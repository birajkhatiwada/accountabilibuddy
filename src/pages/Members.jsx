import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, onSnapshot, updateDoc, arrayRemove, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import { ChevronRight, Check, Pencil } from 'lucide-react'

export default function Members() {
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const { user } = useAuth()
  const [members, setMembers] = useState([])
  const [nicknames, setNicknames] = useState({})
  const [penalty, setPenalty] = useState(15)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [penaltyInput, setPenaltyInput] = useState('15')
  const [savingPenalty, setSavingPenalty] = useState(false)
  const [penaltySaved, setPenaltySaved] = useState(false)
  const [editingNick, setEditingNick] = useState(false)
  const [nickInput, setNickInput] = useState('')
  const [savingNick, setSavingNick] = useState(false)

  const sessionDoc = doc(db, 'sessions', sessionId)

  useEffect(() => {
    if (!sessionId) return
    return onSnapshot(sessionDoc, (snap) => {
      if (snap.exists()) {
        setMembers(snap.data().names || [])
        setNicknames(snap.data().nicknames || {})
        const p = snap.data().penalty ?? 15
        setPenalty(p)
        setPenaltyInput(String(p))
      }
    })
  }, [sessionId])

  const savePenalty = async () => {
    const val = Math.max(1, Number(penaltyInput) || 1)
    if (val === penalty) return
    setSavingPenalty(true)
    await setDoc(sessionDoc, { penalty: val }, { merge: true })
    setSavingPenalty(false)
    setPenaltySaved(true)
    setTimeout(() => setPenaltySaved(false), 2000)
  }

  const removeMember = async (name) => {
    await updateDoc(sessionDoc, { names: arrayRemove(name) })
  }

  const openNickEdit = () => {
    const myName = user?.displayName
    setNickInput(nicknames[myName] || myName || '')
    setEditingNick(true)
  }

  const saveNick = async () => {
    const myName = user?.displayName
    if (!myName) return
    setSavingNick(true)
    const trimmed = nickInput.trim()
    const updated = { ...nicknames }
    if (!trimmed || trimmed === myName) {
      delete updated[myName]
    } else {
      updated[myName] = trimmed
    }
    await setDoc(sessionDoc, { nicknames: updated }, { merge: true })
    setSavingNick(false)
    setEditingNick(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Members</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Everyone in this session</p>
      </div>

      {members.length === 0 && (
        <div className="text-center py-12 text-zinc-500 dark:text-zinc-600">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-medium text-zinc-500 dark:text-zinc-400">No members yet</p>
          <p className="text-sm mt-1">Members join automatically when they enter the session</p>
        </div>
      )}

      <div className="space-y-2">
        {members.map(name => {
          const isMe = user?.displayName?.toLowerCase() === name.toLowerCase()
          const displayName = nicknames[name] || name
          return (
            <div key={name} className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {displayName[0].toUpperCase()}
              </div>
              <button
                onClick={() => navigate(`/${sessionId}/member/${encodeURIComponent(name)}`)}
                className="flex-1 text-left font-medium text-zinc-800 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white transition-colors min-w-0"
              >
                <span className="truncate block">{displayName}</span>
                {nicknames[name] && <span className="text-[10px] text-zinc-400 font-normal">@{name}</span>}
                {isMe && <span className="ml-2 text-[10px] font-semibold text-emerald-500">you</span>}
              </button>
              {isMe && (
                <button onClick={openNickEdit}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-1 shrink-0"
                  title="Edit nickname">
                  <Pencil size={13} />
                </button>
              )}
              <button
                onClick={() => navigate(`/${sessionId}/member/${encodeURIComponent(name)}`)}
                className="text-zinc-500 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors p-1 shrink-0"
              >
                <ChevronRight size={15} />
              </button>
              {isMe && (
                <button onClick={() => setConfirmLeave(true)}
                  className="text-xs text-zinc-400 hover:text-red-400 transition-colors font-medium shrink-0">
                  Leave
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5">
        <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-3">Session settings</h3>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Penalty per miss</p>
            <p className="text-xs text-zinc-500 mt-0.5">Added to the pot when someone fails a week</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-sm font-bold text-zinc-500">$</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={penaltyInput}
              onChange={e => setPenaltyInput(e.target.value)}
              onBlur={savePenalty}
              onKeyDown={e => e.key === 'Enter' && savePenalty()}
              style={{ fontSize: 16 }}
              className="w-16 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm font-bold text-zinc-800 dark:text-zinc-200 text-center focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {penaltySaved && <Check size={14} className="text-emerald-500" />}
          </div>
        </div>
      </div>

      {/* Nickname edit modal */}
      {editingNick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={() => setEditingNick(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-xs shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="space-y-1">
              <p className="font-bold text-zinc-900 dark:text-white">Nickname in this session</p>
              <p className="text-xs text-zinc-400">Only changes how you appear here. Leave blank to use your username.</p>
            </div>
            <input
              type="text"
              value={nickInput}
              onChange={e => setNickInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveNick()}
              placeholder={user?.displayName || 'Nickname'}
              maxLength={32}
              autoFocus
              style={{ fontSize: 16 }}
              className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl px-4 py-3 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
            <div className="flex gap-2">
              <button onClick={() => setEditingNick(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                Cancel
              </button>
              <button onClick={saveNick} disabled={savingNick}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-bold transition-colors">
                {savingNick ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave session modal */}
      {confirmLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={() => setConfirmLeave(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-xs shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-1">
              <p className="text-2xl">👋</p>
              <p className="font-bold text-zinc-900 dark:text-white">Leave this session?</p>
              <p className="text-sm text-zinc-500">You can always rejoin with the session code.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmLeave(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                Cancel
              </button>
              <button onClick={() => { removeMember(members.find(m => m.toLowerCase() === user?.displayName?.toLowerCase())); setConfirmLeave(false) }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-bold transition-colors">
                Yes, leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
