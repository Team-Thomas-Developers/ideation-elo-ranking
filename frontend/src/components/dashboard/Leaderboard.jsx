export function Leaderboard({ rows }) {
  return (
    <section className="panel leaderboard-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Live Ranking</span>
          <h2>Leaderboard</h2>
        </div>
        <span className="refresh-label">Mock realtime</span>
      </div>

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>ELO</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((team) => (
              <tr key={team.id}>
                <td className="rank-cell">#{team.rank}</td>
                <td>
                  <span className="team-name">{team.name}</span>
                </td>
                <td>{team.elo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
