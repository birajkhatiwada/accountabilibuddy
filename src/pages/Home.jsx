import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, addDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentWeekId, formatWeekLabel, formatTimestamp } from '../utils'
import { CheckCircle, XCircle, Send, AlertTriangle, ArrowLeft, Plus, Check, Pencil, X, UserPlus } from 'lucide-react'
import WeekCalendar from '../components/WeekCalendar'
import GoalBuilder from '../components/GoalBuilder'

const MEMBERS_DOC = doc(db, 'config', 'members')
const PENALTY = 15

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

const getAvatarColor = (name) =>
  AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]

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

  useEffect(() => {
    const unsub = onSnapshot(MEMBERS_DOC, snap => {
      setMembers(snap.exists() ? (snap.data().names || []) : [])
      setLoading(false)
    }, err => { setError(err.message); setLoading(false) })
    return unsub
  }, [])

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
    const color = getAvatarColor(selectedMember)
    const goalCount = entry?.goalItems?.length || 0
    const updateCount = entry?.updates?.length || 0

    return (
      <div className="flex flex-col space-y-4">
        {/* Back */}
        <button onClick={closeMember}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 transition-colors self-start">
          <ArrowLeft size={15} /> All members
        </button>

        {/* Hero — full bleed, taller, more immersive */}
        <div className={`-mx-4 bg-gradient-to-br ${color} relative overflow-hidden px-6 pt-8 pb-6`}>
          <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10" />
          <div className="absolute -left-6 -bottom-8 w-36 h-36 rounded-full bg-black/10" />
          <div className="absolute right-8 bottom-4 w-16 h-16 rounded-full bg-white/10" />

          <div className="relative flex items-end justify-between">
            <div className="flex items-center gap-5">
              {/* Big circular avatar */}
              <div className="w-20 h-20 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center text-white font-black text-4xl shadow-xl">
                {selectedMember[0].toUpperCase()}
              </div>
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
        <div className="space-y-3">
          {members.map(name => {
            const e = getEntry(name)
            const color = getAvatarColor(name)
            const streak = getStreak(name)

            const ringColor =
              e?.status === 'completed' ? 'ring-emerald-400' :
              e?.status === 'failed' ? 'ring-red-500' :
              e ? 'ring-amber-400' : 'ring-zinc-700'

            const statusEmoji =
              e?.status === 'completed' ? '✅' :
              e?.status === 'failed' ? '❌' :
              e ? '🔥' : '💤'

            return (
              <button
                key={name}
                onClick={() => openMember(name)}
                className="w-full text-left rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden transition-all active:scale-[0.99] hover:border-zinc-700 flex"
              >
                {/* Left: name */}
                <div className={`bg-gradient-to-b ${color} w-20 shrink-0 flex flex-col items-center justify-center gap-1 py-4 px-2`}>
                  <div className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center text-white font-black text-base">
                    {name[0].toUpperCase()}
                  </div>
                  <p className="text-white font-bold text-xs text-center leading-tight break-words w-full px-1">{name}</p>
                  {streak >= 2 && <p className="text-white/70 text-[10px] font-bold">🔥{streak}</p>}
                </div>

                {/* Right: goals */}
                <div className="flex-1 px-3 py-3 flex flex-col justify-center gap-1.5 min-w-0">
                  {e?.goalItems?.length > 0 ? (
                    e.goalItems.map((g, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className={`text-[10px] font-black w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                          g.type === 'habit' ? 'bg-violet-500/20 text-violet-400' :
                          g.type === 'count' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {g.type === 'habit' ? '✓' : g.type === 'count' ? '×' : '#'}
                        </span>
                        <span className="text-zinc-200 text-sm flex-1 truncate">{g.text}</span>
                        {g.target && <span className="text-zinc-600 text-xs shrink-0">{g.target} {g.unit}</span>}
                      </div>
                    ))
                  ) : e ? (
                    <p className="text-zinc-500 text-sm">{e.goals}</p>
                  ) : (
                    <p className="text-zinc-600 text-sm italic">Tap to add goals</p>
                  )}
                </div>

                {/* Status dot */}
                <div className="flex items-center pr-3">
                  <span className="text-base">{statusEmoji}</span>
                </div>
              </button>
            )
          })}

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
              className="w-full rounded-2xl border-2 border-dashed border-zinc-800 hover:border-zinc-600 py-5 flex items-center justify-center gap-3 text-zinc-600 hover:text-zinc-400 transition-all"
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
