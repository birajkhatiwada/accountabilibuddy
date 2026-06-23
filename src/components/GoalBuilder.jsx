import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'

const EMPTY_GOAL = () => ({ text: '', type: 'habit', target: '', unit: '', subGoals: [] })
const EMPTY_SUB  = () => ({ text: '', target: '', unit: '' })

const ACCENT = ['#8b5cf6','#3b82f6','#10b981','#f97316','#ec4899','#14b8a6','#f59e0b','#6366f1']

const UNIT_CHIPS = ['times','pages','km','min','hrs','reps','lbs','sessions','chapters','cups']

const PLACEHOLDERS = [
  'e.g. Hit the gym 💪',
  'e.g. Read every night 📚',
  'e.g. No junk food 🥗',
  'e.g. Cold shower 🚿',
  'e.g. Meditate 🧘',
  'e.g. Code something 💻',
  'e.g. Go for a run 🏃',
  'e.g. Sleep by 11pm 😴',
]

export default function GoalBuilder({ onChange, initialGoals }) {
  const [goals, setGoals] = useState(() =>
    initialGoals?.length
      ? initialGoals.map(g => ({
          text: g.text || '',
          type: (g.type === 'count' || g.type === 'total') ? 'weekly' : (g.type || 'habit'),
          target: g.target || '', unit: g.unit || '',
          subGoals: g.subGoals || [],
        }))
      : [EMPTY_GOAL()]
  )

  const push = (next) => { setGoals(next); onChange(next) }
  const update = (i, patch) => push(goals.map((g, idx) => idx === i ? { ...g, ...patch } : g))
  const add    = () => push([...goals, EMPTY_GOAL()])
  const remove = (i) => push(goals.length > 1 ? goals.filter((_, idx) => idx !== i) : [EMPTY_GOAL()])

  const addSub    = (i) => update(i, { subGoals: [...(goals[i].subGoals || []), EMPTY_SUB()] })
  const removeSub = (i, si) => update(i, { subGoals: goals[i].subGoals.filter((_, idx) => idx !== si) })
  const updateSub = (i, si, patch) => update(i, {
    subGoals: goals[i].subGoals.map((sg, idx) => idx === si ? { ...sg, ...patch } : sg),
  })

  return (
    <div className="space-y-2.5">
      {goals.map((goal, i) => {
        const accent = ACCENT[i % ACCENT.length]
        const placeholder = PLACEHOLDERS[i % PLACEHOLDERS.length]
        return (
          <div key={i} className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            style={{ borderLeftColor: accent, borderLeftWidth: 3 }}>
            <div className="p-3 space-y-2.5">

              {/* Goal name */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={placeholder}
                  value={goal.text}
                  onChange={e => update(i, { text: e.target.value })}
                  className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-zinc-800 dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-600 focus:outline-none"
                />
                <button onClick={() => remove(i)}
                  className="text-zinc-200 dark:text-zinc-700 hover:text-red-400 transition-colors shrink-0 p-1">
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Type toggle */}
              <div className="flex gap-1.5">
                <button type="button" onClick={() => update(i, { type: 'habit', subGoals: [] })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    goal.type === 'habit'
                      ? 'text-white shadow-sm'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                  }`}
                  style={goal.type === 'habit' ? { background: accent } : {}}>
                  ✅ Daily habit
                </button>
                <button type="button" onClick={() => update(i, { type: 'weekly', subGoals: [] })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    goal.type === 'weekly'
                      ? 'text-white shadow-sm'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                  }`}
                  style={goal.type === 'weekly' ? { background: accent } : {}}>
                  🎯 Hit a number
                </button>
              </div>

              {/* Target + unit for weekly with no breakdowns */}
              {goal.type === 'weekly' && goal.subGoals.length === 0 && (
                <div className="space-y-2">
                  {/* Stepper + selected unit */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
                      <button type="button"
                        onClick={() => update(i, { target: String(Math.max(1, (Number(goal.target) || 0) - 1) )})}
                        className="px-3 py-1.5 text-base font-bold text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors select-none">
                        −
                      </button>
                      <span className="px-3 py-1.5 text-sm font-black text-zinc-800 dark:text-zinc-100 min-w-[2.5rem] text-center tabular-nums"
                        style={{ color: goal.target ? accent : undefined }}>
                        {goal.target || '0'}
                      </span>
                      <button type="button"
                        onClick={() => update(i, { target: String((Number(goal.target) || 0) + 1) })}
                        className="px-3 py-1.5 text-base font-bold text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors select-none">
                        +
                      </button>
                    </div>
                    {goal.unit
                      ? <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{goal.unit}
                          <button type="button" onClick={() => update(i, { unit: '' })} className="ml-1.5 text-zinc-300 dark:text-zinc-600 hover:text-red-400 transition-colors text-xs">✕</button>
                        </span>
                      : <span className="text-xs text-zinc-400 dark:text-zinc-600 italic">pick a unit →</span>
                    }
                  </div>
                  {/* Unit chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {UNIT_CHIPS.map(u => (
                      <button key={u} type="button"
                        onClick={() => update(i, { unit: goal.unit === u ? '' : u })}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          goal.unit === u
                            ? 'text-white shadow-sm'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                        }`}
                        style={goal.unit === u ? { background: accent } : {}}>
                        {u}
                      </button>
                    ))}
                    {/* Custom unit input */}
                    {!UNIT_CHIPS.includes(goal.unit) && (
                      <input type="text" placeholder="custom…"
                        value={UNIT_CHIPS.includes(goal.unit) ? '' : goal.unit}
                        onChange={e => update(i, { unit: e.target.value })}
                        className="px-2.5 py-1 rounded-lg text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 placeholder-zinc-300 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-20 transition-all"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Breakdowns */}
              {goal.type === 'weekly' && (
                <div className="space-y-1.5">
                  {goal.subGoals.map((sg, si) => (
                    <div key={si} className="flex gap-1.5 items-center pl-1">
                      <span className="text-zinc-300 dark:text-zinc-600 text-xs">↳</span>
                      <input type="text" placeholder="e.g. Hard problems"
                        value={sg.text}
                        onChange={e => updateSub(i, si, { text: e.target.value })}
                        className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                      />
                      <div className="flex items-center rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 shrink-0">
                        <button type="button" onClick={() => updateSub(i, si, { target: String(Math.max(1, (Number(sg.target) || 0) - 1)) })}
                          className="px-2 py-1 text-xs font-bold text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors select-none">−</button>
                        <span className="px-2 py-1 text-xs font-black text-zinc-800 dark:text-zinc-100 min-w-[1.5rem] text-center tabular-nums">{sg.target || '0'}</span>
                        <button type="button" onClick={() => updateSub(i, si, { target: String((Number(sg.target) || 0) + 1) })}
                          className="px-2 py-1 text-xs font-bold text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors select-none">+</button>
                      </div>
                      <input type="text" placeholder="unit"
                        value={sg.unit}
                        onChange={e => updateSub(i, si, { unit: e.target.value })}
                        className="w-14 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-1.5 py-1 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                      />
                      <button onClick={() => removeSub(i, si)} className="text-zinc-200 dark:text-zinc-700 hover:text-red-400 transition-colors shrink-0">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addSub(i)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 pl-4 transition-colors">
                    <Plus size={10} /> add breakdown
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Add goal button */}
      <button type="button" onClick={add}
        className="w-full py-3 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600 hover:border-emerald-400 hover:text-emerald-500 transition-all text-sm font-bold flex items-center justify-center gap-2 group">
        <span className="text-base group-hover:scale-125 transition-transform">+</span> Add another goal
      </button>
    </div>
  )
}
