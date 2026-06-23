import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { collection, onSnapshot, query, where, orderBy, limit, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentWeekId, formatWeekLabel } from '../utils'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'

const PENALTY = 15

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600', 'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',     'from-indigo-500 to-blue-600',
  'from-teal-500 to-emerald-600',  'from-fuchsia-500 to-pink-600',
]

function getPrevWeekId(weekId) {
  const d = new Date(weekId + 'T00:00:00')
  d.setDate(d.getDate() - 7)
  return d.toISOString().split('T')[0]
}

function getNextWeekId(weekId) {
  const d = new Date(weekId + 'T00:00:00')
  d.setDate(d.getDate() + 7)
  return d.toISOString().split('T')[0]
}

export default function Recap() {
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const currentWeekId = getCurrentWeekId()
  const [weekId, setWeekId] = useState(() => getPrevWeekId(currentWeekId))

  const [members, setMembers] = useState([])
  const [avatars, setAvatars] = useState({})
  const [allEntries, setAllEntries] = useState([])
  const [shoutouts, setShoutouts] = useState([])

  useEffect(() => {
    if (!sessionId) return
    return onSnapshot(doc(db, 'sessions', sessionId), snap => {
      if (snap.exists()) {
        setMembers(snap.data().names || [])
        setAvatars(snap.data().avatars || {})
      }
    })
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    const q = query(collection(db, 'entries'), where('sessionId', '==', sessionId))
    return onSnapshot(q, snap => {
      setAllEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    const q = query(
      collection(db, 'shoutouts'),
      where('sessionId', '==', sessionId),
      orderBy('timestamp', 'desc'),
      limit(100)
    )
    return onSnapshot(q, snap => {
      setShoutouts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [sessionId])

  // Entries for the selected week
  const weekEntries = allEntries.filter(e => e.weekId === weekId)
  const completed = weekEntries.filter(e => e.status === 'completed')
  const failed = weekEntries.filter(e => e.status === 'failed')
  const active = weekEntries.filter(e => e.status === 'active')
  const passRate = weekEntries.length > 0
    ? Math.round((completed.length / weekEntries.length) * 100)
    : null

  // Pot for this week
  const weekPot = failed.length * PENALTY
  const totalPot = allEntries.filter(e => e.status === 'failed').length * PENALTY

  // Shoutouts for this week
  const weekShoutouts = shoutouts.filter(s => s.weekId === weekId)

  // Streak leaderboard
  const getStreak = (name) => {
    const past = allEntries
      .filter(e => (e.nameLower || e.name?.toLowerCase()) === name.toLowerCase() && e.weekId < currentWeekId)
      .sort((a, b) => b.weekId.localeCompare(a.weekId))
    let s = 0
    for (const e of past) { if (e.status === 'completed') s++; else break }
    return s
  }

  const streaks = members
    .map(name => ({ name, streak: getStreak(name) }))
    .filter(s => s.streak > 0)
    .sort((a, b) => b.streak - a.streak)

  const isCurrentWeek = weekId === currentWeekId
  const canGoForward = weekId < getPrevWeekId(currentWeekId) || weekId === getPrevWeekId(currentWeekId)
    ? getNextWeekId(weekId) <= getPrevWeekId(currentWeekId)
    : false

  const heroBg = passRate === null ? 'from-zinc-700 to-zinc-800'
    : passRate === 100 ? 'from-emerald-600 to-teal-700'
    : passRate >= 50 ? 'from-amber-600 to-orange-700'
    : 'from-red-700 to-rose-800'

  return (
    <div className="space-y-4">
      {/* Back */}
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
        <ArrowLeft size={15} /> Back
      </button>

      {/* Week selector */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekId(getPrevWeekId(weekId))}
          className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <ChevronLeft size={16} className="text-zinc-500 dark:text-zinc-400" />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-zinc-900 dark:text-white">Week Recap</p>
          <p className="text-xs text-zinc-500">{formatWeekLabel(weekId)}</p>
        </div>
        <button
          onClick={() => setWeekId(getNextWeekId(weekId))}
          disabled={getNextWeekId(weekId) >= currentWeekId}
          className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          <ChevronRight size={16} className="text-zinc-500 dark:text-zinc-400" />
        </button>
      </div>

      {/* Hero card */}
      <div className={`bg-gradient-to-br ${heroBg} rounded-3xl p-6 relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `radial-gradient(circle, white 1.5px, transparent 1.5px)`,
          backgroundSize: '18px 18px',
        }} />
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -left-4 -bottom-6 w-28 h-28 rounded-full bg-black/10" />
        <div className="relative">
          {passRate !== null ? (
            <>
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Pass rate</p>
              <p className="text-6xl font-black text-white leading-none">{passRate}%</p>
              <p className="text-white/70 text-sm mt-2">
                {completed.length} passed · {failed.length} failed
                {active.length > 0 && ` · ${active.length} unknown`}
              </p>
            </>
          ) : (
            <>
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">No data</p>
              <p className="text-3xl font-black text-white">No entries this week</p>
            </>
          )}
        </div>
      </div>

      {/* Members */}
      {weekEntries.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wide px-1">Results</p>

          {/* Passed */}
          {completed.map(e => {
            const idx = members.indexOf(e.name) % AVATAR_COLORS.length
            const color = AVATAR_COLORS[idx < 0 ? 0 : idx]
            return (
              <button key={e.id} onClick={() => navigate(`/${sessionId}/member/${encodeURIComponent(e.name)}`)}
                className="w-full text-left bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl px-4 py-3 flex items-center gap-3 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${color} flex items-center justify-center shrink-0 text-lg`}>
                  {avatars[e.name] || <span className="text-white font-black">{e.name[0]}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-zinc-900 dark:text-white">{e.name} <span className="text-emerald-500">✅</span></p>
                  {e.goalItems?.length > 0 && (
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{e.goalItems.map(g => g.text).join(' · ')}</p>
                  )}
                </div>
              </button>
            )
          })}

          {/* Failed */}
          {failed.map(e => {
            const idx = members.indexOf(e.name) % AVATAR_COLORS.length
            const color = AVATAR_COLORS[idx < 0 ? 0 : idx]
            return (
              <button key={e.id} onClick={() => navigate(`/${sessionId}/member/${encodeURIComponent(e.name)}`)}
                className="w-full text-left bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-2xl px-4 py-3 flex items-center gap-3 hover:border-red-300 dark:hover:border-red-700 transition-colors">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${color} flex items-center justify-center shrink-0 text-lg`}>
                  {avatars[e.name] || <span className="text-white font-black">{e.name[0]}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-zinc-900 dark:text-white">{e.name} <span className="text-red-400">❌</span></p>
                  {e.goalItems?.length > 0 && (
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{e.goalItems.map(g => g.text).join(' · ')}</p>
                  )}
                </div>
                <span className="text-xs font-bold text-red-400 shrink-0">+${PENALTY}</span>
              </button>
            )
          })}

          {/* Active/unknown */}
          {active.map(e => (
            <div key={e.id}
              className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 flex items-center gap-3 opacity-60">
              <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                <span className="text-zinc-500 dark:text-zinc-400 font-black">{e.name[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-zinc-600 dark:text-zinc-400">{e.name} <span>❓</span></p>
                <p className="text-xs text-zinc-400 mt-0.5">Week not closed</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pot this week */}
      {weekPot > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wide mb-1">Added to pot</p>
            <p className="text-3xl font-black text-red-400">${weekPot}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Running total: <span className="font-bold text-zinc-700 dark:text-zinc-300">${totalPot}</span></p>
          </div>
          <div className="text-4xl">💰</div>
        </div>
      )}

      {/* Streak leaderboard */}
      {streaks.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wide px-1">Current streaks</p>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
            {streaks.map(({ name, streak }, i) => {
              const idx = members.indexOf(name) % AVATAR_COLORS.length
              const color = AVATAR_COLORS[idx < 0 ? 0 : idx]
              return (
                <div key={name} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs font-black text-zinc-400 w-4">{i + 1}</span>
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${color} flex items-center justify-center shrink-0 text-sm`}>
                    {avatars[name] || <span className="text-white font-black text-xs">{name[0]}</span>}
                  </div>
                  <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">{name}</span>
                  <span className="text-sm font-black text-orange-400">🔥 {streak}w</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Shoutouts this week */}
      {weekShoutouts.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wide px-1">Shoutouts this week</p>
          {weekShoutouts.map(s => (
            <div key={s.id} className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl px-4 py-3 flex gap-3">
              <span className="text-xl shrink-0">{s.emoji}</span>
              <div>
                <p className="text-sm text-zinc-800 dark:text-zinc-200">
                  <span className="font-bold text-amber-600 dark:text-amber-300">{s.from}</span>
                  <span className="text-zinc-400"> → </span>
                  <span className="font-bold text-zinc-900 dark:text-white">{s.to}</span>
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-0.5">"{s.message}"</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {weekEntries.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <p className="text-4xl">📭</p>
          <p className="font-semibold text-zinc-700 dark:text-zinc-300">No entries for this week</p>
          <p className="text-sm text-zinc-500">Try navigating to a different week</p>
        </div>
      )}
    </div>
  )
}
