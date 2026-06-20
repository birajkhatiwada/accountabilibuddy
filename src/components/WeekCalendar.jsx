import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentWeekId } from '../utils'
import { Send } from 'lucide-react'

function getWeekDays(weekId) {
  const base = new Date(weekId + 'T00:00:00')
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    return d
  })
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
  const [logs, setLogs] = useState({})
  // progressInputs: { [goal]: string } — local state while typing
  const [progressInputs, setProgressInputs] = useState({})
  const [noteInput, setNoteInput] = useState('')
  const [saving, setSaving] = useState(false)

  const goalItems = parseGoals(goals || '')

  useEffect(() => {
    if (!entryId) return
    const unsub = onSnapshot(collection(db, 'entries', entryId, 'dailyLogs'), (snap) => {
      const data = {}
      snap.docs.forEach(d => { data[d.id] = d.data() })
      setLogs(data)
    })
    return unsub
  }, [entryId])

  // Reset local inputs when switching days
  useEffect(() => {
    setProgressInputs({})
    setNoteInput('')
  }, [selectedDay])

  const getDayLog = (key) => logs[key] || { progress: {}, notes: [] }

  const saveProgress = async (dayKey, goal, value) => {
    if (!entryId) return
    const current = getDayLog(dayKey)
    const updated = {
      ...current,
      progress: { ...current.progress, [goal]: value },
    }
    await setDoc(doc(db, 'entries', entryId, 'dailyLogs', dayKey), updated)
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
    return (log.notes?.length > 0) || Object.values(log.progress || {}).some(v => v?.trim())
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
              <span className={`w-1.5 h-1.5 rounded-full transition-all ${
                hasActivity ? (isSelected ? 'bg-emerald-500' : 'bg-emerald-400') : 'bg-transparent'
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
            {dateKey(selectedDate) === todayKey && (
              <span className="ml-2 text-xs text-emerald-400 font-semibold">Today</span>
            )}
          </p>

          {/* Goal progress inputs */}
          {goalItems.length > 0 && (
            <div className="space-y-3">
              {goalItems.map(goal => {
                const saved = selectedLog.progress?.[goal] || ''
                const localVal = progressInputs[goal] ?? saved
                const isDone = !!saved.trim()

                return (
                  <div key={goal} className="space-y-1.5">
                    {/* Goal label + done badge */}
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isDone ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                      <span className={`text-sm font-medium ${isDone ? 'text-zinc-300' : 'text-zinc-400'}`}>
                        {goal}
                      </span>
                      {isDone && (
                        <span className="ml-auto text-[10px] text-emerald-400 font-bold uppercase tracking-wide">✓ logged</span>
                      )}
                    </div>

                    {/* Progress input */}
                    <div className="flex gap-2 pl-4">
                      <input
                        type="text"
                        placeholder={`What did you do? (e.g. 15 pages, 30 min)`}
                        value={localVal}
                        onChange={e => setProgressInputs(p => ({ ...p, [goal]: e.target.value }))}
                        onBlur={() => {
                          if (localVal !== saved) saveProgress(selectedDay, goal, localVal)
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.target.blur()
                            saveProgress(selectedDay, goal, localVal)
                          }
                        }}
                        className={`flex-1 bg-zinc-800 border rounded-xl px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none transition-colors ${
                          isDone
                            ? 'border-emerald-800/50 text-emerald-300 focus:border-emerald-500'
                            : 'border-zinc-700 text-zinc-200 focus:border-emerald-500'
                        }`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Divider if there are both goals and notes */}
          {goalItems.length > 0 && (
            <div className="border-t border-zinc-800" />
          )}

          {/* Existing extra notes */}
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

          {/* Add extra note */}
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
