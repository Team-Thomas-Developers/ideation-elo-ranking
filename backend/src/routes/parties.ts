import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { generatePartyCode } from '../lib/partyCode';
import { getAuthenticatedUser } from '../lib/auth';

// ============================================================
// PARTY / ROOM ROUTES
// ------------------------------------------------------------
// The "party room + room leader" system. A user creates a party
// and becomes its LEADER; others join with the code. The leader
// controls when the session starts.
//
// The caller is identified from the verified Supabase JWT
// (Authorization: Bearer <access_token>), never from the body.
// ============================================================

const router = Router();

type PartyRow = {
  id: string;
  code: string;
  room_name: string;
  leader_id: string;
  status: 'lobby' | 'active' | 'done';
};

// Auth users live in auth.users, but our parties/party_members FKs
// point at the public `users` table — so mirror the signed-in user
// into `users` before we reference them. Also keeps roster names fresh.
async function ensureUserRow(user: { id: string; email?: string; user_metadata?: any }) {
  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Player';
  await supabase
    .from('users')
    .upsert({ id: user.id, email: user.email ?? null, name }, { onConflict: 'id' });
}

// Shape a party + its members into one response object.
async function loadPartyWithMembers(partyId: string) {
  const { data: party, error: pErr } = await supabase
    .from('parties')
    .select('id, code, room_name, leader_id, status')
    .eq('id', partyId)
    .single();
  if (pErr || !party) return null;

  const { data: members } = await supabase
    .from('party_members')
    .select('user_id, is_leader, joined_at, users ( id, name, email )')
    .eq('party_id', partyId)
    .order('joined_at', { ascending: true });

  // flatten the joined user fields onto each member row for the frontend
  const roster = (members ?? []).map((m: any) => ({
    user_id: m.user_id,
    is_leader: m.is_leader,
    joined_at: m.joined_at,
    name: m.users?.name ?? 'Player',
    email: m.users?.email ?? null,
  }));

  return { ...party, members: roster };
}

// --- Get the current party for the signed-in user (if any). --
// NOTE: must be declared before "/:partyId" so it isn't captured.
router.get('/me', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'auth required' });

  const { data: membership } = await supabase
    .from('party_members')
    .select('party_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!membership) return res.json({ party: null });

  const party = await loadPartyWithMembers(membership.party_id);
  if (!party || party.status === 'done') {
    return res.json({ party: null });
  }

  res.json({ party });
});

// --- Create a party. Caller becomes the room leader. ----------
router.post('/create', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'auth required' });
  await ensureUserRow(user);

  // generate a unique join code (retry on the rare collision)
  let code = '';
  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate = generatePartyCode();
    const { data: existing } = await supabase
      .from('parties')
      .select('id')
      .eq('code', candidate)
      .maybeSingle();
    if (!existing) {
      code = candidate;
      break;
    }
  }
  if (!code) return res.status(500).json({ error: 'could not allocate code' });

  const { roomName } = req.body ?? {};
  const { data: party, error } = await supabase
    .from('parties')
    .insert({
      code,
      room_name: roomName?.trim() || 'New Room',
      leader_id: user.id,
      status: 'lobby',
    })
    .select('id')
    .single();
  if (error || !party) return res.status(500).json({ error: error?.message });

  // leader joins their own room
  await supabase
    .from('party_members')
    .insert({ party_id: party.id, user_id: user.id, is_leader: true });

  res.json(await loadPartyWithMembers(party.id));
});

// --- Join an existing party by code. -------------------------
router.post('/join', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'auth required' });
  const { code } = req.body ?? {};
  if (!code) return res.status(400).json({ error: 'code required' });
  await ensureUserRow(user);

  const { data: party } = await supabase
    .from('parties')
    .select('id, status')
    .eq('code', String(code).trim().toUpperCase())
    .maybeSingle();
  if (!party) return res.status(404).json({ error: 'room not found' });
  if (party.status !== 'lobby')
    return res.status(409).json({ error: 'room is not accepting players' });

  // upsert membership (a user joins a room at most once)
  const { error } = await supabase
    .from('party_members')
    .upsert(
      { party_id: party.id, user_id: user.id, is_leader: false },
      { onConflict: 'party_id,user_id', ignoreDuplicates: true }
    );
  if (error) return res.status(500).json({ error: error.message });

  res.json(await loadPartyWithMembers(party.id));
});

// --- Get one party (room state + roster). --------------------
router.get('/:partyId', async (req, res) => {
  const party = await loadPartyWithMembers(req.params.partyId);
  if (!party) return res.status(404).json({ error: 'room not found' });
  res.json(party);
});

// --- Start the session. LEADER ONLY. lobby -> active. --------
router.post('/:partyId/start', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'auth required' });

  const { data: party } = await supabase
    .from('parties')
    .select('id, leader_id, status')
    .eq('id', req.params.partyId)
    .maybeSingle<PartyRow>();
  if (!party) return res.status(404).json({ error: 'room not found' });
  if (party.leader_id !== user.id)
    return res.status(403).json({ error: 'only the room leader can start' });
  if (party.status !== 'lobby')
    return res.status(409).json({ error: 'room already started' });

  await supabase.from('parties').update({ status: 'active' }).eq('id', party.id);

  // open the first round for this room (status = true => round open)
  const { data: round, error: roundInsertError } = await supabase
    .from('rounds')
    .insert({ party_id: party.id, round_num: 1, status: true })
    .select('id, round_num')
    .single();
  if (roundInsertError) throw roundInsertError;

  // create matchups for every current party member
  const { data: members, error: membersError } = await supabase
    .from('party_members')
    .select('user_id')
    .eq('party_id', party.id);
  if (membersError) throw membersError;

  const { data: ideas, error: ideasError } = await supabase
    .from('ideas')
    .select('id');
  if (ideasError) throw ideasError;
  if (!ideas || ideas.length < 2) {
    // nothing to insert — leave room active but no matchups
    return res.json(await loadPartyWithMembers(party.id));
  }

  // for each member, pick two random distinct ideas and create a matchup
  const ideaIds = (ideas as any[]).map((i) => i.id);
  const matchups = (members ?? []).map((m: any) => {
    // pick two distinct random indices
    const a = Math.floor(Math.random() * ideaIds.length);
    let b = Math.floor(Math.random() * ideaIds.length);
    if (b === a) b = (b + 1) % ideaIds.length;
    return {
      round_id: round.id,
      user_id: m.user_id,
      idea_a: ideaIds[a],
      idea_b: ideaIds[b],
      status: false,
    };
  });

  const { error: matchupsError } = await supabase.from('matchups').insert(matchups);
  if (matchupsError) throw matchupsError;

  res.json(await loadPartyWithMembers(party.id));
});

// --- Leave a party. If the leader leaves, hand off the role. -
router.post('/:partyId/leave', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'auth required' });
  const partyId = req.params.partyId;

  await supabase
    .from('party_members')
    .delete()
    .eq('party_id', partyId)
    .eq('user_id', user.id);

  const { data: party } = await supabase
    .from('parties')
    .select('id, leader_id')
    .eq('id', partyId)
    .maybeSingle<PartyRow>();
  if (!party) return res.json({ party: null });

  // if the leader left, promote the earliest-joined remaining member
  if (party.leader_id === user.id) {
    const { data: next } = await supabase
      .from('party_members')
      .select('user_id')
      .eq('party_id', partyId)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (next) {
      await supabase.from('parties').update({ leader_id: next.user_id }).eq('id', partyId);
      await supabase
        .from('party_members')
        .update({ is_leader: true })
        .eq('party_id', partyId)
        .eq('user_id', next.user_id);
    } else {
      // room is empty — clean it up
      await supabase.from('parties').delete().eq('id', partyId);
      return res.json({ party: null });
    }
  }

  res.json({ party: await loadPartyWithMembers(partyId) });
});

export default router;
