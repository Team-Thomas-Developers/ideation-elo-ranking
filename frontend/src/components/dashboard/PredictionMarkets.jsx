import { useMemo, useState } from 'react'

function formatPercent(value) {
  return `${Math.round(value)}%`
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function buildWinnerMarkets(rows) {
  if (rows.length === 0) return []

  const scores = rows.map((team) => {
    const rankBoost = (rows.length - team.rank + 1) * 14
    const eloBoost = Math.max(team.elo - 1450, 0) / 5
    const momentum = team.scoreChange ?? 0
    return {
      ...team,
      marketScore: Math.max(rankBoost + eloBoost + momentum, 1),
    }
  })

  const totalScore = scores.reduce((sum, team) => sum + team.marketScore, 0)

  return scores
    .map((team) => ({
      id: team.id,
      label: `${team.name} wins the next round`,
      price: clamp((team.marketScore / totalScore) * 100, 5, 82),
      baseVotes: Math.round(
        clamp((team.marketScore / totalScore) * 120, 8, 64),
      ),
    }))
    .sort((a, b) => b.price - a.price)
    .slice(0, 4)
}

export function PredictionMarkets({ rows, round }) {
  const markets = buildWinnerMarkets(rows)
  const topMarket = markets[0]
  const roundLabel = round ? `Round ${round.round_number}` : 'Live'
  const [selectedMarketId, setSelectedMarketId] = useState(null)
  const voteCounts = useMemo(() => {
    return markets.reduce((counts, market) => {
      counts[market.id] =
        market.baseVotes + (selectedMarketId === market.id ? 1 : 0)
      return counts
    }, {})
  }, [markets, selectedMarketId])

  return (
    <section className="panel markets-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Prediction Markets</span>
          <h2>{roundLabel} Forecast</h2>
        </div>
        <span className="refresh-label">Community votes</span>
      </div>

      {topMarket ? (
        <div className="market-feature">
          <div>
            <span className="market-kicker">Market leader</span>
            <strong>{topMarket.label}</strong>
          </div>
          <span className="market-price">{formatPercent(topMarket.price)}</span>
        </div>
      ) : null}

      <div className="market-list">
        {markets.map((market) => (
          <article className="market-row" key={market.id}>
            <div className="market-copy">
              <strong>{market.label}</strong>
              <span>{voteCounts[market.id]} votes cast</span>
            </div>
            <div
              className="market-meter"
              aria-label={`${market.label}: ${formatPercent(market.price)}`}
            >
              <div
                className="market-meter-fill"
                style={{ width: `${market.price}%` }}
              />
            </div>
            <span className="market-odds">{formatPercent(market.price)}</span>
            <button
              className={`vote-button${selectedMarketId === market.id ? ' is-selected' : ''}`}
              type="button"
              onClick={() => setSelectedMarketId(market.id)}
            >
              {selectedMarketId === market.id ? 'Voted' : 'Vote'}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}
