import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, setDoc, Timestamp } from 'firebase/firestore'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { db } from '../firebase'
import { BUTTON_MD, BUTTON_SM, BUTTON_ADD } from '../buttonStyles'
import { useAuth } from '../AuthContext'
import { getCurrentWeekId } from '../utils'
import useLockBodyScroll from '../useLockBodyScroll'
import { GoalPopup, SortableGoalRow } from '../components/GoalEditor'
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'

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

// ── Main page ──────────────────────────────────────────────────────────────
export default function EditGoals() {
  const { sessionId, name } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isOwner = user?.displayName?.toLowerCase() === name?.toLowerCase()
  const weekId = getCurrentWeekId()

  const [members, setMembers] = useState([])
  const [bannerColorIdx, setBannerColorIdx] = useState(null)
  const [goals, setGoals] = useState(null)   // null = loading
  const [goalTemplates, setGoalTemplates] = useState([])
  const [entry, setEntry] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const savedGoals = useRef(null)  // snapshot of goals at load time, for change detection
  const [editingGoal, setEditingGoal] = useState(null)  // { index, goal } or { index: -1 } for new
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  useLockBodyScroll(!!editingGoal || templatePickerOpen)

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
      setGoalTemplates(normalizeTemplates(d.goalTemplates?.[name]))
      const mg = d.memberGoals?.[name]
      if (goals === null) {
        const loaded = mg?.length ? mg : []
        setGoals(loaded)
        savedGoals.current = JSON.stringify(loaded)
      }
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
      if (goals === null && mine?.goalItems?.length) {
        setGoals(mine.goalItems)
        savedGoals.current = JSON.stringify(mine.goalItems)
      }
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

  // Swaps in the chosen template — only touches local state, so it isn't
  // persisted (and can't clobber the current week's goals/progress) until
  // the owner hits "Lock in Changes" below.
  const applyTemplate = (items) => {
    if (items?.length) setGoals(items)
    setTemplatePickerOpen(false)
  }

  if (!isOwner) return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-2">
      <p className="text-sm font-semibold text-zinc-300">Only {name} can edit these goals</p>
      <button onClick={() => navigate(-1)} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
        ← Back
      </button>
    </div>
  )

  if (goals === null) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const hasChanges = goals !== null && savedGoals.current !== null && JSON.stringify(goals) !== savedGoals.current
  const hasValid = goals?.some(g => g.text.trim())
  const lockLabel = submitting ? 'Saving…' : hasChanges ? 'Lock in Changes' : 'Lock in'

  return (
    <div className="-mx-4 -mt-3 min-h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 shrink-0">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-sm font-semibold mb-3">
          <ArrowLeft size={15} /> Back
        </button>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-white">Edit Goals</h1>
          {goalTemplates.length > 0 && (
            <button onClick={() => setTemplatePickerOpen(true)}
              className={`shrink-0 ${BUTTON_SM}`}>
              Use template
            </button>
          )}
        </div>
      </div>

      <div className="h-px bg-zinc-800 mx-4" />

      {/* Goal list */}
      <div className="flex-1 px-4 pt-2 pb-8">
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

        {hasValid && (
          <div className="mt-3 space-y-1.5">
            {hasChanges && (
              <p className="text-xs text-amber-500 text-center font-medium">You have unsaved changes — tap Lock in to save them</p>
            )}
            <button onClick={() => save()} disabled={submitting}
              className={`w-full ${BUTTON_MD}`}>
              {lockLabel}
            </button>
          </div>
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

      {/* Template picker */}
      {templatePickerOpen && (
        <TemplatePicker
          templates={goalTemplates}
          onUse={applyTemplate}
          onClose={() => setTemplatePickerOpen(false)}
        />
      )}
    </div>
  )
}

// ── Template picker — pick which saved template (if more than one), then
//    preview every goal in it before it overwrites the local (unsaved)
//    goal list ─────────────────────────────────────────────────────────
function TemplatePicker({ templates, onUse, onClose }) {
  const [selected, setSelected] = useState(templates.length === 1 ? templates[0] : null)
  const backToPick = templates.length > 1 ? () => setSelected(null) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div className="relative w-full max-w-sm bg-zinc-900 rounded-2xl border border-white/[0.06] shadow-2xl shadow-black/60 modal-pop flex flex-col overflow-hidden"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 pt-4 shrink-0">
          {backToPick ? (
            <button onClick={backToPick}
              className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
              <ChevronLeft size={18} />
            </button>
          ) : <span className="w-8 h-8" />}
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        {!selected ? (
          <>
            <div className="px-6 pb-2 pt-1 text-center shrink-0">
              <h2 className="text-lg font-bold text-white">Which template?</h2>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-2">
              {templates.map(t => (
                <button key={t.id} type="button" onClick={() => setSelected(t)}
                  className="w-full flex items-center gap-3 text-left px-3.5 py-3 rounded-xl border bg-zinc-800/40 border-zinc-800 hover:border-zinc-600 transition-all group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{t.title || 'Untitled template'}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{t.items.length} goal{t.items.length === 1 ? '' : 's'}</p>
                  </div>
                  <ChevronRight size={16} className="text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="px-6 pb-2 pt-1 text-center shrink-0">
              <p className="text-sm font-medium text-zinc-500">Saved template</p>
              <h2 className="text-lg font-bold text-white mt-0.5">{selected.title || 'Untitled template'}</h2>
              <p className="text-xs text-zinc-600 mt-1">{selected.items.length} goal{selected.items.length === 1 ? '' : 's'}</p>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-2">
              {selected.items.map((g, i) => {
                const subtitle = g.type === 'habit'
                  ? 'Daily habit'
                  : (g.subGoals?.length > 0)
                    ? g.subGoals.map(sg => `${sg.text} (${sg.target}${sg.unit ? ` ${sg.unit}` : ''})`).join(', ')
                    : g.target ? `${g.target}${g.unit ? ` ${g.unit}` : ''} / week` : 'Count goal'
                return (
                  <div key={i} className="bg-zinc-800/40 border border-zinc-800 rounded-xl px-4 py-3">
                    <p className="text-sm font-semibold text-white truncate">{g.text}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
                  </div>
                )
              })}
            </div>

            <div className="px-6 pb-6 pt-1 shrink-0">
              <button onClick={() => onUse(selected.items)}
                className={`w-full ${BUTTON_MD}`}>
                Use this template
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
