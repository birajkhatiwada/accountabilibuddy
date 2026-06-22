import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { formatWeekLabel } from '../utils'
import { ChevronDown, ChevronUp } from 'lucide-react'

const PENALTY = 15

export default function History() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'entries'), (snap) => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  // Group by week, exclude current week
  const today = new Date()
  const currentWeekStart = new Date(today)
  const day = today.getDay()
  currentWeekStart.setDate(today.getDate() + (day === 0 ? -6 : 1 - day))
  const currentWeekId = currentWeekStart.toISOString().split('T')[0]

  const byWeek = {}
  entries
    .filter(e => e.weekId !== currentWeekId)
    .forEach(e => {
      if (!byWeek[e.weekId]) byWeek[e.weekId] = []
      byWeek[e.weekId].push(e)
    })

  const weeks = Object.keys(byWeek).sort((a, b) => b.localeCompare(a))

  if (loading) return <div className="text-zinc-500 text-sm mt-16 text-center">Loading...</div>

  if (weeks.length === 0) return (
    <div className="text-center py-20 space-y-3">
      <p className="text-5xl">📅</p>
      <p className="font-semibold text-zinc-700 dark:text-zinc-300">No history yet</p>
      <p className="text-sm text-zinc-500">Past weeks will show up here</p>
    </div>
  )

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Past Weeks</h2>
      {weeks.map(weekId => {
        const weekEntries = byWeek[weekId]
        const failed = weekEntries.filter(e => e.status === 'failed')
        const completed = weekEntries.filter(e => e.status === 'completed')
        const active = weekEntries.filter(e => e.status === 'active')
        const potThisWeek = failed.length * PENALTY
        const isOpen = expanded[weekId]

        return (
          <div key={weekId} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpanded(p => ({ ...p, [weekId]: !p[weekId] }))}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <div className="flex-1">
                <p className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">{formatWeekLabel(weekId)}</p>
                <div className="flex gap-3 mt-1">
                  {completed.length > 0 && <span className="text-xs text-emerald-400">✓ {completed.length} passed</span>}
                  {failed.length > 0 && <span className="text-xs text-red-400">✗ {failed.length} failed</span>}
                  {active.length > 0 && <span className="text-xs text-zinc-500">? {active.length} unknown</span>}
                </div>
              </div>
              {potThisWeek > 0 && (
                <span className="text-sm font-bold text-red-400">${potThisWeek}</span>
              )}
              {isOpen ? <ChevronUp size={16} className="text-zinc-500 shrink-0" /> : <ChevronDown size={16} className="text-zinc-500 shrink-0" />}
            </button>

            {isOpen && (
              <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 pb-4 pt-3 space-y-2">
                {weekEntries.sort((a, b) => a.name.localeCompare(b.name)).map(e => (
                  <div key={e.id} className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0">
                      {e.status === 'completed' && '✅'}
                      {e.status === 'failed' && '❌'}
                      {e.status === 'active' && '❓'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{e.name}</p>
                      <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{e.goals}</p>
                      {e.updates?.length > 0 && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-600 mt-0.5">{e.updates.length} proof update{e.updates.length !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                    {e.status === 'failed' && (
                      <span className="text-xs text-red-400 font-semibold shrink-0">${PENALTY}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
