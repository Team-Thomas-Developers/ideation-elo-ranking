import React from 'react'
import { UserAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'

const PrivateRoute = ({ children, redirectTo = '/signin' }) => {
  const { session } = UserAuth()

  if (session === undefined) {
    return <div>Loading...</div>
  }

  return session ? <>{children}</> : <Navigate to={redirectTo} replace />
}

export default PrivateRoute
