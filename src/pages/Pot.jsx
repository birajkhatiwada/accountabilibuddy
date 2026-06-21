import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, setDoc, onSnapshot as snap } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentWeekId, formatWeekLabel } from '../utils'
import { Check } from 'lucide-react'

const PENALTY = 15
const PAYMENTS_DOC = doc(db, 'config', 'payments')

export default function Pot() {
  const [allEntries, setAllEntries] = useState([])
  const [payments, setPayments] = useState({}) // { `${name}-${weekId}`: true }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'entries'), where('status', '==', 'failed'))
    return onSnapshot(q, snap => {
      setAllEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    return onSnapshot(PAYMENTS_DOC, snap => {
      if (snap.exists()) setPayments(snap.data() || {})
    })
  }, [])

  const togglePaid = async (name, weekId) => {
    const key = `${name}-${weekId}`
    const next = { ...payments, [key]: !payments[key] }
    await setDoc(PAYMENTS_DOC, next)
  }

  const total = allEntries.length * PENALTY
  const paid = allEntries.filter(e => payments[`${e.name}-${e.weekId}`]).length * PENALTY
  const owed = total - paid

  const byPerson = {}
  allEntries.forEach(e => {
    const key = e.nameLower || e.name.toLowerCase()
    if (!byPerson[key]) byPerson[key] = { name: e.name, weeks: [] }
    byPerson[key].weeks.push(e.weekId)
  })
  const leaderboard = Object.values(byPerson).sort((a, b) => b.weeks.length - a.weeks.length)

  const byWeek = {}
  allEntries.forEach(e => {
    if (!byWeek[e.weekId]) byWeek[e.weekId] = []
    byWeek[e.weekId].push(e)
  })
  const weeksSorted = Object.keys(byWeek).sort((a, b) => b.localeCompare(a))

  if (loading) return <div className="text-zinc-500 text-sm mt-8 text-center">Loading...</div>

  return (
    <div className="space-y-6">
      {/* Total */}
      <div className="bg-gradient-to-br from-emerald-900/40 to-zinc-900 border border-emerald-800/40 rounded-2xl p-6 text-center">
        <p className="text-xs text-emerald-400 uppercase tracking-widest font-medium mb-2">Total in the pot</p>
        <p className="text-6xl font-extrabold text-white tracking-tight">${total}</p>
        <p className="text-zinc-500 text-sm mt-2">
          {allEntries.length} failed week{allEntries.length !== 1 ? 's' : ''} × ${PENALTY}
        </p>

        {total > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="bg-zinc-900/60 rounded-xl py-2 px-3">
              <p className="text-xs text-zinc-500">Collected</p>
              <p className="text-lg font-black text-emerald-400">${paid}</p>
            </div>
            <div className="bg-zinc-900/60 rounded-xl py-2 px-3">
              <p className="text-xs text-zinc-500">Still owed</p>
              <p className={`text-lg font-black ${owed > 0 ? 'text-red-400' : 'text-zinc-500'}`}>${owed}</p>
            </div>
          </div>
        )}

        {total >= 50 && (
          <div className="mt-3 bg-emerald-900/40 border border-emerald-700/40 rounded-xl px-3 py-2 text-sm text-emerald-300">
            🎉 Time to plan the hangout?
          </div>
        )}
      </div>

      {/* Hall of shame with payment tracking */}
      {leaderboard.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-3">Hall of shame</p>
          <div className="space-y-2">
            {leaderboard.map((p, i) => {
              const totalOwed = p.weeks.length * PENALTY
              const paidAmount = p.weeks.filter(w => payments[`${p.name}-${w}`]).length * PENALTY
              const stillOwes = totalOwed - paidAmount
              return (
                <div key={p.name} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-600 font-bold w-5 text-right text-sm">{i + 1}</span>
                    <span className="flex-1 font-medium text-zinc-200">{p.name}</span>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-400">${totalOwed}</p>
                      {stillOwes < totalOwed && (
                        <p className="text-[10px] text-emerald-400">${paidAmount} paid</p>
                      )}
                    </div>
                  </div>
                  {p.weeks.length > 1 && (
                    <div className="flex flex-wrap gap-1 mt-2 pl-8">
                      {p.weeks.sort((a, b) => b.localeCompare(a)).map(w => {
                        const isPaid = !!payments[`${p.name}-${w}`]
                        return (
                          <button
                            key={w}
                            onClick={() => togglePaid(p.name, w)}
                            className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1 ${
                              isPaid
                                ? 'bg-emerald-950/50 border-emerald-700/50 text-emerald-400'
                                : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                            }`}
                          >
                            {isPaid && <Check size={8} />}
                            {formatWeekLabel(w)}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* By week with payment per person */}
      {weeksSorted.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-3">By week</p>
          <div className="space-y-2">
            {weeksSorted.map(weekId => (
              <div key={weekId} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-500">{formatWeekLabel(weekId)}</p>
                  <span className="text-xs font-bold text-red-400">−${byWeek[weekId].length * PENALTY}</span>
                </div>
                <div className="space-y-1">
                  {byWeek[weekId].map(e => {
                    const isPaid = !!payments[`${e.name}-${weekId}`]
                    return (
                      <button
                        key={e.id}
                        onClick={() => togglePaid(e.name, weekId)}
                        className={`w-full flex items-center justify-between rounded-lg px-3 py-1.5 transition-all ${
                          isPaid ? 'bg-emerald-950/30' : 'hover:bg-zinc-800/60'
                        }`}
                      >
                        <span className="text-sm text-zinc-300">{e.name}</span>
                        <span className={`text-[11px] font-bold flex items-center gap-1 ${isPaid ? 'text-emerald-400' : 'text-zinc-600'}`}>
                          {isPaid ? <><Check size={10} /> paid</> : `$${PENALTY} owed`}
                        </span>
                      </button>
                    )
                  })}
                </div>
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
