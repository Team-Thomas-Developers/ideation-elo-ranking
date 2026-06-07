// db helpers between the pure elo math and the routes. no real transactions in supabase-js, so these run as ordered awaits and could race under concurrent votes

import { supabase } from '../lib/supabase';
import { Idea } from '../types';

// how many decided matchups an idea has played, for the k-factor. derived from votes since ideas has no counter column
export async function countMatchupsPlayed(ideaId: string): Promise<number> {
  const { count, error } = await supabase
    .from('votes')
    .select('id', { count: 'exact', head: true })
    .or(`winner_id.eq.${ideaId},loser_id.eq.${ideaId}`);

  if (error) throw error;
  return count ?? 0;
}

// re-sort all ideas by score and write back curr_rank (1 = highest), returning them in ranked order
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
