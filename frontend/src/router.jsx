import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from './App'
import Signup from './components/Signup'
import Signin from './components/Signin'
import Dashboard from './routes/Dashboard'
import Ideas from './routes/Ideas'
import PartyRoom from './routes/PartyRoom'
import PrivateRoute from './components/PrivateRoute'
import PublicRoute from './components/PublicRoute'
import Round from './round'
import Waiting from './waiting'
import Results from './results'
import { UserAuth } from './context/AuthContext'

const RootRoute = () => {
  const { session } = UserAuth()

  if (session === undefined) {
    return <div>Loading...</div>
  }

  return session ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Navigate to="/signin" replace />
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootRoute />,
  },
  {
    path: '/signup',
    element: (
      <PublicRoute>
        <Signup />
      </PublicRoute>
    ),
  },
  {
    path: '/signin',
    element: (
      <PublicRoute>
        <Signin />
      </PublicRoute>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <PrivateRoute>
        <Dashboard />
      </PrivateRoute>
    ),
  },
  {
    path: '/ideas',
    element: (
      <PrivateRoute>
        <Ideas />
      </PrivateRoute>
    ),
  },
  {
    path: '/party',
    element: (
      <PrivateRoute>
        <PartyRoom />
      </PrivateRoute>
    ),
  },
  {
    path: '/round/:roundNumber',
    element: (
      <PrivateRoute>
        <Round />
      </PrivateRoute>
    ),
  },
  {
    path: '/waiting',
    element: (
      <PrivateRoute>
        <Waiting />
      </PrivateRoute>
    ),
  },
  {
    path: '/results',
    element: (
      <PrivateRoute>
        <Results />
      </PrivateRoute>
    ),
  },
])
