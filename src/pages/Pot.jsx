import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentWeekId, formatWeekLabel } from '../utils'
import { DollarSign, TrendingUp } from 'lucide-react'

const PENALTY = 15

export default function Pot() {
  const [allEntries, setAllEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'entries'), where('status', '==', 'failed'))
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setAllEntries(data)
      setLoading(false)
    })
    return unsub
  }, [])

  const total = allEntries.length * PENALTY

  // Group by person
  const byPerson = {}
  allEntries.forEach(e => {
    const key = e.nameLower || e.name.toLowerCase()
    if (!byPerson[key]) byPerson[key] = { name: e.name, count: 0 }
    byPerson[key].count++
  })
  const leaderboard = Object.values(byPerson).sort((a, b) => b.count - a.count)

  // Group by week
  const byWeek = {}
  allEntries.forEach(e => {
    if (!byWeek[e.weekId]) byWeek[e.weekId] = []
    byWeek[e.weekId].push(e.name)
  })
  const weeksSorted = Object.keys(byWeek).sort((a, b) => b.localeCompare(a))

  if (loading) {
    return <div className="text-zinc-500 text-sm mt-8 text-center">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Total */}
      <div className="bg-gradient-to-br from-emerald-900/40 to-zinc-900 border border-emerald-800/40 rounded-2xl p-6 text-center">
        <p className="text-xs text-emerald-400 uppercase tracking-widest font-medium mb-2">Total in the pot</p>
        <p className="text-6xl font-extrabold text-white tracking-tight">
          ${total}
        </p>
        <p className="text-zinc-500 text-sm mt-2">
          {allEntries.length} failed week{allEntries.length !== 1 ? 's' : ''} × ${PENALTY}
        </p>
        {total >= 50 && (
          <div className="mt-4 bg-emerald-900/40 border border-emerald-700/40 rounded-xl px-3 py-2 text-sm text-emerald-300">
            🎉 Time to plan the hangout?
          </div>
        )}
      </div>

      {/* Leaderboard (most failures) */}
      {leaderboard.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-3">Hall of shame</p>
          <div className="space-y-2">
            {leaderboard.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                <span className="text-zinc-600 font-bold w-5 text-right text-sm">{i + 1}</span>
                <span className="flex-1 font-medium text-zinc-200">{p.name}</span>
                <span className="text-sm text-red-400 font-semibold">${p.count * PENALTY}</span>
                <span className="text-xs text-zinc-600">{p.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By week */}
      {weeksSorted.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-3">By week</p>
          <div className="space-y-2">
            {weeksSorted.map(weekId => (
              <div key={weekId} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                <p className="text-xs text-zinc-500 mb-1">{formatWeekLabel(weekId)}</p>
                <p className="text-sm text-zinc-300">
                  {byWeek[weekId].join(', ')}
                  <span className="text-red-400 ml-2 font-medium">
                    −${byWeek[weekId].length * PENALTY}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {allEntries.length === 0 && (
        <div className="text-center py-12 text-zinc-600">
          <p className="text-4xl mb-3">💰</p>
          <p className="font-medium text-zinc-400">Pot is empty</p>
          <p className="text-sm mt-1">Everyone's on track — for now</p>
        </div>
      )}
    </div>
  )
}
