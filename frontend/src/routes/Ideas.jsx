import { Link, useNavigate } from 'react-router-dom'
import { IdeaManager } from '../components/dashboard/IdeaManager'
import { UserAuth } from '../context/AuthContext'
import '../dashboard.css'

const Ideas = () => {
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
          <span className="eyebrow">Ideas</span>
          <h1>Manage Ideas</h1>
        </div>
        <div className="header-actions">
          <Link className="sign-out-button header-link" to="/">
            Home
          </Link>
          <Link className="sign-out-button header-link" to="/dashboard">
            Leaderboard
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
      <IdeaManager session={session} />
    </main>
  )
}

export default Ideas
