import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentWeekId } from '../utils'
import { Send, Plus, Minus } from 'lucide-react'

function getWeekDays(weekId) {
  const base = new Date(weekId + 'T00:00:00')
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    return d
  })
}

// Fallback for old plain-text goals
function parseGoalsText(goalsText) {
  return (goalsText || '').split('\n')
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
    .map(text => ({ text, type: 'habit', target: null, unit: '' }))
}

function dateKey(date) {
  return date.toISOString().split('T')[0]
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ── small sub-components ──────────────────────────────────────────────────────

function Checkmark({ checked }) {
  return (
    <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
      checked ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600'
    }`}>
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </span>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function WeekCalendar({ entryId, goalItems, goals }) {
  const weekId = getCurrentWeekId()
  const days = getWeekDays(weekId)
  const todayKey = dateKey(new Date())

  const [selectedDay, setSelectedDay] = useState(todayKey)
  const [logs, setLogs] = useState({})     // { 'YYYY-MM-DD': { habit, count, total, notes } }
  const [noteInput, setNoteInput] = useState('')
  const [saving, setSaving] = useState(false)

  const resolvedGoals = goalItems?.length ? goalItems : parseGoalsText(goals)

  useEffect(() => {
    if (!entryId) return
    const unsub = onSnapshot(collection(db, 'entries', entryId, 'dailyLogs'), snap => {
      const data = {}
      snap.docs.forEach(d => { data[d.id] = d.data() })
      setLogs(data)
    })
    return unsub
  }, [entryId])

  useEffect(() => { setNoteInput('') }, [selectedDay])

  const getDayLog = (key) => logs[key] || {}

  const patchDay = async (dayKey, patch) => {
    if (!entryId) return
    const current = getDayLog(dayKey)
    await setDoc(doc(db, 'entries', entryId, 'dailyLogs', dayKey), { ...current, ...patch })
  }

  // ── per-goal helpers ──────────────────────────────────────────────────────

  // habit: toggle checked for a day
  const toggleHabit = (dayKey, goalText) => {
    const current = getDayLog(dayKey)
    const habits = { ...(current.habits || {}) }
    habits[goalText] = !habits[goalText]
    patchDay(dayKey, { habits })
  }

  // count: increment/decrement total times done (not per-day)
  const adjustCount = (goalText, delta) => {
    const current = getDayLog('__count__') // stored on a special key
    const counts = { ...(current.counts || {}) }
    counts[goalText] = Math.max((counts[goalText] || 0) + delta, 0)
    // store counts in a special non-date doc
    if (!entryId) return
    setDoc(doc(db, 'entries', entryId, 'dailyLogs', '__count__'), { ...current, counts })
  }

  // total: set amount for a specific day
  const setTotal = (dayKey, goalText, value) => {
    const current = getDayLog(dayKey)
    const totals = { ...(current.totals || {}) }
    totals[goalText] = Math.max(Number(value) || 0, 0)
    patchDay(dayKey, { totals })
  }

  const addNote = async (dayKey) => {
    if (!noteInput.trim() || !entryId) return
    setSaving(true)
    const current = getDayLog(dayKey)
    await setDoc(doc(db, 'entries', entryId, 'dailyLogs', dayKey), {
      ...current,
      notes: [...(current.notes || []), noteInput.trim()],
    })
    setNoteInput('')
    setSaving(false)
  }

  // ── activity detection for dots ───────────────────────────────────────────

  const dayHasActivity = (key) => {
    const log = logs[key]
    if (!log) return false
    return (
      (log.notes?.length > 0) ||
      Object.values(log.habits || {}).some(Boolean) ||
      Object.values(log.totals || {}).some(v => v > 0)
    )
  }

  // ── weekly summaries ──────────────────────────────────────────────────────

  const habitDaysCount = (goalText) =>
    Object.values(logs).filter(l => l.habits?.[goalText]).length

  const weeklyCountValue = (goalText) =>
    (logs['__count__']?.counts?.[goalText]) || 0

  const weeklyTotalValue = (goalText) =>
    Object.entries(logs)
      .filter(([k]) => k !== '__count__')
      .reduce((sum, [, l]) => sum + (Number(l.totals?.[goalText]) || 0), 0)

  // ── render ────────────────────────────────────────────────────────────────

  const selectedLog = getDayLog(selectedDay)
  const selectedDate = days.find(d => dateKey(d) === selectedDay)

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold px-1">Daily log</p>

      {/* Day picker */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const key = dateKey(day)
          const isToday = key === todayKey
          const isSelected = key === selectedDay
          const hasActivity = dayHasActivity(key)
          const isFuture = key > todayKey
          return (
            <button key={key} onClick={() => setSelectedDay(key)}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                isSelected ? 'bg-white text-zinc-900 shadow-lg' :
                isToday ? 'bg-zinc-800 text-white ring-1 ring-emerald-500' :
                isFuture ? 'bg-zinc-900/50 text-zinc-700 cursor-default' :
                'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700'
              }`}>
              <span className="text-[10px] font-bold uppercase">{DAY_LABELS[i]}</span>
              <span className="text-sm font-black">{day.getDate()}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${hasActivity ? (isSelected ? 'bg-emerald-500' : 'bg-emerald-400') : 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>

      {/* Weekly summary cards */}
      {resolvedGoals.length > 0 && (
        <div className="space-y-2">
          {resolvedGoals.map(({ text, type, target, unit }) => {
            if (type === 'habit') {
              const done = habitDaysCount(text)
              return (
                <div key={text} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-400 truncate">{text}</span>
                  <div className="flex gap-0.5 shrink-0">
                    {days.map((d, i) => {
                      const k = dateKey(d)
                      const checked = !!logs[k]?.habits?.[text]
                      return <span key={i} className={`w-3 h-3 rounded-sm ${checked ? 'bg-emerald-500' : 'bg-zinc-800'}`} />
                    })}
                  </div>
                  <span className="text-xs font-bold text-zinc-400 shrink-0">{done}/7</span>
                </div>
              )
            }
            if (type === 'count') {
              const val = weeklyCountValue(text)
              const tgt = Number(target) || 0
              const pct = tgt ? Math.min((val / tgt) * 100, 100) : 0
              return (
                <div key={text} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400 truncate pr-2">{text}</span>
                    <span className={`text-xs font-black shrink-0 ${val >= tgt && tgt ? 'text-emerald-400' : 'text-zinc-300'}`}>
                      {val}{tgt ? `/${tgt}` : ''} {unit || 'times'}
                    </span>
                  </div>
                  {tgt > 0 && <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${val >= tgt ? 'bg-emerald-400' : 'bg-emerald-600'}`} style={{ width: `${pct}%` }} />
                  </div>}
                </div>
              )
            }
            if (type === 'total') {
              const val = weeklyTotalValue(text)
              const tgt = Number(target) || 0
              const pct = tgt ? Math.min((val / tgt) * 100, 100) : 0
              const remaining = Math.max(tgt - val, 0)
              return (
                <div key={text} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400 truncate pr-2">{text}</span>
                    <span className={`text-xs font-black shrink-0 ${val >= tgt && tgt ? 'text-emerald-400' : 'text-zinc-300'}`}>
                      {val}{tgt ? `/${tgt}` : ''} {unit}
                    </span>
                  </div>
                  {tgt > 0 && <>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${val >= tgt ? 'bg-emerald-400' : 'bg-emerald-600'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-zinc-600">{val >= tgt ? '🎉 Goal reached!' : `${remaining} ${unit} left`}</p>
                  </>}
                </div>
              )
            }
            return null
          })}
        </div>
      )}

      {/* Selected day panel */}
      {selectedDate && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
          <p className="text-sm font-bold text-zinc-300">
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            {dateKey(selectedDate) === todayKey && <span className="ml-2 text-xs text-emerald-400 font-semibold">Today</span>}
          </p>

          {resolvedGoals.length > 0 && (
            <div className="space-y-4">
              {resolvedGoals.map(({ text, type, target, unit }) => {
                if (type === 'habit') {
                  const checked = !!selectedLog.habits?.[text]
                  return (
                    <button key={text} onClick={() => toggleHabit(selectedDay, text)}
                      className="w-full flex items-center gap-3 text-left group">
                      <Checkmark checked={checked} />
                      <span className={`text-sm transition-colors ${checked ? 'text-zinc-500 line-through' : 'text-zinc-300 group-hover:text-white'}`}>
                        {text}
                      </span>
                      {checked && <span className="ml-auto text-[10px] text-emerald-400 font-bold">✓ done</span>}
                    </button>
                  )
                }

                if (type === 'count') {
                  const val = weeklyCountValue(text)
                  return (
                    <div key={text} className="space-y-1.5">
                      <p className="text-xs text-zinc-500">{text}</p>
                      <div className="flex items-center gap-3">
                        <button onClick={() => adjustCount(text, -1)}
                          className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-colors">
                          <Minus size={16} />
                        </button>
                        <div className="flex-1 text-center">
                          <span className="text-2xl font-black text-white">{val}</span>
                          {target && <span className="text-zinc-500 text-sm">/{target} {unit || 'times'}</span>}
                        </div>
                        <button onClick={() => adjustCount(text, 1)}
                          className="w-10 h-10 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors">
                          <Plus size={16} />
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-600 text-center">tap + each time you do it</p>
                    </div>
                  )
                }

                if (type === 'total') {
                  const val = selectedLog.totals?.[text] || 0
                  return (
                    <div key={text} className="space-y-1.5">
                      <p className="text-xs text-zinc-500">{text} — how much today?</p>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setTotal(selectedDay, text, val - 1)}
                          className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-colors">
                          <Minus size={16} />
                        </button>
                        <div className="flex-1 flex items-center justify-center gap-2">
                          <input type="number" min="0" value={val}
                            onChange={e => setTotal(selectedDay, text, e.target.value)}
                            className="w-20 bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-2 text-center text-xl font-black text-white focus:outline-none focus:border-emerald-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-sm text-zinc-500">{unit}</span>
                        </div>
                        <button onClick={() => setTotal(selectedDay, text, val + 1)}
                          className="w-10 h-10 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  )
                }
                return null
              })}
            </div>
          )}

          {resolvedGoals.length > 0 && <div className="border-t border-zinc-800" />}

          {selectedLog.notes?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-600 uppercase tracking-wider">Notes</p>
              {selectedLog.notes.map((note, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                  <span className="text-emerald-500 mt-0.5 shrink-0">→</span>
                  <span>{note}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input type="text" placeholder="Anything else to note..."
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addNote(selectedDay)}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button onClick={() => addNote(selectedDay)} disabled={saving || !noteInput.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl px-3 transition-colors">
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
