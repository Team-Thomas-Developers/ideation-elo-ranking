import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { applyMatchupVotes } from '../services/ratings';
import { advancePartyIfRoundComplete } from '../services/gameEngine';
import { withLock } from '../lib/mutex';
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

    // Apply the vote and (if the round is now finished) advance the game under
    // a serialization lock. Both steps touch shared ELO/round state, so running
    // them one-at-a-time prevents concurrent votes from clobbering each other
    // (lost updates) or two finishers both opening the next round.
    const outcome = await withLock(async () => {
      const result = await applyMatchupVotes(m, winners);
      await advancePartyIfRoundComplete(m.round_id);
      return result;
    });

    res.status(201).json({ round_id: m.round_id, ...outcome });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
