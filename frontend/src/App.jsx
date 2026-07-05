import { Link, Outlet } from 'react-router-dom'
import { UserAuth } from './context/AuthContext'

const App = () => {
  const { session } = UserAuth()

  const showProtectedLinks = !!session

  return (
    <div style={{ padding: 16 }}>
      <nav style={{ marginBottom: 12 }}>
        <Link to="/">Home</Link>
        {!showProtectedLinks && (
          <>
            {' | '} <Link to="/signup">Sign Up</Link> |{' '}
            <Link to="/signin">Sign In</Link>
          </>
        )}
        {showProtectedLinks && (
          <>
            {' | '} <Link to="/dashboard">Dashboard</Link> |{' '}
            <Link to="/party">Party Room</Link>
          </>
        )}
      </nav>

      <main>
        <h2>Welcome to Ideation Elo Ranking</h2>
        <Outlet />
      </main>
    </div>
  )
}

export default App
