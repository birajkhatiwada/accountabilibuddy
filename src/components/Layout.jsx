import { useEffect, useState } from 'react'
import { Outlet, NavLink, useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { Target, DollarSign, Clock, Users, Rss, Moon, Sun, Copy, Check } from 'lucide-react'
import { useTheme } from '../ThemeContext'

export default function Layout() {
  const { dark, toggle } = useTheme()
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    return onSnapshot(doc(db, 'sessions', sessionId), snap => {
      if (snap.exists()) setSession(snap.data())
    })
  }, [sessionId])

  const copyCode = () => {
    navigator.clipboard.writeText(sessionId)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const linkClass = ({ isActive }) =>
    `flex flex-col items-center gap-0.5 px-5 py-2 text-[11px] font-bold uppercase tracking-wider transition-all ${
      isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400'
    }`

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto relative">
      {/* Header */}
      <header className="px-5 pt-8 pb-3">
        <div className="flex items-end justify-between">
          <div>
            <button onClick={() => navigate('/')}
              className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors mb-1 flex items-center gap-1">
              ← sessions
            </button>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white leading-none">
              accountabili<span style={{ background: 'linear-gradient(to right, #34d399, #2dd4bf)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>buddy</span>
            </h1>
            {session && (
              <button onClick={copyCode}
                className="flex items-center gap-1.5 mt-1 group">
                <span className="text-sm">{session.emoji || '🎯'}</span>
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">{session.name}</span>
                <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded group-hover:text-zinc-500 dark:group-hover:text-zinc-400 transition-colors">{sessionId}</span>
                {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} className="text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-400 transition-colors" />}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={toggle}
              className="p-1.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
              aria-label="Toggle dark mode">
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-3 overflow-y-auto pb-24">
        <Outlet />
      </main>

      {/* Nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-t border-zinc-200 dark:border-zinc-800/60 flex justify-around py-2">
        <NavLink to={`/${sessionId}`} end className={linkClass}>
          {({ isActive }) => (
            <>
              <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}>
                <Target size={18} />
              </div>
              This Week
            </>
          )}
        </NavLink>
        <NavLink to={`/${sessionId}/history`} className={linkClass}>
          {({ isActive }) => (
            <>
              <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}>
                <Clock size={18} />
              </div>
              History
            </>
          )}
        </NavLink>
        <NavLink to={`/${sessionId}/pot`} className={linkClass}>
          {({ isActive }) => (
            <>
              <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}>
                <DollarSign size={18} />
              </div>
              The Pot
            </>
          )}
        </NavLink>
        <NavLink to={`/${sessionId}/feed`} className={linkClass}>
          {({ isActive }) => (
            <>
              <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}>
                <Rss size={18} />
              </div>
              Feed
            </>
          )}
        </NavLink>
        <NavLink to={`/${sessionId}/members`} className={linkClass}>
          {({ isActive }) => (
            <>
              <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}>
                <Users size={18} />
              </div>
              Members
            </>
          )}
        </NavLink>
      </nav>
    </div>
  )
}
