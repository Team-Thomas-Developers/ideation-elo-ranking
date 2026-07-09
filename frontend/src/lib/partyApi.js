// Thin client for the party/room backend. Every call sends the
// Supabase access token so the server can identify the user.
const API =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  'http://localhost:3001'

async function request(path, token, options = {}, basePath = '/api/parties') {
  const res = await fetch(`${API}${basePath}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export const getMyParty = (token) => request('/me', token)

export const createParty = (token, roomName) =>
  request('/create', token, {
    method: 'POST',
    body: JSON.stringify({ roomName }),
  })

export const joinParty = (token, code) =>
  request('/join', token, {
    method: 'POST',
    body: JSON.stringify({ code }),
  })

export const startParty = (token, partyId) =>
  request(`/${partyId}/start`, token, { method: 'POST' })

export const leaveParty = (token, partyId) =>
  request(`/${partyId}/leave`, token, { method: 'POST' })

export const getCurrentRound = (token) =>
  request('/current', token, {}, '/api/rounds')

export const getMatchups = (token, userId, roundId) => {
  const params = new URLSearchParams({ userId })
  if (roundId) params.set('roundId', roundId)
  return request(`/?${params.toString()}`, token, {}, '/api/matchups')
}

// winners: { <categoryId>: <winnerIdeaId> } for all categories
export const submitVote = (token, { matchupId, winners }) =>
  request(
    '/',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ matchup_id: matchupId, winners }),
    },
    '/api/votes',
  )

export const getCategories = (token) =>
  request('/', token, {}, '/api/categories')
