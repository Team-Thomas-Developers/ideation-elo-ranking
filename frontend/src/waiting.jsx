import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentRound } from './lib/gameApi'

export default function Waiting() {
  const navigate = useNavigate()
  const [doneCount, setDoneCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [roundNumber, setRoundNumber] = useState(1)

  useEffect(() => {
    let intervalId

    async function pollCurrentRound() {
      const { data, error } = await getCurrentRound()
      if (error) {
        console.error('Waiting screen fetch failed', error)
        navigate('/results')
        return
      }

      const done = data?.completed_matchups ?? 0
      setDoneCount(done)
      setTotalCount(data?.total_matchups ?? 0)
      setRoundNumber(data?.round_number ?? 1)

      const allDone = data?.total_matchups && done === data.total_matchups
      if (allDone) {
        navigate('/results')
      }
    }

    pollCurrentRound()
    intervalId = window.setInterval(pollCurrentRound, 2000)
    return () => window.clearInterval(intervalId)
  }, [navigate])

  return (
    <div
      style={{
        maxWidth: 480,
        margin: '60px auto',
        padding: '0 24px',
        textAlign: 'center',
      }}
    >
      <h1>Waiting for others...</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 12 }}>
        {doneCount} of {totalCount} votes in
      </p>
      <div
        style={{
          marginTop: 32,
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {Array.from({ length: totalCount }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background:
                i < doneCount
                  ? 'var(--color-background-success)'
                  : 'var(--color-border-secondary)',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>
    </div>
  )
}
