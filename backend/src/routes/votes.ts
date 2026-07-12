import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { applyMatchupVotes } from '../services/ratings';
import { CATEGORY_IDS } from '../lib/categories';
import { Matchup } from '../types';
import { getAuthenticatedUser } from '../lib/auth';

const router = Router();

// post /api/votes { matchup_id, winners: { <categoryId>: <winnerId> } }
// records one winner per category for the matchup and applies its elo effects
router.post('/', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Valid Supabase bearer token required' });
      return;
    }

    const { matchup_id, winners } = req.body ?? {};
    if (!matchup_id || !winners || typeof winners !== 'object') {
      res
        .status(400)
        .json({ error: 'matchup_id and a winners map are required' });
      return;
    }

    const missing = CATEGORY_IDS.filter((c) => !winners[c]);
    if (missing.length > 0) {
      res
        .status(400)
        .json({ error: `a winner is required for every category: missing ${missing.join(', ')}` });
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
    if (m.user_id !== user.id) {
      res.status(403).json({ error: 'This matchup is assigned to another user' });
      return;
    }

    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .select('status')
      .eq('id', m.round_id)
      .maybeSingle();
    if (roundError) throw roundError;
    if (!round?.status) {
      res.status(409).json({ error: 'Voting is closed for this round' });
      return;
    }

    if (m.status) {
      res.status(409).json({ error: 'matchup already voted on' });
      return;
    }
    const invalid = CATEGORY_IDS.filter(
      (c) => winners[c] !== m.idea_a && winners[c] !== m.idea_b,
    );
    if (invalid.length > 0) {
      res.status(400).json({
        error: `each winner must be one of the matchup ideas (bad: ${invalid.join(', ')})`,
      });
      return;
    }

    const outcome = await applyMatchupVotes(m, winners);

    const { data: roundInfo, error: roundInfoError } = await supabase
      .from('rounds')
      .select('id, party_id')
      .eq('id', m.round_id)
      .maybeSingle();
    if (roundInfoError) throw roundInfoError;

    if (roundInfo?.id) {
      const { count: completedCount, error: completedCountError } = await supabase
        .from('matchups')
        .select('id', { count: 'exact', head: true })
        .eq('round_id', roundInfo.id)
        .eq('status', true);
      if (completedCountError) throw completedCountError;

      const { count: totalCount, error: totalCountError } = await supabase
        .from('matchups')
        .select('id', { count: 'exact', head: true })
        .eq('round_id', roundInfo.id);
      if (totalCountError) throw totalCountError;

      if (typeof completedCount === 'number' && typeof totalCount === 'number' && completedCount === totalCount) {
        await supabase.from('rounds').update({ status: false }).eq('id', roundInfo.id);
        await supabase.from('parties').update({ status: 'done' }).eq('id', roundInfo.party_id);
      }
    }

    res.status(201).json({ round_id: m.round_id, ...outcome });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
