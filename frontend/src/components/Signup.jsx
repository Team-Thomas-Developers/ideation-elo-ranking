import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserAuth } from '../context/AuthContext'

const Signup = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const { signUpNewUser, signInWithGoogle } = UserAuth()
  const navigate = useNavigate()

  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await signUpNewUser(email, password)

      if (result.success) {
        navigate('/dashboard')
      } else {
        setError(result.error.message)
      }
    } catch (err) {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSignUp}>
        <h2>Sign up today!</h2>

        <p>
          Already have an account? <Link to="/">Sign in</Link>
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

        <button type="submit" disabled={loading}>
          Sign Up
        </button>

        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            onClick={signInWithGoogle}
            style={{ width: '100%' }}
          >
            Sign Up with Google
          </button>
        </div>

        {error && <p>{error}</p>}
      </form>
    </div>
  )
}

export default Signup
