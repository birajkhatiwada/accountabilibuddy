import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { formatWeekLabel } from '../utils'
import { Check } from 'lucide-react'

const PENALTY = 15
const PAYMENTS_DOC = doc(db, 'config', 'payments')

function PotVisual({ total, paid, owed }) {
  const isEmpty = total === 0
  const allPaid = total > 0 && owed === 0
  const billCount = Math.min(Math.floor(total / 15), 12)

  return (
    <div className="flex flex-col items-center py-6 select-none">
      <div className="text-center mb-6">
        <p className="text-6xl font-black text-zinc-900 dark:text-white tracking-tight">${total}</p>
        <p className="text-sm text-zinc-500 mt-1">
          {isEmpty
            ? 'pot is empty — keep it up! 💪'
            : allPaid
            ? 'all collected — time to hang! 🎉'
            : `$${paid} collected · $${owed} still owed`}
        </p>
      </div>

      {/* Stacked bills pile */}
      {isEmpty ? (
        <div className="text-6xl opacity-30 mb-2">💸</div>
      ) : (
        <div className="relative mb-2" style={{ height: 40 + billCount * 7, width: 120 }}>
          {Array.from({ length: billCount }).map((_, i) => {
            const fromTop = billCount - 1 - i
            const wobble = (i % 3 === 0 ? -2 : i % 3 === 1 ? 1.5 : -0.5)
            return (
              <div key={i} style={{
                position: 'absolute',
                top: fromTop * 7,
                left: '50%',
                transform: `translateX(-50%) rotate(${wobble}deg)`,
                fontSize: 52,
                lineHeight: 1,
                filter: `brightness(${0.75 + (i / billCount) * 0.25})`,
                zIndex: i,
              }}>
                💵
              </div>
            )
          })}
        </div>
      )}

      {/* Stats */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-2 w-full mt-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-3 text-center">
            <p className="text-lg font-black text-zinc-900 dark:text-white">${total}</p>
            <p className="text-[10px] text-zinc-500 font-medium">total owed</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-3 text-center">
            <p className="text-lg font-black text-emerald-500">${paid}</p>
            <p className="text-[10px] text-zinc-500 font-medium">collected</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-3 text-center">
            <p className={`text-lg font-black ${owed > 0 ? 'text-red-400' : 'text-zinc-400'}`}>${owed}</p>
            <p className="text-[10px] text-zinc-500 font-medium">still owed</p>
          </div>
        </div>
      )}

      {allPaid && total > 0 && (
        <div className="mt-3 w-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700/40 rounded-xl px-4 py-2.5 text-center">
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-300">🎉 All collected — time to hang out!</p>
        </div>
      )}
    </div>
  )
}

export default function Pot() {
  const [allEntries, setAllEntries] = useState([])
  const [payments, setPayments] = useState({})
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
    await setDoc(PAYMENTS_DOC, { ...payments, [key]: !payments[key] })
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
      <PotVisual total={total} paid={paid} owed={owed} />

      {leaderboard.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-3">🏆 Hall of shame</p>
          <div className="space-y-2">
            {leaderboard.map((p, i) => {
              const totalOwed = p.weeks.length * PENALTY
              const paidAmount = p.weeks.filter(w => payments[`${p.name}-${w}`]).length * PENALTY
              const stillOwes = totalOwed - paidAmount
              return (
                <div key={p.name} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-400 dark:text-zinc-600 font-bold w-5 text-right text-sm">{i + 1}</span>
                    <span className="flex-1 font-medium text-zinc-800 dark:text-zinc-200">{p.name}</span>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-400">${totalOwed}</p>
                      {stillOwes < totalOwed && <p className="text-[10px] text-emerald-400">${paidAmount} paid</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2 pl-8">
                    {p.weeks.sort((a, b) => b.localeCompare(a)).map(w => {
                      const isPaid = !!payments[`${p.name}-${w}`]
                      return (
                        <button key={w} onClick={() => togglePaid(p.name, w)}
                          className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1 ${
                            isPaid
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700/50 text-emerald-600 dark:text-emerald-400'
                              : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400 dark:hover:border-zinc-500'
                          }`}>
                          {isPaid && <Check size={8} />}
                          {formatWeekLabel(w)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {weeksSorted.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-3">By week</p>
          <div className="space-y-2">
            {weeksSorted.map(weekId => (
              <div key={weekId} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-500">{formatWeekLabel(weekId)}</p>
                  <span className="text-xs font-bold text-red-400">-${byWeek[weekId].length * PENALTY}</span>
                </div>
                <div className="space-y-1">
                  {byWeek[weekId].map(e => {
                    const isPaid = !!payments[`${e.name}-${weekId}`]
                    return (
                      <button key={e.id} onClick={() => togglePaid(e.name, weekId)}
                        className={`w-full flex items-center justify-between rounded-lg px-3 py-1.5 transition-all ${
                          isPaid ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                        }`}>
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{e.name}</span>
                        <span className={`text-[11px] font-bold flex items-center gap-1 ${isPaid ? 'text-emerald-500 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-600'}`}>
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
        <div className="text-center py-4 text-zinc-500">
          <p className="text-sm">Everyone's on track — pot stays empty 💪</p>
        </div>
      )}
    </div>
  )
}
