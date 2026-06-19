import { Outlet, NavLink } from 'react-router-dom'
import { Target, DollarSign, Clock, Users } from 'lucide-react'

export default function Layout() {
  const linkClass = ({ isActive }) =>
    `flex flex-col items-center gap-0.5 px-4 py-2 text-xs font-medium transition-colors ${
      isActive ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
    }`

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto">
      <header className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          accountability<span className="text-emerald-400">.</span>
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">honor system — no cheating yourself</p>
      </header>

      <main className="flex-1 px-4 py-4 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-zinc-900 border-t border-zinc-800 flex justify-around py-1">
        <NavLink to="/" end className={linkClass}>
          <Target size={20} />
          This Week
        </NavLink>
        <NavLink to="/history" className={linkClass}>
          <Clock size={20} />
          History
        </NavLink>
        <NavLink to="/pot" className={linkClass}>
          <DollarSign size={20} />
          The Pot
        </NavLink>
        <NavLink to="/members" className={linkClass}>
          <Users size={20} />
          Members
        </NavLink>
      </nav>
    </div>
  )
}
