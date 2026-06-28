import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, setDoc, Timestamp } from 'firebase/firestore'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db } from '../firebase'
import { getCurrentWeekId } from '../utils'
import { ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react'

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

const UNIT_SUGGESTIONS = ['reps','sets','miles','km','min','hrs','pages','steps','calories','sessions']

const EMPTY_GOAL = () => ({ text: '', type: 'habit', target: '', unit: '', subGoals: [] })
const EMPTY_SUB  = () => ({ text: '', target: '', unit: '' })

const goalsSummary = (items) => items.map(g =>
  g.type === 'habit' ? `${g.text} (every day)` : g.target ? `${g.text} (${g.target} ${g.unit})` : g.text
).join(', ')

// ── Animated stepper ──────────────────────────────────────────────────────
function Stepper({ value, onChange }) {
  const [animDir, setAnimDir] = useState(null)
  const [numKey, setNumKey] = useState(0)
  const holdRef = useRef(null)

  const step = (dir) => {
    const next = Math.max(0, (Number(value) || 0) + dir)
    setAnimDir(dir > 0 ? 'up' : 'down')
    setNumKey(k => k + 1)
    onChange(String(next))
  }

  const startHold = (dir) => {
    step(dir)
    holdRef.current = setTimeout(() => {
      holdRef.current = setInterval(() => step(dir), 80)
    }, 400)
  }

  const stopHold = () => {
    clearTimeout(holdRef.current)
    clearInterval(holdRef.current)
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <button
        type="button"
        onPointerDown={() => startHold(-1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        className="w-14 h-14 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-3xl font-light flex items-center justify-center select-none stepper-btn transition-colors"
      >−</button>

      <div className="flex-1 flex justify-center overflow-hidden" style={{ height: 60 }}>
        <span
          key={numKey}
          className={`text-5xl font-black text-white tabular-nums leading-none self-center stepper-num-${animDir}`}
        >
          {value || '0'}
        </span>
      </div>

      <button
        type="button"
        onPointerDown={() => startHold(1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-3xl font-light flex items-center justify-center select-none stepper-btn transition-colors shadow-lg shadow-emerald-500/30"
      >+</button>
    </div>
  )
}

// ── Single goal editor popup ───────────────────────────────────────────────
function GoalPopup({ goal, onSave, onClose }) {
  const [draft, setDraft] = useState(goal || EMPTY_GOAL())
  const [unitQuery, setUnitQuery] = useState('')
  const [unitOpen, setUnitOpen] = useState(false)

  const update = (patch) => setDraft(d => ({ ...d, ...patch }))

  const addSub = () => update({ subGoals: [...(draft.subGoals || []), EMPTY_SUB()] })
  const removeSub = (si) => update({ subGoals: draft.subGoals.filter((_, i) => i !== si) })
  const updateSub = (si, patch) => update({
    subGoals: draft.subGoals.map((sg, i) => i === si ? { ...sg, ...patch } : sg)
  })

  const unitMatches = unitQuery
    ? UNIT_SUGGESTIONS.filter(u => u.includes(unitQuery.toLowerCase()))
    : UNIT_SUGGESTIONS

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-zinc-950 rounded-t-3xl shadow-2xl slide-up flex flex-col"
        style={{ maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div className="flex justify-center pt-3 shrink-0">
          <div className="w-8 h-1 rounded-full bg-zinc-800" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4 shrink-0">
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-sm font-medium transition-colors">
            Cancel
          </button>
          <h2 className="text-sm font-bold text-white">{goal ? 'Edit goal' : 'New goal'}</h2>
          <button
            onClick={() => draft.text.trim() && onSave(draft)}
            disabled={!draft.text.trim()}
            className="text-emerald-400 hover:text-emerald-300 disabled:text-zinc-600 text-sm font-bold transition-colors">
            Done
          </button>
        </div>

        <div className="h-px bg-zinc-800 shrink-0 mx-5" />

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-6">

          {/* Goal name */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Goal</label>
            <input
              autoFocus
              type="text"
              placeholder="e.g. Hit the gym"
              value={draft.text}
              onChange={e => update({ text: e.target.value })}
              style={{ fontSize: 16 }}
              className="w-full bg-transparent text-2xl font-black text-white placeholder-zinc-700 focus:outline-none"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Type</label>
            <div className="flex gap-2">
              {[
                { value: 'habit', label: 'Daily habit', desc: 'Do it every day' },
                { value: 'weekly', label: 'Hit a number', desc: 'Track a weekly total' },
              ].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => update({ type: opt.value, subGoals: [] })}
                  className={`flex-1 py-3 px-3 rounded-2xl border text-left transition-all ${
                    draft.type === opt.value
                      ? 'bg-emerald-500/10 border-emerald-500 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600'
                  }`}>
                  <p className="text-xs font-bold">{opt.label}</p>
                  <p className="text-[10px] mt-0.5 opacity-60">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Count goal: target + unit */}
          {draft.type === 'weekly' && draft.subGoals.length === 0 && (
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Weekly target</label>
              <Stepper value={draft.target} onChange={v => update({ target: v })} />

              {/* Unit picker */}
              <div className="relative">
                  {draft.unit ? (
                    <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl">
                      <span className="text-sm font-bold text-white flex-1">{draft.unit}</span>
                      <button type="button" onClick={() => update({ unit: '' })}
                        className="text-zinc-600 hover:text-red-400 transition-colors text-xs">✕</button>
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="unit (e.g. reps)"
                      value={unitQuery}
                      onChange={e => setUnitQuery(e.target.value)}
                      onFocus={() => setUnitOpen(true)}
                      onBlur={() => setTimeout(() => setUnitOpen(false), 120)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && unitQuery.trim()) {
                          update({ unit: unitQuery.trim() }); setUnitQuery(''); setUnitOpen(false)
                        }
                      }}
                      style={{ fontSize: 16 }}
                      className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                    />
                  )}
                  {unitOpen && !draft.unit && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-10">
                      <div className="flex flex-wrap gap-1.5 p-3">
                        {unitMatches.slice(0, 9).map(u => (
                          <button key={u} type="button" onMouseDown={() => { update({ unit: u }); setUnitQuery(''); setUnitOpen(false) }}
                            className="px-3 py-1.5 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-400 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors">
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
            </div>
          )}

          {/* Sub-goals */}
          {draft.type === 'weekly' && (
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Breakdowns <span className="normal-case font-normal opacity-50">(optional)</span></label>
              <div className="space-y-2">
                {draft.subGoals.map((sg, si) => (
                  <div key={si} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3">
                    <input type="text" placeholder="e.g. Hard problems"
                      value={sg.text}
                      onChange={e => updateSub(si, { text: e.target.value })}
                      style={{ fontSize: 16 }}
                      className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-white placeholder-zinc-600 focus:outline-none"
                    />
                    <div className="flex items-center bg-zinc-800 rounded-xl overflow-hidden shrink-0">
                      <button type="button" onClick={() => updateSub(si, { target: String(Math.max(1, (Number(sg.target) || 0) - 1)) })}
                        className="w-8 h-8 flex items-center justify-center text-zinc-500 text-base hover:text-white transition-colors select-none">−</button>
                      <span className="w-7 text-center text-sm font-black text-white tabular-nums">{sg.target || '0'}</span>
                      <button type="button" onClick={() => updateSub(si, { target: String((Number(sg.target) || 0) + 1) })}
                        className="w-8 h-8 flex items-center justify-center text-zinc-500 text-base hover:text-white transition-colors select-none">+</button>
                    </div>
                    <button onClick={() => removeSub(si)} className="text-zinc-700 hover:text-red-400 transition-colors shrink-0 p-0.5">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addSub}
                  className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-emerald-500 transition-colors">
                  <Plus size={11} /> Add breakdown
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sortable goal row ──────────────────────────────────────────────────────
function SortableGoalRow({ id, text, type, target, unit, subGoals = [], onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const subtitle = type === 'habit'
    ? 'Daily habit'
    : subGoals.length > 0
      ? null
      : target ? `${target}${unit ? ` ${unit}` : ''} / week` : 'Count goal'

  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={`flex items-center gap-3 py-3 transition-all ${isDragging ? 'opacity-80' : ''}`}>
      {/* Drag handle */}
      <div {...listeners} {...attributes} className="touch-none cursor-grab active:cursor-grabbing p-1 shrink-0">
        <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
          {[2,6,10].flatMap(y => [2,6].map(x => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="currentColor" className="text-zinc-700" />
          )))}
        </svg>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-100 truncate">{text}</p>
        {subtitle && <p className="text-[10px] text-zinc-500 mt-0.5">{subtitle}</p>}
        {subGoals.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {subGoals.map((sg, i) => (
              <p key={i} className="text-[10px] text-zinc-600 truncate">
                ↳ {sg.text}{sg.target ? ` · ${sg.target}${sg.unit ? ` ${sg.unit}` : ''}` : ''}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <button onClick={onEdit} className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors shrink-0">
        <Pencil size={13} />
      </button>
      <button onClick={onDelete} className="p-1.5 text-zinc-700 hover:text-red-400 transition-colors shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function EditGoals() {
  const { sessionId, name } = useParams()
  const navigate = useNavigate()
  const weekId = getCurrentWeekId()

  const [members, setMembers] = useState([])
  const [bannerColorIdx, setBannerColorIdx] = useState(null)
  const [goals, setGoals] = useState(null)   // null = loading
  const [entry, setEntry] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)  // { index, goal } or { index: -1 } for new

  const sessionDoc = doc(db, 'sessions', sessionId)

  const dndSensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  useEffect(() => {
    return onSnapshot(sessionDoc, snap => {
      if (!snap.exists()) return
      const d = snap.data()
      setMembers(d.names || [])
      setBannerColorIdx(d.bannerColors?.[name] ?? null)
      const mg = d.memberGoals?.[name]
      if (goals === null) setGoals(mg?.length ? mg : [])
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
      // seed from entry only if we haven't loaded from session yet
      if (goals === null && mine?.goalItems?.length) setGoals(mine.goalItems)
    })
  }, [sessionId, weekId, name])

  const colorIdx = members.indexOf(name) % AVATAR_COLORS.length
  const color = bannerColorIdx !== null
    ? BANNER_COLORS[bannerColorIdx]
    : (AVATAR_COLORS[colorIdx < 0 ? 0 : colorIdx] || AVATAR_COLORS[0])

  const save = async (items) => {
    const valid = (items ?? goals).filter(g => g.text.trim())
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

  const handlePopupSave = (draft) => {
    const next = [...(goals || [])]
    if (editingGoal.index === -1) {
      next.push(draft)
    } else {
      next[editingGoal.index] = draft
    }
    setGoals(next)
    setEditingGoal(null)
  }

  const deleteGoal = (i) => setGoals(g => g.filter((_, idx) => idx !== i))

  if (goals === null) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

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
          <button onClick={() => save()} disabled={submitting || !goals.some(g => g.text.trim())}
            className="bg-white/20 hover:bg-white/30 disabled:opacity-40 active:scale-95 text-white font-bold text-sm px-5 py-1.5 rounded-full transition-all">
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="relative">
          <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-1">This week</p>
          <h1 className="text-2xl font-black text-white leading-tight">
            What are you<br />committing to?
          </h1>
        </div>
      </div>

      {/* Goal list */}
      <div className="flex-1 bg-zinc-950 px-4 pt-2 pb-8">
        {goals.length === 0 ? (
          <p className="text-zinc-600 text-sm text-center py-8">No goals yet — add one below</p>
        ) : (
          <DndContext sensors={dndSensors} collisionDetection={closestCenter}
            onDragEnd={({ active, over }) => {
              if (!over || active.id === over.id) return
              const oldIdx = goals.findIndex(g => g.text === active.id)
              const newIdx = goals.findIndex(g => g.text === over.id)
              if (oldIdx !== -1 && newIdx !== -1) setGoals(arrayMove(goals, oldIdx, newIdx))
            }}>
            <SortableContext items={goals.map(g => g.text)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-zinc-800/60">
                {goals.map((g, i) => (
                  <SortableGoalRow key={g.text} id={g.text}
                    text={g.text} type={g.type} target={g.target} unit={g.unit} subGoals={g.subGoals || []}
                    onEdit={() => setEditingGoal({ index: i, goal: g })}
                    onDelete={() => deleteGoal(i)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Add goal */}
        <button onClick={() => setEditingGoal({ index: -1, goal: null })}
          className="group add-goal-btn mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold active:scale-95 transition-transform">
          <span className="add-goal-plus-wrap">
            <Plus size={15} strokeWidth={2.5} />
          </span>
          Add goal
        </button>

        {goals.some(g => g.text.trim()) && (
          <button onClick={() => save()} disabled={submitting}
            className="mt-3 w-full bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-40 text-white font-black rounded-2xl py-3.5 text-base transition-all">
            {submitting ? 'Saving…' : 'Lock in 🔒'}
          </button>
        )}
      </div>

      {/* Single goal popup */}
      {editingGoal && (
        <GoalPopup
          goal={editingGoal.goal}
          onSave={handlePopupSave}
          onClose={() => setEditingGoal(null)}
        />
      )}
    </div>
  )
}
