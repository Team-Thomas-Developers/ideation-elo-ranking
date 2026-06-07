// db helpers for the elo routes. supabase-js has no transactions, so these run
// as ordered awaits and could race under concurrent votes

import { supabase } from '../lib/supabase';
import { calculateNewRatings } from '../elo/elo';
import { Idea, Matchup } from '../types';

export interface VoteSide {
  id: string;
  score_before: number;
  score_after: number;
  rank_after?: number;
}

export interface VoteOutcome {
  winner: VoteSide;
  loser: VoteSide;
}

// matchups an idea has played, from its vote count (drives the k-factor)
export async function countMatchupsPlayed(ideaId: string): Promise<number> {
  const { count, error } = await supabase
    .from('votes')
    .select('id', { count: 'exact', head: true })
    .or(`winner_id.eq.${ideaId},loser_id.eq.${ideaId}`);

  if (error) throw error;
  return count ?? 0;
}

// re-rank every idea by score (1 = highest), returns them in ranked order
export async function recomputeRanks(): Promise<Idea[]> {
  const { data: ideas, error } = await supabase
    .from('ideas')
    .select('id, title, desc, curr_score, curr_rank')
    .order('curr_score', { ascending: false });

  if (error) throw error;
  if (!ideas) return [];

  const ranked: Idea[] = [];
  for (let i = 0; i < ideas.length; i++) {
    const rank = i + 1;
    const idea = ideas[i] as Idea;
    if (idea.curr_rank !== rank) {
      const { error: updateError } = await supabase
        .from('ideas')
        .update({ curr_rank: rank })
        .eq('id', idea.id);
      if (updateError) throw updateError;
    }
    ranked.push({ ...idea, curr_rank: rank });
  }

  return ranked;
}

// write one idea's score
function setScore(id: string, score: number) {
  return supabase.from('ideas').update({ curr_score: score }).eq('id', id);
}

// apply a vote: rescore both ideas, re-rank, log to scorehistory
export async function applyVote(matchup: Matchup, winnerId: string): Promise<VoteOutcome> {
  const loserId = winnerId === matchup.idea_a ? matchup.idea_b : matchup.idea_a;

  const { data, error } = await supabase
    .from('ideas')
    .select('id, curr_score')
    .in('id', [winnerId, loserId]);
  if (error) throw error;
  const winner = (data ?? []).find((i) => i.id === winnerId);
  const loser = (data ?? []).find((i) => i.id === loserId);
  if (!winner || !loser) throw new Error('an idea in this matchup no longer exists');

  const [winnerPlayed, loserPlayed] = await Promise.all([
    countMatchupsPlayed(winnerId),
    countMatchupsPlayed(loserId),
  ]);
  const { winnerScore, loserScore } = calculateNewRatings(
    winner.curr_score,
    loser.curr_score,
    winnerPlayed,
    loserPlayed,
  );

  const [w, l] = await Promise.all([
    setScore(winnerId, winnerScore),
    setScore(loserId, loserScore),
  ]);
  if (w.error) throw w.error;
  if (l.error) throw l.error;

  const { error: voteError } = await supabase.from('votes').insert({
    matchup_id: matchup.id,
    user_id: matchup.user_id,
    winner_id: winnerId,
    loser_id: loserId,
  });
  if (voteError) throw voteError;

  const { error: closeError } = await supabase
    .from('matchups')
    .update({ status: true })
    .eq('id', matchup.id);
  if (closeError) throw closeError;

  const ranked = await recomputeRanks();
  const rankOf = (id: string) => ranked.find((i) => i.id === id)?.curr_rank;

  const sides: VoteSide[] = [
    { id: winnerId, score_before: winner.curr_score, score_after: winnerScore, rank_after: rankOf(winnerId) },
    { id: loserId, score_before: loser.curr_score, score_after: loserScore, rank_after: rankOf(loserId) },
  ];

  const { error: historyError } = await supabase.from('scorehistory').insert(
    sides.map((s) => ({
      idea_id: s.id,
      round_id: matchup.round_id,
      score_after_round: s.score_after,
      rank_after_round: s.rank_after,
    })),
  );
  if (historyError) throw historyError;

  return { winner: sides[0], loser: sides[1] };
}
