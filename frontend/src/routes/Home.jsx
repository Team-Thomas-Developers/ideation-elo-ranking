import { Link, useNavigate } from 'react-router-dom'
import { QtmaLogo } from '../components/dashboard/QtmaLogo'
import { UserAuth } from '../context/AuthContext'
import '../dashboard.css'

// ============================================================
// HOME — the landing screen for signed-in users.
// Just a menu: pick Leaderboard, Party Room, or Ideas.
// (Unauthenticated visitors never get here; PrivateRoute sends
// them to /signin first.)
// ============================================================

const DESTINATIONS = [
  {
    to: '/dashboard',
    eyebrow: 'Live scores',
    title: 'Leaderboard',
    copy: 'Current standings, score history, and how every idea is trending.',
  },
  {
    to: '/party',
    eyebrow: 'Play',
    title: 'Party Room',
    copy: 'Create or join a room, then vote head-to-head to rank the ideas.',
  },
  {
    to: '/ideas',
    eyebrow: 'Setup',
    title: 'Manage Ideas',
    copy: 'Add, edit, and remove the ideas that go into the rankings.',
  },
]

const Home = () => {
  const { session, signOut } = UserAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/signin')
  }

  return (
    <main className="page page-enter">
      <header className="app-header">
        <div>
          <QtmaLogo />
          <h1>Ideation Elo</h1>
        </div>
        <div className="header-actions">
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

      <div className="home-grid">
        {DESTINATIONS.map((item) => (
          <Link className="panel home-card" key={item.to} to={item.to}>
            <span className="eyebrow">{item.eyebrow}</span>
            <h2>{item.title}</h2>
            <p>{item.copy}</p>
            <span className="home-card__cta">Open →</span>
          </Link>
        ))}
      </div>
    </main>
  )
}

export default Home
