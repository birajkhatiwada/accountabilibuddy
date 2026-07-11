import { useState } from 'react'
import { useAuth } from '../AuthContext'
import { BUTTON_MD } from '../buttonStyles'
import { GREEN_LIGHT } from '../colors'

export default function Auth() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setError(''); setLoading(true)
    try {
      if (mode === 'signup') await signUp(username, password)
      else await signIn(username, password)
    } catch (err) {
      const msg = err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
        ? 'Wrong username or password'
        : err.code === 'auth/email-already-in-use'
        ? 'Username already taken'
        : err.code === 'auth/weak-password'
        ? 'Password must be at least 6 characters'
        : 'Something went wrong'
      setError(msg)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-5">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white leading-none">
            accountabili<span style={{ background: `linear-gradient(to right, ${GREEN_LIGHT}, #2dd4bf)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>buddy</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-1">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoCapitalize="none"
            style={{ fontSize: 16 }}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ fontSize: 16 }}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading || !username.trim() || !password}
            className={`w-full ${BUTTON_MD}`}>
            {loading ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError('') }}
            className="text-emerald-500 font-semibold hover:text-emerald-400 transition-colors">
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
