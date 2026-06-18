import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { generatePartyCode } from '../lib/partyCode';

// ============================================================
// PARTY / ROOM ROUTES
// ------------------------------------------------------------
// The "party room + room leader" system. A user creates a party
// and becomes its LEADER; others join with the code. The leader
// controls when the session starts.
//
// NOTE: these handlers take `userId` in the body for simplicity.
// In production you'd read it from the verified Supabase JWT
// instead of trusting the client. Left as a TODO for the devs.
// ============================================================

const router = Router();

type PartyRow = {
  id: string;
  code: string;
  room_name: string;
  leader_id: string;
  status: 'lobby' | 'active' | 'done';
};

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

  return { ...party, members: members ?? [] };
}

// --- Create a party. Caller becomes the room leader. ----------
router.post('/create', async (req, res) => {
  const { userId, roomName } = req.body ?? {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

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

  const { data: party, error } = await supabase
    .from('parties')
    .insert({
      code,
      room_name: roomName?.trim() || 'New Room',
      leader_id: userId,
      status: 'lobby',
    })
    .select('id')
    .single();
  if (error || !party) return res.status(500).json({ error: error?.message });

  // leader joins their own room
  await supabase
    .from('party_members')
    .insert({ party_id: party.id, user_id: userId, is_leader: true });

  res.json(await loadPartyWithMembers(party.id));
});

// --- Join an existing party by code. -------------------------
router.post('/join', async (req, res) => {
  const { userId, code } = req.body ?? {};
  if (!userId || !code) return res.status(400).json({ error: 'userId and code required' });

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
      { party_id: party.id, user_id: userId, is_leader: false },
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

// --- Get the current party for a user (if any). --------------
router.get('/me/:userId', async (req, res) => {
  const { data: membership } = await supabase
    .from('party_members')
    .select('party_id')
    .eq('user_id', req.params.userId)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!membership) return res.json({ party: null });
  res.json({ party: await loadPartyWithMembers(membership.party_id) });
});

// --- Start the session. LEADER ONLY. lobby -> active. --------
router.post('/:partyId/start', async (req, res) => {
  const { userId } = req.body ?? {};
  const { data: party } = await supabase
    .from('parties')
    .select('id, leader_id, status')
    .eq('id', req.params.partyId)
    .maybeSingle<PartyRow>();
  if (!party) return res.status(404).json({ error: 'room not found' });
  if (party.leader_id !== userId)
    return res.status(403).json({ error: 'only the room leader can start' });
  if (party.status !== 'lobby')
    return res.status(409).json({ error: 'room already started' });

  await supabase.from('parties').update({ status: 'active' }).eq('id', party.id);

  // open the first round for this room (status = true => round open)
  await supabase
    .from('rounds')
    .insert({ party_id: party.id, round_num: 1, status: true });

  res.json(await loadPartyWithMembers(party.id));
});

// --- Leave a party. If the leader leaves, hand off the role. -
router.post('/:partyId/leave', async (req, res) => {
  const { userId } = req.body ?? {};
  const partyId = req.params.partyId;

  await supabase
    .from('party_members')
    .delete()
    .eq('party_id', partyId)
    .eq('user_id', userId);

  const { data: party } = await supabase
    .from('parties')
    .select('id, leader_id')
    .eq('id', partyId)
    .maybeSingle<PartyRow>();
  if (!party) return res.json({ party: null });

  // if the leader left, promote the earliest-joined remaining member
  if (party.leader_id === userId) {
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
