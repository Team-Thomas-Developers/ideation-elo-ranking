import { supabase } from '../supabaseClient'

const API =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  'http://localhost:3001'

async function request(path, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token

  const res = await fetch(`${API}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
      ...(options.headers || {}),
    },
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { data: null, error: data.error || `Request failed (${res.status})` }
  }
  return { data, error: null }
}

export const getCurrentRound = () => request('/rounds/current')

export const getIdeas = () => request('/ideas')

export const voteMatchup = (matchupId, winnerId) =>
  request('/votes', {
    method: 'POST',
    body: JSON.stringify({ matchup_id: matchupId, winner_id: winnerId }),
  })
