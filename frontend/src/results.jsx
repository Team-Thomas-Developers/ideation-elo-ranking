import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCategories, getIdeas } from './lib/gameApi'

export default function Results() {
  const navigate = useNavigate()
  const [ideas, setIdeas] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getIdeas(), getCategories()]).then(
      ([ideasRes, categoriesRes]) => {
        if (ideasRes.error) console.error(ideasRes.error)
        if (categoriesRes.error) console.error(categoriesRes.error)
        if (ideasRes.data) setIdeas(ideasRes.data)
        if (categoriesRes.data) setCategories(categoriesRes.data)
        setLoading(false)
      },
    )
  }, [])

  const labelFor = (categoryId) =>
    categories.find((c) => c.id === categoryId)?.label ?? categoryId

  if (loading) {
    return (
      <div style={{ maxWidth: 480, margin: '60px auto', padding: '0 24px' }}>
        <p>Loading results...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '60px auto', padding: '0 24px' }}>
      <h1>Final results</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32 }}>
        Ideas ranked by their overall score (out of 5), averaged across all
        categories
      </p>

      {ideas.map((idea, index) => (
        <div
          key={idea.id}
          style={{
            padding: '16px 18px',
            marginBottom: 12,
            borderRadius: 'var(--border-radius-lg)',
            background:
              index === 0
                ? 'var(--color-background-success, #e6f4ea)'
                : 'var(--color-background-secondary)',
            border: '1px solid var(--color-border-tertiary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 20,
                  color: 'var(--color-text-primary)',
                }}
              >
                {idea.overall_rating != null
                  ? `${idea.overall_rating.toFixed(1)} / 5`
                  : '—'}
              </div>
              <div
                style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}
              >
                overall
              </div>
            </div>
          </div>

          {/* per-category /5 breakdown */}
          {Array.isArray(idea.scores) && idea.scores.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: 8,
                marginTop: 14,
              }}
            >
              {idea.scores.map((score) => (
                <div
                  key={score.category_id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--border-radius-md)',
                    background: 'var(--color-background-primary, #fff)',
                    border: '1px solid var(--color-border-tertiary)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {labelFor(score.category_id)}
                  </div>
                  <div
                    style={{
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {score.rating5.toFixed(1)}
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 400,
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {' '}
                      / 5
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
