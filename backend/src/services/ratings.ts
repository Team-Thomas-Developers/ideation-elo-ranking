// db helpers for the elo routes.
// Ideas are ranked per category: each idea has one ELO per category in the
// `idea_scores` table. A matchup vote records a winner per category, and the
// idea's overall rank comes from the mean of its five /5 category ratings

import { supabase } from "../lib/supabase";
import { calculateNewRatings } from "../elo/elo";
import { CATEGORY_IDS } from "../lib/categories";
import { computeRatings } from "../lib/rating";
import { Matchup } from "../types";

export interface CategorySide {
  id: string;
  score_before: number;
  score_after: number;
}

export interface CategoryOutcome {
  category_id: string;
  winner: CategorySide;
  loser: CategorySide;
}

export interface MatchupOutcome {
  matchup_id: string;
  categories: CategoryOutcome[];
}

// matchups an idea has played in one category, from its vote count there
// (drives the per-category k-factor)
export async function countMatchupsPlayed(
  ideaId: string,
  categoryId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId)
    .or(`winner_id.eq.${ideaId},loser_id.eq.${ideaId}`);

  if (error) throw error;
  return count ?? 0;
}

// apply one category's vote: rescore both ideas in that category, record the vote
async function applyCategoryVote(
  matchup: Matchup,
  categoryId: string,
  winnerId: string,
): Promise<CategoryOutcome> {
  const loserId = winnerId === matchup.idea_a ? matchup.idea_b : matchup.idea_a;

  const { data, error } = await supabase
    .from("idea_scores")
    .select("idea_id, curr_score")
    .eq("category_id", categoryId)
    .in("idea_id", [winnerId, loserId]);
  if (error) throw error;
  const winner = (data ?? []).find((s) => s.idea_id === winnerId);
  const loser = (data ?? []).find((s) => s.idea_id === loserId);
  if (!winner || !loser) {
    throw new Error(`missing idea_scores for category ${categoryId}`);
  }

  const [winnerPlayed, loserPlayed] = await Promise.all([
    countMatchupsPlayed(winnerId, categoryId),
    countMatchupsPlayed(loserId, categoryId),
  ]);
  const { winnerScore, loserScore } = calculateNewRatings(
    winner.curr_score,
    loser.curr_score,
    winnerPlayed,
    loserPlayed,
  );

  const [w, l] = await Promise.all([
    supabase
      .from("idea_scores")
      .update({ curr_score: winnerScore, updated_at: new Date().toISOString() })
      .eq("category_id", categoryId)
      .eq("idea_id", winnerId),
    supabase
      .from("idea_scores")
      .update({ curr_score: loserScore, updated_at: new Date().toISOString() })
      .eq("category_id", categoryId)
      .eq("idea_id", loserId),
  ]);
  if (w.error) throw w.error;
  if (l.error) throw l.error;

  const { error: voteError } = await supabase.from("votes").insert({
    matchup_id: matchup.id,
    user_id: matchup.user_id,
    winner_id: winnerId,
    loser_id: loserId,
    category_id: categoryId,
  });
  if (voteError) throw voteError;

  return {
    category_id: categoryId,
    winner: {
      id: winnerId,
      score_before: winner.curr_score,
      score_after: winnerScore,
    },
    loser: {
      id: loserId,
      score_before: loser.curr_score,
      score_after: loserScore,
    },
  };
}

// re-rank every idea within one category (1 = highest score)
async function recomputeCategoryRanks(categoryId: string): Promise<void> {
  const { data: scores, error } = await supabase
    .from("idea_scores")
    .select("idea_id, curr_rank")
    .eq("category_id", categoryId)
    .order("curr_score", { ascending: false });
  if (error) throw error;
  if (!scores) return;

  for (let i = 0; i < scores.length; i++) {
    const rank = i + 1;
    if (scores[i].curr_rank !== rank) {
      const { error: updateError } = await supabase
        .from("idea_scores")
        .update({ curr_rank: rank })
        .eq("category_id", categoryId)
        .eq("idea_id", scores[i].idea_id);
      if (updateError) throw updateError;
    }
  }
}

// recompute each idea's overall: curr_score = raw avg ELO (for the score chart),
// curr_rank = order by the overall /5 rating (mean of the five category ratings)
export async function recomputeOverall(): Promise<void> {
  const { data: ideas, error } = await supabase.from("ideas").select("id");
  if (error) throw error;
  if (!ideas) return;

  const { data: allScores, error: scoresError } = await supabase
    .from("idea_scores")
    .select("idea_id, category_id, curr_score");
  if (scoresError) throw scoresError;

  const scoresByIdea = new Map<
    string,
    { category_id: string; curr_score: number }[]
  >();
  for (const row of allScores ?? []) {
    const list = scoresByIdea.get(row.idea_id) ?? [];
    list.push({ category_id: row.category_id, curr_score: row.curr_score });
    scoresByIdea.set(row.idea_id, list);
  }

  const ratings = computeRatings(
    ideas.map((i) => ({ id: i.id, scores: scoresByIdea.get(i.id) ?? [] })),
  );

  // rank by overall /5 (highest first); tie-break by raw average ELO
  const rawAvg = (id: string) => {
    const list = scoresByIdea.get(id) ?? [];
    if (list.length === 0) return 1200;
    return list.reduce((sum, s) => sum + s.curr_score, 0) / list.length;
  };

  const ordered = [...ideas].sort((a, b) => {
    const diff =
      (ratings.get(b.id)?.overall_rating ?? 0) -
      (ratings.get(a.id)?.overall_rating ?? 0);
    return diff !== 0 ? diff : rawAvg(b.id) - rawAvg(a.id);
  });

  for (let i = 0; i < ordered.length; i++) {
    const { error: updateError } = await supabase
      .from("ideas")
      .update({
        curr_rank: i + 1,
        curr_score: Math.round(rawAvg(ordered[i].id)),
      })
      .eq("id", ordered[i].id);
    if (updateError) throw updateError;
  }
}

// recompute every category rank plus the overall ranking. Used after votes and
// after ideas are created/deleted.
export async function recomputeAllRanks(): Promise<void> {
  for (const categoryId of CATEGORY_IDS) {
    await recomputeCategoryRanks(categoryId);
  }
  await recomputeOverall();
}

// apply a full matchup vote: one winner per category, then re-rank everything
export async function applyMatchupVotes(
  matchup: Matchup,
  winnersByCategory: Record<string, string>,
): Promise<MatchupOutcome> {
  const categories: CategoryOutcome[] = [];
  for (const categoryId of CATEGORY_IDS) {
    categories.push(
      await applyCategoryVote(
        matchup,
        categoryId,
        winnersByCategory[categoryId],
      ),
    );
  }

  const { error: closeError } = await supabase
    .from("matchups")
    .update({ status: true })
    .eq("id", matchup.id);
  if (closeError) throw closeError;

  await recomputeAllRanks();

  // snapshot the two ideas' overall score/rank for the score-history chart
  const { data: updated, error: updatedError } = await supabase
    .from("ideas")
    .select("id, curr_score, curr_rank")
    .in("id", [matchup.idea_a, matchup.idea_b]);
  if (updatedError) throw updatedError;

  const { error: historyError } = await supabase.from("scorehistory").insert(
    (updated ?? []).map((u) => ({
      idea_id: u.id,
      round_id: matchup.round_id,
      score_after_round: u.curr_score,
      rank_after_round: u.curr_rank,
    })),
  );
  if (historyError) throw historyError;

  return { matchup_id: matchup.id, categories };
}
