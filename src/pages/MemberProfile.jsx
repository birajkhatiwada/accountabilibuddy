import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, addDoc, setDoc, getDoc, Timestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'
import { useAuth } from '../AuthContext'
import { getCurrentWeekId, formatWeekLabel, formatTimestamp } from '../utils'
import { Pencil, X, Trash2, Camera, Link2 } from 'lucide-react'
import GoalBuilder from '../components/GoalBuilder'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import confetti from 'canvas-confetti'

const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const GOAL_COLORS = ['#8b5cf6','#3b82f6','#10b981','#f97316','#ec4899','#14b8a6']

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

const BANNER_COLORS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-500',
  'from-pink-500 to-rose-500',
  'from-indigo-500 to-violet-600',
  'from-red-500 to-orange-500',
  'from-teal-400 to-cyan-600',
  'from-fuchsia-500 to-pink-500',
  'from-slate-600 to-zinc-700',
]

const BANNER_COLOR_PREVIEWS = [
  '#8b5cf6','#3b82f6','#10b981','#f97316',
  '#ec4899','#6366f1','#ef4444','#14b8a6',
  '#d946ef','#475569',
]

const VIBE_EMOJIS = ['⚡','🔥','🌊','🎯','💎','🦁','🚀','🌈','🌙','⭐','🎸','🏔️','🐉','🌺','🦋','💫','🍀','🎃','🦅','🌋']
const AVATAR_HEX = [
  '#8b5cf6','#3b82f6','#10b981','#f97316','#ec4899','#6366f1','#14b8a6','#d946ef',
]

function dateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function Counter({ value, onChange, unit }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button onClick={() => onChange(Math.max(0, value - 1))}
        className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold text-base flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-90 transition-all select-none">
        −
      </button>
      <span className="text-sm font-black text-zinc-900 dark:text-white w-6 text-center tabular-nums">{value}</span>
      <button onClick={() => onChange(Math.min(999, value + 1))}
        className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold text-base flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-90 transition-all select-none">
        +
      </button>
      {unit && <span className="text-[11px] text-zinc-400">{unit}</span>}
    </div>
  )
}

export default function MemberProfile() {
  const { name, sessionId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isOwner = user?.displayName?.toLowerCase() === name?.toLowerCase()
  const weekId = getCurrentWeekId()
  const todayKey = dateKey(new Date())

  const [members, setMembers] = useState([])
  const [entry, setEntry] = useState(undefined)
  const [allEntries, setAllEntries] = useState([])
  const [logs, setLogs] = useState({})
  const [avatars, setAvatars] = useState({})
  const [penalty, setPenalty] = useState(15)
  const [goalsInput, setGoalsInput] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [editingGoals, setEditingGoals] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pickingAvatar, setPickingAvatar] = useState(false)
  const [copied, setCopied] = useState(false)
  const [goalBuilderKey, setGoalBuilderKey] = useState(0)
  const [carryOverGoals, setCarryOverGoals] = useState(null)
  const [selectedDay, setSelectedDay] = useState(todayKey)
  const [localCounts, setLocalCounts] = useState({})
  const [localTotals, setLocalTotals] = useState({})
  const [proofOpen, setProofOpen] = useState({})
  const [proofNoteInputs, setProofNoteInputs] = useState({})
  const [editingProof, setEditingProof] = useState({})
  const [uploadingPhoto, setUploadingPhoto] = useState({})
  const [reactionPickerOpen, setReactionPickerOpen] = useState(null)
  const longPressTimer = useRef(null)
  const [bio, setBio] = useState('')
  const [status, setStatus] = useState('')
  const [nickname, setNickname] = useState('')
  const [editingBio, setEditingBio] = useState(false)
  const [editingStatus, setEditingStatus] = useState(false)
  const [bioInput, setBioInput] = useState('')
  const [statusInput, setStatusInput] = useState('')
  const [bannerColorIdx, setBannerColorIdx] = useState(null)
  const [bannerVibe, setBannerVibe] = useState('')
  const [showCustomize, setShowCustomize] = useState(false)
  const saveTimers = useRef({})
  const confettiFired = useRef(false)

  const sessionDoc = doc(db, 'sessions', sessionId)

  useEffect(() => {
    setProofNoteInputs({})
    setProofOpen({})
  }, [selectedDay])

  // Auto-complete when all goals hit 100%
  useEffect(() => {
    if (!entry || entry.status !== 'active' || !entry.goalItems?.length) return
    const allDone = entry.goalItems.every(g => {
      if (g.type === 'habit') return weekDays.filter(d => logs[dateKey(d)]?.habits?.[g.text]).length >= 7
      if (g.subGoals?.length > 0) return g.subGoals.every(sg => {
        const k = `${g.text}::${sg.text}`
        const total = weekDays.reduce((s, d) => s + (Number(logs[dateKey(d)]?.counts?.[k]) || 0), 0)
        return total >= (Number(sg.target) || 1)
      })
      const total = weekDays.reduce((s, d) => s + (Number(logs[dateKey(d)]?.counts?.[g.text]) || 0) + (Number(logs[dateKey(d)]?.totals?.[g.text]) || 0), 0)
      return total >= (Number(g.target) || 1)
    })
    if (allDone) updateDoc(doc(db, 'entries', entry.id), { status: 'completed' })
  }, [logs, entry?.id])

  useEffect(() => {
    if (!sessionId) return
    return onSnapshot(sessionDoc, snap => {
      if (snap.exists()) {
        const d = snap.data()
        setMembers(d.names || [])
        setAvatars(d.avatars || {})
        setPenalty(d.penalty ?? 15)
        setBio(d.bios?.[name] || '')
        setStatus(d.statuses?.[name] || '')
        setBannerColorIdx(d.bannerColors?.[name] ?? null)
        setBannerVibe(d.bannerVibes?.[name] || '')
        setNickname(d.nicknames?.[name] || '')
      }
    })
  }, [sessionId])

  // Single query — filter weekId + name client-side to avoid composite index requirement
  useEffect(() => {
    if (!sessionId) return
    const q = query(collection(db, 'entries'), where('sessionId', '==', sessionId))
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setAllEntries(all)
      const mine = all.find(e =>
        e.weekId === weekId && (e.nameLower || e.name?.toLowerCase()) === name.toLowerCase()
      )
      setEntry(mine || null)
    })
  }, [sessionId, weekId, name])

  useEffect(() => {
    if (!entry?.id) return
    return onSnapshot(collection(db, 'entries', entry.id, 'dailyLogs'), snap => {
      const data = {}
      snap.docs.forEach(d => { data[d.id] = d.data() })
      setLogs(data)
    })
  }, [entry?.id])

  useEffect(() => {
    if (entry?.status !== 'completed' || confettiFired.current) return
    confettiFired.current = true
    const colors = ['#10b981','#3b82f6','#8b5cf6','#f97316','#ec4899','#fbbf24']
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.4 }, colors })
    setTimeout(() => confetti({ particleCount: 60, spread: 60, origin: { y: 0.3 }, colors, angle: 60 }), 250)
    setTimeout(() => confetti({ particleCount: 60, spread: 60, origin: { y: 0.3 }, colors, angle: 120 }), 400)
  }, [entry?.status])

  // ── derived ──────────────────────────────────────────────────────────────────

  const colorIdx = members.indexOf(name) % AVATAR_COLORS.length
  const color = bannerColorIdx !== null ? BANNER_COLORS[bannerColorIdx] : (AVATAR_COLORS[colorIdx < 0 ? 0 : colorIdx] || AVATAR_COLORS[0])
  const colorHex = AVATAR_HEX[colorIdx < 0 ? 0 : colorIdx] || AVATAR_HEX[0]


  const prevEntry = allEntries
    .filter(e => (e.nameLower || e.name?.toLowerCase()) === name.toLowerCase() && e.weekId < weekId)
    .sort((a, b) => b.weekId.localeCompare(a.weekId))[0]

  const streak = (() => {
    const past = allEntries
      .filter(e => (e.nameLower || e.name?.toLowerCase()) === name.toLowerCase() && e.weekId < weekId)
      .sort((a, b) => b.weekId.localeCompare(a.weekId))
    let s = 0
    for (const e of past) { if (e.status === 'completed') s++; else break }
    return s
  })()

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekId)
    d.setDate(d.getDate() + i)
    return d
  })

  // ── logging helpers ────────────────────────────────────────────────────────

  const getDayLog = (key) => logs[key] || {}

  const toggleHabit = async (goalText) => {
    if (!entry?.id) return
    const current = getDayLog(selectedDay)
    const habits = { ...(current.habits || {}) }
    habits[goalText] = !habits[goalText]
    await setDoc(doc(db, 'entries', entry.id, 'dailyLogs', selectedDay), { ...current, habits })
  }

  const setDayCount = (key, value) => {
    if (!entry?.id) return
    const localKey = `${selectedDay}__count__${key}`
    const newVal = Math.max(0, Math.min(999, value))
    setLocalCounts(p => ({ ...p, [localKey]: newVal }))
    clearTimeout(saveTimers.current[localKey])
    saveTimers.current[localKey] = setTimeout(async () => {
      const current = getDayLog(selectedDay)
      await setDoc(doc(db, 'entries', entry.id, 'dailyLogs', selectedDay), {
        ...current, counts: { ...(current.counts || {}), [key]: newVal },
      })
    }, 300)
  }

  const setDayTotal = (key, value) => {
    if (!entry?.id) return
    const localKey = `${selectedDay}__total__${key}`
    const newVal = Math.max(0, Math.min(9999, value))
    setLocalTotals(p => ({ ...p, [localKey]: newVal }))
    clearTimeout(saveTimers.current[localKey])
    saveTimers.current[localKey] = setTimeout(async () => {
      const current = getDayLog(selectedDay)
      await setDoc(doc(db, 'entries', entry.id, 'dailyLogs', selectedDay), {
        ...current, totals: { ...(current.totals || {}), [key]: newVal },
      })
    }, 300)
  }

  const getCountVal = (key) => {
    const localKey = `${selectedDay}__count__${key}`
    return localCounts[localKey] ?? (Number(logs[selectedDay]?.counts?.[key]) || 0)
  }

  const getTotalVal = (key) => {
    const localKey = `${selectedDay}__total__${key}`
    return localTotals[localKey] ?? (Number(logs[selectedDay]?.totals?.[key]) || 0)
  }

  const weeklyCount = (key) => weekDays.reduce((sum, d) => {
    const dk = dateKey(d)
    const localKey = `${dk}__count__${key}`
    return sum + (localCounts[localKey] ?? (Number(logs[dk]?.counts?.[key]) || 0))
  }, 0)

  const weeklyTotal = (key) => weekDays.reduce((sum, d) => {
    const dk = dateKey(d)
    const localKey = `${dk}__total__${key}`
    return sum + (localTotals[localKey] ?? (Number(logs[dk]?.totals?.[key]) || 0))
  }, 0)

  const weeklyHabitDays = (text) =>
    weekDays.filter(d => logs[dateKey(d)]?.habits?.[text]).length

  const dayHasActivity = (key) => {
    const log = logs[key]
    if (!log) return false
    return (log.notes?.length > 0) || (log.photos?.length > 0) ||
      Object.values(log.habits || {}).some(Boolean) ||
      Object.values(log.counts || {}).some(v => v > 0) ||
      Object.values(log.totals || {}).some(v => v > 0)
  }

  // ── badges ────────────────────────────────────────────────────────────────
  const badges = []
  const completedWeeks = allEntries.filter(e => (e.nameLower || e.name?.toLowerCase()) === name.toLowerCase() && e.status === 'completed').length
  const daysThisWeek = weekDays.filter(d => dateKey(d) <= todayKey && dayHasActivity(dateKey(d))).length
  if (daysThisWeek >= 7) badges.push({ emoji: '💯', label: 'Perfect week' })
  if (streak >= 5) badges.push({ emoji: '👑', label: 'Streak king' })
  if (completedWeeks >= 4) badges.push({ emoji: '🏆', label: 'Veteran' })
  if (completedWeeks >= 1 && entry?.status === 'active' && allEntries.find(e => (e.nameLower || e.name?.toLowerCase()) === name.toLowerCase() && e.status === 'failed')) badges.push({ emoji: '💪', label: 'Comeback' })

  // ── per-goal proof helpers ────────────────────────────────────────────────

  const getGoalProof = (goalText) => logs[selectedDay]?.proof?.[goalText] || {}

  const setGoalProofNote = (goalText, text) => {
    setProofNoteInputs(p => ({ ...p, [goalText]: text }))
    clearTimeout(saveTimers.current[`proof__${goalText}`])
    saveTimers.current[`proof__${goalText}`] = setTimeout(async () => {
      const current = getDayLog(selectedDay)
      await setDoc(doc(db, 'entries', entry.id, 'dailyLogs', selectedDay), {
        ...current,
        proof: { ...(current.proof || {}), [goalText]: { ...(current.proof?.[goalText] || {}), note: text } }
      })
    }, 500)
  }

  const uploadGoalPhoto = async (goalText, file) => {
    setUploadingPhoto(p => ({ ...p, [goalText]: true }))
    const storageRef = ref(storage, `proofs/${entry.id}/${selectedDay}/${goalText.replace(/[^a-z0-9]/gi, '_')}`)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    const current = getDayLog(selectedDay)
    await setDoc(doc(db, 'entries', entry.id, 'dailyLogs', selectedDay), {
      ...current,
      proof: { ...(current.proof || {}), [goalText]: { ...(current.proof?.[goalText] || {}), photoUrl: url } }
    })
    setUploadingPhoto(p => ({ ...p, [goalText]: false }))
  }

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleCarryOver = () => {
    const goals = prevEntry?.goalItems || []
    setCarryOverGoals(goals); setGoalsInput(goals); setGoalBuilderKey(k => k + 1)
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const submitGoals = async () => {
    const valid = goalsInput.filter(g => g.text.trim())
    if (!valid.length) return
    setSubmitting(true)
    const goalsSummary = valid.map(g =>
      g.type === 'habit' ? `${g.text} (every day)` : g.target ? `${g.text} (${g.target} ${g.unit})` : g.text
    ).join(', ')
    await addDoc(collection(db, 'entries'), {
      name, nameLower: name.toLowerCase(), weekId, sessionId,
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
    setEditingGoals(false); setSubmitting(false)
  }

  const QUICK_REACTIONS = ['💪','🔥','👏','❤️','🎉','😤']

  const toggleReaction = async (goalText, emoji) => {
    if (!user) return
    const current = getDayLog(selectedDay)
    const existing = current.proof?.[goalText]?.reactions || []
    const arr = Array.isArray(existing) ? existing : []
    const i = arr.findIndex(r => r.e === emoji)
    let updated
    if (i >= 0) {
      const alreadyReacted = arr[i].users?.includes(user.uid)
      if (alreadyReacted) {
        const users = arr[i].users.filter(u => u !== user.uid)
        updated = users.length === 0
          ? arr.filter((_, j) => j !== i)
          : arr.map((r, j) => j === i ? { ...r, users } : r)
      } else {
        updated = arr.map((r, j) => j === i ? { ...r, users: [...(r.users || []), user.uid] } : r)
      }
    } else {
      updated = [...arr, { e: emoji, users: [user.uid] }]
    }
    await setDoc(doc(db, 'entries', entry.id, 'dailyLogs', selectedDay), {
      ...current,
      proof: { ...(current.proof || {}), [goalText]: { ...(current.proof?.[goalText] || {}), reactions: updated } }
    })
  }

  const sendProofNote = async (goalText) => {
    const text = (proofNoteInputs[goalText] ?? '').trim()
    if (!text) return
    const current = getDayLog(selectedDay)
    await setDoc(doc(db, 'entries', entry.id, 'dailyLogs', selectedDay), {
      ...current,
      proof: { ...(current.proof || {}), [goalText]: { ...(current.proof?.[goalText] || {}), note: text } }
    })
    setProofNoteInputs(p => ({ ...p, [goalText]: '' }))
  }

  const renderProofSection = (goalText, isFutureDay) => {
    if (isFutureDay || !entry || entry.status === 'failed') return null
    const saved = getGoalProof(goalText)
    const inputVal = proofNoteInputs[goalText] ?? ''
    const uploading = uploadingPhoto[goalText]
    const reactions = Array.isArray(saved.reactions) ? saved.reactions : []
    const hasProof = !!(saved.note || saved.photoUrl)
    const isEditing = !!editingProof[goalText]

    return (
      <div className="mt-3 space-y-2">
        {/* Posted proof card */}
        {hasProof && !isEditing && (
          <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
            {saved.photoUrl && <img src={saved.photoUrl} alt="proof" className="w-full object-cover max-h-52" />}
            {saved.note && (
              <div className="flex items-start gap-2 px-3 py-2.5">
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-snug flex-1">{saved.note}</p>
                {isOwner && (
                  <button onClick={() => { setEditingProof(p => ({ ...p, [goalText]: true })); setProofNoteInputs(p => ({ ...p, [goalText]: saved.note || '' })) }}
                    className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors shrink-0 mt-0.5">
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            )}
            {/* Reactions */}
            <div className="flex flex-wrap items-center gap-1 px-3 pb-2.5">
              {reactions.map(({ e, users: us = [] }) => {
                const reacted = us.includes(user?.uid)
                return (
                  <button key={e} onClick={() => toggleReaction(goalText, e)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                      reacted
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-600 text-zinc-500 hover:border-emerald-400'
                    }`}>
                    {e}<span className="font-semibold ml-0.5">{us.length}</span>
                  </button>
                )
              })}
              <div className="relative">
                <button onClick={() => setReactionPickerOpen(reactionPickerOpen === goalText ? null : goalText)}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-400 hover:text-emerald-500 hover:border-emerald-400 transition-all">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                  +
                </button>
                {reactionPickerOpen === goalText && (
                  <div className="absolute bottom-7 left-0 flex items-center gap-0.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full px-2 py-1.5 shadow-xl z-20">
                    {QUICK_REACTIONS.map(emoji => (
                      <button key={emoji} onClick={() => { toggleReaction(goalText, emoji); setReactionPickerOpen(null) }}
                        className="text-lg hover:scale-125 active:scale-125 transition-transform px-0.5">
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit mode */}
        {isEditing && (
          <div className="border border-emerald-500 rounded-xl overflow-hidden">
            <textarea
              autoFocus
              value={proofNoteInputs[goalText] ?? ''}
              onChange={e => setProofNoteInputs(p => ({ ...p, [goalText]: e.target.value }))}
              placeholder="What did you do?"
              rows={3}
              style={{ fontSize: 16 }}
              className="w-full bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-300 dark:placeholder-zinc-600 focus:outline-none resize-none"
            />
            <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <button onClick={() => setEditingProof(p => ({ ...p, [goalText]: false }))}
                className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">Cancel</button>
              <button onClick={() => { sendProofNote(goalText); setEditingProof(p => ({ ...p, [goalText]: false })) }}
                disabled={!(proofNoteInputs[goalText] ?? '').trim()}
                className="text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 px-3 py-1 rounded-lg transition-colors">
                Save
              </button>
            </div>
          </div>
        )}

        {/* Empty state — owner only */}
        {isOwner && !hasProof && !isEditing && (
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditingProof(p => ({ ...p, [goalText]: true })); setProofNoteInputs(p => ({ ...p, [goalText]: '' })) }}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
              <Pencil size={12} /> Add note
            </button>
            <span className="text-zinc-200 dark:text-zinc-700">·</span>
            <label className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer">
              {uploading
                ? <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                : <Camera size={12} />
              }
              Add photo
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadGoalPhoto(goalText, f); e.target.value = '' }} />
            </label>
          </div>
        )}
      </div>
    )
  }

  const deleteMember = async () => { await setDoc(sessionDoc, { names: members.filter(m => m !== name) }, { merge: true }); navigate(`/${sessionId}`) }
  const saveAvatar = async (emoji) => { await setDoc(sessionDoc, { avatars: { ...avatars, [name]: emoji } }, { merge: true }); setPickingAvatar(false) }
  const saveBio = async (val) => { await setDoc(sessionDoc, { bios: { [name]: val.trim() } }, { merge: true }); setEditingBio(false) }
  const saveStatus = async (val) => { await setDoc(sessionDoc, { statuses: { [name]: val.trim() } }, { merge: true }); setEditingStatus(false) }
  const saveBannerColor = async (idx) => { setBannerColorIdx(idx); await setDoc(sessionDoc, { bannerColors: { [name]: idx } }, { merge: true }) }
  const saveBannerVibe = async (emoji) => { setBannerVibe(emoji); await setDoc(sessionDoc, { bannerVibes: { [name]: emoji } }, { merge: true }) }

  // ── chart ─────────────────────────────────────────────────────────────────

  const today = new Date(); today.setHours(23, 59, 59, 0)
  const elapsed = weekDays.filter(d => d <= today)
  const chartCategories = DAY_LABELS.slice(0, elapsed.length)

  const getGoalDailyPct = (goal) =>
    elapsed.map((_, dayIdx) => {
      const daysUpTo = weekDays.slice(0, dayIdx + 1)
      if (goal.type === 'habit') {
        const checked = daysUpTo.filter(d => logs[dateKey(d)]?.habits?.[goal.text]).length
        return Math.round(checked / 7 * 100)
      }
      if (goal.subGoals?.length > 0) {
        const ratios = goal.subGoals.map(sg => {
          const k = `${goal.text}::${sg.text}`
          const done = daysUpTo.reduce((s, d) => s + (Number(logs[dateKey(d)]?.counts?.[k]) || 0), 0)
          return Math.min(1, done / (Number(sg.target) || 1))
        })
        return Math.round(ratios.reduce((s, r) => s + r, 0) / ratios.length * 100)
      }
      const done = daysUpTo.reduce((s, d) => s + (Number(logs[dateKey(d)]?.counts?.[goal.text]) || 0), 0)
      return Math.round(Math.min(1, done / (Number(goal.target) || 1)) * 100)
    })

  const chartOptions = useMemo(() => ({
    chart: { type: 'areaspline', backgroundColor: 'transparent', height: 160, spacing: [8,8,8,0], style: { fontFamily: 'inherit' } },
    title: { text: null }, credits: { enabled: false }, legend: { enabled: false },
    xAxis: { categories: chartCategories, labels: { style: { color: '#71717a', fontSize: '10px' } }, lineColor: '#27272a', tickColor: 'transparent', gridLineColor: 'transparent' },
    yAxis: { min: 0, max: 100, title: { text: null }, labels: { format: '{value}%', style: { color: '#71717a', fontSize: '10px' } }, gridLineColor: '#27272a', tickPositions: [0, 50, 100] },
    tooltip: { shared: true, backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: 12, style: { color: '#e4e4e7', fontSize: '11px' }, pointFormat: '<span style="color:{series.color}">●</span> {series.name}: <b>{point.y}%</b><br/>' },
    plotOptions: { areaspline: { fillOpacity: 0.12, lineWidth: 2, marker: { enabled: true, radius: 3, lineWidth: 0 } } },
    series: entry?.goalItems?.map((g, i) => ({ name: g.text, color: GOAL_COLORS[i % GOAL_COLORS.length], data: getGoalDailyPct(g) })) || [],
  }), [logs, entry?.goalItems])

  // ── loading skeleton ──────────────────────────────────────────────────────

  if (entry === undefined) return (
    <div className="flex flex-col space-y-4 animate-pulse">
      <div className="h-5 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
      <div className="h-40 -mx-4 bg-zinc-100 dark:bg-zinc-800 rounded-none" />
      <div className="grid grid-cols-4 gap-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl" />)}</div>
      <div className="h-32 bg-zinc-100 dark:bg-zinc-800 rounded-2xl" />
    </div>
  )

  const daysLogged = Object.values(logs).filter(log =>
    Object.values(log?.habits || {}).some(Boolean) ||
    Object.values(log?.counts || {}).some(v => v > 0) ||
    Object.values(log?.totals || {}).some(v => v > 0)
  ).length

  const selectedDayDate = weekDays.find(d => dateKey(d) === selectedDay)
  const selectedDayLabel = selectedDayDate
    ? selectedDayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : ''

  return (
    <div className="flex flex-col space-y-4 min-h-screen -mx-4 px-4 -mt-3">

      {/* Hero */}
      <div className={`-mx-4 bg-gradient-to-br ${color} relative overflow-hidden px-6 pt-5 pb-0`}>
        {/* Background texture */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`, backgroundSize: '22px 22px' }} />
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-white/10" />
        <div className="absolute -left-8 bottom-0 w-40 h-40 rounded-full bg-black/10" />
        {/* Vibe emoji watermark */}
        {bannerVibe && <div className="absolute right-4 bottom-6 text-7xl opacity-20 select-none pointer-events-none">{bannerVibe}</div>}

        {/* Week label + actions */}
        <div className="relative flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <p className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">{formatWeekLabel(weekId)}</p>
            <button onClick={() => setShowCustomize(v => !v)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all ${showCustomize ? 'bg-white/25 text-white' : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80'}`}>
              🎨 Customize
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleShare}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white/80 text-[11px] font-semibold transition-all">
              <Link2 size={10} /> {copied ? 'Copied!' : 'Share'}
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <button onClick={deleteMember} className="text-[11px] font-bold text-red-300 px-2 py-1 bg-red-900/50 rounded-full">Remove</button>
                <button onClick={() => setConfirmDelete(false)} className="text-[11px] text-white/50 px-2 py-1">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-full bg-white/10 hover:bg-red-500/30 text-white/40 hover:text-red-300 transition-all">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Avatar + name */}
        <div className="relative flex items-end gap-4 mb-5">
          <button onClick={() => setPickingAvatar(v => !v)}
            className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-2xl relative group transition-all hover:scale-105 active:scale-95 shrink-0">
            {avatars[name]
              ? <span className="text-4xl">{avatars[name]}</span>
              : <span className="text-white font-black text-4xl leading-none">{name[0].toUpperCase()}</span>}
            <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Pencil size={9} className="text-white" />
            </span>
          </button>
          <div className="pb-1 flex-1 min-w-0">
            <h2 className="text-3xl font-black text-white leading-none tracking-tight">{nickname || name}</h2>
            {nickname && <p className="text-xs text-white/50 leading-none mt-0.5">@{name}</p>}

            {/* Editable status */}
            {editingStatus ? (
              <input autoFocus value={statusInput}
                onChange={e => setStatusInput(e.target.value)}
                onBlur={() => saveStatus(statusInput)}
                onKeyDown={e => { if (e.key === 'Enter') saveStatus(statusInput); if (e.key === 'Escape') setEditingStatus(false) }}
                maxLength={40}
                placeholder="What's your vibe? e.g. 💪 locked in"
                className="mt-2 w-full bg-white/10 border border-white/20 rounded-lg px-2.5 py-1 text-white placeholder-white/30 focus:outline-none focus:border-white/40"
                style={{ fontSize: 16 }}
              />
            ) : (
              <button onClick={() => { setStatusInput(status); setEditingStatus(true) }}
                className="mt-1.5 flex items-center gap-1 group">
                <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">
                  {status || '+ add status'}
                </span>
                <Pencil size={9} className="text-white/20 group-hover:text-white/50 transition-colors" />
              </button>
            )}

            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {entry?.status === 'completed' && <span className="text-[11px] font-bold text-emerald-200 bg-emerald-500/25 px-2.5 py-0.5 rounded-full">✅ Week done!</span>}
              {entry?.status === 'failed'    && <span className="text-[11px] font-bold text-red-200 bg-red-500/25 px-2.5 py-0.5 rounded-full">❌ Week failed</span>}
              {!entry                        && <span className="text-[11px] text-white/40 bg-white/10 px-2.5 py-0.5 rounded-full">No goals set</span>}
              {streak >= 2 && <span className="text-[11px] font-bold text-amber-200 bg-amber-500/20 px-2.5 py-0.5 rounded-full">🔥 {streak}-week streak</span>}
            </div>
          </div>
        </div>


        {/* Bio inside banner */}
        <div className="relative mb-4">
          {editingBio ? (
            <textarea autoFocus value={bioInput}
              onChange={e => setBioInput(e.target.value)}
              onBlur={() => saveBio(bioInput)}
              onKeyDown={e => { if (e.key === 'Escape') saveBio(bioInput) }}
              maxLength={120}
              rows={2}
              placeholder="Write a short bio…"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-white/40 resize-none"
              style={{ fontSize: 16 }}
            />
          ) : (
            <button onClick={() => { setBioInput(bio); setEditingBio(true) }}
              className="flex items-start gap-1.5 group text-left w-full">
              <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors leading-snug">
                {bio || '+ add bio'}
              </span>
              <Pencil size={9} className="text-white/20 group-hover:text-white/50 transition-colors mt-1 shrink-0" />
            </button>
          )}
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <div className="relative flex items-center gap-1.5 mb-4">
            {badges.map((b, i) => (
              <span key={i} title={b.label} className="text-xl cursor-default">{b.emoji}</span>
            ))}
          </div>
        )}

        {/* Customize panel */}
        {showCustomize && (
          <div className="relative bg-black/20 backdrop-blur-sm rounded-2xl p-3 mb-3 space-y-3">
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Customize banner</p>
            <div className="flex flex-wrap gap-2">
              {BANNER_COLORS.map((_, i) => (
                <button key={i} onClick={() => saveBannerColor(i)}
                  className={`w-6 h-6 rounded-full transition-all ${bannerColorIdx === i ? 'ring-2 ring-white ring-offset-1 ring-offset-transparent scale-110' : 'opacity-70 hover:opacity-100'}`}
                  style={{ background: BANNER_COLOR_PREVIEWS[i] }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {VIBE_EMOJIS.map(e => (
                <button key={e} onClick={() => saveBannerVibe(bannerVibe === e ? '' : e)}
                  className={`text-xl transition-all ${bannerVibe === e ? 'scale-125' : 'opacity-50 hover:opacity-100'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="h-1 -mx-6 bg-black/10" />
      </div>



      {/* No goals yet */}
      {!entry && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Lock in your goals for this week 🔒</p>
            {prevEntry?.goalItems?.length > 0 && (
              <button onClick={handleCarryOver} className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors">
                ↩ Last week's
              </button>
            )}
          </div>
          <GoalBuilder key={goalBuilderKey} initialGoals={carryOverGoals} onChange={setGoalsInput} />
          <button onClick={submitGoals} disabled={submitting || !goalsInput.some(g => g.text.trim())}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-bold rounded-xl py-3 transition-all">
            {submitting ? 'Locking in...' : 'Lock in goals 🔒'}
          </button>
        </div>
      )}

      {entry && (
        <>
          {/* Edit goals panel */}
          {editingGoals && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Edit goals</p>
                <button onClick={() => setEditingGoals(false)} className="text-zinc-500 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400"><X size={16} /></button>
              </div>
              <GoalBuilder initialGoals={entry.goalItems} onChange={setGoalsInput} />
              <button onClick={updateGoals} disabled={submitting || !goalsInput.some(g => g.text.trim())}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 disabled:opacity-40 text-white font-bold rounded-xl py-2.5 transition-all">
                {submitting ? 'Saving...' : 'Save goals'}
              </button>
            </div>
          )}

          {/* Day strip */}
          {!editingGoals && (
            <div className="flex items-stretch bg-zinc-100 dark:bg-zinc-800/60 rounded-xl overflow-hidden">
              {weekDays.map((day, i) => {
                const key = dateKey(day)
                const isToday    = key === todayKey
                const isSelected = key === selectedDay
                const isFuture   = key > todayKey
                const hasActivity = dayHasActivity(key)
                return (
                  <button key={key} onClick={() => !isFuture && setSelectedDay(key)}
                    disabled={isFuture}
                    className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-all disabled:opacity-30 ${
                      isSelected ? 'bg-zinc-900 dark:bg-white' : isToday ? 'bg-zinc-200/70 dark:bg-zinc-700' : 'hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
                    }`}>
                    <span className={`text-[10px] font-bold uppercase leading-none ${isSelected ? 'text-white dark:text-zinc-900' : 'text-zinc-400 dark:text-zinc-500'}`}>
                      {DAY_LABELS[i][0]}
                    </span>
                    <span className={`text-xs font-black leading-none ${isSelected ? 'text-white dark:text-zinc-900' : isToday ? 'text-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                      {day.getDate()}
                    </span>
                    <span className={`w-1 h-1 rounded-full ${hasActivity ? 'bg-emerald-400' : 'bg-transparent'}`} />
                  </button>
                )
              })}
            </div>
          )}

          {/* Re-enter goals if old entry has no goalItems */}
          {!editingGoals && !entry.goalItems?.length && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
              <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Re-enter your goals to unlock logging & proof 🔒</p>
              <GoalBuilder key="re-enter" initialGoals={[]} onChange={setGoalsInput} />
              <button onClick={updateGoals} disabled={submitting || !goalsInput.some(g => g.text.trim())}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 disabled:opacity-40 text-white font-bold rounded-xl py-2.5 transition-all">
                {submitting ? 'Saving...' : 'Save goals'}
              </button>
            </div>
          )}

          {/* Goal cards */}
          {!editingGoals && entry.goalItems?.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                  {selectedDay === todayKey ? 'Today' : selectedDayLabel}
                </p>
                {isOwner && (
                  <button onClick={() => { setGoalsInput(entry.goalItems); setEditingGoals(true) }}
                    className="flex items-center gap-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors text-xs">
                    <Pencil size={11} /> Edit goals
                  </button>
                )}
              </div>

              {entry.goalItems.map((goal, gi) => {
                const isFutureDay = selectedDay > todayKey

                // ── Habit card — single tappable row ─────────────────────
                if (goal.type === 'habit') {
                  const checked = !!logs[selectedDay]?.habits?.[goal.text]
                  return (
                    <div key={gi} className={`rounded-2xl border transition-all ${
                      checked ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                    }`}>
                      <button
                        onClick={() => isOwner && !isFutureDay && toggleHabit(goal.text)}
                        disabled={isFutureDay || !isOwner}
                        className="w-full flex items-center gap-3 px-4 py-3 disabled:opacity-40 active:scale-[0.99] transition-all">
                        <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                          checked ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-300 dark:border-zinc-600'
                        }`}>
                          {checked && <svg width="8" height="6" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </span>
                        <span className={`flex-1 text-sm font-semibold text-left ${checked ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                          {goal.text}
                        </span>
                        <div className="flex gap-0.5 shrink-0">
                          {weekDays.map((d, i) => {
                            const k = dateKey(d)
                            const done = !!logs[k]?.habits?.[goal.text]
                            const isSel = k === selectedDay
                            return <span key={i} className={`w-2 h-2 rounded-sm transition-all ${
                              done ? 'bg-emerald-500' : isSel ? 'bg-zinc-400 dark:bg-zinc-500' : k > todayKey ? 'bg-zinc-100 dark:bg-zinc-800' : 'bg-zinc-200 dark:bg-zinc-700'
                            }`} />
                          })}
                        </div>
                        <span className="text-[11px] font-bold text-zinc-400 shrink-0 w-5 text-right">{weeklyHabitDays(goal.text)}/7</span>
                      </button>
                      <div className="px-4 pb-3">{renderProofSection(goal.text, isFutureDay)}</div>
                    </div>
                  )
                }

                // ── Sub-goals card — compact rows ─────────────────────────
                if (goal.subGoals?.length > 0) {
                  const allDone = goal.subGoals.every(sg => {
                    const k = `${goal.text}::${sg.text}`
                    const v = weeklyCount(k)
                    const t = Number(sg.target) || 0
                    return t > 0 && v >= t
                  })
                  return (
                    <div key={gi} className={`border rounded-2xl px-4 py-3 space-y-2.5 transition-all ${
                      allDone ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                    }`}>
                      <span className={`text-sm font-semibold ${allDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-800 dark:text-zinc-200'}`}>{goal.text}</span>
                      {goal.subGoals.map((sg, si) => {
                        const k = `${goal.text}::${sg.text}`
                        const weekVal = weeklyCount(k)
                        const tgt = Number(sg.target) || 0
                        const pct = tgt ? Math.min(1, weekVal / tgt) : 0
                        const done = tgt > 0 && weekVal >= tgt
                        const dayVal = getCountVal(k)
                        return (
                          <div key={si} className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500 w-12 shrink-0 truncate">{sg.text}</span>
                            {tgt > 0 && (
                              <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-400' : 'bg-emerald-600'}`} style={{ width: `${pct * 100}%` }} />
                              </div>
                            )}
                            <span className={`text-[11px] font-bold shrink-0 w-8 text-right ${done ? 'text-emerald-400' : 'text-zinc-400'}`}>
                              {weekVal}{tgt ? `/${tgt}` : ''}
                            </span>
                            <Counter value={dayVal} unit={sg.unit} onChange={v => setDayCount(k, v)} />
                          </div>
                        )
                      })}
                      {renderProofSection(goal.text, isFutureDay)}
                    </div>
                  )
                }

                // ── Weekly goal card — two rows ───────────────────────────
                const weekVal = weeklyCount(goal.text)
                const tgt = Number(goal.target) || 0
                const pct = tgt ? Math.min(1, weekVal / tgt) : 0
                const done = tgt > 0 && weekVal >= tgt
                const dayVal = getCountVal(goal.text)

                return (
                  <div key={gi} className={`border rounded-2xl px-4 py-3 space-y-2 transition-all ${
                    done ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-semibold truncate ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-800 dark:text-zinc-200'}`}>{goal.text}</span>
                      <span className={`text-xs font-bold shrink-0 ${done ? 'text-emerald-400' : 'text-zinc-400'}`}>
                        {weekVal}{tgt ? `/${tgt}` : ''}{goal.unit ? ` ${goal.unit}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {tgt > 0 && (
                        <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-400' : 'bg-emerald-600'}`} style={{ width: `${pct * 100}%` }} />
                        </div>
                      )}
                      <Counter value={dayVal} unit={goal.unit} onChange={v => setDayCount(goal.text, v)} />
                    </div>
                    {renderProofSection(goal.text, isFutureDay)}
                  </div>
                )
              })}
            </div>
          )}

          {/* Chart */}
          {entry.goalItems?.length > 0 && (
            <div className="bg-zinc-100/40 dark:bg-zinc-800/40 rounded-2xl p-4">
              <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wide mb-2">Progress this week</p>
              <HighchartsReact
                highcharts={Highcharts}
                options={chartOptions}
              />
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {entry.goalItems.map((g, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: GOAL_COLORS[i % GOAL_COLORS.length] }} />
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{g.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proof log */}
          {entry.updates?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold px-1">Progress log</p>
              {entry.updates.map((u, i) => {
                const reactions = u.reactions || {}
                const toggleReaction = async (emoji) => {
                  const snap = await getDoc(doc(db, 'entries', entry.id))
                  const updates = snap.data().updates || []
                  updates[i] = { ...updates[i], reactions: { ...(updates[i].reactions || {}), [emoji]: ((updates[i].reactions?.[emoji] || 0) + 1) % 99 } }
                  await updateDoc(doc(db, 'entries', entry.id), { updates })
                }
                return (
                  <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 space-y-2">
                    <div className="flex gap-3">
                      <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                      <div className="flex-1">
                        <p className="text-sm text-zinc-800 dark:text-zinc-200">{u.text}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-600 mt-0.5">{formatTimestamp(u.timestamp)}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 pl-5">
                      {['🔥','💪','👏','❤️'].map(emoji => {
                        const count = reactions[emoji] || 0
                        return (
                          <button key={emoji} onClick={() => toggleReaction(emoji)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-sm transition-all active:scale-95 ${
                              count > 0 ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-600 hover:border-zinc-300 dark:hover:border-zinc-600'
                            }`}>
                            {emoji}
                            {count > 0 && <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{count}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}


        </>
      )}

      {/* Avatar picker */}
      {pickingAvatar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4" onClick={() => setPickingAvatar(false)}>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-3xl p-4 shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Pick your avatar</p>
              <button onClick={() => setPickingAvatar(false)} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-8 gap-1.5">
              {AVATAR_EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => saveAvatar(emoji)}
                  className={`text-2xl rounded-xl p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors active:scale-90 ${avatars[name] === emoji ? 'bg-zinc-200 dark:bg-zinc-700 ring-2 ring-emerald-500' : ''}`}>
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
