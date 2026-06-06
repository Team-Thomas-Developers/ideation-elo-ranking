import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Leaderboard } from '../components/dashboard/Leaderboard'
import { PredictionMarkets } from '../components/dashboard/PredictionMarkets'
import { QtmaLogo } from '../components/dashboard/QtmaLogo'
import { RoundStatus } from '../components/dashboard/RoundStatus'
import { ScoreChart } from '../components/dashboard/ScoreChart'
import { UserAuth } from '../context/AuthContext'
import {
  createRealtimeMockSnapshot,
  dataSource,
  getCurrentRound,
  getLeaderboard,
  getScoreHistory,
} from '../services/leaderboardService'
import { playSplashDing } from '../utils/playSplashDing'
import '../dashboard.css'

const Dashboard = () => {
  const { session, signOut } = UserAuth()
  const navigate = useNavigate()
  const [baseLeaderboard, setBaseLeaderboard] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [scoreHistory, setScoreHistory] = useState([])
  const [round, setRound] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => playSplashDing(), [])

  useEffect(() => {
    async function loadData() {
      try {
        const [[leaderboardRows, historyRows, activeRound]] = await Promise.all(
          [
            Promise.all([
              getLeaderboard(),
              getScoreHistory(),
              getCurrentRound(),
            ]),
            new Promise((resolve) => setTimeout(resolve, 1200)),
          ],
        )

        setBaseLeaderboard(leaderboardRows)
        setLeaderboard(leaderboardRows)
        setScoreHistory(historyRows)
        setRound(activeRound)
      } catch (error) {
        setLoadError(error.message || 'Unable to load Supabase data.')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    if (dataSource === 'Supabase' || baseLeaderboard.length === 0) {
      return undefined
    }

    let tick = 0
    const intervalId = setInterval(() => {
      tick += 1
      setLeaderboard(createRealtimeMockSnapshot(baseLeaderboard, tick))
    }, 2500)

    return () => clearInterval(intervalId)
  }, [baseLeaderboard])

  const handleSignOut = async () => {
    await signOut()
    navigate('/signin')
  }

  if (isLoading) {
    return (
      <main className="splash-screen" aria-label="Loading QTMA leaderboard">
        <img className="splash-logo" src="/qtma-logo.svg" alt="QTMA" />
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="page page-enter">
        <section className="panel loading-panel">
          <span className="eyebrow">Supabase connection error</span>
          <h2>Data could not be loaded</h2>
          <p>{loadError}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="page page-enter">
      <header className="app-header">
        <div>
          <QtmaLogo />
          <h1>Leaderboard + Real-time Scoring</h1>
        </div>
        <div className="header-actions">
          <div className="header-stat">
            <span>Data Source</span>
            <strong>{dataSource}</strong>
          </div>
          <button
            className="sign-out-button"
            type="button"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </header>

      <span className="signed-in-label">{session?.user?.email}</span>
      <RoundStatus round={round} />
      <div className="dashboard-grid">
        <Leaderboard rows={leaderboard} />
        <ScoreChart history={scoreHistory} teams={baseLeaderboard} />
      </div>
      <PredictionMarkets rows={leaderboard} round={round} />
    </main>
  )
}

export default Dashboard
