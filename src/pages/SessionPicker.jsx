import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, setDoc, updateDoc, arrayUnion, Timestamp, getCountFromServer, collection, addDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import { Plus, Users, ChevronRight, Home, MessageSquare, Send, Check } from 'lucide-react'

const SESSION_EMOJIS = ['💼','👨‍👩‍👧‍👦','🏋️','📚','🎯','🚀','🌱','🎮','🏠','✈️']
const SAVED_KEY = 'accountabili_sessions'

const TAGLINES = [
  'No cheating yourself.',
  'Your people are watching.',
  'Accountability is a superpower.',
  'Show up. Every day.',
  'Hard goals. Real stakes.',
]

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

// Days left in the current Mon–Sun week
function daysLeftInWeek() {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  const toSunday = day === 0 ? 0 : 7 - day
  return toSunday
}

function FeedbackSection({ user }) {
  const [text, setText] = useState('')
  const [name, setName] = useState(user?.displayName || '')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const submit = async () => {
    if (!text.trim()) return
    setSending(true)
    await addDoc(collection(db, 'feedback'), {
      text: text.trim(),
      name: name.trim() || 'Anonymous',
      createdAt: Timestamp.now(),
      uid: user?.uid || null,
    })
    setSent(true)
    setSending(false)
  }

  return (
    <div className="border border-zinc-800 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare size={14} className="text-zinc-500" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Beta Feedback</p>
      </div>

      {sent ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <Check size={16} className="text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-white">Thanks for the feedback!</p>
          <button onClick={() => { setSent(false); setText('') }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            Send more
          </button>
        </div>
      ) : (
        <>
          {!user?.displayName && (
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Your name (optional)" maxLength={40} style={{ fontSize: 16 }}
              className="w-full bg-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-all" />
          )}
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="What's working? What's broken? What's missing?" rows={3}
            maxLength={500} style={{ fontSize: 16 }}
            className="w-full bg-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-all resize-none" />
          <button onClick={submit} disabled={sending || !text.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white text-sm font-bold transition-all">
            <Send size={13} />
            {sending ? 'Sending…' : 'Send feedback'}
          </button>
        </>
      )}
    </div>
  )
}

export default function SessionPicker() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [saved, setSaved] = useState(getSaved)
  const [mode, setMode] = useState(null)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🎯')
  const [penalty, setPenalty] = useState(15)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [taglineIdx, setTaglineIdx] = useState(0)
  const [taglineFade, setTaglineFade] = useState(true)
  const [sessionCount, setSessionCount] = useState(null)
  const daysLeft = daysLeftInWeek()

  // Rotate taglines
  useEffect(() => {
    const t = setInterval(() => {
      setTaglineFade(false)
      setTimeout(() => {
        setTaglineIdx(i => (i + 1) % TAGLINES.length)
        setTaglineFade(true)
      }, 300)
    }, 3500)
    return () => clearInterval(t)
  }, [])

  // Live session count
  useEffect(() => {
    getCountFromServer(collection(db, 'sessions'))
      .then(snap => setSessionCount(snap.data().count))
      .catch(() => {})
  }, [])

  const createSession = async () => {
    if (!name.trim()) return
    setLoading(true)
    const id = genId()
    const username = user?.displayName || ''
    const session = { name: name.trim(), emoji, penalty: Number(penalty) || 15, createdAt: Timestamp.now(), names: username ? [username] : [], avatars: {} }
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
    if (user?.displayName) {
      await updateDoc(doc(db, 'sessions', id), { names: arrayUnion(user.displayName) })
    }
    addSaved({ id, name: data.name, emoji: data.emoji || '🎯' })
    navigate(`/${id}`)
  }

  const openSession = async (s) => {
    addSaved(s)
    if (user?.displayName) {
      try { await updateDoc(doc(db, 'sessions', s.id), { names: arrayUnion(user.displayName) }) } catch {}
    }
    navigate(`/${s.id}`)
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">

      {/* Hero */}
      <div className="relative overflow-hidden px-6 pt-16 pb-12 flex flex-col items-center text-center"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(52,211,153,0.12) 0%, transparent 70%)' }}>
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="relative z-10 space-y-3 max-w-xs">
          <h1 className="text-4xl font-black tracking-tight text-white leading-none">
            accountabili<span style={{ background: 'linear-gradient(to right, #34d399, #2dd4bf)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>buddy</span>
          </h1>

          <p className="text-sm font-semibold text-zinc-400 h-5 transition-opacity duration-300"
            style={{ opacity: taglineFade ? 1 : 0 }}>
            {TAGLINES[taglineIdx]}
          </p>

          {/* Week urgency pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {daysLeft === 0 ? 'Week resets tonight' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left this week`}
            {sessionCount && <span className="text-zinc-600">·</span>}
            {sessionCount && <span className="text-zinc-500">{sessionCount} sessions</span>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-28 space-y-5 max-w-sm mx-auto w-full">

        {/* Saved sessions */}
        {saved.length > 0 && !mode && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 px-1">Your sessions</p>
            <div className="space-y-2">
              {saved.map((s, i) => (
                <button key={s.id} onClick={() => openSession(s)}
                  className="w-full flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl px-4 py-3.5 transition-all group active:scale-[0.98]">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                    {s.emoji || '🎯'}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-bold text-white text-sm truncate">{s.name}</p>
                    <p className="text-[10px] text-zinc-600 font-mono mt-0.5 tracking-wider">{s.id}</p>
                  </div>
                  <ChevronRight size={14} className="text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {!mode && (
          <div className="space-y-2">
            {saved.length > 0 && <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 px-1">Start new</p>}
            <button onClick={() => setMode('create')}
              className="w-full flex items-center justify-center gap-2 font-bold rounded-2xl py-3.5 transition-all active:scale-[0.98] text-black"
              style={{ background: 'linear-gradient(135deg, #34d399, #2dd4bf)' }}>
              <Plus size={16} /> New session
            </button>
            <button onClick={() => setMode('join')}
              className="w-full flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-300 font-bold rounded-2xl py-3.5 transition-all active:scale-[0.98]">
              <Users size={16} /> Join with a code
            </button>
          </div>
        )}

        {/* Create form */}
        {mode === 'create' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <p className="font-black text-white">New session</p>

            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pick an emoji</p>
              <div className="grid grid-cols-5 gap-2">
                {SESSION_EMOJIS.map(e => (
                  <button key={e} type="button" onClick={() => setEmoji(e)}
                    className={`text-2xl py-2 rounded-xl transition-all ${emoji === e ? 'bg-emerald-900/40 ring-1 ring-emerald-500 scale-110' : 'bg-zinc-800 hover:scale-105'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <input type="text" placeholder="Session name (e.g. Work Crew)"
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createSession()}
              style={{ fontSize: 16 }}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-all"
              autoFocus />

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Penalty per miss ($)</p>
              <input type="number" min={1} max={1000} value={penalty}
                onChange={e => setPenalty(Math.max(1, Number(e.target.value) || 1))}
                style={{ fontSize: 16 }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 transition-all" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setMode(null); setName('') }}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <p className="font-black text-white">Join a session</p>

            <input type="text" placeholder="6-LETTER CODE"
              value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
              onKeyDown={e => e.key === 'Enter' && joinSession()}
              maxLength={6} style={{ fontSize: 16 }}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-all tracking-widest uppercase"
              autoFocus />
            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-2">
              <button onClick={() => { setMode(null); setCode(''); setError('') }}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                Cancel
              </button>
              <button onClick={joinSession} disabled={loading || code.length < 4}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm transition-all">
                {loading ? 'Joining…' : 'Join'}
              </button>
            </div>
          </div>
        )}
        {/* Feedback */}
        <FeedbackSection user={user} />

      </div>

      {/* Pill nav */}
      <div className="fixed left-1/2 -translate-x-1/2 z-40 flex justify-center"
        style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <nav className="flex items-center gap-0.5 bg-zinc-900/95 backdrop-blur-2xl rounded-full px-2 py-2 shadow-2xl shadow-black/60 border border-white/[0.06]">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-zinc-700 text-white">
            <Home size={15} strokeWidth={2.5} />
            <span className="text-[10px] font-semibold">Sessions</span>
          </div>
          <button onClick={() => setMode('join')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-zinc-400 hover:text-zinc-200 transition-all duration-200">
            <Users size={15} strokeWidth={2} />
            <span className="text-[10px] font-semibold">Join</span>
          </button>
          <button onClick={() => setMode('create')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-zinc-400 hover:text-zinc-200 transition-all duration-200">
            <Plus size={15} strokeWidth={2} />
            <span className="text-[10px] font-semibold">New</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
