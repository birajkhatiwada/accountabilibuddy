import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db } from '../firebase'
import { BUTTON_MD, BUTTON_SM } from '../buttonStyles'
import { useAuth } from '../AuthContext'
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Trash2, Pencil, X, Repeat, Target, Hash, Layers } from 'lucide-react'

const EMPTY_GOAL = () => ({ text: '', type: 'habit', target: '1', unit: '', subGoals: [] })
const EMPTY_SUB  = () => ({ text: '', target: '1', unit: '' })

// ── Single goal editor popup — identical to EditGoals.jsx's version ────────
function GoalPopup({ goal, onSave, onClose }) {
  const [draft, setDraft] = useState(goal || EMPTY_GOAL())
  // New goals walk through a wizard (name → type → target); editing an
  // existing goal shows everything on one screen like before.
  const [step, setStep] = useState(goal ? 'full' : 'name')

  const update = (patch) => setDraft(d => ({ ...d, ...patch }))

  const addSub = () => update({ subGoals: [...(draft.subGoals || []), EMPTY_SUB()] })
  const removeSub = (si) => update({ subGoals: draft.subGoals.filter((_, i) => i !== si) })
  const updateSub = (si, patch) => update({
    subGoals: draft.subGoals.map((sg, i) => i === si ? { ...sg, ...patch } : sg)
  })

  const isDraftValid = draft.text.trim() && (
    draft.type !== 'weekly' ? true
      : draft.subGoals?.length > 0 ? draft.subGoals.every(sg => sg.text.trim() && Number(sg.target) > 0)
      : Number(draft.target) > 0
  )

  const chooseType = (value) => {
    update({ type: value, subGoals: [] })
    if (value === 'habit') onSave({ ...draft, type: value, subGoals: [] })
    else setStep('breakdownChoice')
  }

  const chooseBreakdown = (kind) => {
    if (kind === 'single') { update({ subGoals: [] }); setStep('target') }
    else { update({ subGoals: draft.subGoals?.length ? draft.subGoals : [EMPTY_SUB()] }); setStep('breakdown') }
  }

  const breakdownOptions = [
    { value: 'single', label: 'Single target', desc: 'One number to hit, e.g. 5 workouts', icon: Hash },
    { value: 'breakdown', label: 'Split into parts', desc: 'Track a few pieces separately, e.g. Push / Pull / Legs', icon: Layers },
  ]

  const backStep = { type: 'name', breakdownChoice: 'type', target: 'breakdownChoice', breakdown: 'breakdownChoice' }[step]

  const typeOptions = [
    { value: 'habit', label: 'Daily habit', desc: 'Do it every day', icon: Repeat },
    { value: 'weekly', label: 'Hit a number', desc: 'Track a weekly total', icon: Target },
  ]

  const fieldCls = "w-full bg-zinc-800/60 border border-zinc-700/60 focus:border-emerald-500/60 rounded-xl text-white placeholder-zinc-600 focus:outline-none transition-colors"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div className="relative w-full max-w-sm bg-zinc-900 rounded-2xl border border-white/[0.06] shadow-2xl shadow-black/60 modal-pop flex flex-col overflow-hidden"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}>

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-4 shrink-0">
          {backStep ? (
            <button onClick={() => setStep(backStep)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
              <ChevronLeft size={18} />
            </button>
          ) : <span className="w-8 h-8" />}
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-1">

          {(step === 'full' || step === 'name') && (
            <div className={step === 'full' ? '' : 'text-center'}>
              {step === 'full' ? (
                <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-2">Goal</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-zinc-500">New goal</p>
                  <h2 className="text-lg font-bold text-white mt-0.5 mb-5">What are you working on?</h2>
                </>
              )}
              <input
                autoFocus
                type="text"
                placeholder="e.g. Hit the gym"
                value={draft.text}
                onChange={e => update({ text: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter' && draft.text.trim() && step === 'name') setStep('type') }}
                style={{ fontSize: 16 }}
                className={step === 'full'
                  ? "w-full bg-transparent text-base font-semibold text-white placeholder-zinc-700 focus:outline-none"
                  : `${fieldCls} px-4 py-3 text-base font-semibold text-center`}
              />
              {step === 'name' && (
                <button
                  onClick={() => draft.text.trim() && setStep('type')}
                  disabled={!draft.text.trim()}
                  className={`mt-5 w-full ${BUTTON_MD}`}>
                  Continue
                </button>
              )}
            </div>
          )}

          {(step === 'full' || step === 'type') && (
            <div className={step === 'full' ? 'mt-6' : ''}>
              {step === 'full' ? (
                <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-2">Type</p>
              ) : (
                <div className="text-center mb-5">
                  <p className="text-sm font-medium text-zinc-500 truncate">{draft.text}</p>
                  <h2 className="text-lg font-bold text-white mt-0.5">What kind of goal is it?</h2>
                </div>
              )}
              <div className={step === 'type' ? 'flex flex-col gap-2.5' : 'flex gap-2'}>
                {typeOptions.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => step === 'type' ? chooseType(opt.value) : update({ type: opt.value, subGoals: [] })}
                    className={step === 'type'
                      ? `flex items-center gap-3 text-left px-3.5 py-3 rounded-xl border transition-all group ${
                          draft.type === opt.value
                            ? 'bg-emerald-500/10 border-emerald-500'
                            : 'bg-zinc-800/40 border-zinc-800 hover:border-zinc-600'
                        }`
                      : `flex-1 py-3 px-3 rounded-xl border text-left transition-all ${
                          draft.type === opt.value
                            ? 'bg-emerald-500/10 border-emerald-500'
                            : 'bg-zinc-800/40 border-zinc-800 hover:border-zinc-600'
                        }`
                    }>
                    {step === 'type' && (
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        draft.type === opt.value ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-500 group-hover:text-zinc-300'
                      }`}>
                        <opt.icon size={16} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${draft.type === opt.value ? 'text-white' : 'text-zinc-400'}`}>{opt.label}</p>
                      <p className="text-xs text-zinc-600 mt-0.5">{opt.desc}</p>
                    </div>
                    {step === 'type' && <ChevronRight size={16} className="text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Breakdown choice */}
          {step === 'breakdownChoice' && (
            <div>
              <div className="text-center mb-5">
                <p className="text-sm font-medium text-zinc-500 truncate">{draft.text}</p>
                <h2 className="text-lg font-bold text-white mt-0.5">One target, or a few parts?</h2>
              </div>
              <div className="flex flex-col gap-2.5">
                {breakdownOptions.map(opt => (
                  <button key={opt.value} type="button" onClick={() => chooseBreakdown(opt.value)}
                    className="flex items-center gap-3 text-left px-3.5 py-3 rounded-xl border bg-zinc-800/40 border-zinc-800 hover:border-zinc-600 transition-all group">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-zinc-800 text-zinc-500 group-hover:text-zinc-300 transition-colors">
                      <opt.icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-400 group-hover:text-white transition-colors">{opt.label}</p>
                      <p className="text-xs text-zinc-600 mt-0.5">{opt.desc}</p>
                    </div>
                    <ChevronRight size={16} className="text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Single vs split toggle — only shown in single-screen edit mode,
              since the wizard already asked this explicitly */}
          {step === 'full' && draft.type === 'weekly' && (
            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-2">Target</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => update({ subGoals: [] })}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    draft.subGoals.length === 0 ? 'bg-emerald-500/10 border-emerald-500 text-white' : 'bg-zinc-800/40 border-zinc-800 text-zinc-500 hover:border-zinc-600'
                  }`}>Single target</button>
                <button type="button" onClick={() => update({ subGoals: draft.subGoals.length ? draft.subGoals : [EMPTY_SUB()] })}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    draft.subGoals.length > 0 ? 'bg-emerald-500/10 border-emerald-500 text-white' : 'bg-zinc-800/40 border-zinc-800 text-zinc-500 hover:border-zinc-600'
                  }`}>Split into parts</button>
              </div>
            </div>
          )}

          {(step === 'target' || (step === 'full' && draft.type === 'weekly' && draft.subGoals.length === 0)) && (
            <div className={step === 'full' ? 'space-y-2 mt-3' : 'space-y-2'}>
              {step === 'target' && (
                <div className="text-center mb-3">
                  <p className="text-sm font-medium text-zinc-500 truncate">{draft.text}</p>
                  <h2 className="text-lg font-bold text-white mt-0.5">Set your target</h2>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-zinc-800/60 border border-zinc-700/60 rounded-xl overflow-hidden shrink-0">
                  <button type="button"
                    disabled={Number(draft.target) <= 1}
                    onClick={() => update({ target: String(Math.max(1, Number(draft.target) - 1)) })}
                    className="w-11 h-11 flex items-center justify-center text-zinc-500 hover:text-white disabled:text-zinc-700 disabled:hover:text-zinc-700 active:scale-90 transition-all select-none text-lg">−</button>
                  <span className="w-10 text-center text-sm font-semibold text-white tabular-nums">
                    {draft.target}
                  </span>
                  <button type="button"
                    onClick={() => update({ target: String(Number(draft.target) + 1) })}
                    className="w-11 h-11 flex items-center justify-center text-zinc-500 hover:text-white active:scale-90 transition-all select-none text-lg">+</button>
                </div>

                <input
                  type="text"
                  placeholder="e.g. reps, km, hrs"
                  value={draft.unit}
                  onChange={e => update({ unit: e.target.value })}
                  style={{ fontSize: 16 }}
                  className="flex-1 min-w-0 px-4 py-3 bg-zinc-800/60 border border-zinc-700/60 rounded-xl text-sm font-semibold text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors"
                />
              </div>
            </div>
          )}

          {(step === 'breakdown' || (step === 'full' && draft.type === 'weekly' && draft.subGoals.length > 0)) && (
            <div className={step === 'full' ? 'mt-3' : 'mt-6'}>
              {step === 'breakdown' && (
                <div className="text-center mb-3">
                  <p className="text-sm font-medium text-zinc-500 truncate">{draft.text}</p>
                  <h2 className="text-lg font-bold text-white mt-0.5">Add your parts</h2>
                </div>
              )}
              {step === 'full' && (
                <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-2">Breakdowns</p>
              )}
              <div className="space-y-2">
                {draft.subGoals.map((sg, si) => (
                  <div key={si} className="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4" style={{ height: 44 }}>
                    <input type="text" placeholder="e.g. Hard problems"
                      value={sg.text}
                      onChange={e => updateSub(si, { text: e.target.value })}
                      style={{ fontSize: 16 }}
                      className="flex-1 min-w-0 h-full bg-transparent text-sm font-semibold text-white placeholder-zinc-600 focus:outline-none"
                    />
                    <div className="flex items-center bg-zinc-900/60 border border-zinc-700 rounded-xl overflow-hidden shrink-0">
                      <button type="button"
                        disabled={Number(sg.target) <= 1}
                        onClick={() => updateSub(si, { target: String(Math.max(1, Number(sg.target) - 1)) })}
                        className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white disabled:text-zinc-700 disabled:hover:text-zinc-700 active:scale-90 transition-all select-none text-sm">−</button>
                      <span className="w-7 text-center text-sm font-semibold text-white tabular-nums">{sg.target}</span>
                      <button type="button" onClick={() => updateSub(si, { target: String(Number(sg.target) + 1) })}
                        className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white active:scale-90 transition-all select-none text-sm">+</button>
                    </div>
                    <button onClick={() => removeSub(si)} className="text-zinc-700 hover:text-red-400 transition-colors shrink-0">
                      <Trash2 size={12} />
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

          {(step === 'full' || step === 'target' || step === 'breakdown') && (
            <button
              onClick={() => isDraftValid && onSave(draft)}
              disabled={!isDraftValid}
              className={`mt-6 w-full ${BUTTON_MD}`}>
              {goal ? 'Save changes' : 'Save goal'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sortable goal card — same card language as the template list ──────────
function SortableGoalRow({ id, text, type, target, unit, subGoals = [], onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const subtitle = type === 'habit'
    ? 'Daily habit'
    : subGoals.length > 0
      ? null
      : target ? `${target}${unit ? ` ${unit}` : ''} / week` : 'Count goal'

  const Icon = type === 'habit' ? Repeat : Target

  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={`flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-3 transition-all ${isDragging ? 'opacity-80 shadow-lg' : ''}`}>
      <div {...listeners} {...attributes} className="touch-none cursor-grab active:cursor-grabbing p-1 shrink-0 text-zinc-700">
        <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
          {[2,6,10].flatMap(y => [2,6].map(x => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="currentColor" />
          )))}
        </svg>
      </div>

      <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-500">
        <Icon size={16} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{text}</p>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
        {subGoals.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {subGoals.map((sg, i) => (
              <p key={i} className="text-xs text-zinc-600 truncate">
                ↳ {sg.text}{sg.target ? ` · ${sg.target}${sg.unit ? ` ${sg.unit}` : ''}` : ''}
              </p>
            ))}
          </div>
        )}
      </div>

      <button onClick={onEdit} className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors shrink-0">
        <Pencil size={13} />
      </button>
      <button onClick={onDelete} className="p-1.5 text-zinc-700 hover:text-red-400 transition-colors shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// A member can keep several named templates now. Normalize away the older
// shapes this field used to be saved in: a bare goal array (the very first
// version), or a single { title, items } object (one template, no list).
const newTemplateId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
const normalizeTemplates = (raw) => {
  if (!raw) return []
  if (Array.isArray(raw)) {
    if (!raw.length) return []
    return raw[0]?.items !== undefined ? raw : [{ id: newTemplateId(), title: '', items: raw }]
  }
  return raw.items?.length ? [{ id: newTemplateId(), title: raw.title || '', items: raw.items }] : []
}

// ── Main page — a member can keep several named templates. The list view
//    shows all of them; picking one (or "+ New template") opens the
//    single-template editor below, independent of whatever goals happen
//    to be live this week ───────────────────────────────────────────────
export default function EditGoalTemplate() {
  const { sessionId, name } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isOwner = user?.displayName?.toLowerCase() === name?.toLowerCase()

  const [templates, setTemplates] = useState(null)   // null = loading
  const [editingId, setEditingId] = useState(null)    // null = list view, else 'new' or a template id

  const [goals, setGoals] = useState([])
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)

  const sessionDoc = doc(db, 'sessions', sessionId)

  const dndSensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  useEffect(() => {
    return onSnapshot(sessionDoc, snap => {
      if (!snap.exists()) return
      if (templates === null) setTemplates(normalizeTemplates(snap.data().goalTemplates?.[name]))
    })
  }, [sessionId, name])

  const persist = async (next) => {
    await setDoc(sessionDoc, { goalTemplates: { [name]: next } }, { merge: true })
  }

  const openNew = () => { setEditingId('new'); setTitle(''); setGoals([]) }
  const openEdit = (t) => { setEditingId(t.id); setTitle(t.title); setGoals(t.items) }
  const closeEditor = () => setEditingId(null)

  const deleteTemplate = async (id) => {
    const next = templates.filter(t => t.id !== id)
    setTemplates(next)
    await persist(next)
  }

  const saveTemplate = async () => {
    const valid = goals.filter(g => g.text.trim())
    if (!title.trim() || !valid.length) return
    setSubmitting(true)
    const entry = { id: editingId === 'new' ? newTemplateId() : editingId, title: title.trim(), items: valid }
    const next = editingId === 'new'
      ? [...templates, entry]
      : templates.map(t => t.id === editingId ? entry : t)
    setTemplates(next)
    await persist(next)
    setSubmitting(false)
    setEditingId(null)
  }

  const handlePopupSave = (draft) => {
    const next = [...goals]
    if (editingGoal.index === -1) {
      next.push(draft)
    } else {
      next[editingGoal.index] = draft
    }
    setGoals(next)
    setEditingGoal(null)
  }

  const deleteGoal = (i) => setGoals(g => g.filter((_, idx) => idx !== i))

  if (!isOwner) return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-2">
      <p className="text-sm font-semibold text-zinc-300">Only {name} can edit these templates</p>
      <button onClick={() => navigate(-1)} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
        ← Back
      </button>
    </div>
  )

  if (templates === null) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── Editor view — one template ──────────────────────────────────────────
  if (editingId) {
    const hasValid = goals.some(g => g.text.trim())
    const canSave = title.trim() && hasValid
    const lockLabel = submitting ? 'Saving…' : 'Save Template'

    return (
      <div className="-mx-4 -mt-3 min-h-full flex flex-col bg-zinc-950">
        <div className="px-4 pt-5 pb-4 shrink-0">
          <button onClick={closeEditor}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-sm font-semibold mb-3">
            <ArrowLeft size={15} /> Back
          </button>
          <h1 className="text-lg font-bold text-white">{editingId === 'new' ? 'New Template' : 'Edit Template'}</h1>
          <p className="text-xs text-zinc-500 mt-1">Build a reusable goal set — this doesn't affect any live week until you tap "Use template" from a new week.</p>
        </div>

        <div className="h-px bg-zinc-800 mx-4" />

        {/* Template name */}
        <div className="px-4 pt-4 shrink-0">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-2">Template name <span className="font-normal text-zinc-600 normal-case tracking-normal">(required)</span></p>
          <input
            autoFocus={editingId === 'new'}
            type="text"
            placeholder="e.g. Push Pull Legs week"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{ fontSize: 16 }}
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-semibold text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors"
          />
          {!title.trim() && (
            <p className="text-xs text-amber-500 mt-2">Give this template a name to save it</p>
          )}
        </div>

        {/* Goal list */}
        <div className="flex-1 px-4 pt-4 pb-8">
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
                <div className="space-y-2">
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
            className="mt-4 w-full py-2.5 rounded-xl border border-dashed border-zinc-800 text-zinc-600 hover:border-emerald-500/50 hover:text-emerald-500 transition-all text-xs font-semibold flex items-center justify-center gap-1.5">
            <Plus size={12} />
            Add goal
          </button>

          {canSave && (
            <button onClick={saveTemplate} disabled={submitting}
              className={`mt-3 w-full ${BUTTON_MD}`}>
              {lockLabel}
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

  // ── List view — every saved template ────────────────────────────────────
  return (
    <div className="-mx-4 -mt-3 min-h-full flex flex-col bg-zinc-950">
      <div className="px-4 pt-5 pb-4 shrink-0">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-sm font-semibold mb-3">
          <ArrowLeft size={15} /> Back
        </button>
        <h1 className="text-lg font-bold text-white">Goal Templates</h1>
        <p className="text-xs text-zinc-500 mt-1">Keep as many reusable goal sets as you like — each one needs its own name.</p>
      </div>

      <div className="h-px bg-zinc-800 mx-4" />

      <div className="flex-1 px-4 pt-2 pb-8">
        {templates.length === 0 ? (
          <p className="text-zinc-600 text-sm text-center py-8">No templates yet — create one below</p>
        ) : (
          <div className="space-y-2">
            {templates.map(t => (
              <div key={t.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                <button onClick={() => openEdit(t)} className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-white truncate">{t.title || 'Untitled template'}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{t.items.length} goal{t.items.length === 1 ? '' : 's'}</p>
                </button>
                <button onClick={() => openEdit(t)} className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors shrink-0">
                  <Pencil size={13} />
                </button>
                <button onClick={() => deleteTemplate(t.id)} className="p-1.5 text-zinc-700 hover:text-red-400 transition-colors shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button onClick={openNew}
          className="mt-4 w-full py-2.5 rounded-xl border border-dashed border-zinc-800 text-zinc-600 hover:border-emerald-500/50 hover:text-emerald-500 transition-all text-xs font-semibold flex items-center justify-center gap-1.5">
          <Plus size={12} />
          New template
        </button>
      </div>
    </div>
  )
}
