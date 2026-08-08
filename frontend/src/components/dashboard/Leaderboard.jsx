import { useEffect, useState } from 'react'

function rankByCategory(rows, categoryId) {
  return [...rows]
    .map((team) => ({
      ...team,
      categoryRating:
        team.scores?.find((s) => s.category_id === categoryId)?.rating5 ??
        null,
    }))
    .sort((a, b) => (b.categoryRating ?? 0) - (a.categoryRating ?? 0))
}

export function Leaderboard({ rows, categories }) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id)

  useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0].id)
    }
  }, [categories, activeCategory])

  const rankedRows = activeCategory
    ? rankByCategory(rows, activeCategory)
    : rows

  return (
    <section className="panel leaderboard-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Live Ranking</span>
          <h2>Leaderboard</h2>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="category-tabs">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`category-tab${activeCategory === category.id ? ' is-selected' : ''}`}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
      )}

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {rankedRows.map((team, index) => (
              <tr key={team.id}>
                <td className="rank-cell">#{index + 1}</td>
                <td>
                  <span className="team-name">{team.name}</span>
                </td>
                <td>
                  {team.categoryRating != null
                    ? `${team.categoryRating.toFixed(1)} / 5`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
