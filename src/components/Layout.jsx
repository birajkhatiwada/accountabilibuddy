import { Outlet, NavLink } from 'react-router-dom'
import { Target, DollarSign, Clock, Users, Rss, Moon, Sun } from 'lucide-react'
import { useTheme } from '../ThemeContext'

export default function Layout() {
  const { dark, toggle } = useTheme()

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
            <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white leading-none">
              accountabili<span style={{ background: 'linear-gradient(to right, #34d399, #2dd4bf)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>buddy</span>
            </h1>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-600 mt-1 font-medium tracking-wide uppercase">honor system · no cheating yourself</p>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={toggle}
              className="p-1.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
              aria-label="Toggle dark mode"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-3 overflow-y-auto pb-24 bg-zinc-50 dark:bg-zinc-900">
        <Outlet />
      </main>

      {/* Nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-t border-zinc-200 dark:border-zinc-800/60 flex justify-around py-2">
        <NavLink to="/" end className={linkClass}>
          {({ isActive }) => (
            <>
              <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}>
                <Target size={18} />
              </div>
              This Week
            </>
          )}
        </NavLink>
        <NavLink to="/history" className={linkClass}>
          {({ isActive }) => (
            <>
              <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}>
                <Clock size={18} />
              </div>
              History
            </>
          )}
        </NavLink>
        <NavLink to="/pot" className={linkClass}>
          {({ isActive }) => (
            <>
              <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}>
                <DollarSign size={18} />
              </div>
              The Pot
            </>
          )}
        </NavLink>
        <NavLink to="/feed" className={linkClass}>
          {({ isActive }) => (
            <>
              <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}>
                <Rss size={18} />
              </div>
              Feed
            </>
          )}
        </NavLink>
        <NavLink to="/members" className={linkClass}>
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
