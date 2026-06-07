import {
  mockLeaderboard,
  mockRounds,
  mockScoreHistory,
} from '../data/mockGameData.js'
import {
  getSupabaseCurrentRound,
  getSupabaseLeaderboard,
  getSupabaseScoreHistory,
} from './supabaseLeaderboardService.js'

const MOCK_LATENCY_MS = 250
const useSupabase = import.meta.env.VITE_DATA_SOURCE !== 'mock'
export const dataSource = useSupabase ? 'Supabase' : 'Mock'

function wait(ms = MOCK_LATENCY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function mapLeaderboardRow(row) {
  return {
    id: row.id,
    name: row.name,
    elo: row.elo,
    rank: row.rank,
    previousRank: row.previous_rank,
    scoreChange: row.score_change,
    roundScore: row.round_score,
  }
}

function mapScoreHistoryRow(row) {
  return {
    id: row.id,
    round_id: row.round_id,
    roundNumber: row.round_number,
    teamId: row.team_id,
    elo: row.elo,
    score: row.score,
    rank: row.rank,
  }
}

export async function getLeaderboard() {
  if (useSupabase) {
    return getSupabaseLeaderboard()
  }

  await wait()
  return [...mockLeaderboard]
    .sort((a, b) => a.rank - b.rank)
    .map(mapLeaderboardRow)
}

export async function getCurrentRound() {
  if (useSupabase) {
    return getSupabaseCurrentRound()
  }

  await wait()
  return (
    mockRounds.find((round) => ['active', 'open'].includes(round.status)) ??
    mockRounds.at(-1)
  )
}

export async function getScoreHistory() {
  if (useSupabase) {
    return getSupabaseScoreHistory()
  }

  await wait()
  return [...mockScoreHistory]
    .sort((a, b) => a.round_number - b.round_number)
    .map(mapScoreHistoryRow)
}

export function createRealtimeMockSnapshot(baseLeaderboard, tick) {
  return baseLeaderboard
    .map((team, index) => {
      const wave = Math.round(Math.sin((tick + index) / 2) * 5)
      return {
        ...team,
        elo: team.elo + wave,
        roundScore: team.roundScore + Math.max(wave, -3),
        scoreChange: team.scoreChange + wave,
      }
    })
    .sort((a, b) => b.elo - a.elo)
    .map((team, index) => ({ ...team, rank: index + 1 }))
}

export function getSupabaseSwapExample() {
  return `const { data, error } = await supabase
  .from("scorehistory")
  .select("id, idea_id, score_after_round, rank_after_round, rounds(round_num)")
  .order("round_id", { ascending: true })`
}
