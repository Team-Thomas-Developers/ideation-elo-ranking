import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserAuth } from '../context/AuthContext'
import {
  getMyParty,
  createParty,
  joinParty,
  startParty,
  leaveParty,
  getCurrentRound,
  submitVote,
  getCategories,
} from '../lib/partyApi'
import './PartyRoom.css'

// ============================================================
// PARTY ROOM  — fully wired to the backend
// ------------------------------------------------------------
// Lobby: create / join / start / leave, with live roster.
// Game:  the backend auto-advances rounds. This screen just
//        polls the current round and shows the right thing —
//        your matchup to vote on, a "waiting for others" screen,
//        or the final results when the party is done. The leader
//        does nothing after pressing Start.
// ============================================================

const POLL_MS = 2500

const PartyRoom = () => {
  const { session } = UserAuth()
  const token = session?.access_token
  const userId = session?.user?.id
  const navigate = useNavigate()

  const [party, setParty] = useState(null)
  const [code, setCode] = useState('')
  const [roomName, setRoomName] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // game state, driven by polling /rounds/current
  const [round, setRound] = useState(null) // { round_number, total_matchups, completed_matchups, user_matchups }
  const [categories, setCategories] = useState([])
  const [picks, setPicks] = useState({}) // categoryId -> winning ideaId
  const [phase, setPhase] = useState('loading') // loading | voting | waiting | done
  const shownMatchupId = useRef(null)

  const refresh = useCallback(async () => {
    if (!token) return
    try {
      const { party } = await getMyParty(token)
      setParty(party)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  // initial load + light polling while in a lobby (to see people join / game start)
  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!party || party.status === 'active') return
    const id = setInterval(refresh, 4000)
    return () => clearInterval(id)
  }, [party, refresh])

  // load the fixed category list once
  useEffect(() => {
    if (!token) return
    getCategories(token)
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [token])

  // ---- the game loop: poll the current round while the party is active ----
  useEffect(() => {
    if (!token || !party || party.status !== 'active') return

    let stop = false

    const poll = async () => {
      try {
        const data = await getCurrentRound(token)
        if (stop) return
        setRound(data)
        const open = (data.user_matchups || []).filter((m) => !m.status)
        // voting if you still have a matchup; otherwise you're done -> waiting
        setPhase(open.length > 0 ? 'voting' : 'waiting')
      } catch (err) {
        if (stop) return
        // no active round for your party => the game finished
        if (/no active round/i.test(err.message)) {
          setPhase('done')
          refresh() // pick up party.status === 'done'
        } else {
          setError(err.message)
        }
      }
    }

    poll()
    const id = setInterval(poll, POLL_MS)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [token, party?.id, party?.status, refresh])

  const openMatchups = (round?.user_matchups || []).filter((m) => !m.status)
  const currentMatchup = openMatchups[0] ?? null

  // clear picks whenever the matchup we're showing changes
  useEffect(() => {
    if (currentMatchup?.id !== shownMatchupId.current) {
      shownMatchupId.current = currentMatchup?.id ?? null
      setPicks({})
    }
  }, [currentMatchup?.id])

  // run a lobby action (create/join/start/leave), then update party state
  const run = async (fn) => {
    setBusy(true)
    setError(null)
    try {
      const result = await fn()
      const nextParty = result.party ?? result
      setParty(nextParty)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const allPicked = categories.length > 0 && categories.every((c) => picks[c.id])

  const pickCategory = (categoryId, ideaId) => {
    if (busy) return
    setPicks((prev) => ({ ...prev, [categoryId]: ideaId }))
  }

  const handleSubmit = async () => {
    if (!currentMatchup || busy || !allPicked) return
    setBusy(true)
    setError(null)
    try {
      await submitVote(token, { matchupId: currentMatchup.id, winners: picks })
      setPicks({})
      // re-poll right away so the next matchup / waiting screen shows immediately
      const data = await getCurrentRound(token).catch((err) => {
        if (/no active round/i.test(err.message)) {
          setPhase('done')
          refresh()
          return null
        }
        throw err
      })
      if (data) {
        setRound(data)
        const open = (data.user_matchups || []).filter((m) => !m.status)
        setPhase(open.length > 0 ? 'voting' : 'waiting')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!session) return <p>Please sign in to use party rooms.</p>
  if (loading) return <p>Loading…</p>

  // ---- Not in a room: create / join ----
  if (!party) {
    return (
      <div className="party-page">
        <Link className="party-back-link" to="/">
          ← Home
        </Link>
        {error && <p className="party-error">{error}</p>}
        <section className="party-actions">
          <div className="party-join">
            <input
              className="party-input party-input--wide"
              placeholder="Room name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
            <button
              className="party-btn party-btn--primary"
              type="button"
              disabled={busy}
              onClick={() => run(() => createParty(token, roomName))}
            >
              Create Party
            </button>
          </div>
          <div className="party-join">
            <input
              className="party-input"
              placeholder="Enter 4-letter code"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button
              className="party-btn"
              type="button"
              disabled={busy || !code}
              onClick={() => run(() => joinParty(token, code))}
            >
              Join Party
            </button>
          </div>
        </section>
      </div>
    )
  }

  const youAreLeader = party.leader_id === userId

  // ---- Game in progress ----
  if (party.status === 'active') {
    const total = round?.total_matchups ?? 0
    const completed = round?.completed_matchups ?? 0

    return (
      <div className="party-page">
        {error && <p className="party-error">{error}</p>}
        <section className="party-card">
          <header className="party-card__header">
            <div>
              <h2 className="party-room-name">{party.room_name}</h2>
              <span className="party-status party-status--active">active</span>
            </div>
            <div className="party-code">
              <span className="party-code__label">Round</span>
              <span className="party-code__value">{round?.round_number ?? 1}</span>
            </div>
          </header>

          {phase === 'loading' && <p>Loading matchup…</p>}

          {phase === 'done' && (
            <div>
              <h3>Game over 🎉</h3>
              <p>
                Every idea has been compared. Head to the dashboard to see the
                final ranking and how scores moved.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
                <button
                  className="party-btn party-btn--primary"
                  type="button"
                  onClick={() => navigate('/dashboard')}
                >
                  View results
                </button>
                <button
                  className="party-btn party-btn--ghost"
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => leaveParty(token, party.id))}
                >
                  Leave room
                </button>
              </div>
            </div>
          )}

          {phase === 'waiting' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <h3>Waiting for others…</h3>
              <p style={{ color: 'var(--color-text-secondary)', marginTop: 8 }}>
                {completed} of {total} votes in this round
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
                {Array.from({ length: total }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background:
                        i < completed
                          ? 'var(--color-background-success, #2e7d32)'
                          : 'var(--color-border-secondary, #ccc)',
                      transition: 'background 0.3s',
                    }}
                  />
                ))}
              </div>
              <p style={{ color: 'var(--color-text-secondary)', marginTop: 20, fontSize: 13 }}>
                The next round starts automatically once everyone has voted.
              </p>
            </div>
          )}

          {phase === 'voting' && currentMatchup && (
            <div>
              <p>Pick the stronger idea in every category, then submit.</p>

              {/* header: the two ideas being compared */}
              <div className="ballot-grid ballot-header">
                <div />
                <div className="ballot-idea-head">
                  <strong>{currentMatchup.idea_a?.title || 'Idea A'}</strong>
                  {(currentMatchup.idea_a?.desc || currentMatchup.idea_a?.description) && (
                    <div className="ballot-idea-desc">
                      {currentMatchup.idea_a.desc ?? currentMatchup.idea_a.description}
                    </div>
                  )}
                </div>
                <div className="ballot-idea-head">
                  <strong>{currentMatchup.idea_b?.title || 'Idea B'}</strong>
                  {(currentMatchup.idea_b?.desc || currentMatchup.idea_b?.description) && (
                    <div className="ballot-idea-desc">
                      {currentMatchup.idea_b.desc ?? currentMatchup.idea_b.description}
                    </div>
                  )}
                </div>
              </div>

              {/* one row per category */}
              {categories.map((category) => {
                const ideaAId = currentMatchup.idea_a?.id
                const ideaBId = currentMatchup.idea_b?.id
                return (
                  <div key={category.id} className="ballot-grid ballot-row">
                    <div className="ballot-category">{category.label}</div>
                    <button
                      type="button"
                      disabled={busy}
                      className={`ballot-choice${picks[category.id] === ideaAId ? ' is-selected' : ''}`}
                      onClick={() => pickCategory(category.id, ideaAId)}
                    >
                      {picks[category.id] === ideaAId ? '✓ ' : ''}
                      {currentMatchup.idea_a?.title || 'Idea A'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className={`ballot-choice${picks[category.id] === ideaBId ? ' is-selected' : ''}`}
                      onClick={() => pickCategory(category.id, ideaBId)}
                    >
                      {picks[category.id] === ideaBId ? '✓ ' : ''}
                      {currentMatchup.idea_b?.title || 'Idea B'}
                    </button>
                  </div>
                )
              })}

              <button
                className="party-btn party-btn--primary"
                type="button"
                disabled={busy || !allPicked}
                onClick={handleSubmit}
                style={{ marginTop: 20 }}
              >
                {busy ? 'Submitting…' : 'Submit votes'}
              </button>
              {!allPicked && (
                <p className="ballot-hint">Choose a winner in every category to submit.</p>
              )}
            </div>
          )}
        </section>
      </div>
    )
  }

  // ---- Lobby: room + roster ----
  const roster = [...party.members].sort(
    (a, b) => Number(b.is_leader) - Number(a.is_leader),
  )

  return (
    <div className="party-page">
      <Link className="party-back-link" to="/">
        ← Home
      </Link>
      {error && <p className="party-error">{error}</p>}

      {youAreLeader && party.status === 'lobby' && (
        <div className="party-host-banner">
          👑 You’re the party host — start the game when everyone’s in.
        </div>
      )}

      <section className="party-card">
        <header className="party-card__header">
          <div>
            <h2 className="party-room-name">{party.room_name}</h2>
            <span className={`party-status party-status--${party.status}`}>
              {party.status}
            </span>
          </div>
          <div className="party-code">
            <span className="party-code__label">Room code</span>
            <span className="party-code__value">{party.code}</span>
          </div>
        </header>

        <div className="party-roster">
          <div className="party-roster__head">
            <span>{roster.length} players</span>
          </div>
          <ul className="party-member-list">
            {roster.map((m, i) => (
              <li key={m.user_id} className="party-member">
                <span className="party-member__index">{i + 1}</span>
                <span className="party-member__avatar">
                  {m.name?.[0]?.toUpperCase() ?? '?'}
                </span>
                <span className="party-member__name">
                  {m.name}
                  {m.user_id === userId ? ' (you)' : ''}
                </span>
                <span
                  className={
                    'party-member__role' +
                    (m.is_leader ? ' party-member__role--leader' : '')
                  }
                >
                  {m.is_leader ? 'Host' : 'Player'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <footer className="party-card__footer">
          {youAreLeader && party.status === 'lobby' && (
            <button
              className="party-btn party-btn--primary"
              type="button"
              disabled={busy}
              onClick={() => run(() => startParty(token, party.id))}
            >
              Start game
            </button>
          )}
          {!youAreLeader && party.status === 'lobby' && (
            <span className="party-hint">Waiting for the host to start…</span>
          )}
          <button
            className="party-btn party-btn--ghost"
            type="button"
            disabled={busy}
            onClick={() => run(() => leaveParty(token, party.id))}
          >
            Leave room
          </button>
        </footer>
      </section>
    </div>
  )
}

export default PartyRoom
