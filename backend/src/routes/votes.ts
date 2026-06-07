import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { applyVote } from '../services/ratings';
import { Matchup } from '../types';

const router = Router();

// post /api/votes { matchup_id, winner_id } — record a vote and apply its elo effects
router.post('/', async (req, res) => {
  try {
    const { matchup_id, winner_id } = req.body ?? {};
    if (!matchup_id || !winner_id) {
      res.status(400).json({ error: 'matchup_id and winner_id are required' });
      return;
    }

    const { data: matchup, error } = await supabase
      .from('matchups')
      .select('id, round_id, user_id, idea_a, idea_b, status')
      .eq('id', matchup_id)
      .maybeSingle();
    if (error) throw error;
    if (!matchup) {
      res.status(404).json({ error: 'matchup not found' });
      return;
    }

    const m = matchup as Matchup;
    if (m.status) {
      res.status(409).json({ error: 'matchup already voted on' });
      return;
    }
    if (winner_id !== m.idea_a && winner_id !== m.idea_b) {
      res.status(400).json({ error: 'winner_id must be one of the matchup ideas' });
      return;
    }

    const outcome = await applyVote(m, winner_id);
    res.status(201).json({ matchup_id: m.id, round_id: m.round_id, ...outcome });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
