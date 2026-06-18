import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentWeekId, formatWeekLabel, formatTimestamp } from '../utils'
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Send, AlertTriangle } from 'lucide-react'

export default function Home() {
  const weekId = getCurrentWeekId()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [proofInputs, setProofInputs] = useState({})
  const [submitting, setSubmitting] = useState({})
  const [confirmFail, setConfirmFail] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'entries'), where('weekId', '==', weekId))
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      data.sort((a, b) => a.name.localeCompare(b.name))
      setEntries(data)
      setLoading(false)
    })
    return unsub
  }, [weekId])

  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const submitProof = async (entry) => {
    const text = proofInputs[entry.id]?.trim()
    if (!text) return
    setSubmitting(p => ({ ...p, [entry.id]: true }))
    await updateDoc(doc(db, 'entries', entry.id), {
      updates: arrayUnion({ text, timestamp: Timestamp.now() }),
    })
    setProofInputs(p => ({ ...p, [entry.id]: '' }))
    setSubmitting(p => ({ ...p, [entry.id]: false }))
  }

  const markFailed = async (entry) => {
    await updateDoc(doc(db, 'entries', entry.id), { status: 'failed' })
    setConfirmFail(null)
  }

  const markCompleted = async (entry) => {
    await updateDoc(doc(db, 'entries', entry.id), { status: 'completed' })
  }

  if (loading) {
    return <div className="text-zinc-500 text-sm mt-8 text-center">Loading...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Week of</p>
          <p className="text-sm font-semibold text-zinc-300">{formatWeekLabel(weekId)}</p>
        </div>
        <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-full">
          {entries.length} {entries.length === 1 ? 'member' : 'members'}
        </span>
      </div>

      {entries.length === 0 && (
        <div className="text-center py-16 text-zinc-600">
          <p className="text-4xl mb-3">🎯</p>
          <p className="font-medium text-zinc-400">No goals yet this week</p>
          <p className="text-sm mt-1">Be the first to submit yours</p>
        </div>
      )}

      {entries.map(entry => (
        <div
          key={entry.id}
          className={`rounded-2xl border transition-colors ${
            entry.status === 'failed'
              ? 'border-red-800/60 bg-red-950/20'
              : entry.status === 'completed'
              ? 'border-emerald-800/60 bg-emerald-950/20'
              : 'border-zinc-800 bg-zinc-900'
          }`}
        >
          {/* Header */}
          <button
            onClick={() => toggle(entry.id)}
            className="w-full flex items-center gap-3 p-4 text-left"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{entry.name}</span>
                {entry.status === 'completed' && (
                  <span className="text-xs bg-emerald-900/50 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded-full">done</span>
                )}
                {entry.status === 'failed' && (
                  <span className="text-xs bg-red-900/50 text-red-400 border border-red-800/50 px-2 py-0.5 rounded-full">failed · owes $15</span>
                )}
              </div>
              <p className="text-zinc-400 text-sm mt-0.5 line-clamp-1">{entry.goals}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(entry.updates?.length > 0) && (
                <span className="text-xs text-zinc-500">{entry.updates.length} update{entry.updates.length !== 1 ? 's' : ''}</span>
              )}
              {expanded[entry.id] ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
            </div>
          </button>

          {/* Expanded */}
          {expanded[entry.id] && (
            <div className="px-4 pb-4 space-y-4 border-t border-zinc-800/60 pt-3">
              {/* Goals */}
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Goals</p>
                <p className="text-zinc-300 text-sm whitespace-pre-wrap">{entry.goals}</p>
              </div>

              {/* Updates */}
              {entry.updates?.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Progress</p>
                  <div className="space-y-2">
                    {entry.updates.map((u, i) => (
                      <div key={i} className="bg-zinc-800/50 rounded-xl p-3">
                        <p className="text-sm text-zinc-200">{u.text}</p>
                        <p className="text-xs text-zinc-600 mt-1">{formatTimestamp(u.timestamp)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add proof */}
              {entry.status === 'active' && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Add proof</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="read 20 pages, hit the gym, etc."
                      value={proofInputs[entry.id] || ''}
                      onChange={e => setProofInputs(p => ({ ...p, [entry.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && submitProof(entry)}
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-600"
                    />
                    <button
                      onClick={() => submitProof(entry)}
                      disabled={submitting[entry.id] || !proofInputs[entry.id]?.trim()}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl px-3 py-2 transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Status actions */}
              {entry.status === 'active' && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => markCompleted(entry)}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-800/50 text-emerald-400 rounded-xl py-2 text-sm font-medium transition-colors"
                  >
                    <CheckCircle size={16} />
                    Week complete
                  </button>
                  <button
                    onClick={() => setConfirmFail(entry.id)}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-900/30 hover:bg-red-900/50 border border-red-800/40 text-red-400 rounded-xl py-2 text-sm font-medium transition-colors"
                  >
                    <XCircle size={16} />
                    I failed
                  </button>
                </div>
              )}

              {/* Fail confirmation */}
              {confirmFail === entry.id && (
                <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                    <AlertTriangle size={16} />
                    Are you sure? This adds $15 to the pot.
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => markFailed(entry)}
                      className="flex-1 bg-red-700 hover:bg-red-600 text-white rounded-lg py-1.5 text-sm font-medium transition-colors"
                    >
                      Yeah, I failed
                    </button>
                    <button
                      onClick={() => setConfirmFail(null)}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg py-1.5 text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
