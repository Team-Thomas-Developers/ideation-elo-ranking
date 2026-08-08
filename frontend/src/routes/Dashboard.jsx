import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Leaderboard } from '../components/dashboard/Leaderboard'
import { PredictionMarkets } from '../components/dashboard/PredictionMarkets'
import { QtmaLogo } from '../components/dashboard/QtmaLogo'
import { RoundStatus } from '../components/dashboard/RoundStatus'
import { ScoreChart } from '../components/dashboard/ScoreChart'
import { UserAuth } from '../context/AuthContext'
import { getCategories } from '../lib/gameApi'
import {
  getCurrentRound,
  getLeaderboard,
  getScoreHistory,
} from '../services/leaderboardService'
import { playSplashDing } from '../utils/playSplashDing'
import '../dashboard.css'

const Dashboard = () => {
  const { session, signOut } = UserAuth()
  const navigate = useNavigate()
  const [leaderboard, setLeaderboard] = useState([])
  const [categories, setCategories] = useState([])
  const [scoreHistory, setScoreHistory] = useState([])
  const [round, setRound] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => playSplashDing(), [])

  useEffect(() => {
    async function loadData() {
      try {
        const [
          [leaderboardRows, historyRows, activeRound, categoriesRes],
        ] = await Promise.all([
          Promise.all([
            getLeaderboard(),
            getScoreHistory(),
            getCurrentRound(),
            getCategories(),
          ]),
          new Promise((resolve) => setTimeout(resolve, 1200)),
        ])

        setLeaderboard(leaderboardRows)
        setScoreHistory(historyRows)
        setRound(activeRound)
        setCategories(categoriesRes.data ?? [])
      } catch (error) {
        setLoadError(error.message || 'Unable to load Supabase data.')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

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

  return (
    <main className="page page-enter">
      <header className="app-header">
        <div>
          <QtmaLogo />
          <h1>Leaderboard + Real-time Scoring</h1>
        </div>
        <div className="header-actions">
          <Link className="sign-out-button header-link" to="/">
            Home
          </Link>
          <Link className="sign-out-button header-link" to="/ideas">
            Manage Ideas
          </Link>
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

      {loadError ? (
        <section className="panel loading-panel dashboard-error-panel">
          <span className="eyebrow">Supabase connection error</span>
          <h2>Leaderboard data could not be loaded</h2>
          <p>{loadError}</p>
        </section>
      ) : (
        <>
          <RoundStatus round={round} />
          <div className="dashboard-grid">
            <Leaderboard rows={leaderboard} categories={categories} />
            <ScoreChart history={scoreHistory} teams={leaderboard} />
          </div>
          <PredictionMarkets rows={leaderboard} round={round} />
        </>
      )}
    </main>
  )
}

export default Dashboard
