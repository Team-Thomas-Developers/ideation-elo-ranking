export function RoundStatus({ round }) {
  if (!round) {
    return <section className="panel metric-panel">Loading round...</section>
  }

  const remainingVotes = Math.max(round.total_voters - round.votes_cast, 0)
  const progress =
    round.total_voters > 0
      ? Math.min(Math.round((round.votes_cast / round.total_voters) * 100), 100)
      : 0

  return (
    <section className="panel metric-panel">
      <div>
        <span className="eyebrow">Current Round</span>
        <h2>Round {round.round_number}</h2>
      </div>
      <div className="round-grid">
        <div>
          <span className="metric-value">
            {round.votes_cast}/{round.total_voters}
          </span>
          <span className="metric-label">Votes Cast</span>
        </div>
        <div>
          <span className="metric-value">{remainingVotes}</span>
          <span className="metric-label">Waiting</span>
        </div>
        <div>
          <span className="status-pill">{round.status}</span>
          <span className="metric-label">Status</span>
        </div>
      </div>
      <div className="progress-track" aria-label={`${progress}% of votes cast`}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </section>
  )
}
