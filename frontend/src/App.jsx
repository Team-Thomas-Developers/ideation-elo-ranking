import { Link, Outlet } from 'react-router-dom'

const App = () => {
  return (
    <div style={{ padding: 16 }}>
      <nav style={{ marginBottom: 12 }}>
        <Link to="/">Home</Link> | <Link to="/signup">Sign Up</Link> |{' '}
        <Link to="/signin">Sign In</Link> |{' '}
        <Link to="/dashboard">Dashboard</Link>
      </nav>

      <main>
        <h2>Welcome to Ideation Elo Ranking</h2>
        <Outlet />
      </main>
    </div>
  )
}

export default App
