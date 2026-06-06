const COLORS = ['#246bfe', '#e15d44', '#14936f', '#9b5de5', '#c18b00']

function groupByTeam(history, teams) {
  return teams.map((team, index) => ({
    team,
    color: COLORS[index % COLORS.length],
    points: history.filter((entry) => entry.teamId === team.id),
  }))
}

function buildPath(points, xForRound, yForElo) {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${xForRound(point.roundNumber)} ${yForElo(point.elo)}`,
    )
    .join(' ')
}

export function ScoreChart({ history, teams }) {
  if (history.length === 0) {
    return (
      <section className="panel chart-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Score History</span>
            <h2>ELO by Round</h2>
          </div>
        </div>
        <span className="refresh-label">No completed round data yet</span>
      </section>
    )
  }

  const series = groupByTeam(history, teams)
  const rounds = [...new Set(history.map((entry) => entry.roundNumber))]
  const elos = history.map((entry) => entry.elo)
  const minElo = Math.min(...elos) - 20
  const maxElo = Math.max(...elos) + 20
  const width = 720
  const height = 280
  const padding = { top: 24, right: 28, bottom: 42, left: 56 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const xForRound = (round) => {
    if (rounds.length === 1) return padding.left + chartWidth / 2
    return (
      padding.left +
      ((round - rounds[0]) / (rounds.at(-1) - rounds[0])) * chartWidth
    )
  }
  const yForElo = (elo) =>
    padding.top + ((maxElo - elo) / (maxElo - minElo)) * chartHeight

  return (
    <section className="panel chart-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ScoreHistory</span>
          <h2>ELO by Round</h2>
        </div>
      </div>

      <div className="chart-shell">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Line chart of ELO score by round"
        >
          {rounds.map((round) => (
            <g key={round}>
              <line
                className="grid-line"
                x1={xForRound(round)}
                x2={xForRound(round)}
                y1={padding.top}
                y2={height - padding.bottom}
              />
              <text
                className="axis-label"
                x={xForRound(round)}
                y={height - 14}
                textAnchor="middle"
              >
                R{round}
              </text>
            </g>
          ))}

          {[minElo, Math.round((minElo + maxElo) / 2), maxElo].map((elo) => (
            <g key={elo}>
              <line
                className="grid-line"
                x1={padding.left}
                x2={width - padding.right}
                y1={yForElo(elo)}
                y2={yForElo(elo)}
              />
              <text className="axis-label" x={18} y={yForElo(elo) + 4}>
                {elo}
              </text>
            </g>
          ))}

          {series.map(({ team, color, points }) => (
            <g key={team.id}>
              <path
                className="score-line"
                d={buildPath(points, xForRound, yForElo)}
                stroke={color}
              />
              {points.map((point) => (
                <circle
                  key={point.id}
                  cx={xForRound(point.roundNumber)}
                  cy={yForElo(point.elo)}
                  r="5"
                  fill={color}
                />
              ))}
            </g>
          ))}
        </svg>
      </div>

      <div className="legend">
        {series.map(({ team, color }) => (
          <span className="legend-item" key={team.id}>
            <span className="legend-dot" style={{ backgroundColor: color }} />
            {team.name}
          </span>
        ))}
      </div>
    </section>
  )
}
