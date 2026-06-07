import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { Idea, Matchup } from '../types';

const router = Router();

// fisher-yates shuffle, returns a new array
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// attach full idea objects to each matchup so the client renders without a second call. done in js to avoid depending on supabase fk constraint names
function hydrate(matchups: Matchup[], ideasById: Map<string, Idea>) {
  return matchups.map((m) => ({
    id: m.id,
    round_id: m.round_id,
    user_id: m.user_id,
    status: m.status,
    idea_a: ideasById.get(m.idea_a) ?? null,
    idea_b: ideasById.get(m.idea_b) ?? null,
  }));
}

// get /api/matchups?userId=<uuid>&roundId=<uuid> — this user's pairings for the round, generated on first request. roundId defaults to the active round, each user gets their own random unique pairings
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      res.status(400).json({ error: 'userId query parameter is required' });
      return;
    }

    let roundId = req.query.roundId as string | undefined;
    if (!roundId) {
      const { data: round, error: roundError } = await supabase
        .from('rounds')
        .select('id')
        .eq('status', true)
        .order('round_num', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (roundError) throw roundError;
      if (!round) {
        res.status(404).json({ error: 'No active round. Create one first.' });
        return;
      }
      roundId = round.id;
    }

    const { data: ideas, error: ideasError } = await supabase
      .from('ideas')
      .select('id, title, desc, curr_score, curr_rank');
    if (ideasError) throw ideasError;
    const ideasById = new Map((ideas as Idea[]).map((i) => [i.id, i]));

    // idempotent: if this user already has matchups for the round, return them
    const { data: existing, error: existingError } = await supabase
      .from('matchups')
      .select('id, round_id, user_id, idea_a, idea_b, status')
      .eq('round_id', roundId)
      .eq('user_id', userId);
    if (existingError) throw existingError;

    if (existing && existing.length > 0) {
      res.json(hydrate(existing as Matchup[], ideasById));
      return;
    }

    if (!ideas || ideas.length < 2) {
      res.status(400).json({ error: 'Need at least 2 ideas to build matchups' });
      return;
    }

    // pair shuffled ideas, a leftover odd idea sits this round out
    const order = shuffle(ideas as Idea[]);
    const rows = [];
    for (let i = 0; i + 1 < order.length; i += 2) {
      rows.push({
        round_id: roundId,
        user_id: userId,
        idea_a: order[i].id,
        idea_b: order[i + 1].id,
        status: false,
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from('matchups')
      .insert(rows)
      .select('id, round_id, user_id, idea_a, idea_b, status');
    if (insertError) throw insertError;

    res.status(201).json(hydrate(inserted as Matchup[], ideasById));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
