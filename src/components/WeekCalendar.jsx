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

// Fallback parser for old entries that only have goals as plain text
function parseGoalsText(goalsText) {
  return (goalsText || '').split('\n')
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
    .map(text => {
      const match = text.match(/(\d+)\s*([a-zA-Z]+)?/)
      return match
        ? { text, target: parseInt(match[1], 10), unit: match[2] || '' }
        : { text, target: null, unit: '' }
    })
}

function dateKey(date) {
  return date.toISOString().split('T')[0]
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function WeekCalendar({ entryId, goalItems, goals }) {
  const weekId = getCurrentWeekId()
  const days = getWeekDays(weekId)
  const todayKey = dateKey(new Date())

  const [selectedDay, setSelectedDay] = useState(todayKey)
  const [logs, setLogs] = useState({})
  const [noteInput, setNoteInput] = useState('')
  const [saving, setSaving] = useState(false)

  // Use structured goalItems if available, else fall back to parsing plain text
  const resolvedGoals = goalItems?.length ? goalItems : parseGoalsText(goals)

  useEffect(() => {
    if (!entryId) return
    const unsub = onSnapshot(collection(db, 'entries', entryId, 'dailyLogs'), (snap) => {
      const data = {}
      snap.docs.forEach(d => { data[d.id] = d.data() })
      setLogs(data)
    })
    return unsub
  }, [entryId])

  useEffect(() => {
    setNoteInput('')
  }, [selectedDay])

  const getDayLog = (key) => logs[key] || { progress: {}, notes: [] }

  // Sum a numeric goal's progress across all days this week
  const weeklyTotal = (goalLabel) =>
    Object.values(logs).reduce((sum, log) => sum + (Number(log.progress?.[goalLabel]) || 0), 0)

  const setGoalCount = async (dayKey, goalLabel, value) => {
    if (!entryId || value < 0) return
    const current = getDayLog(dayKey)
    await setDoc(doc(db, 'entries', entryId, 'dailyLogs', dayKey), {
      ...current,
      progress: { ...current.progress, [goalLabel]: value },
    })
  }

  const setGoalText = async (dayKey, goalLabel, value) => {
    if (!entryId) return
    const current = getDayLog(dayKey)
    await setDoc(doc(db, 'entries', entryId, 'dailyLogs', dayKey), {
      ...current,
      progress: { ...current.progress, [goalLabel]: value },
    })
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

  const dayHasActivity = (key) => {
    const log = logs[key]
    if (!log) return false
    return (log.notes?.length > 0) ||
      Object.values(log.progress || {}).some(v => v !== undefined && v !== '' && v !== 0)
  }

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
            <button
              key={key}
              onClick={() => setSelectedDay(key)}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                isSelected ? 'bg-white text-zinc-900 shadow-lg' :
                isToday ? 'bg-zinc-800 text-white ring-1 ring-emerald-500' :
                isFuture ? 'bg-zinc-900/50 text-zinc-700 cursor-default' :
                'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide">{DAY_LABELS[i]}</span>
              <span className="text-sm font-black">{day.getDate()}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${
                hasActivity ? (isSelected ? 'bg-emerald-500' : 'bg-emerald-400') : 'bg-transparent'
              }`} />
            </button>
          )
        })}
      </div>

      {/* Weekly progress summary — numeric goals only */}
      {resolvedGoals.some(g => g.target !== null) && (
        <div className="space-y-2">
          {resolvedGoals.filter(g => g.target !== null).map(({ label, target, unit }) => {
            const total = weeklyTotal(label)
            const pct = Math.min((total / target) * 100, 100)
            const remaining = Math.max(target - total, 0)
            const done = total >= target
            return (
              <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-400 truncate pr-2">{label}</span>
                  <span className={`text-xs font-black shrink-0 ${done ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {total}/{target} {unit}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-400' : 'bg-emerald-600'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {!done && (
                  <p className="text-[10px] text-zinc-600">{remaining} {unit} left this week</p>
                )}
                {done && (
                  <p className="text-[10px] text-emerald-500 font-semibold">Goal reached! 🎉</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Selected day panel */}
      {selectedDate && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
          <p className="text-sm font-bold text-zinc-300">
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            {dateKey(selectedDate) === todayKey && (
              <span className="ml-2 text-xs text-emerald-400 font-semibold">Today</span>
            )}
          </p>

          {/* Goals */}
          {resolvedGoals.length > 0 && (
            <div className="space-y-3">
              {resolvedGoals.map(({ label, target, unit }) => {
                const savedVal = selectedLog.progress?.[label]

                return (
                  <div key={label}>
                    <p className="text-xs text-zinc-500 mb-1.5 truncate">{label}</p>

                    {target !== null ? (
                      /* Numeric counter */
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setGoalCount(selectedDay, label, Math.max((Number(savedVal) || 0) - 1, 0))}
                          className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <div className="flex-1 flex items-center justify-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={Number(savedVal) || 0}
                            onChange={e => setGoalCount(selectedDay, label, Math.max(Number(e.target.value) || 0, 0))}
                            className="w-16 bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-2 text-center text-lg font-black text-white focus:outline-none focus:border-emerald-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-sm text-zinc-500">{unit}</span>
                        </div>
                        <button
                          onClick={() => setGoalCount(selectedDay, label, (Number(savedVal) || 0) + 1)}
                          className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    ) : (
                      /* Text input for non-numeric goals */
                      <input
                        type="text"
                        placeholder="Did you do it? Add a note..."
                        value={savedVal || ''}
                        onChange={e => setGoalText(selectedDay, label, e.target.value)}
                        onBlur={e => setGoalText(selectedDay, label, e.target.value)}
                        className={`w-full bg-zinc-800 border rounded-xl px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none transition-colors ${
                          savedVal ? 'border-emerald-800/50 text-emerald-300 focus:border-emerald-500' : 'border-zinc-700 text-zinc-200 focus:border-emerald-500'
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {resolvedGoals.length > 0 && <div className="border-t border-zinc-800" />}

          {/* Extra notes */}
          {selectedLog.notes?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-600 uppercase tracking-wider">Extra notes</p>
              {selectedLog.notes.map((note, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                  <span className="text-emerald-500 mt-0.5 shrink-0">→</span>
                  <span>{note}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Anything else to note..."
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addNote(selectedDay)}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              onClick={() => addNote(selectedDay)}
              disabled={saving || !noteInput.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl px-3 transition-colors"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
