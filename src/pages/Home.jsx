import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentWeekId, formatWeekLabel, formatTimestamp } from '../utils'
import { CheckCircle, XCircle, Send, AlertTriangle } from 'lucide-react'

const MEMBERS_DOC = doc(db, 'config', 'members')
const PENALTY = 15
const ALL = '__all__'

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
    entries.find(e => e.nameLower === name.toLowerCase() || e.name.toLowerCase() === name.toLowerCase())

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

  const markDone = (entry) => updateDoc(doc(db, 'entries', entry.id), { status: 'completed' })
  const markFailed = async (entry) => {
    await updateDoc(doc(db, 'entries', entry.id), { status: 'failed' })
    setConfirmFail(false)
  }

  const statusDot = (name) => {
    const e = getEntry(name)
    if (!e) return 'bg-zinc-600'
    if (e.status === 'completed') return 'bg-emerald-400'
    if (e.status === 'failed') return 'bg-red-400'
    return 'bg-yellow-400'
  }

  const statusLabel = (entry) => {
    if (!entry) return null
    if (entry.status === 'completed') return <span className="text-xs bg-emerald-900/50 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded-full">completed</span>
    if (entry.status === 'failed') return <span className="text-xs bg-red-900/50 text-red-400 border border-red-800/50 px-2 py-0.5 rounded-full">failed · owes ${PENALTY}</span>
    return <span className="text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-800/40 px-2 py-0.5 rounded-full">in progress</span>
  }

  if (loading) return <div className="text-zinc-500 text-sm mt-16 text-center">Loading...</div>
  if (error) return (
    <div className="mt-8 bg-red-950/40 border border-red-800/50 rounded-2xl p-4 space-y-2">
      <p className="text-red-400 font-semibold text-sm">Connection error</p>
      <p className="text-red-300/70 text-xs break-all">{error}</p>
    </div>
  )
  if (members.length === 0) return (
    <div className="text-center py-20 space-y-3">
      <p className="text-5xl">👥</p>
      <p className="font-semibold text-zinc-300">No members yet</p>
      <p className="text-sm text-zinc-500">Add your group in the Members tab</p>
    </div>
  )

  const entry = activeTab !== ALL ? getEntry(activeTab) : null

  return (
    <div className="flex flex-col">
      <p className="text-xs text-zinc-500 mb-3">{formatWeekLabel(weekId)}</p>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3">
        {/* All tab */}
        <button
          onClick={() => switchTab(ALL)}
          className={`px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors shrink-0 ${
            activeTab === ALL ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          All
        </button>

        {/* Member tabs */}
        {members.map(name => (
          <button
            key={name}
            onClick={() => switchTab(name)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors shrink-0 ${
              activeTab === name ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(name)}`} />
            {name}
          </button>
        ))}
      </div>

      {/* ALL VIEW — everyone's goals as cards */}
      {activeTab === ALL && (
        <div className="space-y-3 mt-1">
          {members.map(name => {
            const e = getEntry(name)
            return (
              <div
                key={name}
                className={`rounded-2xl border p-4 ${
                  e?.status === 'failed' ? 'border-red-800/50 bg-red-950/10' :
                  e?.status === 'completed' ? 'border-emerald-800/50 bg-emerald-950/10' :
                  'border-zinc-800 bg-zinc-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot(name)}`} />
                    <span className="font-bold text-white">{name}</span>
                  </div>
                  {statusLabel(e)}
                </div>
                {e ? (
                  <>
                    <p className="text-zinc-400 text-sm whitespace-pre-wrap">{e.goals}</p>
                    {e.updates?.length > 0 && (
                      <p className="text-xs text-zinc-600 mt-2">
                        {e.updates.length} proof update{e.updates.length !== 1 ? 's' : ''} · last: "{e.updates[e.updates.length - 1].text}"
                      </p>
                    )}
                    <button
                      onClick={() => switchTab(name)}
                      className="mt-3 text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
                    >
                      Go to {name}'s tab →
                    </button>
                  </>
                ) : (
                  <p className="text-zinc-600 text-sm italic">No goals submitted yet</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* MEMBER VIEW — personal tab */}
      {activeTab !== ALL && (
        <div className="space-y-3 mt-1">
          {!entry ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <div>
                <p className="font-bold text-white text-lg">{activeTab}</p>
                <p className="text-zinc-500 text-sm">No goals yet this week — lock them in</p>
              </div>
              <textarea
                placeholder={"- Run 3x this week\n- Read 20 pages/day\n- No takeout"}
                value={goalsInput}
                onChange={e => setGoalsInput(e.target.value)}
                rows={5}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 transition-colors resize-none text-sm"
              />
              <button
                onClick={() => submitGoals(activeTab)}
                disabled={submitting || !goalsInput.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 transition-colors"
              >
                {submitting ? 'Submitting...' : 'Lock in goals'}
              </button>
            </div>
          ) : (
            <>
              {/* Goals card */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-white text-lg">{entry.name}</p>
                  {statusLabel(entry)}
                </div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Goals</p>
                <p className="text-zinc-300 text-sm whitespace-pre-wrap">{entry.goals}</p>
              </div>

              {/* Proof updates */}
              {entry.updates?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider px-1">Progress</p>
                  {entry.updates.map((u, i) => (
                    <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                      <p className="text-sm text-zinc-200">{u.text}</p>
                      <p className="text-xs text-zinc-600 mt-1">{formatTimestamp(u.timestamp)}</p>
                    </div>
                  ))}
                </div>
              )}

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
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 transition-colors"
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
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-800/50 text-emerald-400 rounded-xl py-2.5 text-sm font-medium transition-colors"
                    >
                      <CheckCircle size={16} /> Week complete
                    </button>
                    <button
                      onClick={() => setConfirmFail(true)}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-900/30 hover:bg-red-900/50 border border-red-800/40 text-red-400 rounded-xl py-2.5 text-sm font-medium transition-colors"
                    >
                      <XCircle size={16} /> I failed
                    </button>
                  </div>
                  {confirmFail && (
                    <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-3 space-y-2">
                      <p className="text-red-400 text-sm font-medium flex items-center gap-2">
                        <AlertTriangle size={15} /> This adds ${PENALTY} to the pot. Sure?
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => markFailed(entry)} className="flex-1 bg-red-700 hover:bg-red-600 text-white rounded-lg py-1.5 text-sm font-medium transition-colors">
                          Yeah, I failed
                        </button>
                        <button onClick={() => setConfirmFail(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg py-1.5 text-sm transition-colors">
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
