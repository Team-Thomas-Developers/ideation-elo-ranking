import { createBrowserRouter } from 'react-router-dom'
import App from './App'
import Signup from './components/Signup'
import Signin from './components/Signin'
import Dashboard from './routes/Dashboard'
import PartyRoom from './routes/PartyRoom'
import PrivateRoute from './components/PrivateRoute'
import Round from './round'
import Waiting from './waiting'
import Results from './results'

export const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/signup', element: <Signup /> },
  { path: '/signin', element: <Signin /> },
  {
    path: '/dashboard',
    element: (
      <PrivateRoute>
        <Dashboard />
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
