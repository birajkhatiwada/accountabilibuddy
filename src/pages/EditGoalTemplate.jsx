import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { db } from '../firebase'
import { BUTTON_MD, BUTTON_SM, BUTTON_ADD } from '../buttonStyles'
import { useAuth } from '../AuthContext'
import useLockBodyScroll from '../useLockBodyScroll'
import { GoalPopup, SortableGoalRow } from '../components/GoalEditor'
import { ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react'


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
  useLockBodyScroll(!!editingGoal)

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
            className={`mt-4 w-full ${BUTTON_ADD}`}>
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
          className={`mt-4 w-full ${BUTTON_ADD}`}>
          <Plus size={12} />
          New template
        </button>
      </div>
    </div>
  )
}
