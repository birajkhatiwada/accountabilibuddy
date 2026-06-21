import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, addDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentWeekId, formatWeekLabel, formatTimestamp } from '../utils'
import { CheckCircle, XCircle, Send, AlertTriangle, ArrowLeft, Plus, Check, Pencil, X, UserPlus, Trash2 } from 'lucide-react'
import WeekCalendar from '../components/WeekCalendar'
import GoalBuilder from '../components/GoalBuilder'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

const MEMBERS_DOC = doc(db, 'config', 'members')
const PENALTY = 15

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

const getAvatarColor = (name, members) =>
  AVATAR_COLORS[members.indexOf(name) % AVATAR_COLORS.length]

const getAvatarHex = (name, members) =>
  AVATAR_HEX[members.indexOf(name) % AVATAR_HEX.length]

export default function Home() {
  const weekId = getCurrentWeekId()
  const [members, setMembers] = useState([])
  const [entries, setEntries] = useState([])
  const [allEntries, setAllEntries] = useState([])
  const [selectedMember, setSelectedMember] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [goalsInput, setGoalsInput] = useState([])
  const [proofInput, setProofInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmFail, setConfirmFail] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [editingGoals, setEditingGoals] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [memberLogs, setMemberLogs] = useState({}) // entryId -> { dayKey -> logData }
  const [avatars, setAvatars] = useState({}) // name -> emoji
  const [pickingAvatar, setPickingAvatar] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(MEMBERS_DOC, snap => {
      if (snap.exists()) {
        setMembers(snap.data().names || [])
        setAvatars(snap.data().avatars || {})
      }
      setLoading(false)
    }, err => { setError(err.message); setLoading(false) })
    return unsub
  }, [])

  const saveAvatar = async (name, emoji) => {
    await setDoc(MEMBERS_DOC, { avatars: { ...avatars, [name]: emoji } }, { merge: true })
    setPickingAvatar(false)
  }

  useEffect(() => {
    const q = query(collection(db, 'entries'), where('weekId', '==', weekId))
    return onSnapshot(q, snap => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, err => setError(err.message))
  }, [weekId])

  useEffect(() => {
    return onSnapshot(collection(db, 'entries'), snap => {
      setAllEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  // Load daily logs for all current-week entries
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

  const openMember = (name) => {
    setSelectedMember(name)
    setConfirmFail(false)
    setProofInput('')
    setGoalsInput([])
    setEditingGoals(false)
  }

  const closeMember = () => {
    setSelectedMember(null)
    setConfirmFail(false)
    setEditingGoals(false)
    setConfirmDelete(false)
    setPickingAvatar(false)
  }

  const deleteMember = async (name) => {
    await setDoc(MEMBERS_DOC, { names: members.filter(m => m !== name) }, { merge: true })
    closeMember()
  }

  const submitGoals = async (name) => {
    const validGoals = goalsInput.filter(g => g.text.trim())
    if (!validGoals.length) return
    setSubmitting(true)
    const goalsSummary = validGoals.map(g =>
      g.type === 'habit' ? `${g.text} (every day)` :
      g.target ? `${g.text} (${g.target} ${g.unit})` : g.text
    ).join('\n')
    await addDoc(collection(db, 'entries'), {
      weekId, name, nameLower: name.toLowerCase(),
      goals: goalsSummary,
      goalItems: validGoals.map(g => ({
        text: g.text.trim(),
        type: g.type || 'habit',
        target: (g.type === 'count' || g.type === 'total') && g.target ? Number(g.target) : null,
        unit: g.unit?.trim() || '',
      })),
      status: 'active', updates: [],
      createdAt: Timestamp.now(),
    })
    setGoalsInput([])
    setSubmitting(false)
  }

  const updateGoals = async (entry) => {
    const validGoals = goalsInput.filter(g => g.text.trim())
    if (!validGoals.length) return
    setSubmitting(true)
    const goalsSummary = validGoals.map(g =>
      g.type === 'habit' ? `${g.text} (every day)` :
      g.target ? `${g.text} (${g.target} ${g.unit})` : g.text
    ).join('\n')
    await updateDoc(doc(db, 'entries', entry.id), {
      goals: goalsSummary,
      goalItems: validGoals.map(g => ({
        text: g.text.trim(),
        type: g.type || 'habit',
        target: (g.type === 'count' || g.type === 'total') && g.target ? Number(g.target) : null,
        unit: g.unit?.trim() || '',
      })),
    })
    setGoalsInput([])
    setEditingGoals(false)
    setSubmitting(false)
  }

  const addProof = async (entry) => {
    if (!proofInput.trim()) return
    setSubmitting(true)
    await updateDoc(doc(db, 'entries', entry.id), {
      updates: arrayUnion({ text: proofInput.trim(), timestamp: Timestamp.now() }),
    })
    setProofInput('')
    setSubmitting(false)
  }

  const addMember = async () => {
    const name = newMemberName.trim()
    if (!name || members.some(m => m.toLowerCase() === name.toLowerCase())) {
      setAddingMember(false)
      setNewMemberName('')
      return
    }
    await setDoc(MEMBERS_DOC, { names: [...members, name] }, { merge: true })
    setNewMemberName('')
    setAddingMember(false)
    openMember(name)
  }

  const markDone = (entry) => updateDoc(doc(db, 'entries', entry.id), { status: 'completed' })
  const markFailed = async (entry) => {
    await updateDoc(doc(db, 'entries', entry.id), { status: 'failed' })
    setConfirmFail(false)
  }

  const todayIsMonday = new Date().getDay() === 1
  const missingGoals = members.filter(m => !getEntry(m))
  const showBanner = todayIsMonday && missingGoals.length > 0 && !bannerDismissed

  // Build last 8 week IDs (oldest → newest)
  const getLastWeekIds = (n) => {
    const ids = []
    const today = new Date()
    const day = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(monday)
      d.setDate(monday.getDate() - i * 7)
      ids.push(d.toISOString().split('T')[0])
    }
    return ids
  }
  const weekHistory = getLastWeekIds(8)

  const getMemberWeekStatus = (name, wId) => {
    const e = allEntries.find(e =>
      (e.nameLower || e.name?.toLowerCase()) === name.toLowerCase() && e.weekId === wId
    )
    if (!e) return 'none'
    return e.status // 'active' | 'completed' | 'failed'
  }

  const potTotal = allEntries.filter(e => e.status === 'failed').length * PENALTY
  const doneThisWeek = entries.filter(e => e.status === 'completed').length
  const activeThisWeek = entries.filter(e => e.status === 'active').length

  // Completion rate per member over last 8 weeks
  const getMemberRate = (name) => {
    const relevant = weekHistory.map(wId => getMemberWeekStatus(name, wId)).filter(s => s !== 'none' && s !== 'active')
    if (relevant.length === 0) return null
    return relevant.filter(s => s === 'completed').length / relevant.length
  }

  // 7 days of the current week (Mon–Sun) as Date objects
  const getWeekDays = () => {
    const d = new Date(weekId)
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(d)
      day.setDate(d.getDate() + i)
      return day
    })
  }
  const weekDays = getWeekDays()

  // Compute goal progress from daily logs
  const getGoalProgress = (entryId, goal) => {
    const logs = memberLogs[entryId] || {}
    if (goal.type === 'habit') {
      const done = Object.values(logs).filter(d => d.habits?.[goal.text]).length
      return { done, total: 7, pct: done / 7 }
    } else if (goal.type === 'count') {
      const done = Object.values(logs).reduce((s, d) => s + (Number(d.counts?.[goal.text]) || 0), 0)
      const total = Number(goal.target) || null
      return { done, total, pct: total ? Math.min(1, done / total) : null }
    } else {
      const done = Object.values(logs).reduce((s, d) => s + (Number(d.totals?.[goal.text]) || 0), 0)
      const total = Number(goal.target) || null
      return { done, total, pct: total ? Math.min(1, done / total) : null }
    }
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
          } else if (g.type === 'count') {
            const done = daysUpTo.reduce((s, d) => s + (Number(logs[d.toISOString().split('T')[0]]?.counts?.[g.text]) || 0), 0)
            return Math.min(1, done / (Number(g.target) || 1))
          } else {
            const done = daysUpTo.reduce((s, d) => s + (Number(logs[d.toISOString().split('T')[0]]?.totals?.[g.text]) || 0), 0)
            return Math.min(1, done / (Number(g.target) || 1))
          }
        })
        return progPerGoal.reduce((s, v) => s + v, 0) / progPerGoal.length
      })
  }

  // Build recharts-compatible data array: [{day:'Mon', Name1: 0.4, Name2: 0.7}, ...]
  const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const today = new Date(); today.setHours(23,59,59,0)
  const daysElapsed = weekDays.filter(d => d <= today).length

  const chartData = DAY_LABELS.slice(0, daysElapsed).map((label, dayIdx) => {
    const point = { day: label }
    members.forEach(name => {
      const pts = getMemberDailyProgress(name)
      const val = pts[dayIdx] ?? 0
      point[name] = Math.round(val * 100)
    })
    return point
  })

  if (loading) return (
    <div className="flex items-center justify-center mt-24">
      <div className="w-6 h-6 border-2 border-zinc-600 border-t-emerald-400 rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="mt-8 bg-red-950/40 border border-red-800/50 rounded-2xl p-4 space-y-2">
      <p className="text-red-400 font-semibold text-sm">Connection error</p>
      <p className="text-red-300/70 text-xs break-all">{error}</p>
    </div>
  )

  // ── MEMBER DETAIL VIEW ────────────────────────────────────────────────────
  if (selectedMember) {
    const entry = getEntry(selectedMember)
    const streak = getStreak(selectedMember)
    const color = getAvatarColor(selectedMember, members)
    const goalCount = entry?.goalItems?.length || 0
    const updateCount = entry?.updates?.length || 0

    return (
      <div className="flex flex-col space-y-4">
        {/* Back + delete */}
        <div className="flex items-center justify-between">
          <button onClick={closeMember}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 transition-colors">
            <ArrowLeft size={15} /> All members
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Remove {selectedMember}?</span>
              <button onClick={() => deleteMember(selectedMember)}
                className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors px-2 py-1 bg-red-950/40 rounded-lg">
                Remove
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="p-1.5 text-zinc-700 hover:text-red-400 transition-colors rounded-lg hover:bg-red-950/30">
              <Trash2 size={15} />
            </button>
          )}
        </div>

        {/* Hero — full bleed, taller, more immersive */}
        <div className={`-mx-4 bg-gradient-to-br ${color} relative overflow-hidden px-6 pt-8 pb-6`}>
          <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10" />
          <div className="absolute -left-6 -bottom-8 w-36 h-36 rounded-full bg-black/10" />
          <div className="absolute right-8 bottom-4 w-16 h-16 rounded-full bg-white/10" />

          <div className="relative flex items-end justify-between">
            <div className="flex items-center gap-5">
              {/* Big circular avatar — tap to change */}
              <button
                onClick={() => setPickingAvatar(v => !v)}
                className="w-20 h-20 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center shadow-xl relative group transition-all hover:scale-105 active:scale-95"
              >
                {avatars[selectedMember]
                  ? <span className="text-4xl">{avatars[selectedMember]}</span>
                  : <span className="text-white font-black text-4xl">{selectedMember[0].toUpperCase()}</span>
                }
                <span className="absolute inset-0 rounded-full flex items-end justify-center pb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-bold text-white/70 bg-black/30 rounded-full px-1.5">edit</span>
                </span>
              </button>

              <div>
                <h2 className="text-3xl font-black text-white leading-none mb-1">{selectedMember}</h2>
                {streak >= 2
                  ? <span className="text-white/80 text-sm font-bold">🔥 {streak}-week streak</span>
                  : <span className="text-white/50 text-sm">{formatWeekLabel(weekId)}</span>
                }
              </div>
            </div>
            {entry && !editingGoals && (
              <button
                onClick={() => { if (entry.goalItems?.length) setGoalsInput(entry.goalItems); setEditingGoals(true) }}
                className="bg-black/20 hover:bg-black/30 text-white/80 hover:text-white rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Pencil size={11} /> Edit
              </button>
            )}
          </div>
        </div>

        {/* Status + stats row */}
        {entry && (
          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-2xl p-3 text-center ${
              entry.status === 'completed' ? 'bg-emerald-950/60 border border-emerald-800/50' :
              entry.status === 'failed' ? 'bg-red-950/60 border border-red-800/50' :
              'bg-zinc-900 border border-zinc-800'
            }`}>
              <p className="text-xl mb-0.5">
                {entry.status === 'completed' ? '✅' : entry.status === 'failed' ? '❌' : '🔄'}
              </p>
              <p className={`text-[10px] font-bold uppercase tracking-wide ${
                entry.status === 'completed' ? 'text-emerald-400' :
                entry.status === 'failed' ? 'text-red-400' : 'text-amber-400'
              }`}>
                {entry.status === 'completed' ? 'Done!' : entry.status === 'failed' ? 'Failed' : 'Active'}
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
              <p className="text-xl font-black text-white mb-0.5">{goalCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Goal{goalCount !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
              <p className="text-xl font-black text-white mb-0.5">{updateCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Update{updateCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
        )}

        {/* No goals state */}
        {!entry && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <p className="text-zinc-400 text-sm font-medium">Lock in your goals for this week 🔒</p>
            <GoalBuilder onChange={setGoalsInput} />
            <button
              onClick={() => submitGoals(selectedMember)}
              disabled={submitting || !goalsInput.some(g => g.text.trim())}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-bold rounded-xl py-3 transition-all shadow-lg shadow-emerald-900/30"
            >
              {submitting ? 'Locking in...' : 'Lock in goals 🔒'}
            </button>
          </div>
        )}

        {entry && (
          <>
            {/* Edit goals */}
            {editingGoals && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-zinc-300">Edit goals</p>
                  <button onClick={() => setEditingGoals(false)} className="text-zinc-600 hover:text-zinc-400 transition-colors">
                    <X size={16} />
                  </button>
                </div>
                <GoalBuilder initialGoals={entry.goalItems} onChange={setGoalsInput} />
                <button
                  onClick={() => updateGoals(entry)}
                  disabled={submitting || !goalsInput.some(g => g.text.trim())}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-bold rounded-xl py-2.5 transition-all"
                >
                  {submitting ? 'Saving...' : 'Save goals'}
                </button>
              </div>
            )}

            {/* Goals display — chips layout */}
            {!editingGoals && entry.goalItems?.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3 font-semibold">Goals this week</p>
                <div className="space-y-2">
                  {entry.goalItems.map((g, i) => (
                    <div key={i} className="flex items-center gap-3 bg-zinc-800/60 rounded-xl px-3 py-2.5">
                      <span className="text-base shrink-0">
                        {g.type === 'habit' ? '✓' : g.type === 'count' ? '×' : '#'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-200 font-medium">{g.text}</p>
                        {g.target && <p className="text-xs text-zinc-500">{g.target} {g.unit}</p>}
                      </div>
                      <span className="text-[10px] text-zinc-600 shrink-0">
                        {g.type === 'habit' ? 'daily' : g.type === 'count' ? 'count' : 'total'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress log */}
            {entry.updates?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold px-1">Progress log</p>
                {entry.updates.map((u, i) => (
                  <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex gap-3">
                    <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                    <div>
                      <p className="text-sm text-zinc-200">{u.text}</p>
                      <p className="text-xs text-zinc-600 mt-0.5">{formatTimestamp(u.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Per-goal area chart */}
            {entry?.goalItems?.length > 0 && (() => {
              const GOAL_COLORS = ['#8b5cf6','#3b82f6','#10b981','#f97316','#ec4899','#14b8a6']
              const today = new Date(); today.setHours(23,59,59,0)
              const elapsed = weekDays.filter(d => d <= today)
              const categories = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].slice(0, elapsed.length)

              const getGoalDailyPct = (goal) => {
                const logs = memberLogs[entry.id] || {}
                return elapsed.map((_, dayIdx) => {
                  const daysUpTo = weekDays.slice(0, dayIdx + 1)
                  if (goal.type === 'habit') {
                    const checked = daysUpTo.filter(d => logs[d.toISOString().split('T')[0]]?.habits?.[goal.text]).length
                    return Math.round(checked / 7 * 100)
                  } else if (goal.type === 'count') {
                    const done = daysUpTo.reduce((s, d) => s + (Number(logs[d.toISOString().split('T')[0]]?.counts?.[goal.text]) || 0), 0)
                    return Math.round(Math.min(1, done / (Number(goal.target) || 1)) * 100)
                  } else {
                    const done = daysUpTo.reduce((s, d) => s + (Number(logs[d.toISOString().split('T')[0]]?.totals?.[goal.text]) || 0), 0)
                    return Math.round(Math.min(1, done / (Number(goal.target) || 1)) * 100)
                  }
                })
              }

              return (
                <div className="bg-zinc-800/40 rounded-2xl p-4">
                  <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wide mb-2">Goal progress this week</p>
                  <HighchartsReact
                    key={entry?.goalItems?.map(g => g.text).join(',')}
                    immutable={true}
                    highcharts={Highcharts}
                    options={{
                      chart: {
                        type: 'areaspline',
                        backgroundColor: 'transparent',
                        height: 180,
                        spacing: [8, 8, 8, 0],
                        style: { fontFamily: 'inherit' },
                      },
                      title: { text: null },
                      credits: { enabled: false },
                      legend: { enabled: false },
                      xAxis: {
                        categories,
                        labels: { style: { color: '#71717a', fontSize: '10px' } },
                        lineColor: '#27272a',
                        tickColor: 'transparent',
                        gridLineColor: 'transparent',
                      },
                      yAxis: {
                        min: 0, max: 100,
                        title: { text: null },
                        labels: { format: '{value}%', style: { color: '#71717a', fontSize: '10px' } },
                        gridLineColor: '#27272a',
                        tickPositions: [0, 25, 50, 75, 100],
                      },
                      tooltip: {
                        shared: true,
                        backgroundColor: '#18181b',
                        borderColor: '#3f3f46',
                        borderRadius: 12,
                        style: { color: '#e4e4e7', fontSize: '11px' },
                        pointFormat: '<span style="color:{series.color}">●</span> {series.name}: <b>{point.y}%</b><br/>',
                      },
                      plotOptions: {
                        areaspline: {
                          fillOpacity: 0.15,
                          lineWidth: 2,
                          marker: { enabled: true, radius: 3, lineWidth: 0 },
                          states: { hover: { lineWidth: 2.5 } },
                        },
                      },
                      series: entry.goalItems.map((g, i) => ({
                        name: g.text,
                        color: GOAL_COLORS[i % GOAL_COLORS.length],
                        data: getGoalDailyPct(g),
                      })),
                    }}
                  />
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {entry.goalItems.map((g, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: GOAL_COLORS[i % GOAL_COLORS.length] }} />
                        <span className="text-[10px] text-zinc-400">{g.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Week calendar */}
            <WeekCalendar entryId={entry.id} goalItems={entry.goalItems} goals={entry.goals} />

            {/* Actions */}
            {entry.status === 'active' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Drop some proof..."
                    value={proofInput}
                    onChange={e => setProofInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addProof(entry)}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    onClick={() => addProof(entry)}
                    disabled={submitting || !proofInput.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl px-4 transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => markDone(entry)}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-800/50 text-emerald-400 rounded-xl py-3 text-sm font-bold transition-colors"
                  >
                    <CheckCircle size={15} /> Week complete
                  </button>
                  <button
                    onClick={() => setConfirmFail(true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-900/20 hover:bg-red-900/40 border border-red-800/40 text-red-400 rounded-xl py-3 text-sm font-bold transition-colors"
                  >
                    <XCircle size={15} /> I failed
                  </button>
                </div>
                {confirmFail && (
                  <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4 space-y-3">
                    <p className="text-red-300 text-sm font-medium flex items-center gap-2">
                      <AlertTriangle size={15} /> This adds ${PENALTY} to the pot. For real?
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => markFailed(entry)} className="flex-1 bg-red-700 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-bold transition-colors">
                        Yeah, I failed
                      </button>
                      <button onClick={() => setConfirmFail(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg py-2 text-sm transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      {/* Emoji avatar picker — fixed overlay so it's never clipped */}
      {pickingAvatar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4" onClick={() => setPickingAvatar(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-4 shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-zinc-200">Pick your avatar</p>
              <button onClick={() => setPickingAvatar(false)} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-8 gap-1.5">
              {AVATAR_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => saveAvatar(selectedMember, emoji)}
                  className={`text-2xl rounded-xl p-1.5 hover:bg-zinc-700 transition-colors active:scale-90 ${avatars[selectedMember] === emoji ? 'bg-zinc-700 ring-2 ring-emerald-500' : ''}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
    )
  }

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

      {/* Week label */}
      <div>
        <h2 className="text-xl font-black text-white">This Week</h2>
        <p className="text-xs text-zinc-500 font-medium mt-0.5">{formatWeekLabel(weekId)}</p>
      </div>

      {/* Members grid */}
      {members.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="text-5xl">👥</div>
          <p className="font-semibold text-zinc-300">No members yet</p>
          <p className="text-sm text-zinc-500">Add your crew below</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-zinc-900 rounded-2xl p-3 text-center border border-zinc-800">
              <p className="text-2xl font-black text-emerald-400">{doneThisWeek}</p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide mt-0.5">Done</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-3 text-center border border-zinc-800">
              <p className="text-2xl font-black text-amber-400">{activeThisWeek}</p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide mt-0.5">Active</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-3 text-center border border-zinc-800">
              <p className="text-2xl font-black text-red-400">${potTotal}</p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide mt-0.5">The Pot</p>
            </div>
          </div>

          {/* Per-member goal progress line chart (Highcharts) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wide mb-2">Goal progress this week</p>
            <HighchartsReact
              key={members.join(',')}
              immutable={true}
              highcharts={Highcharts}
              options={{
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
                  categories: DAY_LABELS.slice(0, daysElapsed),
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
                series: members.map(name => ({
                  name,
                  color: getAvatarHex(name, members),
                  data: chartData.map(d => d[name] ?? 0),
                })),
              }}
            />
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
              {members.map(name => (
                <div key={name} className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: getAvatarHex(name, members) }} />
                  <span className="text-[11px] text-zinc-400 font-medium">{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Goals this week */}
          <div className="space-y-2">
            <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wide px-1">This week's goals</p>
            {members.map(name => {
              const e = getEntry(name)
              const color = getAvatarColor(name, members)
              if (!e?.goalItems?.length && !e?.goals) return null
              const streak = getStreak(name)
              return (
                <button
                  key={name}
                  onClick={() => openMember(name)}
                  className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors"
                >
                  {/* Top: profile */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}>
                      {avatars[name]
                        ? <span className="text-2xl">{avatars[name]}</span>
                        : <span className="text-white font-black text-lg">{name[0].toUpperCase()}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm leading-tight">{name}</p>
                      <p className="text-zinc-500 text-[11px]">
                        {streak >= 2 ? `🔥 ${streak}-week streak` : 'This week'}
                      </p>
                    </div>
                    <span className="text-lg">
                      {e.status === 'completed' ? '✅' : e.status === 'failed' ? '❌' : '🔥'}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-zinc-800 mx-4" />

                  {/* Bottom: goals */}
                  <div className="px-4 py-3 flex flex-col gap-2">
                    {e.goalItems?.length > 0 ? (
                      e.goalItems.map((g, i) => {
                        const prog = getGoalProgress(e.id, g)
                        const label = g.type === 'habit'
                          ? `${prog.done}/7 days`
                          : prog.total
                            ? `${prog.done}/${prog.total}${g.unit ? ' ' + g.unit : ''}`
                            : `${prog.done}${g.unit ? ' ' + g.unit : ''}`
                        return (
                          <div key={i}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[9px] font-black w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 ${
                                g.type === 'habit' ? 'bg-violet-500/20 text-violet-400' :
                                g.type === 'count' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-emerald-500/20 text-emerald-400'
                              }`}>
                                {g.type === 'habit' ? '✓' : g.type === 'count' ? '×' : '#'}
                              </span>
                              <span className="text-zinc-300 text-xs flex-1 truncate">{g.text}</span>
                              <span className="text-zinc-500 text-[10px] font-semibold shrink-0">{label}</span>
                            </div>
                            {prog.pct !== null && (
                              <div className="bg-zinc-800 rounded-full h-1 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    prog.pct >= 1 ? 'bg-emerald-400' :
                                    prog.pct >= 0.5 ? 'bg-amber-400' : 'bg-zinc-500'
                                  }`}
                                  style={{ width: `${Math.round(prog.pct * 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-zinc-600 text-xs">{e.goals}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Add member */}
          {addingMember ? (
            <div className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-4 space-y-3">
              <input
                autoFocus
                type="text"
                placeholder="Their name..."
                value={newMemberName}
                onChange={e => setNewMemberName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addMember()
                  if (e.key === 'Escape') { setAddingMember(false); setNewMemberName('') }
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <div className="flex gap-2">
                <button onClick={addMember} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-2.5 text-sm font-bold transition-colors">Add</button>
                <button onClick={() => { setAddingMember(false); setNewMemberName('') }} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl py-2.5 text-sm transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingMember(true)}
              className="w-full rounded-2xl border-2 border-dashed border-zinc-800 hover:border-zinc-600 py-4 flex items-center justify-center gap-3 text-zinc-600 hover:text-zinc-400 transition-all"
            >
              <Plus size={16} />
              <span className="text-sm font-semibold">Add a member</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
