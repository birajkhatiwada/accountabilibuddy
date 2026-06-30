import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, addDoc, setDoc, getDoc, Timestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'
import { useAuth } from '../AuthContext'
import { getCurrentWeekId, formatWeekLabel, formatTimestamp } from '../utils'
import { Pencil, X, Camera } from 'lucide-react'
import GoalBuilder from '../components/GoalBuilder'
import DailyNote from '../components/DailyNote'
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
    <div className="flex items-center gap-1 shrink-0">
      <button onClick={() => onChange(Math.max(0, value - 1))}
        className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold text-sm flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-90 transition-all select-none">
        −
      </button>
      <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 w-5 text-center tabular-nums">{value}</span>
      <button onClick={() => onChange(Math.min(999, value + 1))}
        className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold text-sm flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-90 transition-all select-none">
        +
      </button>
      {unit && <span className="text-[10px] text-zinc-400 ml-0.5">{unit}</span>}
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

  const [memberGoals, setMemberGoals] = useState(undefined) // undefined = loading, null = none set
  const [members, setMembers] = useState([])
  const [entry, setEntry] = useState(undefined)
  const [allEntries, setAllEntries] = useState([])
  const [logs, setLogs] = useState({})
  const [avatars, setAvatars] = useState({})
  const [penalty, setPenalty] = useState(15)
  const [goalsInput, setGoalsInput] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [pickingAvatar, setPickingAvatar] = useState(false)
  const [goalBuilderKey, setGoalBuilderKey] = useState(0)
  const [carryOverGoals, setCarryOverGoals] = useState(null)
  const [selectedDay, setSelectedDay] = useState(todayKey)
  const [localCounts, setLocalCounts] = useState({})
  const [localTotals, setLocalTotals] = useState({})
  const [proofOpen, setProofOpen] = useState({})
  const [proofNoteInputs, setProofNoteInputs] = useState({})
  const [editingProof, setEditingProof] = useState({})
  const [activeGoalSheet, setActiveGoalSheet] = useState(null)
  const [loggingSheet, setLoggingSheet] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState({})
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [reactionPickerOpen, setReactionPickerOpen] = useState(null)
  const longPressTimer = useRef(null)
  const [justChecked, setJustChecked] = useState({})
  const [bio, setBio] = useState('')
  const [status, setStatus] = useState('')
  const [avatarPhotoUrl, setAvatarPhotoUrl] = useState('')
  const [bannerImageUrl, setBannerImageUrl] = useState('')
  const [nickname, setNickname] = useState('')
  const [bioInput, setBioInput] = useState('')
  const [statusInput, setStatusInput] = useState('')
  const [nicknameInput, setNicknameInput] = useState('')
  const [bannerColorIdx, setBannerColorIdx] = useState(null)
  const [bannerVibe, setBannerVibe] = useState('')
  const [editBannerOpen, setEditBannerOpen] = useState(false)
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
        setAvatarPhotoUrl(d.avatarPhotos?.[name] || '')
        setBannerImageUrl(d.bannerImages?.[name] || '')
        setNickname(d.nicknames?.[name] || '')
        const mg = d.memberGoals?.[name]
        setMemberGoals(mg?.length ? mg : null)
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
    const open = !!(loggingSheet || activeGoalSheet)
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [loggingSheet, activeGoalSheet])

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

  const weekDays = useMemo(() => {
    const [y, m, d] = weekId.split('-').map(Number)
    const monday = new Date(y, m - 1, d) // local midnight — no UTC shift
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(monday)
      day.setDate(monday.getDate() + i)
      return day
    })
  }, [weekId])

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

  const cumulativeCount = (key, upToDay) => weekDays.reduce((sum, d) => {
    if (dateKey(d) > upToDay) return sum
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
  }

  // Goals source of truth lives on the session doc; entries are log containers only
  const myGoals = memberGoals || entry?.goalItems || []

  const goalsSummary = (items) => items.map(g =>
    g.type === 'habit' ? `${g.text} (every day)` : g.target ? `${g.text} (${g.target} ${g.unit})` : g.text
  ).join(', ')

  const persistGoals = async (valid) => {
    // Save to session as persistent goals
    await setDoc(sessionDoc, { memberGoals: { [name]: valid } }, { merge: true })
    // Keep entry's goalItems in sync for history / log context
    if (entry) {
      await updateDoc(doc(db, 'entries', entry.id), { goals: goalsSummary(valid), goalItems: valid })
    } else {
      // Create this week's entry so logging can start immediately
      await addDoc(collection(db, 'entries'), {
        name, nameLower: name.toLowerCase(), weekId, sessionId,
        goals: goalsSummary(valid), goalItems: valid, status: 'active',
        updates: [], createdAt: Timestamp.now(),
      })
    }
  }

  const submitGoals = async () => {
    const valid = goalsInput.filter(g => g.text.trim())
    if (!valid.length) return
    setSubmitting(true)
    await persistGoals(valid)
    setSubmitting(false)
  }


  const reorderGoals = async (newItems) => {
    await persistGoals(newItems)
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


  const saveDailyColor = async (color) => {
    const current = getDayLog(selectedDay)
    const existing = current.proof?.['daily'] || {}
    await setDoc(doc(db, 'entries', entry.id, 'dailyLogs', selectedDay), {
      ...current,
      proof: { ...(current.proof || {}), daily: { ...existing, color } }
    })
  }

  const saveDailyNote = async (content, plainText) => {
    const current = getDayLog(selectedDay)
    const existing = current.proof?.['daily'] || {}
    await setDoc(doc(db, 'entries', entry.id, 'dailyLogs', selectedDay), {
      ...current,
      proof: { ...(current.proof || {}), daily: { ...existing, content, note: plainText } }
    })
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
          <div>
            {saved.photoUrl && (
              <div className="relative rounded-xl overflow-hidden mb-2">
                <img src={saved.photoUrl} alt="proof" className="w-full object-cover max-h-52" />
                {isOwner && (
                  <label className="absolute top-2 right-2 bg-black/40 hover:bg-black/60 text-white rounded-lg p-1.5 cursor-pointer transition-colors">
                    {uploading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera size={13} />}
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadGoalPhoto(goalText, f); e.target.value = '' }} />
                  </label>
                )}
              </div>
            )}
            {saved.note && (
              <div className="flex items-start gap-2">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug flex-1">{saved.note}</p>
                {isOwner && (
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <button onClick={() => { setEditingProof(p => ({ ...p, [goalText]: true })); setProofNoteInputs(p => ({ ...p, [goalText]: saved.note || '' })) }}
                      className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors">
                      <Pencil size={12} />
                    </button>
                    <label className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors cursor-pointer">
                      {uploading ? <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <Camera size={12} />}
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadGoalPhoto(goalText, f); e.target.value = '' }} />
                    </label>
                  </div>
                )}
              </div>
            )}
            {/* Reactions */}
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
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


  const saveAvatar = async (emoji) => { await setDoc(sessionDoc, { avatars: { ...avatars, [name]: emoji } }, { merge: true }); setPickingAvatar(false) }
  const saveBio = async (val) => { await setDoc(sessionDoc, { bios: { [name]: val.trim() } }, { merge: true }) }
  const saveStatus = async (val) => { await setDoc(sessionDoc, { statuses: { [name]: val.trim() } }, { merge: true }) }
  const saveNickname = async (val) => { setNickname(val.trim()); await setDoc(sessionDoc, { nicknames: { [name]: val.trim() } }, { merge: true }) }
  const saveBannerColor = async (idx) => { setBannerColorIdx(idx); await setDoc(sessionDoc, { bannerColors: { [name]: idx } }, { merge: true }) }
  const saveBannerVibe = async (emoji) => { setBannerVibe(emoji); await setDoc(sessionDoc, { bannerVibes: { [name]: emoji } }, { merge: true }) }

  const uploadAvatarPhoto = async (file) => {
    setUploadingAvatar(true)
    const storageRef = ref(storage, `avatars/${sessionId}/${name}`)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    setAvatarPhotoUrl(url)
    await setDoc(sessionDoc, { avatarPhotos: { [name]: url } }, { merge: true })
    setUploadingAvatar(false)
  }

  const uploadBannerImage = async (file) => {
    setUploadingBanner(true)
    const storageRef = ref(storage, `banners/${sessionId}/${name}`)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    setBannerImageUrl(url)
    await setDoc(sessionDoc, { bannerImages: { [name]: url } }, { merge: true })
    setUploadingBanner(false)
  }

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
    series: myGoals.map((g, i) => ({ name: g.text, color: GOAL_COLORS[i % GOAL_COLORS.length], data: getGoalDailyPct(g) })),
  }), [logs, myGoals])

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
    <div className="flex flex-col space-y-4 -mx-4 px-4 -mt-5 pb-4">

      {/* Banner */}
      <div className="-mx-4">
        {/* Cover image */}
        <div className={`bg-gradient-to-br ${color} h-28 relative overflow-hidden`}>
          {bannerImageUrl && <img src={bannerImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`, backgroundSize: '20px 20px' }} />
          {bannerVibe && !bannerImageUrl && <div className="absolute right-5 bottom-3 text-7xl opacity-20 select-none pointer-events-none leading-none">{bannerVibe}</div>}

          {/* Edit banner button */}
          {isOwner && (
            <button onClick={() => { setStatusInput(status); setBioInput(bio); setNicknameInput(nickname); setEditBannerOpen(true) }}
              className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white/80 hover:text-white text-xs font-semibold transition-all active:scale-95">
              <Pencil size={11} /> Edit
            </button>
          )}
        </div>

        {/* Profile info — avatar overlaps banner */}
        <div className="px-4 pb-3">
          <div className="flex items-end justify-between -mt-7 mb-3">
            {/* Avatar */}
            <button onClick={() => setPickingAvatar(v => !v)}
              className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${color} ring-4 ring-zinc-50 dark:ring-zinc-950 flex items-center justify-center relative group transition-all hover:scale-105 active:scale-95 shrink-0 shadow-lg overflow-hidden`}>
              {avatarPhotoUrl
                ? <img src={avatarPhotoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                : avatars[name]
                  ? <span className="text-3xl">{avatars[name]}</span>
                  : <span className="text-white font-black text-3xl leading-none">{name[0].toUpperCase()}</span>}
              <span className="absolute inset-0 rounded-2xl bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <Pencil size={11} className="text-white" />
              </span>
            </button>

            {/* Badges top-right */}
            <div className="flex items-center gap-1 pb-1 flex-wrap justify-end">
              {entry?.status === 'completed' && <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded-full">✅ Done!</span>}
              {entry?.status === 'failed'    && <span className="text-[10px] font-bold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-500/20 px-1.5 py-0.5 rounded-full">❌ Failed</span>}
              {streak >= 2 && <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 rounded-full">🔥 {streak}w streak</span>}
              {badges.map((b, i) => <span key={i} title={b.label} className="text-sm cursor-default">{b.emoji}</span>)}
            </div>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-black text-zinc-900 dark:text-white leading-none">{nickname || name}</h2>
              {status && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 leading-snug">{status}</p>}
              {bio && <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500 leading-snug">{bio}</p>}
              <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1">{formatWeekLabel(weekId)}</p>
            </div>

            {/* Overall completion ring */}
            {myGoals.length > 0 && (() => {
              const pct = myGoals.reduce((sum, g) => {
                if (g.type === 'habit') {
                  return sum + Object.values(logs).filter(d => d.habits?.[g.text]).length / 7
                }
                if (g.subGoals?.length > 0) {
                  const r = g.subGoals.map(sg => {
                    const k = `${g.text}::${sg.text}`
                    const done = Object.values(logs).reduce((s, d) => s + (Number(d.counts?.[k]) || 0), 0)
                    return Math.min(1, done / (Number(sg.target) || 1))
                  })
                  return sum + r.reduce((s, v) => s + v, 0) / r.length
                }
                const done = Object.values(logs).reduce((s, d) => s + (Number(d.counts?.[g.text]) || 0), 0)
                return sum + Math.min(1, done / (Number(g.target) || 1))
              }, 0) / myGoals.length
              const pctRound = Math.round(pct * 100)
              const hex = pct >= 1 ? '#34d399' : pct >= 0.5 ? '#fbbf24' : '#8b5cf6'
              return (
                <div className="relative w-14 h-14 shrink-0">
                  <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
                    <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" strokeWidth="5" className="text-zinc-200 dark:text-zinc-700" />
                    <circle cx="28" cy="28" r="22" fill="none" stroke={hex} strokeWidth="5" strokeLinecap="round"
                      strokeDasharray={`${Math.round(pct * 138.2)} 138.2`} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-black text-zinc-800 dark:text-zinc-100 leading-none">{pctRound}%</span>
                    <span className="text-[8px] text-zinc-400 font-semibold leading-none mt-0.5">done</span>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Edit Goals — full-width below banner */}
      {isOwner && myGoals.length > 0 && (
        <button onClick={() => navigate(`/${sessionId}/member/${encodeURIComponent(name)}/goals`)}
          className="add-goal-btn w-full py-3 flex items-center justify-center gap-2 font-bold text-sm rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]">
          <span className="add-goal-plus-wrap">✏️</span>
          Edit Goals
        </button>
      )}



      {/* No goals yet */}
      {!myGoals.length && isOwner && (
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

      {(entry || myGoals.length > 0) && (
        <>
          {/* Day strip */}
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
                    isSelected
                      ? 'bg-zinc-800 dark:bg-white'
                      : isToday
                        ? 'bg-zinc-200 dark:bg-zinc-700'
                        : 'hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50'
                  }`}>
                  <span className={`text-[10px] font-bold uppercase leading-none ${
                    isSelected ? 'text-white dark:text-zinc-900' : 'text-zinc-400 dark:text-zinc-500'
                  }`}>
                    {DAY_LABELS[i][0]}
                  </span>
                  <span className={`text-xs font-black leading-none ${
                    isSelected ? 'text-white dark:text-zinc-900' : isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-300'
                  }`}>
                    {day.getDate()}
                  </span>
                  <span className={`w-1 h-1 rounded-full ${hasActivity ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-transparent'}`} />
                </button>
              )
            })}
          </div>

          {/* Chart */}
          {myGoals.length > 0 && (
            <div className="bg-zinc-100/40 dark:bg-zinc-800/40 rounded-2xl p-4">
              <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wide mb-2">Progress this week</p>
              <HighchartsReact highcharts={Highcharts} options={chartOptions} />
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {myGoals.map((g, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: GOAL_COLORS[i % GOAL_COLORS.length] }} />
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{g.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Goal rows */}
          {myGoals.length > 0 && (() => {
            const goalDone = (goal) => {
              const checked = goal.type === 'habit' ? !!logs[selectedDay]?.habits?.[goal.text] : false
              const wv = goal.type !== 'habit' && !goal.subGoals?.length ? weeklyCount(goal.text) : 0
              const tgt = Number(goal.target) || 0
              return goal.type === 'habit' ? checked
                : goal.subGoals?.length > 0
                  ? goal.subGoals.every(sg => { const k=`${goal.text}::${sg.text}`; return (Number(sg.target)||0)>0 && weeklyCount(k)>=(Number(sg.target)||0) })
                  : tgt > 0 && wv >= tgt
            }
            return (
              <div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold uppercase tracking-wider mb-2">
                  {selectedDay === todayKey ? 'Today' : selectedDayLabel}
                </p>

                <div className="space-y-1.5">
                  {myGoals.map((goal) => {
                    const isFutureDay = selectedDay > todayKey
                    const done = goalDone(goal)
                    const weekVal = goal.type !== 'habit' && !goal.subGoals?.length ? weeklyCount(goal.text) : 0
                    const tgt = Number(goal.target) || 0

                    const rightLabel = goal.type === 'habit'
                      ? `${weeklyHabitDays(goal.text)}/7`
                      : goal.subGoals?.length > 0
                        ? `${goal.subGoals.filter(sg => { const k=`${goal.text}::${sg.text}`; return (Number(sg.target)||0)>0 && weeklyCount(k)>=(Number(sg.target)||0) }).length}/${goal.subGoals.length}`
                        : tgt > 0 ? `${weekVal}/${tgt}${goal.unit ? ` ${goal.unit}` : ''}` : null

                    const barPct = goal.type === 'habit'
                      ? weeklyHabitDays(goal.text) / 7
                      : goal.subGoals?.length > 0
                        ? goal.subGoals.filter(sg => { const k=`${goal.text}::${sg.text}`; return (Number(sg.target)||0)>0 && weeklyCount(k)>=(Number(sg.target)||0) }).length / goal.subGoals.length
                        : tgt > 0 ? Math.min(1, weekVal / tgt) : 0

                    const isBreakdown = goal.subGoals?.length > 0
                    const todayVal = !isBreakdown && goal.type !== 'habit' ? getCountVal(goal.text) : 0
                    const hasBreakdownToday = isBreakdown && goal.subGoals.some(sg => getCountVal(`${goal.text}::${sg.text}`) > 0)
                    const workedToday = todayVal > 0 || hasBreakdownToday
                    // for count goals: check if goal was already complete as of the selected day
                    const doneAsOfSelectedDay = goal.type === 'habit' ? done
                      : goal.subGoals?.length > 0
                        ? goal.subGoals.every(sg => { const k=`${goal.text}::${sg.text}`; return (Number(sg.target)||0)>0 && cumulativeCount(k, selectedDay)>=(Number(sg.target)||0) })
                        : tgt > 0 && cumulativeCount(goal.text, selectedDay) >= tgt
                    const showCheck = goal.type === 'habit' ? done : doneAsOfSelectedDay
                    const showDot = goal.type === 'habit' ? false : (!showCheck && workedToday)

                    const stateColors = (pct, isDone) => {
                      if (isDone || pct >= 1) return {
                        fill: 'bg-emerald-500/30 dark:bg-emerald-400/25',
                        text: 'text-emerald-800 dark:text-emerald-300',
                        label: 'text-emerald-600 dark:text-emerald-400',
                        chevron: 'text-emerald-300 dark:text-emerald-700',
                        todayPill: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/15',
                        checkFull: 'bg-emerald-500 border-emerald-500',
                        checkOutline: 'border-emerald-400 dark:border-emerald-500',
                        checkStroke: '#10b981',
                      }
                      if (pct <= 0) return {
                        fill: '',
                        text: 'text-zinc-800 dark:text-zinc-200',
                        label: 'text-zinc-400 dark:text-zinc-500',
                        chevron: 'text-zinc-300 dark:text-zinc-600',
                        todayPill: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
                        checkFull: 'bg-emerald-500 border-emerald-500',
                        checkOutline: 'border-emerald-400 dark:border-emerald-500',
                        checkStroke: '#10b981',
                      }
                      if (pct < 0.35) return {
                        fill: 'bg-rose-500/20 dark:bg-rose-500/15',
                        text: 'text-rose-800 dark:text-rose-300',
                        label: 'text-rose-500 dark:text-rose-400',
                        chevron: 'text-rose-300 dark:text-rose-700',
                        todayPill: 'text-rose-700 dark:text-rose-300 bg-rose-500/15',
                        checkFull: 'bg-rose-500 border-rose-500',
                        checkOutline: 'border-rose-400 dark:border-rose-500',
                        checkStroke: '#f43f5e',
                      }
                      if (pct < 0.65) return {
                        fill: 'bg-amber-500/20 dark:bg-amber-500/15',
                        text: 'text-amber-800 dark:text-amber-300',
                        label: 'text-amber-600 dark:text-amber-400',
                        chevron: 'text-amber-300 dark:text-amber-700',
                        todayPill: 'text-amber-700 dark:text-amber-300 bg-amber-500/15',
                        checkFull: 'bg-amber-500 border-amber-500',
                        checkOutline: 'border-amber-400 dark:border-amber-500',
                        checkStroke: '#f59e0b',
                      }
                      return {
                        fill: 'bg-emerald-500/20 dark:bg-emerald-500/15',
                        text: 'text-emerald-800 dark:text-emerald-300',
                        label: 'text-emerald-600 dark:text-emerald-400',
                        chevron: 'text-emerald-300 dark:text-emerald-700',
                        todayPill: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/15',
                        checkFull: 'bg-emerald-500 border-emerald-500',
                        checkOutline: 'border-emerald-400 dark:border-emerald-500',
                        checkStroke: '#10b981',
                      }
                    }

                    const isDoneForColor = goal.type === 'habit' ? barPct >= 1 : done
                    const c = stateColors(barPct, isDoneForColor)

                    return (
                      <div key={goal.text} className="space-y-1">
                        {/* Parent card */}
                        <div className="relative rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800/60">
                          <div
                            className={`absolute inset-y-0 left-0 transition-all duration-700 ${c.fill}`}
                            style={{ width: `${barPct * 100}%` }}
                          />
                          <button
                            onClick={() => !isFutureDay && (goal.type === 'habit' ? toggleHabit(goal.text) : setLoggingSheet(goal))}
                            disabled={isFutureDay || (goal.type === 'habit' && !isOwner)}
                            className="relative w-full flex items-center gap-2.5 px-3 py-2.5 text-left disabled:opacity-40">
                            <div className={`w-3.5 h-3.5 rounded-sm border-2 shrink-0 flex items-center justify-center transition-colors ${showCheck ? c.checkFull : showDot ? c.checkOutline : 'border-zinc-300 dark:border-zinc-500'}`}>
                              {(showCheck || showDot) && (
                                <svg width="7" height="5" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4L3.5 6.5L9 1" stroke={showCheck ? 'white' : c.checkStroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <span className={`flex-1 text-sm truncate ${c.text}`}>{goal.text}</span>
                            {todayVal > 0 && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${c.todayPill}`}>+{todayVal} today</span>
                            )}
                            {rightLabel && <span className={`text-[11px] tabular-nums shrink-0 ${c.label}`}>{rightLabel}</span>}
                          </button>
                        </div>

                        {/* Sub-goal cards */}
                        {isBreakdown && (
                          <div className="ml-4 space-y-1">
                            {goal.subGoals.map((sg, si) => {
                              const k = `${goal.text}::${sg.text}`
                              const sv = weeklyCount(k)
                              const todayV = getCountVal(k)
                              const st = Number(sg.target) || 0
                              const sp = st ? Math.min(1, sv / st) : 0
                              const sdone = st > 0 && sv >= st
                              const sc = stateColors(sp, sdone)
                              return (
                                <div key={si} className="relative rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800/60">
                                  <div
                                    className={`absolute inset-y-0 left-0 transition-all duration-700 ${sc.fill}`}
                                    style={{ width: `${sp * 100}%` }}
                                  />
                                  <div className="relative flex items-center gap-2 px-3 py-2">
                                    <span className={`text-xs flex-1 truncate ${sc.text}`}>{sg.text}</span>
                                    {todayV > 0 && <span className={`text-[10px] font-semibold shrink-0 ${sc.label}`}>+{todayV}</span>}
                                    <span className={`text-[10px] tabular-nums shrink-0 ${sc.label}`}>{sv}{st ? `/${st}` : ''}{sg.unit ? ` ${sg.unit}` : ''}</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <DailyNote
                  daily={getGoalProof('daily')}
                  canEdit={isOwner && selectedDay <= todayKey}
                  dayLabel={selectedDay === todayKey ? 'Today' : selectedDayLabel}
                  onSave={saveDailyNote}
                  onColorSave={saveDailyColor}
                  uploadingPhoto={!!uploadingPhoto['daily']}
                  onPhotoUpload={e => { const f = e.target.files?.[0]; if (f) uploadGoalPhoto('daily', f); e.target.value = '' }}
                />
              </div>
            )
          })()}

          {/* Logging bottom sheet */}
          {loggingSheet && (() => {
            const goal = loggingSheet
            const isFutureDay = selectedDay > todayKey
            const close = () => setLoggingSheet(null)
            const sheetClass = "fixed inset-0 z-50 flex items-end justify-center"
            const innerClass = "relative bg-white dark:bg-zinc-900 rounded-t-3xl w-full max-w-lg slide-up flex flex-col"
            const handle = <div className="flex justify-center pt-3 pb-0 shrink-0"><div className="w-10 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full" /></div>

            // ── breakdown ──────────────────────────────────────────────────
            if (goal.subGoals?.length > 0) {
              return createPortal(
                <div className={sheetClass} onClick={close}>
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                  <div className={innerClass} style={{ maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
                    {handle}
                    <div className="px-5 pt-4 pb-2 flex items-start justify-between shrink-0">
                      <div>
                        <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5">Breakdown</p>
                        <h2 className="text-xl font-black text-zinc-900 dark:text-white leading-tight">{goal.text}</h2>
                      </div>
                      <button onClick={close} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mt-0.5"><X size={16} /></button>
                    </div>
                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-5" />
                    <div className="px-5 pb-8 pt-4 flex-1 overflow-y-auto overscroll-contain space-y-3">
                      {goal.subGoals.map((sg, si) => {
                        const k = `${goal.text}::${sg.text}`
                        const weekVal = weeklyCount(k)
                        const todayVal = getCountVal(k)
                        const tgt = Number(sg.target) || 0
                        const pct = tgt ? Math.min(1, weekVal / tgt) : 0
                        const done = tgt > 0 && weekVal >= tgt
                        return (
                          <div key={si} className={`rounded-2xl p-4 border ${done ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50' : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-100 dark:border-zinc-800'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-sm font-bold ${done ? 'text-emerald-700 dark:text-emerald-300' : 'text-zinc-800 dark:text-zinc-100'}`}>{sg.text}</span>
                              <span className={`text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full ${done ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'}`}>
                                {weekVal}{tgt ? `/${tgt}` : ''}{sg.unit ? ` ${sg.unit}` : ''} wk
                              </span>
                            </div>
                            {tgt > 0 && <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-3"><div className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-400' : 'bg-emerald-500'}`} style={{ width: `${pct * 100}%` }} /></div>}
                            {isOwner && !isFutureDay && (
                              <div className="flex items-center gap-3">
                                <button onClick={() => setDayCount(k, Math.max(0, todayVal - 1))}
                                  className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-sm font-bold flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-600 active:scale-90 transition-all select-none">−</button>
                                <div className="flex-1 text-center">
                                  <span className="text-xl font-black tabular-nums text-zinc-900 dark:text-white">{todayVal}</span>
                                  {sg.unit && <span className="text-xs text-zinc-400 ml-1.5">{sg.unit}</span>}
                                </div>
                                <button onClick={() => setDayCount(k, Math.min(999, todayVal + 1))}
                                  className="w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold flex items-center justify-center active:scale-90 transition-all select-none">+</button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              , document.body)
            }

            // ── count ──────────────────────────────────────────────────────
            const weekVal = weeklyCount(goal.text)
            const tgt = Number(goal.target) || 0
            const pct = tgt ? Math.min(1, weekVal / tgt) : 0
            const done = tgt > 0 && weekVal >= tgt
            const todayCount = getCountVal(goal.text)
            return createPortal(
              <div className={sheetClass} onClick={close}>
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                <div className={innerClass} style={{ maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
                  {handle}
                  <div className="px-5 pt-4 pb-2 flex items-start justify-between shrink-0">
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5">Log progress</p>
                      <h2 className="text-xl font-black text-zinc-900 dark:text-white leading-tight">{goal.text}</h2>
                    </div>
                    <button onClick={close} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mt-0.5"><X size={16} /></button>
                  </div>
                  {tgt > 0 && (
                    <div className="px-5 pt-2 pb-3">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">Weekly total</span>
                        <span className={`text-sm font-black tabular-nums ${done ? 'text-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                          {weekVal} <span className="font-normal text-zinc-400">/ {tgt}{goal.unit ? ` ${goal.unit}` : ''}</span>
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-400' : 'bg-emerald-500'}`} style={{ width: `${pct * 100}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-5" />
                  {isOwner && !isFutureDay ? (
                    <div className="px-5 py-6 flex items-center gap-4">
                      <button onClick={() => setDayCount(goal.text, Math.max(0, todayCount - 1))}
                        className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-lg font-bold flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-90 transition-all select-none">−</button>
                      <div className="flex-1 text-center">
                        <p className="text-4xl font-black tabular-nums text-zinc-900 dark:text-white leading-none">{todayCount}</p>
                        <p className="text-xs text-zinc-400 mt-1.5">{goal.unit ? `${goal.unit} today` : 'today'}</p>
                      </div>
                      <button onClick={() => setDayCount(goal.text, Math.min(999, todayCount + 1))}
                        className="w-11 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-lg font-bold flex items-center justify-center active:scale-90 transition-all select-none">+</button>
                    </div>
                  ) : (
                    <div className="px-5 py-8 text-center text-sm text-zinc-400">{isFutureDay ? "Can't log a future day" : 'View only'}</div>
                  )}
                </div>
              </div>
            , document.body)
          })()}

          {/* Goal bottom sheet */}
          {activeGoalSheet && (() => {
            const goal = activeGoalSheet
            const proof = getGoalProof(goal.text)
            const uploading = uploadingPhoto[goal.text]
            const isEditing = !!editingProof[goal.text]
            const closeProof = () => { setActiveGoalSheet(null); setEditingProof({}); setReactionPickerOpen(null) }

            return createPortal(
              <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={closeProof}>
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                <div className="relative bg-white dark:bg-zinc-900 rounded-t-3xl w-full max-w-lg slide-up shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-center pt-3"><div className="w-10 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700" /></div>

                  <div className="px-5 pt-4 pb-2 flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5">Add proof</p>
                      <h2 className="text-xl font-black text-zinc-900 dark:text-white leading-tight">{goal.text}</h2>
                    </div>
                    <button onClick={closeProof} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mt-0.5"><X size={16} /></button>
                  </div>

                  <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-5 mt-3" />

                  <div className="px-5 py-4 pb-8">
                    {isEditing ? (
                      <div className="border border-emerald-500/50 dark:border-emerald-500/30 rounded-2xl overflow-hidden">
                        <textarea autoFocus value={proofNoteInputs[goal.text] ?? ''} onChange={e => setProofNoteInputs(p => ({ ...p, [goal.text]: e.target.value }))}
                          placeholder="What did you do?" rows={4} style={{ fontSize: 16 }}
                          className="w-full bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none resize-none" />
                        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60">
                          <button onClick={() => setEditingProof(p => ({ ...p, [goal.text]: false }))} className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors px-3 py-1.5">Cancel</button>
                          <button onClick={() => { sendProofNote(goal.text); setEditingProof(p => ({ ...p, [goal.text]: false })); setActiveGoalSheet(null) }}
                            disabled={!(proofNoteInputs[goal.text] ?? '').trim()}
                            className="text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 px-4 py-1.5 rounded-xl transition-colors">Save</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <button onClick={() => { setEditingProof(p => ({ ...p, [goal.text]: true })); setProofNoteInputs(p => ({ ...p, [goal.text]: proof.note || '' })) }}
                          className="flex items-center gap-3.5 w-full px-4 py-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 border border-zinc-100 dark:border-zinc-800 transition-colors text-left">
                          <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                            <Pencil size={13} className="text-zinc-500 dark:text-zinc-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Add a note</p>
                            {proof.note && <p className="text-xs text-zinc-400 truncate mt-0.5">{proof.note}</p>}
                          </div>
                        </button>
                        <label className="flex items-center gap-3.5 w-full px-4 py-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 border border-zinc-100 dark:border-zinc-800 transition-colors cursor-pointer">
                          <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                            {uploading ? <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <Camera size={13} className="text-zinc-500 dark:text-zinc-400" />}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{proof.photoUrl ? 'Replace photo' : 'Add a photo'}</p>
                          </div>
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { uploadGoalPhoto(goal.text, f); setActiveGoalSheet(null) } e.target.value = '' }} />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            , document.body)
          })()}

          {/* Proof log */}
          {entry?.updates?.length > 0 && (
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

      {/* Edit Banner sheet */}
      {editBannerOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setEditBannerOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-zinc-900 rounded-t-3xl w-full max-w-lg slide-up pb-safe" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mt-3 mb-4" />
            <div className="px-5 pb-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-zinc-900 dark:text-white">Edit Banner</h3>
                <button onClick={() => setEditBannerOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"><X size={18} /></button>
              </div>

              {/* Display name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Display Name <span className="font-normal normal-case text-zinc-500">({name})</span></label>
                <input value={nicknameInput} onChange={e => setNicknameInput(e.target.value)}
                  maxLength={30} placeholder={name}
                  style={{ fontSize: 16 }}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500 transition-colors" />
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Status</label>
                <input value={statusInput} onChange={e => setStatusInput(e.target.value)}
                  maxLength={40} placeholder="What's the vibe this week?"
                  style={{ fontSize: 16 }}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500 transition-colors" />
              </div>

              {/* Bio */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Bio</label>
                <textarea value={bioInput} onChange={e => setBioInput(e.target.value)}
                  maxLength={120} rows={2} placeholder="Short bio…"
                  style={{ fontSize: 16 }}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500 transition-colors resize-none" />
              </div>

              {/* Banner image */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Banner Image</label>
                <label className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${bannerImageUrl ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600'}`}>
                  {uploadingBanner
                    ? <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />
                    : <Camera size={15} className="text-zinc-400 shrink-0" />}
                  <span className="text-sm text-zinc-600 dark:text-zinc-400 flex-1">{bannerImageUrl ? 'Change banner photo' : 'Upload a banner photo'}</span>
                  {bannerImageUrl && <button type="button" onClick={e => { e.preventDefault(); setBannerImageUrl(''); setDoc(sessionDoc, { bannerImages: { [name]: '' } }, { merge: true }) }} className="text-xs text-zinc-400 hover:text-red-400 transition-colors">Remove</button>}
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadBannerImage(f); e.target.value = '' }} />
                </label>
                {bannerImageUrl && <img src={bannerImageUrl} alt="" className="w-full h-16 object-cover rounded-xl" />}
              </div>

              {/* Banner color */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Banner Color {bannerImageUrl && <span className="font-normal text-zinc-500">(hidden when photo set)</span>}</label>
                <div className="flex flex-wrap gap-2">
                  {BANNER_COLORS.map((_, i) => (
                    <button key={i} onClick={() => saveBannerColor(i)}
                      className={`w-7 h-7 rounded-full transition-all hover:scale-110 ${bannerColorIdx === i ? 'ring-2 ring-offset-2 ring-zinc-400 dark:ring-zinc-500 dark:ring-offset-zinc-900 scale-110' : ''}`}
                      style={{ background: BANNER_COLOR_PREVIEWS[i] }} />
                  ))}
                </div>
              </div>

              {/* Vibe */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Vibe</label>
                <div className="flex flex-wrap gap-1.5">
                  {VIBE_EMOJIS.map(e => (
                    <button key={e} onClick={() => saveBannerVibe(bannerVibe === e ? '' : e)}
                      className={`text-xl w-9 h-9 flex items-center justify-center rounded-xl transition-all hover:scale-110 ${bannerVibe === e ? 'bg-zinc-100 dark:bg-zinc-800 scale-110 ring-2 ring-zinc-300 dark:ring-zinc-600' : 'opacity-50 hover:opacity-100'}`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save */}
              <button onClick={() => { saveBio(bioInput); saveStatus(statusInput); saveNickname(nicknameInput); setEditBannerOpen(false) }}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-bold rounded-2xl transition-colors">
                Save
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Avatar picker */}
      {pickingAvatar && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4" onClick={() => setPickingAvatar(false)}>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-3xl p-4 shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Pick your avatar</p>
              <button onClick={() => setPickingAvatar(false)} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"><X size={16} /></button>
            </div>

            {/* Photo upload */}
            <label className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors mb-3 ${avatarPhotoUrl ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600'}`}>
              {uploadingAvatar
                ? <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />
                : <Camera size={15} className="text-zinc-400 shrink-0" />}
              <span className="text-sm text-zinc-600 dark:text-zinc-400 flex-1">{avatarPhotoUrl ? 'Change photo' : 'Upload a photo'}</span>
              {avatarPhotoUrl && <button type="button" onClick={e => { e.preventDefault(); setAvatarPhotoUrl(''); setDoc(sessionDoc, { avatarPhotos: { [name]: '' } }, { merge: true }) }} className="text-xs text-zinc-400 hover:text-red-400 transition-colors">Remove</button>}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { uploadAvatarPhoto(f); setPickingAvatar(false) } e.target.value = '' }} />
            </label>

            <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-wide mb-2">Or pick an emoji</p>
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
      , document.body)}
    </div>
  )
}
