// Party game engine: matchup generation + automatic round advancement.
//
// The leader only presses "Start". After that this module runs the game:
//   - each round hands every member one idea-pair they haven't been shown yet
//   - when everyone in a round has voted, the round closes and the next one
//     opens automatically
//   - once every unique idea-pair has been compared, the party is marked done
//
// Full pairwise coverage is what turns a pile of votes into a real ranking:
// every idea gets compared against every other idea at least once.

import { supabase } from '../lib/supabase';

// every unique unordered pair of ideas
function allPairs(ids: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push([ids[i], ids[j]]);
    }
  }
  return pairs;
}

// order-independent key so (a,b) and (b,a) count as the same pairing
function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// every idea-pair already assigned as a matchup anywhere in this party
async function usedPairKeys(partyId: string): Promise<Set<string>> {
  const { data: rounds, error: roundsError } = await supabase
    .from('rounds')
    .select('id')
    .eq('party_id', partyId);
  if (roundsError) throw roundsError;

  const roundIds = (rounds ?? []).map((r) => r.id);
  if (roundIds.length === 0) return new Set();

  const { data: matchups, error: matchupsError } = await supabase
    .from('matchups')
    .select('idea_a, idea_b')
    .in('round_id', roundIds);
  if (matchupsError) throw matchupsError;

  return new Set((matchups ?? []).map((m) => pairKey(m.idea_a, m.idea_b)));
}

// Assign one not-yet-seen pair to each member for this round.
// Returns how many matchups were created (0 => nothing left to compare).
export async function generateRoundMatchups(
  partyId: string,
  roundId: string,
): Promise<number> {
  const [{ data: members, error: membersError }, { data: ideas, error: ideasError }] =
    await Promise.all([
      supabase.from('party_members').select('user_id').eq('party_id', partyId),
      supabase.from('ideas').select('id'),
    ]);
  if (membersError) throw membersError;
  if (ideasError) throw ideasError;

  const ideaIds = (ideas ?? []).map((i) => i.id);
  if (ideaIds.length < 2 || !members || members.length === 0) return 0;

  const used = await usedPairKeys(partyId);
  const remaining = shuffle(
    allPairs(ideaIds).filter(([a, b]) => !used.has(pairKey(a, b))),
  );
  if (remaining.length === 0) return 0;

  const rows = [];
  for (const member of members) {
    const pair = remaining.shift();
    if (!pair) break; // fewer unseen pairs than members: the rest sit this round out
    rows.push({
      round_id: roundId,
      user_id: member.user_id,
      idea_a: pair[0],
      idea_b: pair[1],
      status: false,
    });
  }
  if (rows.length === 0) return 0;

  const { error: insertError } = await supabase.from('matchups').insert(rows);
  if (insertError) throw insertError;
  return rows.length;
}

// Called after every vote. If the round is now fully voted, close it and open
// the next one (with fresh pairings). If there are no pairs left to compare,
// finish the party.
export async function advancePartyIfRoundComplete(roundId: string): Promise<void> {
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('id, round_num, party_id, status')
    .eq('id', roundId)
    .maybeSingle();
  if (roundError) throw roundError;
  // only auto-advance party rounds that are still open
  if (!round || !round.party_id || round.status === false) return;

  const [{ count: total }, { count: done }] = await Promise.all([
    supabase.from('matchups').select('id', { count: 'exact', head: true }).eq('round_id', roundId),
    supabase
      .from('matchups')
      .select('id', { count: 'exact', head: true })
      .eq('round_id', roundId)
      .eq('status', true),
  ]);
  // round has no matchups, or not everyone has voted yet
  if (!total || done !== total) return;

  // close the finished round
  await supabase.from('rounds').update({ status: false }).eq('id', roundId);

  // open the next round and deal out the next set of pairings
  const { data: next, error: nextError } = await supabase
    .from('rounds')
    .insert({ party_id: round.party_id, round_num: round.round_num + 1, status: true })
    .select('id')
    .single();
  if (nextError) throw nextError;

  const created = await generateRoundMatchups(round.party_id, next.id);
  if (created === 0) {
    // nothing left to compare: drop the empty round and finish the party
    await supabase.from('rounds').delete().eq('id', next.id);
    await supabase.from('parties').update({ status: 'done' }).eq('id', round.party_id);
  }
}
