import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { Round } from '../types';
import { getAuthenticatedUser } from '../lib/auth';

const router = Router();

// list rounds, newest first
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('rounds')
    .select('id, round_num, status')
    .order('round_num', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

// Active round, aggregate progress, and the signed-in user's assigned matchups.
router.get('/current', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'auth required' });
      return;
    }

    const { data: membership, error: membershipError } = await supabase
      .from('party_members')
      .select('party_id')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) {
      res.status(404).json({ error: 'No party membership found' });
      return;
    }

    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .select('id, round_num, status')
      .eq('party_id', membership.party_id)
      .eq('status', true)
      .order('round_num', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roundError) throw roundError;
    if (!round) {
      res.status(404).json({ error: 'No active round for your party' });
      return;
    }

    const { data: matchups, error: matchupsError } = await supabase
      .from('matchups')
      .select('id, user_id, idea_a, idea_b, status')
      .eq('round_id', round.id);
    if (matchupsError) throw matchupsError;

    const allMatchups = matchups ?? [];
    const ideaIds = [
      ...new Set(allMatchups.flatMap((matchup) => [matchup.idea_a, matchup.idea_b])),
    ];
    const matchupIds = allMatchups.map((matchup) => matchup.id);

    const [
      { data: ideas, error: ideasError },
      { data: votes, error: votesError },
    ] = await Promise.all([
      ideaIds.length
        ? supabase.from('ideas').select('id, title, desc, curr_score, curr_rank').in('id', ideaIds)
        : Promise.resolve({ data: [], error: null }),
      matchupIds.length
        ? supabase
            .from('votes')
            .select('matchup_id, user_id, winner_id')
            .in('matchup_id', matchupIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (ideasError) throw ideasError;
    if (votesError) throw votesError;

    const ideasById = new Map((ideas ?? []).map((idea) => [idea.id, idea]));
    const userVotes = new Map(
      (votes ?? [])
        .filter((vote) => vote.user_id === user.id)
        .map((vote) => [vote.matchup_id, vote.winner_id]),
    );

    const completedCount = allMatchups.filter((matchup) => matchup.status === true).length;
    const userMatchups = allMatchups.filter((matchup) => matchup.user_id === user.id);

    res.json({
      id: round.id,
      round_number: round.round_num,
      status: 'active',
      total_matchups: allMatchups.length,
      completed_matchups: completedCount,
      votes_cast: votes?.length ?? 0,
      user_matchups: userMatchups.map((matchup) => ({
        id: matchup.id,
        status: matchup.status,
        selected_winner_id: userVotes.get(matchup.id) ?? null,
        idea_a: ideasById.get(matchup.idea_a) ?? null,
        idea_b: ideasById.get(matchup.idea_b) ?? null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// open a new round, closing any active one first
router.post('/', async (_req, res) => {
  try {
    const { error: closeError } = await supabase
      .from('rounds')
      .update({ status: false })
      .eq('status', true);
    if (closeError) throw closeError;

    const { data: latest, error: latestError } = await supabase
      .from('rounds')
      .select('round_num')
      .order('round_num', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;

    const nextNum = (latest?.round_num ?? 0) + 1;

    const { data: round, error: insertError } = await supabase
      .from('rounds')
      .insert({ round_num: nextNum, status: true })
      .select('id, round_num, status')
      .single();
    if (insertError) throw insertError;

    res.status(201).json(round as Round);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
