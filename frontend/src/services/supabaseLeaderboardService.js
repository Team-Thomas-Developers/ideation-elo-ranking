import { supabase } from '../supabaseClient'

function requireSupabase() {
  if (!supabase) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  }

  return supabase
}

export async function getSupabaseLeaderboard() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('ideas')
    .select('id, title, curr_score, curr_rank')
    .order('curr_rank', { ascending: true })

  if (error) throw error
  return data.map((row) => ({
    id: row.id,
    name: row.title,
    elo: row.curr_score,
    rank: row.curr_rank,
    previousRank: row.curr_rank,
    scoreChange: 0,
    roundScore: row.curr_score,
  }))
}

export async function getSupabaseCurrentRound() {
  const client = requireSupabase()
  let { data: round, error } = await client
    .from('rounds')
    .select('id, round_num, status')
    .eq('status', true)
    .order('round_num', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  if (!round) {
    const latestRound = await client
      .from('rounds')
      .select('id, round_num, status')
      .order('round_num', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestRound.error) throw latestRound.error
    round = latestRound.data
  }

  if (!round) return null

  const [
    { count: userCount, error: usersError },
    { data: matchups, error: matchupsError },
  ] = await Promise.all([
    client.from('users').select('id', { count: 'exact', head: true }),
    client.from('matchups').select('id').eq('round_id', round.id),
  ])

  if (usersError) throw usersError
  if (matchupsError) throw matchupsError

  const matchupIds = matchups.map((matchup) => matchup.id)
  let votesCast = 0

  if (matchupIds.length > 0) {
    const { count, error: votesError } = await client
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .in('matchup_id', matchupIds)

    if (votesError) throw votesError
    votesCast = count ?? 0
  }

  return {
    id: round.id,
    round_number: round.round_num,
    status: round.status ? 'active' : 'closed',
    total_voters: (userCount ?? 0) * matchupIds.length,
    votes_cast: votesCast,
  }
}

export async function getSupabaseScoreHistory() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('scorehistory')
    .select(
      'id, idea_id, round_id, score_after_round, rank_after_round, rounds(round_num)',
    )
    .order('round_id', { ascending: true })

  if (error) throw error

  return data.map((entry) => ({
    id: entry.id,
    round_id: entry.round_id,
    roundNumber: entry.rounds?.round_num,
    teamId: entry.idea_id,
    elo: entry.score_after_round,
    score: entry.score_after_round,
    rank: entry.rank_after_round,
  }))
}
