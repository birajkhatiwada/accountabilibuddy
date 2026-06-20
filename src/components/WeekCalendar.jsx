import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentWeekId } from '../utils'
import { Plus, Send } from 'lucide-react'

function getWeekDays(weekId) {
  const days = []
  const base = new Date(weekId + 'T00:00:00')
  for (let i = 0; i < 7; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    days.push(d)
  }
  return days
}

function parseGoals(goalsText) {
  return goalsText
    .split('\n')
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
}

function dateKey(date) {
  return date.toISOString().split('T')[0]
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function WeekCalendar({ entryId, goals }) {
  const weekId = getCurrentWeekId()
  const days = getWeekDays(weekId)
  const todayKey = dateKey(new Date())

  const [selectedDay, setSelectedDay] = useState(todayKey)
  const [logs, setLogs] = useState({})       // { 'YYYY-MM-DD': { checks: {}, notes: [] } }
  const [noteInput, setNoteInput] = useState('')
  const [saving, setSaving] = useState(false)

  const goalItems = parseGoals(goals || '')

  // Load all daily logs for this entry
  useEffect(() => {
    if (!entryId) return
    const logsRef = collection(db, 'entries', entryId, 'dailyLogs')
    const unsub = onSnapshot(logsRef, (snap) => {
      const data = {}
      snap.docs.forEach(d => { data[d.id] = d.data() })
      setLogs(data)
    })
    return unsub
  }, [entryId])

  const getDayLog = (key) => logs[key] || { checks: {}, notes: [] }

  const toggleCheck = async (dayKey, goal) => {
    if (!entryId) return
    const current = getDayLog(dayKey)
    const updated = {
      ...current,
      checks: { ...current.checks, [goal]: !current.checks[goal] },
    }
    await setDoc(doc(db, 'entries', entryId, 'dailyLogs', dayKey), updated)
  }

  const addNote = async (dayKey) => {
    if (!noteInput.trim() || !entryId) return
    setSaving(true)
    const current = getDayLog(dayKey)
    const updated = {
      ...current,
      notes: [...(current.notes || []), noteInput.trim()],
    }
    await setDoc(doc(db, 'entries', entryId, 'dailyLogs', dayKey), updated)
    setNoteInput('')
    setSaving(false)
  }

  const dayHasActivity = (key) => {
    const log = logs[key]
    if (!log) return false
    return (log.notes?.length > 0) || Object.values(log.checks || {}).some(Boolean)
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
                isSelected
                  ? 'bg-white text-zinc-900 shadow-lg'
                  : isToday
                  ? 'bg-zinc-800 text-white ring-1 ring-emerald-500'
                  : isFuture
                  ? 'bg-zinc-900/50 text-zinc-700'
                  : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide">{DAY_LABELS[i]}</span>
              <span className="text-sm font-black">{day.getDate()}</span>
              {/* Activity dot */}
              <span className={`w-1.5 h-1.5 rounded-full transition-all ${
                hasActivity
                  ? isSelected ? 'bg-emerald-500' : 'bg-emerald-400'
                  : 'bg-transparent'
              }`} />
            </button>
          )
        })}
      </div>

      {/* Selected day panel */}
      {selectedDate && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
          <p className="text-sm font-bold text-zinc-300">
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            {dateKey(selectedDate) === todayKey && <span className="ml-2 text-xs text-emerald-400 font-semibold">Today</span>}
          </p>

          {/* Goal checkboxes */}
          {goalItems.length > 0 && (
            <div className="space-y-2">
              {goalItems.map(goal => {
                const checked = !!selectedLog.checks?.[goal]
                return (
                  <button
                    key={goal}
                    onClick={() => toggleCheck(selectedDay, goal)}
                    className="w-full flex items-center gap-3 text-left group"
                  >
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                      checked
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-zinc-600 group-hover:border-zinc-400'
                    }`}>
                      {checked && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    <span className={`text-sm transition-colors ${checked ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>
                      {goal}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Existing notes */}
          {selectedLog.notes?.length > 0 && (
            <div className="space-y-1.5">
              {selectedLog.notes.map((note, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                  <span className="text-emerald-500 mt-0.5 shrink-0">→</span>
                  <span>{note}</span>
                </div>
              ))}
            </div>
          )}

          {/* Add note */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a note... (ran 5k, read ch.3)"
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
