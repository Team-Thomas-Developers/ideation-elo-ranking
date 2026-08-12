import { Router } from "express";
import { supabase } from "../lib/supabase";
import { getAuthenticatedUser } from "../lib/auth";
import { recomputeAllRanks } from "../services/ratings";
import { STARTING_ELO } from "../elo/elo";
import { CATEGORY_IDS } from "../lib/categories";
import { computeRatings } from "../lib/rating";

const router = Router();
const IDEA_SELECT = "id, title, desc, curr_score, curr_rank, created_by";
// list select also pulls each idea's per-category ELO for /5 rating
const IDEA_LIST_SELECT =
  IDEA_SELECT + ", idea_scores(category_id, curr_score, curr_rank)";

// created_by is deliberately not exposed: GET / is public, and the client only
// needs the can_edit flag that /mine derives from it.
function ideaPayload(row: any) {
  return {
    id: row.id,
    title: row.title,
    description: row.desc ?? "",
    curr_score: row.curr_score,
    curr_rank: row.curr_rank,
  };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

// A room host curates the idea pool for their session, so they may edit any
// idea. Everyone else is limited to ideas they submitted themselves.
async function isHost(userId: string) {
  const { data, error } = await supabase
    .from("parties")
    .select("id")
    .eq("leader_id", userId)
    .neq("status", "done")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

// Ideas predating created_by have no recorded author, so only a host can
// manage them — otherwise they would stay editable by anyone.
async function canManageIdea(userId: string, createdBy: string | null) {
  if (createdBy && createdBy === userId) return true;
  return isHost(userId);
}

// Deleting an idea that a running party is still voting on destroys the votes
// cast for its opponents and can strand players on a matchup that no longer
// exists, so it is refused until the session finishes.
async function isIdeaInActiveGame(ideaId: string) {
  const { data: parties, error: partiesError } = await supabase
    .from("parties")
    .select("id")
    .eq("status", "active");
  if (partiesError) throw partiesError;
  const partyIds = (parties ?? []).map((party) => party.id);
  if (partyIds.length === 0) return false;

  const { data: rounds, error: roundsError } = await supabase
    .from("rounds")
    .select("id")
    .in("party_id", partyIds);
  if (roundsError) throw roundsError;
  const roundIds = (rounds ?? []).map((round) => round.id);
  if (roundIds.length === 0) return false;

  const { data: matchups, error: matchupsError } = await supabase
    .from("matchups")
    .select("id")
    .in("round_id", roundIds)
    .or(`idea_a.eq.${ideaId},idea_b.eq.${ideaId}`)
    .limit(1);
  if (matchupsError) throw matchupsError;
  return (matchups ?? []).length > 0;
}

// ideas ranked by overall /5, best first, each with per-category /5 breakdown
router.get("/", async (_req, res) => {
  const { data, error } = await supabase.from("ideas").select(IDEA_LIST_SELECT);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const rows = data ?? [];
  const ratings = computeRatings(
    rows.map((row: any) => ({
      id: row.id,
      scores: (row.idea_scores ?? []).map((s: any) => ({
        category_id: s.category_id,
        curr_score: s.curr_score,
      })),
    })),
  );

  const payloads = rows.map((row: any) => {
    const rated = ratings.get(row.id);
    return {
      ...ideaPayload(row),
      scores: rated?.scores ?? [],
      overall_rating: rated?.overall_rating ?? null,
    };
  });
  payloads.sort((a, b) => (b.overall_rating ?? 0) - (a.overall_rating ?? 0));

  res.json(payloads);
});

router.get("/mine", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: "auth required" });

  const { data, error } = await supabase
    .from("ideas")
    .select(IDEA_SELECT)
    .order("curr_rank", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const host = await isHost(user.id);
  res.json(
    (data ?? []).map((row: any) => ({
      ...ideaPayload(row),
      can_edit: host || row.created_by === user.id,
    })),
  );
});

router.post("/", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: "auth required" });

  const title = cleanText(req.body?.title);
  const description = cleanText(req.body?.description);
  if (!title) return res.status(400).json({ error: "idea name is required" });

  const { data: existingIdea, error: duplicateError } = await supabase
    .from("ideas")
    .select("id")
    .ilike("title", title)
    .maybeSingle();
  if (duplicateError)
    return res.status(500).json({ error: duplicateError.message });
  if (existingIdea) {
    return res
      .status(409)
      .json({ error: "an idea with this name already exists" });
  }

  const { data, error } = await supabase
    .from("ideas")
    .insert({
      title,
      desc: description,
      curr_score: STARTING_ELO,
      curr_rank: 0,
      created_by: user.id,
    })
    .select(IDEA_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // seed a starting ELO row per category for the new idea
  const { error: seedError } = await supabase.from("idea_scores").insert(
    CATEGORY_IDS.map((categoryId) => ({
      idea_id: data.id,
      category_id: categoryId,
      curr_score: STARTING_ELO,
    })),
  );
  if (seedError) return res.status(500).json({ error: seedError.message });

  try {
    await recomputeAllRanks();
  } catch (rankError) {
    return res.status(500).json({ error: (rankError as Error).message });
  }

  const { data: createdIdea, error: createdError } = await supabase
    .from("ideas")
    .select(IDEA_SELECT)
    .eq("id", data.id)
    .single();
  if (createdError)
    return res.status(500).json({ error: createdError.message });

  res.status(201).json(ideaPayload(createdIdea));
});

router.patch("/:ideaId", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: "auth required" });

  const title = cleanText(req.body?.title);
  const description = cleanText(req.body?.description);
  if (!title) return res.status(400).json({ error: "idea name is required" });

  const { data: existing, error: existingError } = await supabase
    .from("ideas")
    .select("id, created_by")
    .eq("id", req.params.ideaId)
    .maybeSingle();

  if (existingError)
    return res.status(500).json({ error: existingError.message });
  if (!existing) return res.status(404).json({ error: "idea not found" });

  if (!(await canManageIdea(user.id, existing.created_by))) {
    return res
      .status(403)
      .json({ error: "only the idea's author or the room host can edit it" });
  }

  const { data: duplicateIdea, error: duplicateError } = await supabase
    .from("ideas")
    .select("id")
    .ilike("title", title)
    .neq("id", req.params.ideaId)
    .maybeSingle();
  if (duplicateError)
    return res.status(500).json({ error: duplicateError.message });
  if (duplicateIdea) {
    return res
      .status(409)
      .json({ error: "an idea with this name already exists" });
  }

  const { data, error } = await supabase
    .from("ideas")
    .update({
      title,
      desc: description,
    })
    .eq("id", req.params.ideaId)
    .select(IDEA_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(ideaPayload(data));
});

router.delete("/:ideaId", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: "auth required" });

  const { data: existing, error: existingError } = await supabase
    .from("ideas")
    .select("id, created_by")
    .eq("id", req.params.ideaId)
    .maybeSingle();

  if (existingError)
    return res.status(500).json({ error: existingError.message });
  if (!existing) return res.status(404).json({ error: "idea not found" });

  if (!(await canManageIdea(user.id, existing.created_by))) {
    return res
      .status(403)
      .json({ error: "only the idea's author or the room host can delete it" });
  }

  const ideaId = req.params.ideaId;

  if (await isIdeaInActiveGame(ideaId)) {
    return res.status(409).json({
      error: "this idea is being voted on right now; delete it after the game",
    });
  }

  const { error: votesError } = await supabase
    .from("votes")
    .delete()
    .or(`winner_id.eq.${ideaId},loser_id.eq.${ideaId}`);
  if (votesError) return res.status(500).json({ error: votesError.message });

  const { error: historyError } = await supabase
    .from("scorehistory")
    .delete()
    .eq("idea_id", ideaId);
  if (historyError)
    return res.status(500).json({ error: historyError.message });

  const { error: matchupsError } = await supabase
    .from("matchups")
    .delete()
    .or(`idea_a.eq.${ideaId},idea_b.eq.${ideaId}`);
  if (matchupsError)
    return res.status(500).json({ error: matchupsError.message });

  // idea_scores rows are removed automatically via on delete cascade
  const { error } = await supabase.from("ideas").delete().eq("id", ideaId);
  if (error) return res.status(500).json({ error: error.message });

  try {
    await recomputeAllRanks();
  } catch (rankError) {
    return res.status(500).json({ error: (rankError as Error).message });
  }

  res.json({ id: ideaId });
});

export default router;
