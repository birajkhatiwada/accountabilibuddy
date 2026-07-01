import { useEffect, useState, useRef } from 'react'
import { Outlet, NavLink, useParams, useNavigate, useLocation } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { Target, DollarSign, Clock, Users, Rss, Moon, Sun, Copy, Check, LogOut, MessageSquare } from 'lucide-react'
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

      {/* Feedback FAB */}
      <button onClick={() => navigate('/feedback')}
        className="fixed right-4 z-50 flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-semibold px-3.5 py-2.5 rounded-full shadow-lg transition-all active:scale-95"
        style={{ bottom: 'max(88px, calc(env(safe-area-inset-bottom) + 88px))' }}>
        <MessageSquare size={14} />
        Feedback
      </button>

      {/* Pill nav */}
      {(() => {
        const myPath = user ? `/${sessionId}/member/${encodeURIComponent(user.displayName)}` : `/${sessionId}/members`
        const tabs = [
          { to: `/${sessionId}`, end: true,  Icon: Target,      label: 'Week'    },
          { to: `/${sessionId}/history`,      Icon: Clock,       label: 'History' },
          { to: `/${sessionId}/pot`,          Icon: DollarSign,  label: 'Pot'     },
          { to: `/${sessionId}/feed`,         Icon: Rss,         label: 'Feed'    },
          { to: myPath,                       Icon: Users,       label: 'Me'      },
        ]
        const activeIdx = tabs.findIndex(t =>
          t.end ? location.pathname === t.to : location.pathname.startsWith(t.to)
        )
        return (
          <div className="fixed left-1/2 -translate-x-1/2 z-40 px-4 w-full max-w-lg"
            style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            <nav className="relative flex items-center bg-zinc-900/95 backdrop-blur-2xl rounded-full p-1 shadow-2xl shadow-black/60 border border-white/[0.06]">
              {/* Sliding pill indicator — stays inside the border */}
              <div className="absolute inset-y-1 rounded-full pointer-events-none"
                style={{
                  width: `calc((100% - 8px) / ${tabs.length})`,
                  left: `calc(4px + ${activeIdx} * (100% - 8px) / ${tabs.length})`,
                  transition: 'left 0.3s cubic-bezier(0.34, 1.3, 0.64, 1)',
                  background: gaming ? 'rgba(0,255,136,0.15)' : 'rgb(63,63,70)',
                }} />
              {tabs.map(({ to, end, Icon, label }) => (
                <NavLink key={to} to={to} end={end} className="flex-1 z-10">
                  {({ isActive }) => (
                    <div className="flex flex-col items-center gap-0.5 py-1.5 transition-colors duration-200"
                      style={{ color: isActive ? (gaming ? '#00ff88' : '#fff') : '#71717a' }}>
                      <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                      <span className="text-[9px] font-semibold tracking-wide">{label}</span>
                    </div>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        )
      })()}

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
