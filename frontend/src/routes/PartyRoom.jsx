import { useState } from 'react'
import { UserAuth } from '../context/AuthContext'
import './PartyRoom.css'

// ============================================================
// PARTY ROOM  —  presentational scaffold
// ------------------------------------------------------------
// Shows the room, the room leader, and the member roster.
// This is UI ONLY — buttons are placeholders. Devs wire these
// up to the backend:
//   POST   /api/parties/create            -> create a room (you become leader)
//   POST   /api/parties/join              -> join by code
//   GET    /api/parties/me/:userId        -> your current room
//   GET    /api/parties/:partyId          -> room state + roster
//   POST   /api/parties/:partyId/start    -> leader only: lobby -> active
//   POST   /api/parties/:partyId/leave    -> leave (leader role hands off)
// ============================================================

// Sample data so the room renders. Replace with the API response.
const SAMPLE_PARTY = {
  code: 'ABCD',
  room_name: "Team Thomas's Room",
  status: 'lobby',
  leader_id: 'u1',
  members: [
    { user_id: 'u1', is_leader: true, name: 'Zane' },
    { user_id: 'u2', is_leader: false, name: 'Kevin' },
    { user_id: 'u3', is_leader: false, name: 'Harish' },
  ],
}

const PartyRoom = () => {
  const { session } = UserAuth()
  const [party] = useState(SAMPLE_PARTY) // TODO: load from /api/parties/me/:userId

  // leader goes first in the roster
  const roster = [...party.members].sort(
    (a, b) => Number(b.is_leader) - Number(a.is_leader),
  )
  const youAreLeader = true // TODO: party.leader_id === session?.user?.id

  return (
    <div className="party-page">
      {/* ---- Lobby actions (placeholders) ---- */}
      <section className="party-actions">
        <button className="party-btn party-btn--primary" type="button">
          Create Room
        </button>
        <div className="party-join">
          <input
            className="party-input"
            placeholder="Enter code"
            maxLength={6}
          />
          <button className="party-btn" type="button">
            Join
          </button>
        </div>
      </section>

      {/* ---- Room card ---- */}
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
                <span className="party-member__name">{m.name}</span>
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

        {/* ---- Leader controls (only the leader sees Start) ---- */}
        <footer className="party-card__footer">
          {youAreLeader && (
            <button className="party-btn party-btn--primary" type="button">
              Start session
            </button>
          )}
          <button className="party-btn party-btn--ghost" type="button">
            Leave room
          </button>
        </footer>
      </section>
    </div>
  )
}

export default PartyRoom
