const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function request(path, token, options = {}) {
  const res = await fetch(`${API}/api/ideas${path}`, {
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

export const getMyIdeas = (token) => request('/mine', token)

export const createIdea = (token, payload) =>
  request('/', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateIdea = (token, id, payload) =>
  request(`/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const deleteIdea = (token, id) =>
  request(`/${id}`, token, { method: 'DELETE' })
