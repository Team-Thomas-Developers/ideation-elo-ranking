import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getCategories, getCurrentRound, voteMatchup } from './lib/gameApi'

export default function Round() {
  const { roundNumber } = useParams()
  const navigate = useNavigate()
  const [matchup, setMatchup] = useState(null)
  const [ideaA, setIdeaA] = useState(null)
  const [ideaB, setIdeaB] = useState(null)
  const [categories, setCategories] = useState([])
  const [picks, setPicks] = useState({}) // categoryId -> winning ideaId
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadMatchup() {
      const [{ data, error }, categoriesRes] = await Promise.all([
        getCurrentRound(),
        getCategories(),
      ])
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

      if (categoriesRes.error) {
        console.error('Could not load categories', categoriesRes.error)
      }

      setMatchup(activeMatchup)
      setIdeaA(activeMatchup.idea_a)
      setIdeaB(activeMatchup.idea_b)
      setCategories(categoriesRes.data ?? [])
      setLoading(false)
    }

    loadMatchup()
  }, [roundNumber])

  const allPicked =
    categories.length > 0 && categories.every((c) => picks[c.id])

  function pick(categoryId, ideaId) {
    if (submitting) return
    setPicks((prev) => ({ ...prev, [categoryId]: ideaId }))
  }

  async function submit() {
    if (!allPicked || submitting || !matchup) return
    setSubmitting(true)

    const { error } = await voteMatchup(matchup.id, picks)
    if (error) {
      console.error('Vote failed', error)
      setSubmitting(false)
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

  const ideaCell = (idea, categoryId) => {
    const selected = picks[categoryId] === idea.id
    return (
      <button
        key={idea.id}
        onClick={() => pick(categoryId, idea.id)}
        disabled={submitting}
        style={{
          padding: '12px 14px',
          borderRadius: 'var(--border-radius-md)',
          background: selected
            ? 'var(--color-background-success, #e6f4ea)'
            : 'var(--color-background-secondary)',
          border: `2px solid ${
            selected
              ? 'var(--color-border-success, #2e7d32)'
              : 'var(--color-border-tertiary)'
          }`,
          cursor: submitting ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          fontWeight: selected ? 600 : 400,
          color: 'var(--color-text-primary)',
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        {selected ? '✓ ' : ''}
        {idea.title}
      </button>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '60px auto', padding: '0 24px' }}>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 8 }}>
        Round {roundNumber}
      </p>
      <h1 style={{ marginBottom: 8 }}>Which idea wins each category?</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32 }}>
        Pick the stronger idea for all {categories.length} categories, then
        submit.
      </p>

      {/* header row: the two ideas being compared */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '150px 1fr 1fr',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div />
        {[ideaA, ideaB].map((idea) => (
          <div key={idea.id}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                color: 'var(--color-text-primary)',
              }}
            >
              {idea.title}
            </div>
            {(idea.desc ?? idea.description) && (
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--color-text-secondary)',
                  marginTop: 2,
                }}
              >
                {idea.desc ?? idea.description}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* one row per category */}
      {categories.map((category) => (
        <div
          key={category.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '150px 1fr 1fr',
            gap: 12,
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontWeight: 500,
              color: 'var(--color-text-primary)',
            }}
          >
            {category.label}
          </div>
          {ideaCell(ideaA, category.id)}
          {ideaCell(ideaB, category.id)}
        </div>
      ))}

      <button
        onClick={submit}
        disabled={!allPicked || submitting}
        style={{
          marginTop: 28,
          padding: '14px 28px',
          borderRadius: 'var(--border-radius-md)',
          border: 'none',
          background: allPicked
            ? 'var(--color-accent, #246bfe)'
            : 'var(--color-border-tertiary)',
          color: allPicked ? '#fff' : 'var(--color-text-secondary)',
          fontWeight: 600,
          cursor: allPicked && !submitting ? 'pointer' : 'not-allowed',
        }}
      >
        {submitting ? 'Submitting…' : 'Submit votes'}
      </button>
      {!allPicked && (
        <p style={{ marginTop: 12, color: 'var(--color-text-secondary)' }}>
          Choose a winner in every category to submit.
        </p>
      )}
    </div>
  )
}
