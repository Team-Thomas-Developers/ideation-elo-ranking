import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserAuth } from '../context/AuthContext'

const Signin = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const { signInUser } = UserAuth()
  const navigate = useNavigate()

  const handleSignIn = async (e) => {
    e.preventDefault()
    const { session, error } = await signInUser(email, password)

    if (error) {
      setError(error)

      setTimeout(() => {
        setError('')
      }, 3000)
    } else {
      navigate('/dashboard')
    }

    if (session) {
      closeModal()
      setError('')
    }
  }

  return (
    <div>
      <form onSubmit={handleSignIn}>
        <h2>Sign in</h2>

        <p>
          Don't have an account yet? <Link to="/signup">Sign up</Link>
        </p>

        <div>
          <input
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            name="email"
            id="email"
            placeholder="Email"
          />
        </div>

        <div>
          <input
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            name="password"
            id="password"
            placeholder="Password"
          />
        </div>

        <button type="submit">Sign In</button>

        {error && <p>{error}</p>}
      </form>
    </div>
  )
}

export default Signin
