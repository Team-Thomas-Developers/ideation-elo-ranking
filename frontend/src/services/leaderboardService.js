import { getLeaderboard as getLeaderboardApi } from '../lib/gameApi.js'
import {
  getSupabaseCurrentRound,
  getSupabaseScoreHistory,
} from './supabaseLeaderboardService.js'

function mapLeaderboardRow(row) {
  return {
    id: row.id,
    name: row.title,
    elo: row.curr_score,
    rating: row.overall_rating ?? null,
    rank: row.curr_rank,
    scores: row.scores ?? [],
  }
}

export async function getLeaderboard() {
  const { data, error } = await getLeaderboardApi()
  if (error) throw new Error(error)
  return (data ?? []).map(mapLeaderboardRow)
}

export async function getCurrentRound() {
  return getSupabaseCurrentRound()
}

export async function getScoreHistory() {
  return getSupabaseScoreHistory()
}
