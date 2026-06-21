import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, addDoc, setDoc, Timestamp, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentWeekId, formatWeekLabel, formatTimestamp } from '../utils'
import { CheckCircle, XCircle, Send, AlertTriangle, ArrowLeft, Pencil, X, Trash2 } from 'lucide-react'
import WeekCalendar from '../components/WeekCalendar'
import GoalBuilder from '../components/GoalBuilder'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import confetti from 'canvas-confetti'

const MEMBERS_DOC = doc(db, 'config', 'members')
const PENALTY = 15

const AVATAR_EMOJIS = [
  '🐨','🦊','🐸','🐼','🦁','🐯','🐻','🐰','🐹','🐶',
  '🐱','🐺','🦋','🐧','🦜','🐙','🦄','🐳','🦈','🦕',
  '🌸','⭐','🔥','💎','🌈','🍕','🧁','🍩','🎸','🚀',
  '🌙','🍀','🎯','💫','🎃','🦩','🐝','🦔','🐠','🌵',
]

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600', 'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',     'from-indigo-500 to-blue-600',
  'from-teal-500 to-emerald-600',  'from-fuchsia-500 to-pink-600',
]
const AVATAR_HEX = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f97316',
  '#ec4899', '#6366f1', '#14b8a6', '#d946ef',
]

const GOAL_COLORS = ['#8b5cf6','#3b82f6','#10b981','#f97316','#ec4899','#14b8a6']

export default function MemberProfile() {
  const { name } = useParams()
  const navigate = useNavigate()
  const weekId = getCurrentWeekId()

  const [members, setMembers] = useState([])
  const [entry, setEntry] = useState(undefined) // undefined = not yet loaded, null = loaded but no entry
  const [allEntries, setAllEntries] = useState([])
  const [memberLogs, setMemberLogs] = useState({})
  const [avatars, setAvatars] = useState({})
  const [goalsInput, setGoalsInput] = useState([])
  const [proofInput, setProofInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingGoals, setEditingGoals] = useState(false)
  const [confirmFail, setConfirmFail] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pickingAvatar, setPickingAvatar] = useState(false)

  useEffect(() => {
    return onSnapshot(MEMBERS_DOC, snap => {
      if (snap.exists()) {
        setMembers(snap.data().names || [])
        setAvatars(snap.data().avatars || {})
      }
    })
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'entries'), where('weekId', '==', weekId))
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      const mine = all.find(e => (e.nameLower || e.name?.toLowerCase()) === name.toLowerCase())
      setEntry(mine || null) // null = confirmed no entry this week
    })
  }, [weekId, name])

  useEffect(() => {
    return onSnapshot(collection(db, 'entries'), snap => {
      setAllEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  useEffect(() => {
    if (!entry) return
    return onSnapshot(collection(db, 'entries', entry.id, 'dailyLogs'), snap => {
      const logs = {}
      snap.docs.forEach(d => { logs[d.id] = d.data() })
      setMemberLogs(logs)
    })
  }, [entry?.id])

  const confettiFired = useRef(false)
  useEffect(() => {
    if (entry?.status !== 'completed' || confettiFired.current) return
    confettiFired.current = true
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f97316', '#ec4899', '#fbbf24']
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.4 }, colors })
    setTimeout(() => confetti({ particleCount: 60, spread: 60, origin: { y: 0.3 }, colors, angle: 60 }), 250)
    setTimeout(() => confetti({ particleCount: 60, spread: 60, origin: { y: 0.3 }, colors, angle: 120 }), 400)
  }, [entry?.status])

  const colorIdx = members.indexOf(name) % AVATAR_COLORS.length
  const color = AVATAR_COLORS[colorIdx < 0 ? 0 : colorIdx] || AVATAR_COLORS[0]
  const colorHex = AVATAR_HEX[colorIdx < 0 ? 0 : colorIdx] || AVATAR_HEX[0]
  const streak = (() => {
    const past = allEntries
      .filter(e => (e.nameLower || e.name?.toLowerCase()) === name.toLowerCase() && e.weekId < weekId)
      .sort((a, b) => b.weekId.localeCompare(a.weekId))
    let s = 0
    for (const e of past) { if (e.status === 'completed') s++; else break }
    return s
  })()

  // 7 days of this week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekId)
    d.setDate(d.getDate() + i)
    return d
  })

  const submitGoals = async () => {
    const valid = goalsInput.filter(g => g.text.trim())
    if (!valid.length) return
    setSubmitting(true)
    const goalsSummary = valid.map(g =>
      g.type === 'habit' ? `${g.text} (every day)` : g.target ? `${g.text} (${g.target} ${g.unit})` : g.text
    ).join(', ')
    await addDoc(collection(db, 'entries'), {
      name, nameLower: name.toLowerCase(), weekId,
      goals: goalsSummary, goalItems: valid, status: 'active',
      updates: [], createdAt: Timestamp.now(),
    })
    setSubmitting(false)
  }

  const updateGoals = async () => {
    const valid = goalsInput.filter(g => g.text.trim())
    if (!valid.length || !entry) return
    setSubmitting(true)
    const goalsSummary = valid.map(g =>
      g.type === 'habit' ? `${g.text} (every day)` : g.target ? `${g.text} (${g.target} ${g.unit})` : g.text
    ).join(', ')
    await updateDoc(doc(db, 'entries', entry.id), { goals: goalsSummary, goalItems: valid })
    setEditingGoals(false)
    setSubmitting(false)
  }

  const addProof = async () => {
    if (!proofInput.trim() || !entry) return
    setSubmitting(true)
    await updateDoc(doc(db, 'entries', entry.id), {
      updates: arrayUnion({ text: proofInput.trim(), timestamp: Timestamp.now() })
    })
    setProofInput('')
    setSubmitting(false)
  }

  const markDone = () => updateDoc(doc(db, 'entries', entry.id), { status: 'completed' })
  const markFailed = async () => {
    await updateDoc(doc(db, 'entries', entry.id), { status: 'failed' })
    setConfirmFail(false)
  }

  const deleteMember = async () => {
    await setDoc(MEMBERS_DOC, { names: members.filter(m => m !== name) }, { merge: true })
    navigate('/')
  }

  const saveAvatar = async (emoji) => {
    await setDoc(MEMBERS_DOC, { avatars: { ...avatars, [name]: emoji } }, { merge: true })
    setPickingAvatar(false)
  }

  // Area chart data
  const today = new Date(); today.setHours(23, 59, 59, 0)
  const elapsed = weekDays.filter(d => d <= today)
  const chartCategories = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].slice(0, elapsed.length)

  const getGoalDailyPct = (goal) =>
    elapsed.map((_, dayIdx) => {
      const daysUpTo = weekDays.slice(0, dayIdx + 1)
      if (goal.type === 'habit') {
        const checked = daysUpTo.filter(d => memberLogs[d.toISOString().split('T')[0]]?.habits?.[goal.text]).length
        return Math.round(checked / 7 * 100)
      } else if (goal.type === 'count') {
        const done = daysUpTo.reduce((s, d) => s + (Number(memberLogs[d.toISOString().split('T')[0]]?.counts?.[goal.text]) || 0), 0)
        return Math.round(Math.min(1, done / (Number(goal.target) || 1)) * 100)
      } else {
        const done = daysUpTo.reduce((s, d) => s + (Number(memberLogs[d.toISOString().split('T')[0]]?.totals?.[goal.text]) || 0), 0)
        return Math.round(Math.min(1, done / (Number(goal.target) || 1)) * 100)
      }
    })

  if (entry === undefined) return (
    <div className="flex flex-col space-y-4 animate-pulse">
      <div className="h-5 w-24 bg-zinc-800 rounded-lg" />
      <div className="h-40 -mx-4 bg-zinc-800 rounded-none" />
      <div className="grid grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-zinc-800 rounded-2xl" />)}
      </div>
      <div className="h-32 bg-zinc-800 rounded-2xl" />
    </div>
  )

  return (
    <div
      className="flex flex-col space-y-4 min-h-screen -mx-4 px-4 -mt-3 pt-3"
      style={entry?.status === 'completed' ? {
        background: `
          radial-gradient(ellipse 120% 25% at 50% 15%, #10b98122 0%, transparent 100%),
          radial-gradient(ellipse 80% 20% at 15% 45%, #f59e0b18 0%, transparent 100%),
          radial-gradient(ellipse 80% 20% at 85% 65%, #10b98118 0%, transparent 100%),
          radial-gradient(ellipse 90% 20% at 40% 85%, #f59e0b14 0%, transparent 100%)
        `,
      } : {}}
    >

      {/* Back + delete */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 transition-colors">
          <ArrowLeft size={15} /> Back
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Remove {name}?</span>
            <button onClick={deleteMember} className="text-xs font-bold text-red-400 hover:text-red-300 px-2 py-1 bg-red-950/40 rounded-lg">Remove</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-zinc-700 hover:text-red-400 transition-colors rounded-lg hover:bg-red-950/30">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Hero */}
      <div className={`-mx-4 bg-gradient-to-br ${color} relative overflow-hidden px-6 pt-6 pb-5`}>
        {/* Dot pattern overlay */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `radial-gradient(circle, white 1.5px, transparent 1.5px)`,
          backgroundSize: '18px 18px',
        }} />
        {/* Floating blobs */}
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute -left-6 -bottom-8 w-36 h-36 rounded-full bg-black/10" />
        <div className="absolute right-8 bottom-4 w-16 h-16 rounded-full bg-white/10" />

        {/* Week label top */}
        <p className="relative text-white/50 text-[11px] font-semibold uppercase tracking-widest mb-4">
          {formatWeekLabel(weekId)}
        </p>

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setPickingAvatar(v => !v)}
              className="w-16 h-16 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center shadow-xl relative group transition-all hover:scale-105 active:scale-95 shrink-0"
            >
              {avatars[name]
                ? <span className="text-3xl">{avatars[name]}</span>
                : <span className="text-white font-black text-3xl">{name[0].toUpperCase()}</span>
              }
              <span className="absolute inset-0 rounded-full flex items-end justify-center pb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] font-bold text-white/70 bg-black/30 rounded-full px-1.5">edit</span>
              </span>
            </button>
            <div>
              <h2 className="text-2xl font-black text-white leading-none">{name}</h2>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {streak >= 2 && <span className="text-white/80 text-xs font-bold">🔥 {streak}-week streak</span>}
                {entry?.status === 'completed' && <span className="text-emerald-300 text-xs font-bold">✅ Week done!</span>}
                {entry?.status === 'failed' && <span className="text-red-300 text-xs font-bold">❌ Week failed</span>}
                {entry?.status === 'active' && <span className="text-white/60 text-xs font-semibold">🔄 In progress</span>}
                {!entry && <span className="text-white/40 text-xs">No goals set yet</span>}
              </div>
              {entry?.goalItems?.length > 0 && (
                <p className="text-white/50 text-[11px] mt-1.5">
                  {entry.goalItems.length} goal{entry.goalItems.length !== 1 ? 's' : ''} · {entry.updates?.length || 0} proof{(entry.updates?.length || 0) !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          {entry && !editingGoals && (
            <button
              onClick={() => { if (entry.goalItems?.length) setGoalsInput(entry.goalItems); setEditingGoals(true) }}
              className="bg-black/20 hover:bg-black/30 text-white/80 hover:text-white rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
            >
              <Pencil size={11} /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      {entry && (() => {
        const daysLogged = Object.values(memberLogs).filter(log =>
          Object.values(log?.habits || {}).some(Boolean) ||
          Object.values(log?.counts || {}).some(v => v > 0) ||
          Object.values(log?.totals || {}).some(v => v > 0)
        ).length
        return (
          <div className="grid grid-cols-4 gap-2">
            <div className={`rounded-2xl p-3 text-center ${
              entry.status === 'completed' ? 'bg-emerald-950/60 border border-emerald-800/50' :
              entry.status === 'failed' ? 'bg-red-950/60 border border-red-800/50' :
              'bg-zinc-900 border border-zinc-800'
            }`}>
  <p className="text-xl mb-0.5">{entry.status === 'completed' ? '✅' : entry.status === 'failed' ? '❌' : '🔄'}</p>
              <p className={`text-[10px] font-bold uppercase tracking-wide ${
                entry.status === 'completed' ? 'text-emerald-400' :
                entry.status === 'failed' ? 'text-red-400' : 'text-amber-400'
              }`}>{entry.status === 'completed' ? 'Done!' : entry.status === 'failed' ? 'Failed' : 'Active'}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
              <p className="text-xl font-black text-white mb-0.5">{entry.goalItems?.length || 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Goals</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
              <p className="text-xl font-black text-white mb-0.5">{daysLogged}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Days</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
              <p className="text-xl font-black text-white mb-0.5">{entry.updates?.length || 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Proofs</p>
            </div>
          </div>
        )
      })()}

      {/* No goals yet */}
      {!entry && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <p className="text-zinc-400 text-sm font-medium">Lock in your goals for this week 🔒</p>
          <GoalBuilder onChange={setGoalsInput} />
          <button
            onClick={submitGoals}
            disabled={submitting || !goalsInput.some(g => g.text.trim())}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-bold rounded-xl py-3 transition-all"
          >
            {submitting ? 'Locking in...' : 'Lock in goals 🔒'}
          </button>
        </div>
      )}

      {entry && (
        <>
          {editingGoals && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-zinc-300">Edit goals</p>
                <button onClick={() => setEditingGoals(false)} className="text-zinc-600 hover:text-zinc-400"><X size={16} /></button>
              </div>
              <GoalBuilder initialGoals={entry.goalItems} onChange={setGoalsInput} />
              <button onClick={updateGoals} disabled={submitting || !goalsInput.some(g => g.text.trim())}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 disabled:opacity-40 text-white font-bold rounded-xl py-2.5 transition-all">
                {submitting ? 'Saving...' : 'Save goals'}
              </button>
            </div>
          )}

          {!editingGoals && entry.goalItems?.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3 font-semibold">Goals this week</p>
              <div className="space-y-2">
                {entry.goalItems.map((g, i) => (
                  <div key={i} className="flex items-center gap-3 bg-zinc-800/60 rounded-xl px-3 py-2.5">
                    <span className="text-base shrink-0">{g.type === 'habit' ? '✓' : g.type === 'count' ? '×' : '#'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 font-medium">{g.text}</p>
                      {g.target && <p className="text-xs text-zinc-500">{g.target} {g.unit}</p>}
                    </div>
                    <span className="text-[10px] text-zinc-600 shrink-0">{g.type === 'habit' ? 'daily' : g.type === 'count' ? 'count' : 'total'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Area chart */}
          {entry.goalItems?.length > 0 && (
            <div className="bg-zinc-800/40 rounded-2xl p-4">
              <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wide mb-2">Goal progress this week</p>
              <HighchartsReact
                key={entry.goalItems.map(g => g.text).join(',')}
                immutable={true}
                highcharts={Highcharts}
                options={{
                  chart: { type: 'areaspline', backgroundColor: 'transparent', height: 180, spacing: [8, 8, 8, 0], style: { fontFamily: 'inherit' } },
                  title: { text: null }, credits: { enabled: false }, legend: { enabled: false },
                  xAxis: { categories: chartCategories, labels: { style: { color: '#71717a', fontSize: '10px' } }, lineColor: '#27272a', tickColor: 'transparent', gridLineColor: 'transparent' },
                  yAxis: { min: 0, max: 100, title: { text: null }, labels: { format: '{value}%', style: { color: '#71717a', fontSize: '10px' } }, gridLineColor: '#27272a', tickPositions: [0, 25, 50, 75, 100] },
                  tooltip: { shared: true, backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: 12, style: { color: '#e4e4e7', fontSize: '11px' }, pointFormat: '<span style="color:{series.color}">●</span> {series.name}: <b>{point.y}%</b><br/>' },
                  plotOptions: { areaspline: { fillOpacity: 0.15, lineWidth: 2, marker: { enabled: true, radius: 3, lineWidth: 0 } } },
                  series: entry.goalItems.map((g, i) => ({ name: g.text, color: GOAL_COLORS[i % GOAL_COLORS.length], data: getGoalDailyPct(g) })),
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
          )}

          {entry.updates?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold px-1">Progress log</p>
              {entry.updates.map((u, i) => {
                const reactionKey = `proofReactions.${i}`
                const reactions = u.reactions || {}
                const toggleReaction = async (emoji) => {
                  const snap = await getDoc(doc(db, 'entries', entry.id))
                  const updates = snap.data().updates || []
                  updates[i] = { ...updates[i], reactions: { ...(updates[i].reactions || {}), [emoji]: ((updates[i].reactions?.[emoji] || 0) + 1) % 99 } }
                  await updateDoc(doc(db, 'entries', entry.id), { updates })
                }
                return (
                  <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 space-y-2">
                    <div className="flex gap-3">
                      <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                      <div className="flex-1">
                        <p className="text-sm text-zinc-200">{u.text}</p>
                        <p className="text-xs text-zinc-600 mt-0.5">{formatTimestamp(u.timestamp)}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 pl-5">
                      {['🔥','💪','👏','❤️'].map(emoji => {
                        const count = reactions[emoji] || 0
                        return (
                          <button key={emoji} onClick={() => toggleReaction(emoji)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-sm transition-all active:scale-95 ${
                              count > 0 ? 'bg-zinc-800 border-zinc-600' : 'border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400'
                            }`}>
                            {emoji}
                            {count > 0 && <span className="text-xs font-bold text-zinc-300">{count}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <WeekCalendar entryId={entry.id} goalItems={entry.goalItems} goals={entry.goals} />

          {entry.status === 'active' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text" placeholder="Drop some proof..."
                  value={proofInput} onChange={e => setProofInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addProof()}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <button onClick={addProof} disabled={submitting || !proofInput.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl px-4 transition-colors">
                  <Send size={16} />
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={markDone} className="flex-1 flex items-center justify-center gap-2 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-800/50 text-emerald-400 rounded-xl py-3 text-sm font-bold transition-colors">
                  <CheckCircle size={15} /> Week complete
                </button>
                <button onClick={() => setConfirmFail(true)} className="flex-1 flex items-center justify-center gap-2 bg-red-900/20 hover:bg-red-900/40 border border-red-800/40 text-red-400 rounded-xl py-3 text-sm font-bold transition-colors">
                  <XCircle size={15} /> I failed
                </button>
              </div>
              {confirmFail && (
                <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4 space-y-3">
                  <p className="text-red-300 text-sm font-medium flex items-center gap-2">
                    <AlertTriangle size={15} /> This adds ${PENALTY} to the pot. For real?
                  </p>
                  <div className="flex gap-2">
                    <button onClick={markFailed} className="flex-1 bg-red-700 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-bold transition-colors">Yeah, I failed</button>
                    <button onClick={() => setConfirmFail(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg py-2 text-sm transition-colors">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Avatar picker overlay */}
      {pickingAvatar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4" onClick={() => setPickingAvatar(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-4 shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-zinc-200">Pick your avatar</p>
              <button onClick={() => setPickingAvatar(false)} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-8 gap-1.5">
              {AVATAR_EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => saveAvatar(emoji)}
                  className={`text-2xl rounded-xl p-1.5 hover:bg-zinc-700 transition-colors active:scale-90 ${avatars[name] === emoji ? 'bg-zinc-700 ring-2 ring-emerald-500' : ''}`}>
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
