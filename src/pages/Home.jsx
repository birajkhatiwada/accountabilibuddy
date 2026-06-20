import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentWeekId, formatWeekLabel, formatTimestamp } from '../utils'
import { CheckCircle, XCircle, Send, AlertTriangle, ArrowLeft, Plus, Check } from 'lucide-react'
import WeekCalendar from '../components/WeekCalendar'

const MEMBERS_DOC = doc(db, 'config', 'members')
const PENALTY = 15
const ALL = '__all__'

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

const StatusPill = ({ entry }) => {
  if (!entry) return <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">no goals</span>
  if (entry.status === 'completed') return <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">✓ done</span>
  if (entry.status === 'failed') return <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">✗ failed</span>
  return <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">● active</span>
}

export default function Home() {
  const weekId = getCurrentWeekId()
  const [members, setMembers] = useState([])
  const [entries, setEntries] = useState([])
  const [activeTab, setActiveTab] = useState(ALL)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [goalsInput, setGoalsInput] = useState('')
  const [proofInput, setProofInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmFail, setConfirmFail] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(MEMBERS_DOC, (snap) => {
      setMembers(snap.exists() ? (snap.data().names || []) : [])
      setLoading(false)
    }, (err) => { setError(err.message); setLoading(false) })
    return unsub
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'entries'), where('weekId', '==', weekId))
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, (err) => setError(err.message))
    return unsub
  }, [weekId])

  const getEntry = (name) =>
    entries.find(e => (e.nameLower || e.name.toLowerCase()) === name.toLowerCase())

  const switchTab = (tab) => {
    setActiveTab(tab)
    setConfirmFail(false)
    setProofInput('')
    setGoalsInput('')
  }

  const submitGoals = async (name) => {
    if (!goalsInput.trim()) return
    setSubmitting(true)
    await addDoc(collection(db, 'entries'), {
      weekId, name, nameLower: name.toLowerCase(),
      goals: goalsInput.trim(), status: 'active', updates: [],
      createdAt: Timestamp.now(),
    })
    setGoalsInput('')
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
    try {
      await updateDoc(MEMBERS_DOC, { names: arrayUnion(name) })
    } catch {
      const { setDoc } = await import('firebase/firestore')
      await setDoc(MEMBERS_DOC, { names: [...members, name] })
    }
    setNewMemberName('')
    setAddingMember(false)
    switchTab(name)
  }

  const markDone = (entry) => updateDoc(doc(db, 'entries', entry.id), { status: 'completed' })
  const markFailed = async (entry) => {
    await updateDoc(doc(db, 'entries', entry.id), { status: 'failed' })
    setConfirmFail(false)
  }

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

  if (members.length === 0) return (
    <div className="text-center py-20 space-y-3">
      <div className="text-5xl">👥</div>
      <p className="font-semibold text-zinc-300">No members yet</p>
      <p className="text-sm text-zinc-500">Add your group in the Members tab</p>
    </div>
  )

  const entry = activeTab !== ALL ? getEntry(activeTab) : null

  return (
    <div className="flex flex-col">
      {/* Week label */}
      <p className="text-xs text-zinc-500 mb-3 font-medium">{formatWeekLabel(weekId)}</p>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 items-center">
        <button
          onClick={() => switchTab(ALL)}
          className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all shrink-0 ${
            activeTab === ALL
              ? 'bg-white text-zinc-900 shadow-lg shadow-white/10'
              : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700/80 hover:text-zinc-200'
          }`}
        >
          All
        </button>

        {members.map(name => {
          const e = getEntry(name)
          const isActive = activeTab === name
          return (
            <button
              key={name}
              onClick={() => switchTab(name)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? 'bg-white text-zinc-900 shadow-lg shadow-white/10'
                  : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700/80 hover:text-zinc-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                !e ? 'bg-zinc-600' :
                e.status === 'completed' ? 'bg-emerald-400' :
                e.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'
              }`} />
              {name}
            </button>
          )
        })}

        {/* Inline add member */}
        {addingMember ? (
          <div className="flex items-center gap-1 shrink-0">
            <input
              autoFocus
              type="text"
              placeholder="Name..."
              value={newMemberName}
              onChange={e => setNewMemberName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addMember(); if (e.key === 'Escape') { setAddingMember(false); setNewMemberName('') } }}
              className="w-28 bg-zinc-800 border border-zinc-600 rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button onClick={addMember} className="p-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white transition-colors">
              <Check size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingMember(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/80 transition-all shrink-0 border border-dashed border-zinc-700"
          >
            <Plus size={14} /> Add
          </button>
        )}
      </div>

      {/* ALL VIEW — 2-col grid */}
      {activeTab === ALL && (
        <div className="grid grid-cols-2 gap-3 mt-1">
          {members.map(name => {
            const e = getEntry(name)
            const color = getAvatarColor(name)
            const cardBorder =
              e?.status === 'failed' ? 'border-red-800/40 bg-gradient-to-b from-red-950/20 to-zinc-900' :
              e?.status === 'completed' ? 'border-emerald-800/40 bg-gradient-to-b from-emerald-950/20 to-zinc-900' :
              'border-zinc-800 bg-zinc-900'

            return (
              <button
                key={name}
                onClick={() => switchTab(name)}
                className={`rounded-2xl border p-3.5 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${cardBorder}`}
              >
                {/* Avatar + status */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white font-black text-sm`}>
                    {name[0].toUpperCase()}
                  </div>
                  <StatusPill entry={e} />
                </div>

                {/* Name */}
                <p className="font-bold text-white text-sm mb-1">{name}</p>

                {/* Goals preview */}
                {e ? (
                  <>
                    <p className="text-zinc-500 text-xs line-clamp-2 leading-relaxed">{e.goals}</p>
                    {e.updates?.length > 0 && (
                      <p className="text-zinc-600 text-[10px] mt-1.5">
                        {e.updates.length} update{e.updates.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-zinc-700 text-xs italic">Tap to add goals</p>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* MEMBER VIEW */}
      {activeTab !== ALL && (
        <div className="space-y-3 mt-1">
          {/* Back hint */}
          <button
            onClick={() => switchTab(ALL)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-1"
          >
            <ArrowLeft size={12} /> All members
          </button>

          {!entry ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              {/* Avatar header */}
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getAvatarColor(activeTab)} flex items-center justify-center text-white font-black text-lg`}>
                  {activeTab[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-white text-lg">{activeTab}</p>
                  <p className="text-zinc-500 text-xs">No goals yet — lock them in</p>
                </div>
              </div>
              <textarea
                placeholder={"- Run 3x this week\n- Read 20 pages/day\n- No takeout"}
                value={goalsInput}
                onChange={e => setGoalsInput(e.target.value)}
                rows={5}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none text-sm"
              />
              <button
                onClick={() => submitGoals(activeTab)}
                disabled={submitting || !goalsInput.trim()}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-bold rounded-xl py-3 transition-all shadow-lg shadow-emerald-900/30"
              >
                {submitting ? 'Locking in...' : 'Lock in goals 🔒'}
              </button>
            </div>
          ) : (
            <>
              {/* Goals card */}
              <div className={`rounded-2xl border p-4 space-y-3 ${
                entry.status === 'completed' ? 'border-emerald-800/40 bg-gradient-to-b from-emerald-950/20 to-zinc-900' :
                entry.status === 'failed' ? 'border-red-800/40 bg-gradient-to-b from-red-950/20 to-zinc-900' :
                'border-zinc-800 bg-zinc-900'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getAvatarColor(entry.name)} flex items-center justify-center text-white font-black text-lg shrink-0`}>
                    {entry.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-white text-lg leading-tight">{entry.name}</p>
                    <StatusPill entry={entry} />
                  </div>
                </div>
                <div className="bg-zinc-800/50 rounded-xl p-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Goals this week</p>
                  <p className="text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed">{entry.goals}</p>
                </div>
              </div>

              {/* Proof updates */}
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
              <WeekCalendar entryId={entry.id} goals={entry.goals} />

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
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl px-4 transition-colors shadow-lg shadow-emerald-900/20"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => markDone(entry)}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-800/50 text-emerald-400 rounded-xl py-2.5 text-sm font-bold transition-colors"
                    >
                      <CheckCircle size={15} /> Week complete
                    </button>
                    <button
                      onClick={() => setConfirmFail(true)}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-900/20 hover:bg-red-900/40 border border-red-800/40 text-red-400 rounded-xl py-2.5 text-sm font-bold transition-colors"
                    >
                      <XCircle size={15} /> I failed
                    </button>
                  </div>
                  {confirmFail && (
                    <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-3 space-y-3">
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
      )}
    </div>
  )
}
