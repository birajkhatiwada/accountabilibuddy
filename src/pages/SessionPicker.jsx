import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { Plus, ArrowRight, Users } from 'lucide-react'

const SESSION_EMOJIS = ['💼','👨‍👩‍👧‍👦','🏋️','📚','🎯','🚀','🌱','🎮','🏠','✈️']
const SAVED_KEY = 'accountabili_sessions'

function getSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') } catch { return [] }
}
function addSaved(session) {
  const saved = getSaved().filter(s => s.id !== session.id)
  localStorage.setItem(SAVED_KEY, JSON.stringify([session, ...saved].slice(0, 10)))
}

function genId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export default function SessionPicker() {
  const navigate = useNavigate()
  const [saved, setSaved] = useState(getSaved)
  const [mode, setMode] = useState(null) // 'create' | 'join'
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🎯')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const createSession = async () => {
    if (!name.trim()) return
    setLoading(true)
    const id = genId()
    const session = { name: name.trim(), emoji, createdAt: Timestamp.now(), names: [], avatars: {} }
    await setDoc(doc(db, 'sessions', id), session)
    const s = { id, name: name.trim(), emoji }
    addSaved(s)
    navigate(`/${id}`)
  }

  const joinSession = async () => {
    const id = code.trim().toUpperCase()
    if (!id) return
    setLoading(true); setError('')
    const snap = await getDoc(doc(db, 'sessions', id))
    if (!snap.exists()) { setError('Session not found. Check the code and try again.'); setLoading(false); return }
    const data = snap.data()
    addSaved({ id, name: data.name, emoji: data.emoji || '🎯' })
    navigate(`/${id}`)
  }

  const openSession = (s) => {
    addSaved(s)
    navigate(`/${s.id}`)
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-start pt-16 px-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
            accountabili<span style={{ background: 'linear-gradient(to right, #34d399, #2dd4bf)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>buddy</span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-600">honor system · no cheating yourself</p>
        </div>

        {/* Saved sessions */}
        {saved.length > 0 && !mode && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-600 px-1">Your sessions</p>
            {saved.map(s => (
              <button key={s.id} onClick={() => openSession(s)}
                className="w-full flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group">
                <span className="text-2xl">{s.emoji || '🎯'}</span>
                <div className="flex-1 text-left">
                  <p className="font-bold text-zinc-900 dark:text-white text-sm">{s.name}</p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono mt-0.5">{s.id}</p>
                </div>
                <ArrowRight size={15} className="text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 transition-colors" />
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        {!mode && (
          <div className="space-y-2">
            <button onClick={() => setMode('create')}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl py-3.5 transition-all">
              <Plus size={16} /> New session
            </button>
            <button onClick={() => setMode('join')}
              className="w-full flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded-2xl py-3.5 transition-all">
              <Users size={16} /> Join with a code
            </button>
          </div>
        )}

        {/* Create form */}
        {mode === 'create' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
            <p className="font-bold text-zinc-900 dark:text-white">Create a session</p>

            <div className="space-y-2">
              <p className="text-xs text-zinc-500 font-semibold">Pick an emoji</p>
              <div className="grid grid-cols-5 gap-2">
                {SESSION_EMOJIS.map(e => (
                  <button key={e} type="button" onClick={() => setEmoji(e)}
                    className={`text-2xl py-2 rounded-xl transition-all ${emoji === e ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-2 ring-emerald-500 scale-110' : 'bg-zinc-100 dark:bg-zinc-800 hover:scale-105'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <input type="text" placeholder="Session name (e.g. Work Crew)"
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createSession()}
              className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              autoFocus
            />

            <div className="flex gap-2">
              <button onClick={() => { setMode(null); setName('') }}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                Cancel
              </button>
              <button onClick={createSession} disabled={loading || !name.trim()}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm transition-all">
                {loading ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {/* Join form */}
        {mode === 'join' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
            <p className="font-bold text-zinc-900 dark:text-white">Join a session</p>

            <input type="text" placeholder="Enter 6-letter code (e.g. K8F2MX)"
              value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
              onKeyDown={e => e.key === 'Enter' && joinSession()}
              maxLength={6}
              className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl px-4 py-3 text-sm font-mono text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all tracking-widest uppercase"
              autoFocus
            />
            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-2">
              <button onClick={() => { setMode(null); setCode(''); setError('') }}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                Cancel
              </button>
              <button onClick={joinSession} disabled={loading || code.length < 4}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm transition-all">
                {loading ? 'Joining…' : 'Join'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
