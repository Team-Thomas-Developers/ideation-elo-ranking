import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

// Score and rank history ordered chronologically for the leaderboard chart.
router.get('/history', async (_req, res) => {
  try {
    const [
      { data: historyRows, error: historyError },
      { data: rounds, error: roundsError },
    ] = await Promise.all([
      supabase
        .from('scorehistory')
        .select('id, idea_id, round_id, score_after_round, rank_after_round'),
      supabase.from('rounds').select('id, round_num'),
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
