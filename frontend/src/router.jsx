import { createBrowserRouter } from 'react-router-dom'
import App from './App'
import Signup from './components/Signup'
import Signin from './components/Signin'
import Dashboard from './routes/Dashboard'
import Home from './routes/Home'
import Ideas from './routes/Ideas'
import PartyRoom from './routes/PartyRoom'
import PrivateRoute from './components/PrivateRoute'
import PublicRoute from './components/PublicRoute'
import Round from './round'
import Waiting from './waiting'
import Results from './results'

export const router = createBrowserRouter([
  {
    // Home is the landing screen. PrivateRoute bounces signed-out
    // visitors to /signin, so "/" is the login gate too.
    path: '/',
    element: (
      <PrivateRoute>
        <Home />
      </PrivateRoute>
    ),
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
