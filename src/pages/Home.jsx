import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentWeekId, formatWeekLabel } from '../utils'
import { useAuth } from '../AuthContext'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { X } from 'lucide-react'

const AVATAR_EMOJIS = [
  '🐨','🦊','🐸','🐼','🦁','🐯','🐻','🐰','🐹','🐶',
  '🐱','🐺','🦋','🐧','🦜','🐙','🦄','🐳','🦈','🦕',
  '🌸','⭐','🔥','💎','🌈','🍕','🧁','🍩','🎸','🚀',
  '🌙','🍀','🎯','💫','🎃','🦩','🐝','🦔','🐠','🌵',
]

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
  'from-indigo-500 to-blue-600',
  'from-teal-500 to-emerald-600',
  'from-fuchsia-500 to-pink-600',
]

const AVATAR_HEX = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f97316',
  '#ec4899', '#6366f1', '#14b8a6', '#d946ef',
]

const DAY_LABELS_STATIC = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

const getAvatarColor = (name, members) =>
  AVATAR_COLORS[members.indexOf(name) % AVATAR_COLORS.length]

const getAvatarHex = (name, members) =>
  AVATAR_HEX[members.indexOf(name) % AVATAR_HEX.length]

export default function Home() {
  const { user } = useAuth()
  const weekId = getCurrentWeekId()
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const [members, setMembers] = useState([])
  const [allEntries, setAllEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [memberLogs, setMemberLogs] = useState({})
  const [avatars, setAvatars] = useState({})
  const [nicknames, setNicknames] = useState({})
  const [penalty, setPenalty] = useState(15)
  const [closeWeekOpen, setCloseWeekOpen] = useState(false)
  const [closeStatuses, setCloseStatuses] = useState({})
  const [closing, setClosing] = useState(false)
  const [quickLogEntry, setQuickLogEntry] = useState(null)
  const [qlLogs, setQlLogs] = useState({})
  const [qlLocalCounts, setQlLocalCounts] = useState({})
  const qlSaveTimers = useRef({})

  const entries = useMemo(() => allEntries.filter(e => e.weekId === weekId), [allEntries, weekId])

  useEffect(() => {
    if (!sessionId) return
    const unsub = onSnapshot(doc(db, 'sessions', sessionId), snap => {
      if (snap.exists()) {
        setMembers(snap.data().names || [])
        setAvatars(snap.data().avatars || {})
        setNicknames(snap.data().nicknames || {})
        setPenalty(snap.data().penalty ?? 15)
      }
      setLoading(false)
    }, err => { setError(err.message); setLoading(false) })
    return unsub
  }, [sessionId])

  // Single query — filter weekId client-side to avoid composite index requirement
  useEffect(() => {
    if (!sessionId) return
    const q = query(collection(db, 'entries'), where('sessionId', '==', sessionId))
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setAllEntries(all)
      // Auto-close past weeks
      const stale = all.filter(e => e.status === 'active' && e.weekId < weekId)
      stale.forEach(e => updateDoc(doc(db, 'entries', e.id), { status: 'failed' }))
    }, err => setError(err.message))
  }, [sessionId])

  useEffect(() => {
    if (!entries.length) return
    const unsubs = entries.map(entry =>
      onSnapshot(collection(db, 'entries', entry.id, 'dailyLogs'), snap => {
        const logs = {}
        snap.docs.forEach(d => { logs[d.id] = d.data() })
        setMemberLogs(prev => ({ ...prev, [entry.id]: logs }))
      })
    )
    return () => unsubs.forEach(u => u())
  }, [entries.map(e => e.id).join(',')])

  useEffect(() => {
    if (!quickLogEntry?.id) { setQlLogs({}); setQlLocalCounts({}); return }
    return onSnapshot(collection(db, 'entries', quickLogEntry.id, 'dailyLogs'), snap => {
      const data = {}
      snap.docs.forEach(d => { data[d.id] = d.data() })
      setQlLogs(data)
    })
  }, [quickLogEntry?.id])

  const qlToggleHabit = async (goalText) => {
    if (!quickLogEntry?.id) return
    const current = qlLogs[todayKey] || {}
    const habits = { ...(current.habits || {}) }
    habits[goalText] = !habits[goalText]
    await setDoc(doc(db, 'entries', quickLogEntry.id, 'dailyLogs', todayKey), { ...current, habits })
  }

  const qlSetCount = (key, value) => {
    if (!quickLogEntry?.id) return
    const newVal = Math.max(0, Math.min(999, value))
    setQlLocalCounts(p => ({ ...p, [key]: newVal }))
    clearTimeout(qlSaveTimers.current[key])
    qlSaveTimers.current[key] = setTimeout(async () => {
      const current = qlLogs[todayKey] || {}
      await setDoc(doc(db, 'entries', quickLogEntry.id, 'dailyLogs', todayKey), {
        ...current, counts: { ...(current.counts || {}), [key]: newVal },
      })
    }, 300)
  }

  const qlGetCount = (key) => qlLocalCounts[key] ?? (Number(qlLogs[todayKey]?.counts?.[key]) || 0)

  const getEntry = (name) =>
    entries.find(e => (e.nameLower || e.name?.toLowerCase()) === name.toLowerCase())

  const getStreak = (name) => {
    const past = allEntries
      .filter(e => (e.nameLower || e.name?.toLowerCase()) === name.toLowerCase() && e.weekId < weekId)
      .sort((a, b) => b.weekId.localeCompare(a.weekId))
    let streak = 0
    for (const e of past) {
      if (e.status === 'completed') streak++
      else break
    }
    return streak
  }

  const todayIsMonday = new Date().getDay() === 1
  const missingGoals = members.filter(m => !getEntry(m))
  const showBanner = todayIsMonday && missingGoals.length > 0 && !bannerDismissed

  const dayContextLine = useMemo(() => {
    const day = new Date().getDay() // 0=Sun,1=Mon,...,6=Sat
    const daysLeft = day === 0 ? 0 : 7 - day
    if (day === 1) return 'Fresh week 🚀'
    if (day <= 3) return `${daysLeft} days left`
    if (day === 4) return 'Halfway there'
    if (day === 5) return 'Last push 💪'
    return 'Final stretch'
  }, [])

  // Build last 8 week IDs (oldest → newest)
  const weekHistory = useMemo(() => {
    const ids = []
    const today = new Date()
    const day = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
    for (let i = 7; i >= 0; i--) {
      const d = new Date(monday)
      d.setDate(monday.getDate() - i * 7)
      ids.push(d.toISOString().split('T')[0])
    }
    return ids
  }, [weekId])

  const getMemberWeekStatus = (name, wId) => {
    const e = allEntries.find(e =>
      (e.nameLower || e.name?.toLowerCase()) === name.toLowerCase() && e.weekId === wId
    )
    if (!e) return 'none'
    return e.status // 'active' | 'completed' | 'failed'
  }

  const activeEntries = useMemo(() => entries.filter(e => e.status === 'active'), [entries])

  const openCloseWeek = () => {
    const initial = {}
    activeEntries.forEach(e => { initial[e.name] = 'completed' })
    setCloseStatuses(initial)
    setCloseWeekOpen(true)
  }

  const confirmCloseWeek = async () => {
    setClosing(true)
    await Promise.all(
      activeEntries.map(e =>
        updateDoc(doc(db, 'entries', e.id), { status: closeStatuses[e.name] || 'completed' })
      )
    )
    setClosing(false)
    setCloseWeekOpen(false)
  }

  const todayKey = useMemo(() => new Date().toISOString().split('T')[0], [])
  const potTotal = useMemo(() => allEntries.filter(e => e.status === 'failed').length * penalty, [allEntries, penalty])
  const doneThisWeek = useMemo(() => entries.filter(e => e.status === 'completed').length, [entries])
  const activeThisWeek = useMemo(() => entries.filter(e => e.status === 'active').length, [entries])

  // Completion rate per member over last 8 weeks
  const getMemberRate = useCallback((name) => {
    const relevant = weekHistory.map(wId => getMemberWeekStatus(name, wId)).filter(s => s !== 'none' && s !== 'active')
    if (relevant.length === 0) return null
    return relevant.filter(s => s === 'completed').length / relevant.length
  }, [weekHistory, allEntries])

  // 7 days of the current week (Mon–Sun) as Date objects
  const weekDays = useMemo(() => {
    const d = new Date(weekId)
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(d)
      day.setDate(d.getDate() + i)
      return day
    })
  }, [weekId])

  // Compute goal progress from daily logs
  const getGoalProgress = (entryId, goal) => {
    const logs = memberLogs[entryId] || {}
    if (goal.type === 'habit') {
      const done = Object.values(logs).filter(d => d.habits?.[goal.text]).length
      return { done, total: 7, pct: done / 7 }
    }
    // Sub-goals: progress = average of sub-goal completion ratios
    if (goal.subGoals?.length > 0) {
      const ratios = goal.subGoals.map(sg => {
        const k = `${goal.text}::${sg.text}`
        const done = Object.values(logs).reduce((s, d) => s + (Number(d.counts?.[k]) || 0), 0)
        const tgt = Number(sg.target) || 1
        return Math.min(1, done / tgt)
      })
      const pct = ratios.reduce((s, r) => s + r, 0) / ratios.length
      return { done: null, total: null, pct }
    }
    // weekly / count / total all store in counts
    const done = Object.values(logs).reduce((s, d) => s + (Number(d.counts?.[goal.text]) || 0), 0)
    const total = Number(goal.target) || null
    return { done, total, pct: total ? Math.min(1, done / total) : null }
  }

  const dayHasActivity = (log) =>
    log && (log.note || Object.values(log.habits || {}).some(Boolean) ||
      Object.values(log.counts || {}).some(v => v > 0) ||
      Object.values(log.totals || {}).some(v => v > 0))

  // Per-member cumulative goal progress per day this week (for multi-line chart)
  const getMemberDailyProgress = (name) => {
    const e = getEntry(name)
    if (!e?.goalItems?.length) return []
    const logs = memberLogs[e.id] || {}
    const goals = e.goalItems
    const today = new Date(); today.setHours(23, 59, 59, 0)
    return weekDays
      .filter(day => day <= today)
      .map((_, dayIdx) => {
        const daysUpTo = weekDays.slice(0, dayIdx + 1)
        const progPerGoal = goals.map(g => {
          if (g.type === 'habit') {
            const checked = daysUpTo.filter(d => logs[d.toISOString().split('T')[0]]?.habits?.[g.text]).length
            return checked / 7
          }
          if (g.subGoals?.length > 0) {
            const ratios = g.subGoals.map(sg => {
              const k = `${g.text}::${sg.text}`
              const done = daysUpTo.reduce((s, d) => s + (Number(logs[d.toISOString().split('T')[0]]?.counts?.[k]) || 0), 0)
              return Math.min(1, done / (Number(sg.target) || 1))
            })
            return ratios.reduce((s, r) => s + r, 0) / ratios.length
          }
          const done = daysUpTo.reduce((s, d) => s + (Number(logs[d.toISOString().split('T')[0]]?.counts?.[g.text]) || 0), 0)
          return Math.min(1, done / (Number(g.target) || 1))
        })
        return progPerGoal.reduce((s, v) => s + v, 0) / progPerGoal.length
      })
  }

  const daysElapsed = useMemo(() => {
    const today = new Date(); today.setHours(23,59,59,0)
    return weekDays.filter(d => d <= today).length
  }, [weekDays])

  const chartData = useMemo(() => {
    return DAY_LABELS_STATIC.slice(0, daysElapsed).map((label, dayIdx) => {
      const point = { day: label }
      members.forEach(name => {
        const pts = getMemberDailyProgress(name)
        const val = pts[dayIdx] ?? 0
        point[name] = Math.round(val * 100)
      })
      return point
    })
  }, [daysElapsed, members, memberLogs, allEntries])

  if (loading) return (
    <div className="flex items-center justify-center mt-24">
      <div className="w-6 h-6 border-2 border-zinc-300 dark:border-zinc-600 border-t-emerald-400 rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="mt-8 bg-red-950/40 border border-red-800/50 rounded-2xl p-4 space-y-2">
      <p className="text-red-400 font-semibold text-sm">Connection error</p>
      <p className="text-red-300/70 text-xs break-all">{error}</p>
    </div>
  )

  // ── ALL MEMBERS GRID VIEW ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col space-y-4">

      {/* Monday banner */}
      {showBanner && (
        <div className="bg-amber-950/40 border border-amber-800/50 rounded-2xl px-4 py-3 flex items-start gap-3">
          <span className="text-xl shrink-0">📅</span>
          <div className="flex-1 min-w-0">
            <p className="text-amber-300 font-bold text-sm">New week — lock in your goals!</p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              {missingGoals.join(', ')} {missingGoals.length === 1 ? "hasn't" : "haven't"} submitted yet.
            </p>
          </div>
          <button onClick={() => setBannerDismissed(true)} className="text-amber-600 hover:text-amber-400 transition-colors shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Week label + close week */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-white">This Week</h2>
          <p className="text-xs text-zinc-500 font-medium mt-0.5">{formatWeekLabel(weekId)} · {dayContextLine}</p>
        </div>
        {activeEntries.length > 0 && (
          <button onClick={openCloseWeek}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            Close week
          </button>
        )}
      </div>

      {/* Members grid */}
      {members.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="text-5xl">👥</div>
          <p className="font-semibold text-zinc-700 dark:text-zinc-300">No members yet</p>
          <p className="text-sm text-zinc-500">Add your crew below</p>
        </div>
      ) : (
        <div className="space-y-4">


          {/* Per-member goal progress line chart (Highcharts) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
            <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wide mb-2">Goal progress this week</p>
            <ChartSection members={members} daysElapsed={daysElapsed} chartData={chartData} />
          </div>

          {/* Today's check-in strip */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3">
            <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wide mb-3">Logged today</p>
            <div className="flex items-center gap-3 flex-wrap">
              {members.map((name, i) => {
                const e = getEntry(name)
                const logs = e ? (memberLogs[e.id] || {}) : {}
                const todayLog = logs[todayKey]
                const hasLogged = todayLog && (
                  todayLog.note ||
                  Object.values(todayLog.habits || {}).some(Boolean) ||
                  Object.values(todayLog.counts || {}).some(v => v > 0)
                )
                const color = getAvatarColor(name, members)
                return (
                  <div key={name} className="flex flex-col items-center gap-1.5"
                    onClick={() => navigate(`/${sessionId}/member/${encodeURIComponent(name)}`)}>
                    <div className="relative">
                      <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${color} flex items-center justify-center ${hasLogged ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900' : 'opacity-40'}`}>
                        {avatars[name]
                          ? <span className="text-xl">{avatars[name]}</span>
                          : <span className="text-white font-black text-base">{name[0].toUpperCase()}</span>
                        }
                      </div>
                      {hasLogged && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-400 rounded-full flex items-center justify-center">
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold ${hasLogged ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400 dark:text-zinc-600'}`}>
                      {nicknames[name] || name.split(' ')[0]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Goals this week */}
          <div className="space-y-2">
            <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wide px-1">This week's goals</p>
            {members.map(name => {
              const e = getEntry(name)
              const color = getAvatarColor(name, members)
              const streak = getStreak(name)
              return (
                <div
                  key={name}
                  onClick={() => navigate(`/${sessionId}/member/${encodeURIComponent(name)}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={ev => ev.key === 'Enter' && navigate(`/${sessionId}/member/${encodeURIComponent(name)}`)}
                  className="flex gap-3 px-2 py-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${color} flex items-center justify-center`}>
                      {avatars[name]
                        ? <span className="text-2xl">{avatars[name]}</span>
                        : <span className="text-white font-black text-lg">{name[0].toUpperCase()}</span>
                      }
                    </div>
                    {(e?.status === 'completed' || e?.status === 'failed' || !e) && (
                      <span className="absolute -bottom-0.5 -right-0.5 text-sm leading-none">
                        {e?.status === 'completed' ? '✅' : e?.status === 'failed' ? '❌' : '💤'}
                      </span>
                    )}
                  </div>

                  {/* Right content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Name + streak */}
                    <div className="flex items-baseline gap-2">
                      <p className={`font-bold text-sm leading-tight ${!e ? 'text-zinc-400' : 'text-zinc-900 dark:text-white'}`}>{nicknames[name] || name}</p>
                      {streak >= 2 && <span className="text-[10px] text-zinc-400 dark:text-zinc-500">🔥 {streak}w</span>}
                      {!e && <span className="text-[10px] text-zinc-400 italic">no goals yet</span>}
                    </div>

                    {/* Goals */}
                    {e?.goalItems?.length > 0 && e.goalItems.map((g, i) => {
                      const logs = memberLogs[e.id] || {}
                      const prog = getGoalProgress(e?.id, g)
                      if (g.subGoals?.length > 0) {
                        return (
                          <div key={i} className="space-y-1">
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium truncate">{g.text}</p>
                            {g.subGoals.map((sg, si) => {
                              const k = `${g.text}::${sg.text}`
                              const done = Object.values(logs).reduce((s, d) => s + (Number(d.counts?.[k]) || 0), 0)
                              const tgt = Number(sg.target) || null
                              const pct = tgt ? Math.min(1, done / tgt) : null
                              return (
                                <div key={si} className="flex items-center gap-2 pl-2">
                                  <span className="text-[10px] text-zinc-400 flex-1 truncate">{sg.text}</span>
                                  <span className="text-[10px] text-zinc-400 shrink-0">{tgt ? `${done}/${tgt}` : done}</span>
                                  {pct !== null && (
                                    <div className="w-12 bg-zinc-200 dark:bg-zinc-700 rounded-full h-1 overflow-hidden shrink-0">
                                      <div className={`h-full rounded-full ${pct >= 1 ? 'bg-emerald-400' : 'bg-zinc-400'}`} style={{ width: `${Math.round(pct * 100)}%` }} />
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      }
                      const label = g.type === 'habit'
                        ? `${prog.done}/7`
                        : prog.total ? `${prog.done}/${prog.total}` : `${prog.done}`
                      return (
                        <div key={i} className="space-y-0.5">
                          <span className="text-xs text-zinc-600 dark:text-zinc-400 block truncate">{g.text}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-400 font-medium shrink-0">{label}</span>
                            {prog.pct !== null && (
                              <div className="flex-1 bg-zinc-200 dark:bg-zinc-700 rounded-full h-1 overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${prog.pct >= 1 ? 'bg-emerald-400' : prog.pct >= 0.5 ? 'bg-amber-400' : 'bg-zinc-400'}`}
                                  style={{ width: `${Math.round(prog.pct * 100)}%` }} />
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {/* Log today */}
                    {e?.status === 'active' && e?.goalItems?.length > 0 && e?.name?.toLowerCase() === user?.displayName?.toLowerCase() && (
                      <button
                        onClick={ev => { ev.stopPropagation(); setQuickLogEntry(e) }}
                        className="mt-1 px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-all"
                      >
                        + Log today
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick log sheet */}
      {quickLogEntry && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setQuickLogEntry(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-3xl w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={ev => ev.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-zinc-900 px-6 pt-5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-black text-zinc-900 dark:text-white">Log today</p>
                  <p className="text-xs text-zinc-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(quickLogEntry.name, members)} flex items-center justify-center`}>
                    {avatars[quickLogEntry.name]
                      ? <span className="text-base">{avatars[quickLogEntry.name]}</span>
                      : <span className="text-white font-black text-sm">{quickLogEntry.name[0]}</span>}
                  </div>
                  <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{quickLogEntry.name}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 space-y-3">
              {quickLogEntry.goalItems?.map((goal, gi) => {
                if (goal.type === 'habit') {
                  const checked = !!qlLogs[todayKey]?.habits?.[goal.text]
                  return (
                    <button key={gi}
                      onClick={() => qlToggleHabit(goal.text)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                        checked ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700'
                      }`}>
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                        checked ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-300 dark:border-zinc-600'
                      }`}>
                        {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </span>
                      <span className={`flex-1 text-sm font-semibold text-left ${checked ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-800 dark:text-zinc-200'}`}>{goal.text}</span>
                    </button>
                  )
                }
                if (goal.subGoals?.length > 0) {
                  return (
                    <div key={gi} className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 space-y-2.5">
                      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{goal.text}</p>
                      {goal.subGoals.map((sg, si) => {
                        const k = `${goal.text}::${sg.text}`
                        return (
                          <div key={si} className="flex items-center gap-3">
                            <span className="text-xs text-zinc-500 flex-1 truncate">{sg.text}</span>
                            <QlCounter value={qlGetCount(k)} unit={sg.unit} onChange={v => qlSetCount(k, v)} />
                          </div>
                        )
                      })}
                    </div>
                  )
                }
                return (
                  <div key={gi} className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex-1 truncate">{goal.text}</span>
                    <QlCounter value={qlGetCount(goal.text)} unit={goal.unit} onChange={v => qlSetCount(goal.text, v)} />
                  </div>
                )
              })}
              <button onClick={() => setQuickLogEntry(null)}
                className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold rounded-xl py-3 text-sm transition-all mt-2">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close week modal */}
      {closeWeekOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setCloseWeekOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto -mt-2 mb-2" />
            <div>
              <p className="text-base font-black text-zinc-900 dark:text-white">Close this week</p>
              <p className="text-xs text-zinc-500 mt-0.5">Mark each person as passed or failed</p>
            </div>
            <div className="space-y-2">
              {activeEntries.map(e => (
                <div key={e.id} className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl px-4 py-3">
                  <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(e.name, members)} flex items-center justify-center shrink-0 text-base`}>
                    {avatars[e.name] || <span className="text-white font-black text-sm">{e.name[0]}</span>}
                  </div>
                  <p className="flex-1 font-semibold text-sm text-zinc-800 dark:text-zinc-200">{e.name}</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setCloseStatuses(s => ({ ...s, [e.name]: 'completed' }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        closeStatuses[e.name] === 'completed'
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-emerald-400 hover:text-emerald-500'
                      }`}>
                      ✅ Pass
                    </button>
                    <button
                      onClick={() => setCloseStatuses(s => ({ ...s, [e.name]: 'failed' }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        closeStatuses[e.name] === 'failed'
                          ? 'bg-red-500 border-red-500 text-white'
                          : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-red-400 hover:text-red-500'
                      }`}>
                      ❌ Fail
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={confirmCloseWeek} disabled={closing}
              className="w-full bg-zinc-900 dark:bg-white hover:bg-zinc-700 dark:hover:bg-zinc-100 disabled:opacity-40 text-white dark:text-zinc-900 font-bold rounded-xl py-3 transition-all text-sm">
              {closing ? 'Closing...' : `Close week for ${activeEntries.length} member${activeEntries.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const ChartSection = memo(function ChartSection({ members, daysElapsed, chartData }) {
  const options = useMemo(() => ({
    chart: {
      type: 'spline',
      backgroundColor: 'transparent',
      height: 200,
      style: { fontFamily: 'inherit' },
      spacing: [8, 8, 8, 0],
    },
    title: { text: null },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: {
      categories: DAY_LABELS_STATIC.slice(0, daysElapsed),
      labels: { style: { color: '#71717a', fontSize: '10px' } },
      lineColor: '#27272a',
      tickColor: '#27272a',
      gridLineColor: '#27272a',
    },
    yAxis: {
      min: 0, max: 100,
      title: { text: null },
      labels: { format: '{value}%', style: { color: '#71717a', fontSize: '10px' } },
      gridLineColor: '#27272a',
      tickPositions: [0, 25, 50, 75, 100],
    },
    tooltip: {
      backgroundColor: '#18181b',
      borderColor: '#3f3f46',
      borderRadius: 12,
      style: { color: '#e4e4e7', fontSize: '12px' },
      pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.y}%</b><br/>',
    },
    plotOptions: {
      spline: {
        lineWidth: 2.5,
        marker: { enabled: true, radius: 4, lineWidth: 0 },
        states: { hover: { lineWidth: 3 } },
      },
    },
    series: members.map((name, i) => ({
      name,
      color: AVATAR_HEX[i % AVATAR_HEX.length],
      data: chartData.map(d => d[name] ?? 0),
    })),
  }), [members, daysElapsed, chartData])

  return (
    <>
      <HighchartsReact key={members.join(',')} highcharts={Highcharts} options={options} />
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
        {members.map((name, i) => (
          <div key={name} className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: AVATAR_HEX[i % AVATAR_HEX.length] }} />
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">{name}</span>
          </div>
        ))}
      </div>
    </>
  )
})

function QlCounter({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button onClick={e => { e.stopPropagation(); onChange(Math.max(0, value - 1)) }}
        className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-all select-none">
        −
      </button>
      <span className="text-sm font-black text-zinc-900 dark:text-white w-6 text-center tabular-nums">{value}</span>
      <button onClick={e => { e.stopPropagation(); onChange(Math.min(999, value + 1)) }}
        className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-all select-none">
        +
      </button>
    </div>
  )
}
