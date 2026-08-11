import { Router } from "express";
import { supabase } from "../lib/supabase";
import { computeRatings } from "../lib/rating";

const router = Router();

const LEADERBOARD_SELECT =
  "id, title, curr_score, curr_rank, idea_scores(category_id, curr_score, curr_rank)";

// Current standings: every idea with its overall + per-category /5 ratings.
router.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("ideas")
    .select(LEADERBOARD_SELECT);
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

  const payload = rows.map((row: any) => {
    const rated = ratings.get(row.id);
    return {
      id: row.id,
      title: row.title,
      curr_score: row.curr_score,
      curr_rank: row.curr_rank,
      scores: rated?.scores ?? [],
      overall_rating: rated?.overall_rating ?? null,
    };
  });
  payload.sort((a, b) => (b.overall_rating ?? 0) - (a.overall_rating ?? 0));

  res.json(payload);
});

// Score and rank history ordered chronologically for the leaderboard chart.
router.get("/history", async (_req, res) => {
  try {
    const [
      { data: historyRows, error: historyError },
      { data: rounds, error: roundsError },
    ] = await Promise.all([
      supabase
        .from("scorehistory")
        .select("id, idea_id, round_id, score_after_round, rank_after_round"),
      supabase.from("rounds").select("id, round_num"),
    ]);

    if (historyError) throw historyError;
    if (roundsError) throw roundsError;

    const roundNumbers = new Map(
      (rounds ?? []).map((round) => [round.id, round.round_num]),
    );

    const history = (historyRows ?? [])
      .map((entry) => ({
        id: entry.id,
        round_id: entry.round_id,
        round_number: roundNumbers.get(entry.round_id) ?? null,
        idea_id: entry.idea_id,
        score: entry.score_after_round,
        rank: entry.rank_after_round,
      }))
      .sort(
        (first, second) =>
          (first.round_number ?? Number.MAX_SAFE_INTEGER) -
            (second.round_number ?? Number.MAX_SAFE_INTEGER) ||
          first.rank - second.rank,
      );

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
