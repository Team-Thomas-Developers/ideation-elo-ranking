import { Router } from "express";
import { supabase } from "../lib/supabase";
import { getAuthenticatedUser } from "../lib/auth";

const router = Router();

type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: any;
};

function ideaPayload(row: any) {
  return {
    id: row.id,
    title: row.title,
    description: row.desc ?? "",
    curr_score: row.curr_score,
    curr_rank: row.curr_rank,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

async function ensureUserRow(user: SupabaseUser) {
  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Player";

  await supabase
    .from("users")
    .upsert(
      { id: user.id, email: user.email ?? null, name },
      { onConflict: "id" },
    );
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

// ideas ranked by score, best first
router.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("ideas")
    .select("id, title, desc, curr_score, curr_rank, created_by, created_at")
    .order("curr_rank", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json((data ?? []).map(ideaPayload));
});

router.get("/mine", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: "auth required" });

  const { data, error } = await supabase
    .from("ideas")
    .select("id, title, desc, curr_score, curr_rank, created_by, created_at")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json((data ?? []).map(ideaPayload));
});

router.post("/", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: "auth required" });

  const title = cleanText(req.body?.title);
  const description = cleanText(req.body?.description);
  if (!title) return res.status(400).json({ error: "idea name is required" });

  await ensureUserRow(user);

  const { data: rankRows, error: rankError } = await supabase
    .from("ideas")
    .select("curr_rank")
    .order("curr_rank", { ascending: false, nullsFirst: false })
    .limit(1);
  if (rankError) return res.status(500).json({ error: rankError.message });

  const nextRank = Number(rankRows?.[0]?.curr_rank ?? 0) + 1;

  const { data, error } = await supabase
    .from("ideas")
    .insert({
      title,
      desc: description,
      created_by: user.id,
      curr_score: 1000,
      curr_rank: nextRank,
    })
    .select("id, title, desc, curr_score, curr_rank, created_by, created_at")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(ideaPayload(data));
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
  if (existing.created_by !== user.id) {
    return res.status(403).json({ error: "you can only edit your own ideas" });
  }

  const { data, error } = await supabase
    .from("ideas")
    .update({
      title,
      desc: description,
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.params.ideaId)
    .select("id, title, desc, curr_score, curr_rank, created_by, created_at")
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
  if (existing.created_by !== user.id) {
    return res
      .status(403)
      .json({ error: "you can only delete your own ideas" });
  }

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

  const { error } = await supabase.from("ideas").delete().eq("id", ideaId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ id: ideaId });
});

export default router;
