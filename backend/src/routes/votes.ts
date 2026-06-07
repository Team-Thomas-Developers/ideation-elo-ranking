import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { calculateNewRatings } from '../elo/elo';
import { countMatchupsPlayed, recomputeRanks } from '../services/ratings';
import { Idea, Matchup } from '../types';

const router = Router();

// post /api/votes body { matchup_id, winner_id } — record a vote, recompute both ideas' scores, refresh all ranks, and append to scorehistory
router.post('/', async (req, res) => {
  try {
    const { matchup_id, winner_id } = req.body ?? {};
    if (!matchup_id || !winner_id) {
      res.status(400).json({ error: 'matchup_id and winner_id are required' });
      return;
    }

    const { data: matchup, error: matchupError } = await supabase
      .from('matchups')
      .select('id, round_id, user_id, idea_a, idea_b, status')
      .eq('id', matchup_id)
      .maybeSingle();
    if (matchupError) throw matchupError;
    if (!matchup) {
      res.status(404).json({ error: 'Matchup not found' });
      return;
    }

    const m = matchup as Matchup;
    if (m.status) {
      res.status(409).json({ error: 'This matchup has already been voted on' });
      return;
    }
    if (winner_id !== m.idea_a && winner_id !== m.idea_b) {
      res.status(400).json({ error: 'winner_id must be one of the matchup ideas' });
      return;
    }

    const loser_id = winner_id === m.idea_a ? m.idea_b : m.idea_a;

    // current scores for the two ideas
    const { data: ideaRows, error: ideasError } = await supabase
      .from('ideas')
      .select('id, title, desc, curr_score, curr_rank')
      .in('id', [winner_id, loser_id]);
    if (ideasError) throw ideasError;
    const ideas = (ideaRows ?? []) as Idea[];
    const winner = ideas.find((i) => i.id === winner_id);
    const loser = ideas.find((i) => i.id === loser_id);
    if (!winner || !loser) {
      res.status(404).json({ error: 'One or both ideas in the matchup no longer exist' });
      return;
    }

    // matchups played so far (before this vote) drives each idea's k-factor
    const [winnerMatchups, loserMatchups] = await Promise.all([
      countMatchupsPlayed(winner_id),
      countMatchupsPlayed(loser_id),
    ]);

    const { winnerScore, loserScore } = calculateNewRatings(
      winner.curr_score,
      loser.curr_score,
      winnerMatchups,
      loserMatchups,
    );

    // apply new scores
    const updateWinner = supabase
      .from('ideas')
      .update({ curr_score: winnerScore })
      .eq('id', winner_id);
    const updateLoser = supabase
      .from('ideas')
      .update({ curr_score: loserScore })
      .eq('id', loser_id);
    const [{ error: wErr }, { error: lErr }] = await Promise.all([updateWinner, updateLoser]);
    if (wErr) throw wErr;
    if (lErr) throw lErr;

    // record the vote and close the matchup
    const { error: voteError } = await supabase.from('votes').insert({
      matchup_id: m.id,
      user_id: m.user_id,
      winner_id,
      loser_id,
    });
    if (voteError) throw voteError;

    const { error: closeError } = await supabase
      .from('matchups')
      .update({ status: true })
      .eq('id', m.id);
    if (closeError) throw closeError;

    // refresh ranks across all ideas, then snapshot the two we touched
    const ranked = await recomputeRanks();
    const rankById = new Map(ranked.map((i) => [i.id, i.curr_rank]));

    const historyRows = [
      {
        idea_id: winner_id,
        round_id: m.round_id,
        score_after_round: winnerScore,
        rank_after_round: rankById.get(winner_id) ?? winner.curr_rank,
      },
      {
        idea_id: loser_id,
        round_id: m.round_id,
        score_after_round: loserScore,
        rank_after_round: rankById.get(loser_id) ?? loser.curr_rank,
      },
    ];
    const { error: historyError } = await supabase.from('scorehistory').insert(historyRows);
    if (historyError) throw historyError;

    res.status(201).json({
      matchup_id: m.id,
      round_id: m.round_id,
      winner: {
        id: winner_id,
        score_before: winner.curr_score,
        score_after: winnerScore,
        rank_after: rankById.get(winner_id),
      },
      loser: {
        id: loser_id,
        score_before: loser.curr_score,
        score_after: loserScore,
        rank_after: rankById.get(loser_id),
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
