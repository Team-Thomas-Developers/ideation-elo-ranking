import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserAuth } from '../context/AuthContext'
import {
  getMyParty,
  createParty,
  joinParty,
  startParty,
  leaveParty,
  getCurrentRound,
  getMatchups,
  submitVote,
} from '../lib/partyApi'
import './PartyRoom.css'

// ============================================================
// PARTY ROOM  — fully wired to the backend
// ------------------------------------------------------------
// Loads the signed-in user's current room, and lets them
// create / join / start / leave. The roster (incl. who's the
// leader) and status come straight from the database. Polls
// every 4s so the room stays in sync while in the lobby.
// ============================================================

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
  const [activeRound, setActiveRound] = useState(null)
  const [matchups, setMatchups] = useState([])
  const [currentMatchupIndex, setCurrentMatchupIndex] = useState(0)
  const [matchupsLoading, setMatchupsLoading] = useState(false)
  const [votingComplete, setVotingComplete] = useState(false)

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

  // initial load + light polling while in a lobby
  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!party || party.status !== 'lobby') return
    const id = setInterval(refresh, 4000)
    return () => clearInterval(id)
  }, [party, refresh])

  useEffect(() => {
    let ignore = false

    const loadVotingState = async () => {
      if (!token || !userId || !party || party.status !== 'active') {
        if (!ignore) {
          setActiveRound(null)
          setMatchups([])
          setCurrentMatchupIndex(0)
          setVotingComplete(false)
        }
        return
      }

      if (!ignore) {
        setMatchupsLoading(true)
        setError(null)
      }

      try {
        const round = await getCurrentRound(token)
        const matchupData = await getMatchups(token, userId, round.id)
        if (!ignore) {
          setActiveRound(round)
          setMatchups(Array.isArray(matchupData) ? matchupData : [])
          setCurrentMatchupIndex(0)
          setVotingComplete(false)
        }
      } catch (err) {
        if (!ignore) {
          setActiveRound(null)
          setMatchups([])
          setCurrentMatchupIndex(0)
          setVotingComplete(false)
          setError(err.message)
        }
      } finally {
        if (!ignore) setMatchupsLoading(false)
      }
    }

    loadVotingState()

    return () => {
      ignore = true
    }
  }, [party?.id, party?.status, token, userId])

  const currentMatchup = matchups[currentMatchupIndex]

  // run an action, then refresh state
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

  if (!session) return <p>Please sign in to use party rooms.</p>
  if (loading) return <p>Loading…</p>

  // ---- Not in a room: show create / join ----
  if (!party) {
    return (
      <div className="party-page">
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
              Create Room
            </button>
          </div>
          <div className="party-join">
            <input
              className="party-input"
              placeholder="Enter code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button
              className="party-btn"
              type="button"
              disabled={busy || !code}
              onClick={() => run(() => joinParty(token, code))}
            >
              Join
            </button>
          </div>
        </section>
      </div>
    )
  }

  const handleVote = async (winnerId) => {
    if (!currentMatchup || busy) return

    setBusy(true)
    setError(null)

    try {
      await submitVote(token, {
        matchupId: currentMatchup.id,
        winnerId,
      })

      if (currentMatchupIndex + 1 >= matchups.length) {
        setVotingComplete(true)
        setMatchups([])
        setCurrentMatchupIndex(0)
      } else {
        setCurrentMatchupIndex((value) => value + 1)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (party.status === 'active') {
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
              <span className="party-code__value">
                {activeRound?.round_number ?? 1}
              </span>
            </div>
          </header>

          {matchupsLoading ? (
            <p>Loading matchup…</p>
          ) : votingComplete || !currentMatchup ? (
            <div>
              <h3>Voting complete</h3>
              <p>
                You&apos;ve finished the current round. Your votes have been
                recorded and the leaderboard will reflect the latest Elo
                changes.
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginTop: 16,
                }}
              >
                <button
                  className="party-btn party-btn--primary"
                  type="button"
                  disabled={busy}
                  onClick={() => navigate('/dashboard')}
                >
                  Go to dashboard
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
          ) : (
            <div>
              <p>
                Pick the idea you want to advance for this matchup{' '}
                {currentMatchupIndex + 1} of {matchups.length}.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  className="party-btn party-btn--primary"
                  type="button"
                  disabled={busy}
                  onClick={() => handleVote(currentMatchup.idea_a?.id)}
                  style={{ flex: 1, minWidth: 220, textAlign: 'left' }}
                >
                  <strong>{currentMatchup.idea_a?.title || 'Idea A'}</strong>
                  {currentMatchup.idea_a?.desc && (
                    <div style={{ marginTop: 8, fontSize: 14 }}>
                      {currentMatchup.idea_a.desc}
                    </div>
                  )}
                </button>
                <button
                  className="party-btn"
                  type="button"
                  disabled={busy}
                  onClick={() => handleVote(currentMatchup.idea_b?.id)}
                  style={{ flex: 1, minWidth: 220, textAlign: 'left' }}
                >
                  <strong>{currentMatchup.idea_b?.title || 'Idea B'}</strong>
                  {currentMatchup.idea_b?.desc && (
                    <div style={{ marginTop: 8, fontSize: 14 }}>
                      {currentMatchup.idea_b.desc}
                    </div>
                  )}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    )
  }

  // ---- In a room: show the room + roster ----
  const roster = [...party.members].sort(
    (a, b) => Number(b.is_leader) - Number(a.is_leader),
  )
  const youAreLeader = party.leader_id === userId

  return (
    <div className="party-page">
      {error && <p className="party-error">{error}</p>}
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
                  {m.is_leader ? 'Leader' : 'Player'}
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
              Start session
            </button>
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
