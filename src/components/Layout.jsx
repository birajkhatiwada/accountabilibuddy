import { useEffect, useLayoutEffect, useState, useRef } from 'react'
import { Outlet, NavLink, useParams, useNavigate, useLocation, useNavigationType } from 'react-router-dom'
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { Target, DollarSign, Clock, Users, Rss, Moon, Sun, Copy, Check, LogOut, MessageSquare, MoreVertical, ArrowLeft, ChevronDown, Plus } from 'lucide-react'
import { useTheme } from '../ThemeContext'
import { useAuth } from '../AuthContext'
import { GREEN_LIGHT } from '../colors'
import { BUTTON_SM } from '../buttonStyles'
import useLockBodyScroll from '../useLockBodyScroll'

function PillNav({ sessionId, user, gaming, location, isHome }) {
  const myPath = user ? `/${sessionId}/member/${encodeURIComponent(user.displayName)}` : `/${sessionId}/members`
  const tabs = [
    { to: `/${sessionId}`, end: true, Icon: Target,     label: 'Week'    },
    { to: `/${sessionId}/history`,    Icon: Clock,      label: 'History' },
    { to: `/${sessionId}/pot`,        Icon: DollarSign, label: 'Pot'     },
    { to: `/${sessionId}/feed`,       Icon: Rss,        label: 'Feed'    },
    { to: myPath,                     Icon: Users,      label: 'Me'      },
  ]
  const activeIdx = tabs.findIndex(t =>
    t.end ? location.pathname === t.to : location.pathname.startsWith(t.to)
  )
  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-40 px-4 w-full max-w-lg"
      style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}>
      <nav className="relative flex items-center bg-zinc-900/95 backdrop-blur-2xl rounded-3xl p-1 shadow-2xl shadow-black/60 border border-white/[0.06]">
        <div className="absolute inset-y-1 rounded-3xl pointer-events-none"
          style={{
            width: `calc((100% - 8px) / ${tabs.length})`,
            left: `calc(4px + ${Math.max(0, activeIdx)} * (100% - 8px) / ${tabs.length})`,
            opacity: activeIdx === -1 ? 0 : 1,
            transition: 'left 0.3s cubic-bezier(0.34, 1.3, 0.64, 1), opacity 0.2s ease',
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
}

// Collapses "Feedback" and "Sign out" behind one overflow button — keeping
// the header's right side to just this + the theme toggle, instead of a
// row of separate icon buttons plus a username and a status dot.
function HeaderMenu({ open, setOpen, onSessions, onFeedback, onSignOut, size = 16 }) {
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="p-1.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all" aria-label="Menu">
        <MoreVertical size={size} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden">
            <button onClick={() => { setOpen(false); onSessions() }}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              <ArrowLeft size={14} /> All sessions
            </button>
            <button onClick={() => { setOpen(false); onFeedback() }}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              <MessageSquare size={14} /> Feedback
            </button>
            <button onClick={() => { setOpen(false); onSignOut() }}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Dropdown for switching between sessions the account belongs to, right
// from the header — instead of the only option being to back out to the
// session picker first.
function SessionSwitcher({ open, setOpen, sessions, currentId, onSwitch, onNew }) {
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} aria-label="Switch session"
        className="text-zinc-300 dark:text-zinc-700 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors shrink-0">
        <ChevronDown size={12} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-56 max-h-72 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl">
            {sessions.map(s => (
              <button key={s.id} onClick={() => { setOpen(false); onSwitch(s.id) }}
                className={s.id === currentId
                  ? `w-full text-left px-3.5 py-2.5 truncate ${BUTTON_SM}`
                  : 'w-full flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium transition-colors text-left truncate text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'}>
                {s.name}
              </button>
            ))}
            <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
            <button onClick={() => { setOpen(false); onNew() }}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              <Plus size={14} /> New or join session
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function Layout() {
  const { dark, toggle, uiTheme } = useTheme()
  const gaming = uiTheme === 'gaming'
  const { user, signOut } = useAuth()
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  useLockBodyScroll(confirmSignOut)
  const handleSignOut = async () => { await signOut(); navigate('/') }
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const navigationType = useNavigationType()
  const isHome = location.pathname === `/${sessionId}`

  // Remember scroll position per page so going back (POP) restores where you
  // were, instead of always jumping to the top like a fresh page visit.
  const scrollPositions = useRef(new Map())

  // Header shadow ramps in smoothly over the first 20px of scroll instead
  // of snapping on/off — flat with nothing beneath it at the very top of
  // the page, like the Health app's nav bar.
  const [headerShadow, setHeaderShadow] = useState(0)

  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return
    const onScroll = () => {
      scrollPositions.current.set(location.pathname, main.scrollTop)
      setHeaderShadow(Math.min(1, main.scrollTop / 20))
    }
    onScroll()
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => main.removeEventListener('scroll', onScroll)
  }, [location.pathname])

  // Synchronous (pre-paint) so a new page never flashes at whatever
  // scrollTop the previous page left <main> at before snapping to
  // top/restored position.
  useLayoutEffect(() => {
    const main = document.querySelector('main')
    if (!main) return
    main.scrollTop = navigationType === 'POP'
      ? (scrollPositions.current.get(location.pathname) || 0)
      : 0
  }, [location.pathname, navigationType])
  const [session, setSession] = useState(null)
  const [copied, setCopied] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [mySessions, setMySessions] = useState([])

  useEffect(() => {
    if (!sessionId) return
    return onSnapshot(doc(db, 'sessions', sessionId), snap => {
      if (snap.exists()) setSession(snap.data())
    })
  }, [sessionId])

  // Every session this account belongs to, for the header's switcher —
  // same query SessionPicker uses for "Your sessions".
  useEffect(() => {
    if (!user?.displayName) { setMySessions([]); return }
    const q = query(collection(db, 'sessions'), where('names', 'array-contains', user.displayName))
    return onSnapshot(q, snap => {
      setMySessions(snap.docs.map(d => ({ id: d.id, name: d.data().name, emoji: d.data().emoji })))
    })
  }, [user?.displayName])

  const copyCode = () => {
    navigator.clipboard.writeText(sessionId)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto relative">
      {/* Header — same compact layout on every page, home included. The
          backdrop-blur + shadow live on absolutely-positioned layers that
          extend past the visible bar and feather out via a mask, so the
          blur's own hard edge (a plain CSS limitation: backdrop-filter
          always clips sharply at its box) fades smoothly into the content
          below — without that extra fade height pushing the page's
          content down, since it's out of normal flow. */}
      <header className="app-header sticky top-0 z-30">
        <div className="absolute inset-x-0 top-0 h-20 backdrop-blur-xl bg-zinc-50/70 dark:bg-zinc-950/70 pointer-events-none"
          style={{ WebkitMaskImage: 'linear-gradient(to bottom, black 65%, transparent 100%)', maskImage: 'linear-gradient(to bottom, black 65%, transparent 100%)' }} />
        {/* Darkening shadow on the same fade shape, ramped in via scroll
            (see headerShadow) so there's nothing under the bar at all at
            the very top of a page. */}
        <div className="header-shadow-fade absolute inset-x-0 top-0 h-20 pointer-events-none" style={{ opacity: headerShadow }} />
        <div className="relative px-4 pt-4 pb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white leading-none cursor-pointer shrink-0" onClick={() => navigate(`/${sessionId}`)}>
              accountabili<span style={{ background: gaming ? 'linear-gradient(to right, #00ff88, #00e5ff)' : `linear-gradient(to right, ${GREEN_LIGHT}, #2dd4bf)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>buddy</span>
            </h1>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {session && (
              <button onClick={copyCode} className="flex items-center gap-1 min-w-0 group">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 truncate group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">{session.name}</span>
                {copied ? <Check size={10} className="text-emerald-400 shrink-0" /> : <Copy size={10} className="text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />}
              </button>
            )}
            {mySessions.length > 1 && (
              <SessionSwitcher open={switcherOpen} setOpen={setSwitcherOpen} sessions={mySessions} currentId={sessionId}
                onSwitch={id => navigate(`/${id}`)} onNew={() => navigate('/')} />
            )}
            <button onClick={toggle} className="p-1.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all" aria-label="Toggle dark mode">
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <HeaderMenu open={menuOpen} setOpen={setMenuOpen} size={15}
              onSessions={() => navigate('/')} onFeedback={() => navigate('/feedback')} onSignOut={() => setConfirmSignOut(true)} />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-3 overflow-y-auto pb-24" style={{ overflowAnchor: 'none' }}>
        <Outlet />
      </main>

      {/* Pill nav — hidden on session home */}
      <PillNav sessionId={sessionId} user={user} gaming={gaming} location={location} isHome={isHome} />

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
