import { useEffect, useState, useRef } from 'react'
import { Outlet, NavLink, useParams, useNavigate, useLocation } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { Target, DollarSign, Clock, Users, Rss, Moon, Sun, Copy, Check, LogOut } from 'lucide-react'
import { useTheme } from '../ThemeContext'
import { useAuth } from '../AuthContext'

export default function Layout() {
  const { dark, toggle, uiTheme } = useTheme()
  const gaming = uiTheme === 'gaming'
  const { user, signOut } = useAuth()
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const handleSignOut = async () => { await signOut(); navigate('/') }
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === `/${sessionId}`

  useEffect(() => {
    document.querySelector('main')?.scrollTo(0, 0)
  }, [location.pathname])
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

  const pillTab = (isActive) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-full transition-all duration-200 ${
      isActive
        ? gaming
          ? 'bg-[#00ff88]/15 text-[#00ff88]'
          : 'bg-zinc-700 dark:bg-zinc-700 text-white'
        : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-200 dark:hover:text-zinc-300'
    }`

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto relative">
      {/* Header */}
      {isHome ? (
        <header className="px-5 pt-8 pb-3">
          <div className="flex items-end justify-between">
            <div>
              <button onClick={() => navigate('/')}
                className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors mb-1 flex items-center gap-1">
                ← sessions
              </button>
              <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white leading-none cursor-pointer" onClick={() => navigate(`/${sessionId}`)}>
                accountabili<span style={{ background: gaming ? 'linear-gradient(to right, #00ff88, #00e5ff)' : 'linear-gradient(to right, #34d399, #2dd4bf)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>buddy</span>
              </h1>
              {session && (
                <button onClick={copyCode} className="flex items-center gap-1.5 mt-1 group">
                  <span className="text-sm">{session.emoji || '🎯'}</span>
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">{session.name}</span>
                  <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{sessionId}</span>
                  {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} className="text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-400 transition-colors" />}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mb-1">
              {user && <button onClick={() => navigate(`/${sessionId}/member/${encodeURIComponent(user.displayName)}`)} className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 hover:text-emerald-500 transition-colors">{user.displayName}</button>}
              <button onClick={toggle} className="p-1.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all" aria-label="Toggle dark mode">
                {dark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button onClick={() => setConfirmSignOut(true)} className="p-1.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all" aria-label="Sign out">
                <LogOut size={15} />
              </button>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: gaming ? '#00ff88' : '#34d399', boxShadow: gaming ? '0 0 6px #00ff88' : 'none' }} />
            </div>
          </div>
        </header>
      ) : (
        <header className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white leading-none cursor-pointer shrink-0" onClick={() => navigate(`/${sessionId}`)}>
              accountabili<span style={{ background: gaming ? 'linear-gradient(to right, #00ff88, #00e5ff)' : 'linear-gradient(to right, #34d399, #2dd4bf)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>buddy</span>
            </h1>
            {session && (
              <button onClick={copyCode} className="flex items-center gap-1 min-w-0 group">
                <span className="text-sm shrink-0">{session.emoji || '🎯'}</span>
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 truncate group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">{session.name}</span>
                {copied ? <Check size={10} className="text-emerald-400 shrink-0" /> : <Copy size={10} className="text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {user && <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">{user.displayName}</span>}
            <button onClick={toggle} className="p-1.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all" aria-label="Toggle dark mode">
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button onClick={() => setConfirmSignOut(true)} className="p-1.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all" aria-label="Sign out">
              <LogOut size={14} />
            </button>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: gaming ? '#00ff88' : '#34d399', boxShadow: gaming ? '0 0 5px #00ff88' : 'none' }} />
          </div>
        </header>
      )}

      <main className="flex-1 px-4 py-3 overflow-y-auto pb-24" style={{ overflowAnchor: 'none' }}>
        <Outlet />
      </main>

      {/* Pill nav */}
      <div className="fixed left-1/2 -translate-x-1/2 z-40 flex justify-center"
        style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <nav className="flex items-center gap-0.5 bg-zinc-900/95 backdrop-blur-2xl rounded-full px-2 py-2 shadow-2xl shadow-black/60 border border-white/[0.06]">
          <NavLink to={`/${sessionId}`} end>
            {({ isActive }) => (
              <div className={pillTab(isActive)}>
                <Target size={15} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-semibold">Week</span>
              </div>
            )}
          </NavLink>
          <NavLink to={`/${sessionId}/history`}>
            {({ isActive }) => (
              <div className={pillTab(isActive)}>
                <Clock size={15} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-semibold">History</span>
              </div>
            )}
          </NavLink>
          <NavLink to={`/${sessionId}/pot`}>
            {({ isActive }) => (
              <div className={pillTab(isActive)}>
                <DollarSign size={15} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-semibold">Pot</span>
              </div>
            )}
          </NavLink>
          <NavLink to={`/${sessionId}/feed`}>
            {({ isActive }) => (
              <div className={pillTab(isActive)}>
                <Rss size={15} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-semibold">Feed</span>
              </div>
            )}
          </NavLink>
          <NavLink to={user ? `/${sessionId}/member/${encodeURIComponent(user.displayName)}` : `/${sessionId}/members`}>
            {({ isActive }) => (
              <div className={pillTab(isActive)}>
                <Users size={15} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-semibold">Me</span>
              </div>
            )}
          </NavLink>
        </nav>
      </div>

      {confirmSignOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={() => setConfirmSignOut(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-xs shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-1">
              <p className="text-2xl">🔐</p>
              <p className="font-bold text-zinc-900 dark:text-white">Sign out?</p>
              <p className="text-sm text-zinc-500">You'll need your username and password to sign back in.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmSignOut(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleSignOut}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-bold transition-colors">
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
