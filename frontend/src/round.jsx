import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getCurrentRound, voteMatchup } from './lib/gameApi'

export default function Round() {
  const { roundNumber } = useParams()
  const navigate = useNavigate()
  const [matchup, setMatchup] = useState(null)
  const [ideaA, setIdeaA] = useState(null)
  const [ideaB, setIdeaB] = useState(null)
  const [voted, setVoted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadMatchup() {
      const { data, error } = await getCurrentRound()
      if (error) {
        console.error('Could not load current round', error)
        navigate('/results')
        return
      }

      const activeMatchup = data?.user_matchups?.[0] ?? null
      if (!activeMatchup) {
        console.warn('No matchup found for current user')
        navigate('/results')
        return
      }

      setMatchup(activeMatchup)
      setIdeaA(activeMatchup.idea_a)
      setIdeaB(activeMatchup.idea_b)
      setLoading(false)
    }

    loadMatchup()
  }, [roundNumber])

  async function vote(winnerId) {
    if (voted || !matchup) return
    setVoted(true)

    const { error } = await voteMatchup(matchup.id, winnerId)
    if (error) {
      console.error('Vote failed', error)
      setVoted(false)
      return
    }

    navigate('/waiting', {
      state: { roundNumber: parseInt(roundNumber ?? '1', 10) },
    })
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 480, margin: '60px auto', padding: '0 24px' }}>
        <p>Loading your matchup...</p>
      </div>
    )
  }

  if (!matchup || !ideaA || !ideaB) {
    return (
      <div style={{ maxWidth: 480, margin: '60px auto', padding: '0 24px' }}>
        <h1>No matchup found</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Your party may not have an active round yet, or your matchup could not
          be loaded.
        </p>
        <button
          onClick={() => navigate('/party')}
          style={{
            marginTop: 20,
            padding: '12px 24px',
            borderRadius: 'var(--border-radius-md)',
          }}
        >
          Return to party room
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 600, margin: '60px auto', padding: '0 24px' }}>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 8 }}>
        Round {roundNumber}
      </p>
      <h1 style={{ marginBottom: 32 }}>Which idea is better?</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[ideaA, ideaB].filter(Boolean).map((idea) => (
          <button
            key={idea.id}
            onClick={() => vote(idea.id)}
            disabled={voted || !idea}
            style={{
              padding: 24,
              borderRadius: 'var(--border-radius-lg)',
              background: 'var(--color-background-secondary)',
              border: '1px solid var(--color-border-tertiary)',
              cursor: voted ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!voted)
                e.currentTarget.style.borderColor =
                  'var(--color-border-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border-tertiary)'
            }}
          >
            <div
              style={{
                fontWeight: 500,
                fontSize: 16,
                marginBottom: 8,
                color: 'var(--color-text-primary)',
              }}
            >
              {idea.title}
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
              {idea.desc ?? idea.description}
            </div>
          </button>
        ))}
      </div>

      {voted && (
        <p style={{ marginTop: 24, color: 'var(--color-text-secondary)' }}>
          Vote recorded — heading to waiting room...
        </p>
      )}
    </div>
  )
}
