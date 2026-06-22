import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentWeekId, formatWeekLabel } from '../utils'
import { Check } from 'lucide-react'

const PENALTY = 15
const PAYMENTS_DOC = doc(db, 'config', 'payments')

function PotVisual({ total, paid, owed }) {
  // Fill = how much of owed has been collected. If nothing owed, empty.
  const fillPct = total > 0 ? Math.min((paid / total) * 100, 100) : 0
  const isEmpty = total === 0
  const allPaid = total > 0 && owed === 0

  return (
    <div className="flex flex-col items-center py-6 select-none">
      {/* Amount above pot */}
      <div className="text-center mb-4">
        <p className="text-6xl font-black text-zinc-900 dark:text-white tracking-tight">${total}</p>
        <p className="text-sm text-zinc-500 mt-1">
          {isEmpty ? 'pot is empty — keep it up! 💪' : allPaid ? 'all collected — time to hang! 🎉' : `$${paid} collected · $${owed} still owed`}
        </p>
      </div>

      {/* The pot */}
      <div className="relative w-52 h-48">
        {/* Pot body SVG */}
        <svg viewBox="0 0 200 180" className="absolute inset-0 w-full h-full" style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.25))' }}>
          {/* Pot rim */}
          <ellipse cx="100" cy="48" rx="80" ry="16" fill="#27272a" />
          <ellipse cx="100" cy="46" rx="72" ry="12" fill="#3f3f46" />

          {/* Pot body clip */}
          <defs>
            <clipPath id="potClip">
              <path d="M30 54 Q28 160 100 168 Q172 160 170 54 Z" />
            </clipPath>
            {/* Wave shape */}
          </defs>

          {/* Pot body */}
          <path d="M30 54 Q28 160 100 168 Q172 160 170 54 Z" fill="#18181b" />

          {/* Cash fill */}
          {!isEmpty && (() => {
            const fillLine = 168 - (114 * fillPct / 100)
            // rows of 💵 scattered at different x/rotation, bottom to top
            const bills = [
              { x: 50,  y: 162, r: -8  },
              { x: 105, y: 160, r:  6  },
              { x: 148, y: 163, r: -4  },
              { x: 72,  y: 149, r: 12  },
              { x: 128, y: 147, r: -10 },
              { x: 95,  y: 151, r:  3  },
              { x: 48,  y: 137, r: -6  },
              { x: 148, y: 135, r:  9  },
              { x: 100, y: 139, r: -14 },
              { x: 68,  y: 125, r:  7  },
              { x: 132, y: 123, r: -5  },
              { x: 95,  y: 127, r: 11  },
              { x: 52,  y: 113, r: -9  },
              { x: 148, y: 111, r:  6  },
              { x: 100, y: 115, r: -3  },
              { x: 72,  y: 101, r: 13  },
              { x: 128, y:  99, r: -8  },
              { x: 96,  y: 103, r:  4  },
              { x: 50,  y:  89, r: -11 },
              { x: 148, y:  87, r:  7  },
              { x: 100, y:  91, r: -5  },
              { x: 68,  y:  77, r:  9  },
              { x: 132, y:  75, r: -12 },
              { x: 96,  y:  79, r:  3  },
            ]
            return (
              <g clipPath="url(#potClip)">
                {/* dark base */}
                <rect x="0" y="54" width="200" height="120" fill="#18181b" />
                {/* cash emoji rows */}
                {bills.map((b, i) => (
                  <text key={i} x={b.x} y={b.y}
                    textAnchor="middle" fontSize="18"
                    transform={`rotate(${b.r}, ${b.x}, ${b.y})`}
                    style={{ userSelect: 'none' }}>
                    💵
                  </text>
                ))}
                {/* dark mask covering above the fill line */}
                <rect x="0" y="54" width="200" height={Math.max(0, fillLine - 54)} fill="#18181b" />
              </g>
            )
          })()}

          {/* Pot rim overlay */}
          <ellipse cx="100" cy="54" rx="70" ry="11" fill="none" stroke="#3f3f46" strokeWidth="2" />

          {/* Handles */}
          <path d="M30 80 Q10 80 10 100 Q10 120 30 118" fill="none" stroke="#27272a" strokeWidth="10" strokeLinecap="round" />
          <path d="M170 80 Q190 80 190 100 Q190 120 170 118" fill="none" stroke="#27272a" strokeWidth="10" strokeLinecap="round" />
          <path d="M30 80 Q10 80 10 100 Q10 120 30 118" fill="none" stroke="#3f3f46" strokeWidth="6" strokeLinecap="round" />
          <path d="M170 80 Q190 80 190 100 Q190 120 170 118" fill="none" stroke="#3f3f46" strokeWidth="6" strokeLinecap="round" />
        </svg>

        {/* Overflow coins when all paid */}
        {allPaid && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex gap-2">
            {['🪙','💰','🪙'].map((e, i) => (
              <div key={i} className="text-xl" style={{
                animation: `float ${1.3 + i * 0.5}s ease-in-out infinite ${i * 0.4}s`,
              }}>{e}</div>
            ))}
          </div>
        )}
        {/* Steam when getting full */}
        {!allPaid && fillPct >= 60 && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex gap-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="text-lg opacity-60" style={{
                animation: `float ${1.5 + i * 0.4}s ease-in-out infinite ${i * 0.3}s`,
              }}>💨</div>
            ))}
          </div>
        )}
      </div>

      {/* Progress bar — paid vs owed */}
      {total > 0 && (
        <div className="w-full max-w-xs mt-4 space-y-1.5">
          <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${fillPct}%`,
                background: allPaid ? '#10b981' : fillPct >= 60 ? '#f59e0b' : '#3b82f6',
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>${paid} collected</span>
            <span>${total} total owed · no limit 🔥</span>
          </div>
        </div>
      )}

      {/* Stats */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-2 w-full mt-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-3 text-center">
            <p className="text-lg font-black text-zinc-900 dark:text-white">${total}</p>
            <p className="text-[10px] text-zinc-500 font-medium">owed total</p>
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

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); opacity: 0.6; }
          50% { transform: translateY(-8px); opacity: 0.3; }
        }
      `}</style>

      {/* The Pot visual */}
      <PotVisual total={total} paid={paid} owed={owed} />

      {/* Hall of shame */}
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
                      {stillOwes < totalOwed && (
                        <p className="text-[10px] text-emerald-400">${paidAmount} paid</p>
                      )}
                    </div>
                  </div>
                  {p.weeks.length >= 1 && (
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
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* By week */}
      {weeksSorted.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-3">By week</p>
          <div className="space-y-2">
            {weeksSorted.map(weekId => (
              <div key={weekId} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-500">{formatWeekLabel(weekId)}</p>
                  <span className="text-xs font-bold text-red-400">−${byWeek[weekId].length * PENALTY}</span>
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
