import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getIdeas } from './lib/gameApi'

export default function Results() {
  const navigate = useNavigate()
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getIdeas().then(({ data, error }) => {
      if (error) {
        console.error(error)
      }
      if (data) setIdeas(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div style={{ maxWidth: 480, margin: '60px auto', padding: '0 24px' }}>
        <p>Loading results...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 560, margin: '60px auto', padding: '0 24px' }}>
      <h1>Final results</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32 }}>
        Ideas ranked by ELO score
      </p>

      {ideas.map((idea, index) => (
        <div
          key={idea.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '14px 18px',
            marginBottom: 10,
            borderRadius: 'var(--border-radius-lg)',
            background:
              index === 0
                ? 'var(--color-background-success)'
                : 'var(--color-background-secondary)',
            border: '1px solid var(--color-border-tertiary)',
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 500,
              minWidth: 28,
              color: 'var(--color-text-secondary)',
            }}
          >
            {index + 1}
          </span>
          <div style={{ flex: 1 }}>
            <div
              style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}
            >
              {idea.title}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--color-text-secondary)',
                marginTop: 2,
              }}
            >
              {idea.desc ?? idea.description}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}
            >
              {idea.curr_score}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              ELO score
            </div>
          </div>
        </div>
      ))}

      <div
        style={{
          marginTop: 32,
          display: 'flex',
          gap: 12,
          justifyContent: 'center',
        }}
      >
        <button
          style={{
            padding: '12px 20px',
            borderRadius: 'var(--border-radius-md)',
            border: '1px solid var(--color-border-tertiary)',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/dashboard')}
        >
          Go to dashboard
        </button>
        <button
          style={{
            padding: '12px 20px',
            borderRadius: 'var(--border-radius-md)',
            border: '1px solid var(--color-border-tertiary)',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/')}
        >
          Return home
        </button>
      </div>
    </div>
  )
}
