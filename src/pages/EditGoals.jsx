import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import { getCurrentWeekId } from '../utils'
import { ArrowLeft } from 'lucide-react'
import GoalBuilder from '../components/GoalBuilder'

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600', 'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',     'from-indigo-500 to-blue-600',
  'from-teal-500 to-emerald-600',  'from-fuchsia-500 to-pink-600',
]
const BANNER_COLORS = [
  'from-violet-500 to-purple-600', 'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-600',  'from-orange-500 to-amber-500',
  'from-pink-500 to-rose-500',     'from-indigo-500 to-violet-600',
  'from-red-500 to-orange-500',    'from-teal-400 to-cyan-600',
  'from-fuchsia-500 to-pink-500',  'from-slate-600 to-zinc-700',
]

const goalsSummary = (items) => items.map(g =>
  g.type === 'habit' ? `${g.text} (every day)` : g.target ? `${g.text} (${g.target} ${g.unit})` : g.text
).join(', ')

export default function EditGoals() {
  const { sessionId, name } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const weekId = getCurrentWeekId()

  const [members, setMembers] = useState([])
  const [bannerColorIdx, setBannerColorIdx] = useState(null)
  const [memberGoals, setMemberGoals] = useState(null)
  const [entry, setEntry] = useState(null)
  const [goalsInput, setGoalsInput] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [builderKey, setBuilderKey] = useState(0)

  const sessionDoc = doc(db, 'sessions', sessionId)

  useEffect(() => {
    return onSnapshot(sessionDoc, snap => {
      if (!snap.exists()) return
      const d = snap.data()
      setMembers(d.names || [])
      setBannerColorIdx(d.bannerColors?.[name] ?? null)
      const mg = d.memberGoals?.[name]
      setMemberGoals(mg?.length ? mg : null)
    })
  }, [sessionId, name])

  useEffect(() => {
    if (!sessionId) return
    const q = query(collection(db, 'entries'), where('sessionId', '==', sessionId))
    return onSnapshot(q, snap => {
      const mine = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .find(e => e.weekId === weekId && (e.nameLower || e.name?.toLowerCase()) === name.toLowerCase())
      setEntry(mine || null)
    })
  }, [sessionId, weekId, name])

  // Once we know goals, seed the builder
  useEffect(() => {
    const initial = memberGoals || entry?.goalItems || []
    if (initial.length) {
      setGoalsInput(initial)
      setBuilderKey(k => k + 1)
    }
  }, [memberGoals, entry?.id])

  const colorIdx = members.indexOf(name) % AVATAR_COLORS.length
  const color = bannerColorIdx !== null
    ? BANNER_COLORS[bannerColorIdx]
    : (AVATAR_COLORS[colorIdx < 0 ? 0 : colorIdx] || AVATAR_COLORS[0])

  const save = async () => {
    const valid = goalsInput.filter(g => g.text.trim())
    if (!valid.length) return
    setSubmitting(true)
    await setDoc(sessionDoc, { memberGoals: { [name]: valid } }, { merge: true })
    if (entry) {
      await updateDoc(doc(db, 'entries', entry.id), { goals: goalsSummary(valid), goalItems: valid })
    } else {
      await addDoc(collection(db, 'entries'), {
        name, nameLower: name.toLowerCase(), weekId, sessionId,
        goals: goalsSummary(valid), goalItems: valid, status: 'active',
        updates: [], createdAt: Timestamp.now(),
      })
    }
    setSubmitting(false)
    navigate(-1)
  }

  const myGoals = memberGoals || entry?.goalItems || []
  const canSave = goalsInput.some(g => g.text.trim())

  return (
    <div className="-mx-4 -mt-3 min-h-full flex flex-col">
      {/* Banner */}
      <div className={`bg-gradient-to-br ${color} relative overflow-hidden px-5 pt-10 pb-8 shrink-0`}>
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -left-8 bottom-0 w-40 h-40 rounded-full bg-black/10 pointer-events-none" />

        <div className="relative flex items-center justify-between mb-5">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm font-semibold">
            <ArrowLeft size={16} /> Back
          </button>
          <button onClick={save} disabled={submitting || !canSave}
            className="bg-white/20 hover:bg-white/30 disabled:opacity-40 active:scale-95 text-white font-bold text-sm px-5 py-1.5 rounded-full transition-all">
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="relative">
          <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-1">This week</p>
          <h1 className="text-2xl font-black text-white leading-tight">
            What are you<br />committing to?
          </h1>
          {myGoals.length > 0 && (
            <p className="text-white/50 text-xs mt-2">{myGoals.length} goal{myGoals.length !== 1 ? 's' : ''} set</p>
          )}
        </div>
      </div>

      {/* GoalBuilder — full remaining space */}
      <div className="flex-1 px-4 pt-5 pb-8 dark">
        <GoalBuilder key={builderKey} initialGoals={myGoals} onChange={setGoalsInput} />

        <button onClick={save} disabled={submitting || !canSave}
          className="w-full mt-6 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-40 text-white font-black rounded-2xl py-3.5 text-base transition-all">
          {submitting ? 'Saving…' : 'Lock in 🔒'}
        </button>
      </div>
    </div>
  )
}
