import { useState, useEffect, useRef } from 'react'
import { collection, doc, onSnapshot, setDoc, updateDoc, increment } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'
import { getCurrentWeekId } from '../utils'
import { Send, Camera } from 'lucide-react'
import Picker from 'react-mobile-picker'

function getWeekDays(weekId) {
  const base = new Date(weekId + 'T00:00:00')
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    return d
  })
}

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
const REACTIONS = ['🔥', '💪', '👏', '❤️']

const NUM_RANGE = Array.from({ length: 201 }, (_, i) => i)

function NumPicker({ value, onChange, unit }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700"
      style={{ touchAction: 'none' }}
    >
      {/* selection highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-10 bg-zinc-200/60 dark:bg-zinc-700/60 border-y border-zinc-300 dark:border-zinc-600 z-10" />
      {/* fade top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-zinc-100 dark:from-zinc-800 to-transparent z-20" />
      {/* fade bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-zinc-100 dark:from-zinc-800 to-transparent z-20" />
      {/* unit label overlaid at center-right */}
      {unit && (
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 z-30">
          <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">{unit}</span>
        </div>
      )}
      <Picker
        value={{ n: value }}
        onChange={(v) => onChange(v.n)}
        height={120}
        itemHeight={40}
        wheelMode="natural"
      >
        <Picker.Column name="n">
          {NUM_RANGE.map(n => (
            <Picker.Item key={n} value={n}>
              {({ selected }) => (
                <span className={`text-xl font-black transition-all ${selected ? 'text-zinc-900 dark:text-white scale-110' : 'text-zinc-400 dark:text-zinc-600'}`}>
                  {n}
                </span>
              )}
            </Picker.Item>
          ))}
        </Picker.Column>
      </Picker>
    </div>
  )
}

function Checkmark({ checked }) {
  return (
    <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
      checked ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-300 dark:border-zinc-600'
    }`}>
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </span>
  )
}

export default function WeekCalendar({ entryId, goalItems, goals }) {
  const weekId = getCurrentWeekId()
  const days = getWeekDays(weekId)
  const todayKey = dateKey(new Date())

  const [selectedDay, setSelectedDay] = useState(todayKey)
  const [logs, setLogs] = useState({})
  const [noteInput, setNoteInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [localTotals, setLocalTotals] = useState({})
  const [localCounts, setLocalCounts] = useState({})
  const saveTimers = useRef({})
  const fileInputRef = useRef(null)

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

  useEffect(() => {
    setNoteInput('')
  }, [selectedDay])

  const getDayLog = (key) => logs[key] || {}

  const patchDay = async (dayKey, patch) => {
    if (!entryId) return
    const current = getDayLog(dayKey)
    await setDoc(doc(db, 'entries', entryId, 'dailyLogs', dayKey), { ...current, ...patch })
  }

  // ── per-goal helpers ──────────────────────────────────────────────────────

  const toggleHabit = (dayKey, goalText) => {
    const current = getDayLog(dayKey)
    const habits = { ...(current.habits || {}) }
    habits[goalText] = !habits[goalText]
    patchDay(dayKey, { habits })
  }

  const adjustCount = (dayKey, goalText, delta) => {
    if (!entryId) return
    const localKey = `${dayKey}__count__${goalText}`
    const firestoreVal = logs[dayKey]?.counts?.[goalText] || 0
    const currentVal = localCounts[localKey] ?? firestoreVal
    const newVal = Math.max(currentVal + delta, 0)
    setLocalCounts(p => ({ ...p, [localKey]: newVal }))

    clearTimeout(saveTimers.current[localKey])
    saveTimers.current[localKey] = setTimeout(async () => {
      const current = getDayLog(dayKey)
      await setDoc(doc(db, 'entries', entryId, 'dailyLogs', dayKey), {
        ...current,
        counts: { ...(current.counts || {}), [goalText]: newVal },
      })
    }, 400)
  }

  const setCountFromInput = (dayKey, goalText, value) => {
    if (!entryId) return
    const localKey = `${dayKey}__count__${goalText}`
    const newVal = Math.max(Number(value) || 0, 0)
    setLocalCounts(p => ({ ...p, [localKey]: newVal }))
    clearTimeout(saveTimers.current[localKey])
    saveTimers.current[localKey] = setTimeout(async () => {
      const current = getDayLog(dayKey)
      await setDoc(doc(db, 'entries', entryId, 'dailyLogs', dayKey), {
        ...current,
        counts: { ...(current.counts || {}), [goalText]: newVal },
      })
    }, 400)
  }

  const adjustTotal = (dayKey, goalText, delta) => {
    const firestoreVal = logs[dayKey]?.totals?.[goalText] || 0
    const localKey = `${dayKey}__${goalText}`
    const currentLocal = localTotals[localKey] ?? firestoreVal
    const newVal = Math.max(currentLocal + delta, 0)
    setLocalTotals(p => ({ ...p, [localKey]: newVal }))

    clearTimeout(saveTimers.current[localKey])
    saveTimers.current[localKey] = setTimeout(async () => {
      const current = getDayLog(dayKey)
      await setDoc(doc(db, 'entries', entryId, 'dailyLogs', dayKey), {
        ...current,
        totals: { ...(current.totals || {}), [goalText]: newVal },
      })
    }, 400)
  }

  const setTotalFromInput = (dayKey, goalText, value) => {
    const newVal = Math.max(Number(value) || 0, 0)
    const localKey = `${dayKey}__${goalText}`
    setLocalTotals(p => ({ ...p, [localKey]: newVal }))
    clearTimeout(saveTimers.current[localKey])
    saveTimers.current[localKey] = setTimeout(async () => {
      const current = getDayLog(dayKey)
      await setDoc(doc(db, 'entries', entryId, 'dailyLogs', dayKey), {
        ...current,
        totals: { ...(current.totals || {}), [goalText]: newVal },
      })
    }, 400)
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

  const addReaction = async (dayKey, emoji) => {
    if (!entryId) return
    const current = getDayLog(dayKey)
    const reactions = { ...(current.reactions || {}) }
    reactions[emoji] = (reactions[emoji] || 0) + 1
    await patchDay(dayKey, { reactions })
  }

  const uploadPhoto = async (dayKey, file) => {
    if (!entryId || !file) return
    setUploading(true)
    try {
      const path = `photos/${entryId}/${dayKey}/${Date.now()}_${file.name}`
      const snap = await uploadBytes(storageRef(storage, path), file)
      const url = await getDownloadURL(snap.ref)
      const current = getDayLog(dayKey)
      await setDoc(doc(db, 'entries', entryId, 'dailyLogs', dayKey), {
        ...current,
        photos: [...(current.photos || []), url],
      })
    } catch (e) {
      console.error('Upload failed:', e)
    }
    setUploading(false)
  }

  // ── activity detection ────────────────────────────────────────────────────

  const dayHasActivity = (key) => {
    const log = logs[key]
    if (!log) return false
    return (
      (log.notes?.length > 0) ||
      (log.photos?.length > 0) ||
      Object.values(log.habits || {}).some(Boolean) ||
      Object.values(log.totals || {}).some(v => v > 0) ||
      Object.values(log.counts || {}).some(v => v > 0)
    )
  }

  // ── weekly summaries ──────────────────────────────────────────────────────

  const habitDaysCount = (goalText) =>
    Object.values(logs).filter(l => l.habits?.[goalText]).length

  const weeklyCountValue = (goalText) =>
    days.reduce((sum, day) => {
      const key = dateKey(day)
      const localKey = `${key}__count__${goalText}`
      const val = localCounts[localKey] ?? (Number(logs[key]?.counts?.[goalText]) || 0)
      return sum + val
    }, 0)

  const weeklyTotalValue = (goalText) =>
    days.reduce((sum, day) => {
      const key = dateKey(day)
      const localKey = `${key}__${goalText}`
      const val = localTotals[localKey] ?? (Number(logs[key]?.totals?.[goalText]) || 0)
      return sum + val
    }, 0)

  // sub-goal count uses "goalText::subGoalText" as the counts key
  const subGoalKey = (goalText, subText) => `${goalText}::${subText}`

  const weeklySubCount = (goalText, subText) => {
    const k = subGoalKey(goalText, subText)
    return days.reduce((sum, day) => {
      const dayK = dateKey(day)
      const localKey = `${dayK}__count__${k}`
      const val = localCounts[localKey] ?? (Number(logs[dayK]?.counts?.[k]) || 0)
      return sum + val
    }, 0)
  }

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
                isSelected ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg' :
                isToday ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white ring-1 ring-emerald-500' :
                isFuture ? 'bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-400 dark:text-zinc-700 cursor-default' :
                'bg-zinc-100/60 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
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
          {resolvedGoals.map((goal) => {
            const { text, type, target, unit, subGoals = [] } = goal
            if (type === 'habit') {
              const done = habitDaysCount(text)
              return (
                <div key={text} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{text}</span>
                  <div className="flex gap-0.5 shrink-0">
                    {days.map((d, i) => {
                      const k = dateKey(d)
                      const checked = !!logs[k]?.habits?.[text]
                      return <span key={i} className={`w-3 h-3 rounded-sm ${checked ? 'bg-emerald-500' : 'bg-zinc-100 dark:bg-zinc-800'}`} />
                    })}
                  </div>
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 shrink-0">{done}/7</span>
                </div>
              )
            }

            if (subGoals.length > 0) {
              // Render each sub-goal as its own mini row
              const allDone = subGoals.every(sg => {
                const val = type === 'total' ? weeklyTotalValue(subGoalKey(text, sg.text)) : weeklySubCount(text, sg.text)
                return Number(sg.target) > 0 ? val >= Number(sg.target) : val > 0
              })
              return (
                <div key={text} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{text}</span>
                    {allDone && <span className="text-[10px] text-emerald-400 font-bold">🎉 All done!</span>}
                  </div>
                  {subGoals.map(sg => {
                    const val = type === 'total'
                      ? weeklyTotalValue(subGoalKey(text, sg.text))
                      : weeklySubCount(text, sg.text)
                    const tgt = Number(sg.target) || 0
                    const pct = tgt ? Math.min((val / tgt) * 100, 100) : 0
                    const done = tgt ? val >= tgt : false
                    return (
                      <div key={sg.text} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{sg.text}</span>
                          <span className={`text-[11px] font-bold ${done ? 'text-emerald-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                            {val}{tgt ? `/${tgt}` : ''}{sg.unit ? ` ${sg.unit}` : ''}
                          </span>
                        </div>
                        {tgt > 0 && (
                          <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-400' : 'bg-emerald-600'}`} style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            }

            if (type === 'count') {
              const val = weeklyCountValue(text)
              const tgt = Number(target) || 0
              const pct = tgt ? Math.min((val / tgt) * 100, 100) : 0
              return (
                <div key={text} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate pr-2">{text}</span>
                    <span className={`text-xs font-black shrink-0 ${val >= tgt && tgt ? 'text-emerald-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                      {val}{tgt ? `/${tgt}` : ''} {unit || 'times'}
                    </span>
                  </div>
                  {tgt > 0 && <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
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
                <div key={text} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate pr-2">{text}</span>
                    <span className={`text-xs font-black shrink-0 ${val >= tgt && tgt ? 'text-emerald-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                      {val}{tgt ? `/${tgt}` : ''} {unit}
                    </span>
                  </div>
                  {tgt > 0 && <>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${val >= tgt ? 'bg-emerald-400' : 'bg-emerald-600'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-600">{val >= tgt ? '🎉 Goal reached!' : `${remaining} ${unit} left`}</p>
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
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-4">
          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            {dateKey(selectedDate) === todayKey && <span className="ml-2 text-xs text-emerald-400 font-semibold">Today</span>}
          </p>

          {/* Goal inputs */}
          {resolvedGoals.length > 0 && (
            <div className="space-y-4">
              {resolvedGoals.map((goal) => {
                const { text, type, target, unit, subGoals = [] } = goal

                if (type === 'habit') {
                  const checked = !!selectedLog.habits?.[text]
                  return (
                    <button key={text} onClick={() => toggleHabit(selectedDay, text)}
                      className="w-full flex items-center gap-3 text-left group rounded-xl">
                      <Checkmark checked={checked} />
                      <span className={`text-sm transition-colors ${checked ? 'text-zinc-400 dark:text-zinc-500 line-through' : 'text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white'}`}>
                        {text}
                      </span>
                      {checked && <span className="ml-auto text-[10px] text-emerald-400 font-bold">✓ done</span>}
                    </button>
                  )
                }

                // Sub-goals: show a picker per breakdown
                if (subGoals.length > 0) {
                  return (
                    <div key={text} className="space-y-3">
                      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">{text}</p>
                      {subGoals.map(sg => {
                        const k = subGoalKey(text, sg.text)
                        const localKey = `${selectedDay}__count__${k}`
                        const val = localCounts[localKey] ?? (logs[selectedDay]?.counts?.[k] || 0)
                        return (
                          <div key={sg.text} className="space-y-1">
                            <p className="text-[11px] text-zinc-500">{sg.text}{sg.target ? ` — ${sg.target}${sg.unit ? ' ' + sg.unit : ''} goal` : ''}</p>
                            <NumPicker value={val} unit={sg.unit} onChange={v => {
                              setLocalCounts(p => ({ ...p, [localKey]: v }))
                              clearTimeout(saveTimers.current[localKey])
                              saveTimers.current[localKey] = setTimeout(async () => {
                                const current = getDayLog(selectedDay)
                                await setDoc(doc(db, 'entries', entryId, 'dailyLogs', selectedDay), {
                                  ...current,
                                  counts: { ...(current.counts || {}), [k]: v },
                                })
                              }, 300)
                            }} />
                          </div>
                        )
                      })}
                    </div>
                  )
                }

                if (type === 'count') {
                  const localKey = `${selectedDay}__count__${text}`
                  const val = localCounts[localKey] ?? (logs[selectedDay]?.counts?.[text] || 0)
                  return (
                    <div key={text} className="space-y-1.5">
                      <p className="text-xs text-zinc-500">{text} — how many today?</p>
                      <NumPicker value={val} unit={unit} onChange={v => {
                        setLocalCounts(p => ({ ...p, [localKey]: v }))
                        clearTimeout(saveTimers.current[localKey])
                        saveTimers.current[localKey] = setTimeout(async () => {
                          const current = getDayLog(selectedDay)
                          await setDoc(doc(db, 'entries', entryId, 'dailyLogs', selectedDay), { ...current, counts: { ...(current.counts || {}), [text]: v } })
                        }, 300)
                      }} />
                    </div>
                  )
                }

                if (type === 'total') {
                  const localKey = `${selectedDay}__${text}`
                  const firestoreVal = selectedLog.totals?.[text] || 0
                  const val = localTotals[localKey] ?? firestoreVal
                  return (
                    <div key={text} className="space-y-1.5">
                      <p className="text-xs text-zinc-500">{text} — how much today?</p>
                      <NumPicker value={val} unit={unit} onChange={v => {
                        setLocalTotals(p => ({ ...p, [localKey]: v }))
                        clearTimeout(saveTimers.current[localKey])
                        saveTimers.current[localKey] = setTimeout(async () => {
                          const current = getDayLog(selectedDay)
                          await setDoc(doc(db, 'entries', entryId, 'dailyLogs', selectedDay), { ...current, totals: { ...(current.totals || {}), [text]: v } })
                        }, 300)
                      }} />
                    </div>
                  )
                }
                return null
              })}
            </div>
          )}

          <div className="border-t border-zinc-200 dark:border-zinc-800" />

          {/* Reactions */}
          <div className="space-y-1.5">
            <p className="text-xs text-zinc-500 dark:text-zinc-600 uppercase tracking-wider">Cheer</p>
            <div className="flex gap-2">
              {REACTIONS.map(emoji => {
                const count = selectedLog.reactions?.[emoji] || 0
                return (
                  <button key={emoji} onClick={() => addReaction(selectedDay, emoji)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all active:scale-95 ${
                      count > 0
                        ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}>
                    <span className="text-base leading-none">{emoji}</span>
                    {count > 0 && <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{count}</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800" />

          {/* Notes */}
          {selectedLog.notes?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-500 dark:text-zinc-600 uppercase tracking-wider">Notes</p>
              {selectedLog.notes.map((note, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-zinc-500 dark:text-zinc-400">
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
              className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button onClick={() => addNote(selectedDay)} disabled={saving || !noteInput.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl px-3 transition-colors">
              <Send size={15} />
            </button>
          </div>

          {/* Photo uploads */}
          {selectedLog.photos?.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {selectedLog.photos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt="" className="w-full aspect-square object-cover rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors" />
                </a>
              ))}
            </div>
          )}

          <input type="file" accept="image/*" ref={fileInputRef} className="hidden"
            onChange={e => { if (e.target.files[0]) uploadPhoto(selectedDay, e.target.files[0]); e.target.value = '' }}
          />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors text-sm disabled:opacity-40">
            <Camera size={14} />
            {uploading ? 'Uploading...' : 'Add photo proof'}
          </button>
        </div>
      )}
    </div>
  )
}
