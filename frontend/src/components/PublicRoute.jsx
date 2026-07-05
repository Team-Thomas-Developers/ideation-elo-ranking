import React from 'react'
import { Navigate } from 'react-router-dom'
import { UserAuth } from '../context/AuthContext'

const PublicRoute = ({ children }) => {
  const { session } = UserAuth()

  if (session === undefined) {
    return <div>Loading...</div>
  }

  return session ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

export default PublicRoute
