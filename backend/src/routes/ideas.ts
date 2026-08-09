import { Router } from "express";
import { supabase } from "../lib/supabase";
import { getAuthenticatedUser } from "../lib/auth";
import { recomputeAllRanks } from "../services/ratings";
import { STARTING_ELO } from "../elo/elo";
import { CATEGORY_IDS } from "../lib/categories";
import { computeRatings } from "../lib/rating";

const router = Router();
// Matches the ideas table schema (no created_by/created_at columns — see elo_schema.sql).
const IDEA_SELECT = "id, title, desc, curr_score, curr_rank";
// list select also pulls each idea's per-category ELO for /5 rating
const IDEA_LIST_SELECT =
  IDEA_SELECT + ", idea_scores(category_id, curr_score, curr_rank)";

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
  res.json((data ?? []).map(ideaPayload));
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
    .select("id")
    .eq("id", req.params.ideaId)
    .maybeSingle();

  if (existingError)
    return res.status(500).json({ error: existingError.message });
  if (!existing) return res.status(404).json({ error: "idea not found" });

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
    .select("id")
    .eq("id", req.params.ideaId)
    .maybeSingle();

  if (existingError)
    return res.status(500).json({ error: existingError.message });
  if (!existing) return res.status(404).json({ error: "idea not found" });

  const ideaId = req.params.ideaId;

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
