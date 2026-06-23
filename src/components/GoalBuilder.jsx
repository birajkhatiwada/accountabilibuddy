import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'

const EMPTY_GOAL = () => ({ text: '', type: 'habit', target: '', unit: '', subGoals: [] })
const EMPTY_SUB  = () => ({ text: '', target: '', unit: '' })

const ACCENT = ['#8b5cf6','#3b82f6','#10b981','#f97316','#ec4899','#14b8a6','#f59e0b','#6366f1']

const UNIT_GROUPS = [
  { label: '🏃 Fitness',  units: ['reps','sets','miles','km','meters','steps','lbs','kg','calories'] },
  { label: '📚 Learning', units: ['pages','chapters','books','problems','lessons','videos'] },
  { label: '⏱ Time',     units: ['min','hrs','days','sessions','rounds','pomodoros'] },
  { label: '🎯 General',  units: ['times','cups','glasses','meals','tasks','entries'] },
]

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

function UnitSelect({ value, onChange, accent }) {
  const allUnits = UNIT_GROUPS.flatMap(g => g.units)
  const isCustom = value && !allUnits.includes(value)
  return (
    <div className="flex gap-2 items-center">
      <select
        value={isCustom ? '__custom__' : (value || '')}
        onChange={e => e.target.value !== '__custom__' && onChange(e.target.value)}
        className="flex-1 bg-zinc-100 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all appearance-none cursor-pointer"
        style={{ color: value && !isCustom ? accent : undefined }}>
        <option value="">pick a unit…</option>
        {UNIT_GROUPS.map(g => (
          <optgroup key={g.label} label={g.label}>
            {g.units.map(u => <option key={u} value={u}>{u}</option>)}
          </optgroup>
        ))}
        <optgroup label="✏️ Custom">
          <option value="__custom__">type my own…</option>
        </optgroup>
      </select>
      {isCustom && (
        <input type="text" placeholder="unit"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-20 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
          style={{ color: accent }}
          autoFocus
        />
      )}
      {value && (
        <button type="button" onClick={() => onChange('')}
          className="text-zinc-300 dark:text-zinc-600 hover:text-red-400 transition-colors text-xs shrink-0">✕</button>
      )}
    </div>
  )
}

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

              {/* Weekly: stepper + unit grid */}
              {goal.type === 'weekly' && goal.subGoals.length === 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shrink-0">
                      <button type="button"
                        onClick={() => update(i, { target: String(Math.max(1, (Number(goal.target) || 0) - 1)) })}
                        className="px-3 py-1.5 text-base font-bold text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors select-none">
                        −
                      </button>
                      <span className="px-3 py-1.5 text-sm font-black min-w-[2.5rem] text-center tabular-nums"
                        style={{ color: goal.target ? accent : '#a1a1aa' }}>
                        {goal.target || '0'}
                      </span>
                      <button type="button"
                        onClick={() => update(i, { target: String((Number(goal.target) || 0) + 1) })}
                        className="px-3 py-1.5 text-base font-bold text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors select-none">
                        +
                      </button>
                    </div>
                    <UnitSelect value={goal.unit} onChange={u => update(i, { unit: u })} accent={accent} />
                </div>
              )}

              {/* Breakdowns */}
              {goal.type === 'weekly' && (
                <div className="space-y-2">
                  {goal.subGoals.map((sg, si) => (
                    <div key={si} className="bg-zinc-50 dark:bg-zinc-800/60 rounded-xl p-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-300 dark:text-zinc-600 text-xs shrink-0">↳</span>
                        <input type="text" placeholder="e.g. Hard problems"
                          value={sg.text}
                          onChange={e => updateSub(i, si, { text: e.target.value })}
                          className="flex-1 bg-transparent text-xs font-semibold text-zinc-700 dark:text-zinc-300 placeholder-zinc-300 dark:placeholder-zinc-600 focus:outline-none"
                        />
                        <div className="flex items-center rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 shrink-0">
                          <button type="button" onClick={() => updateSub(i, si, { target: String(Math.max(1, (Number(sg.target) || 0) - 1)) })}
                            className="px-2 py-1 text-xs font-bold text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors select-none">−</button>
                          <span className="px-2 py-1 text-xs font-black min-w-[1.5rem] text-center tabular-nums"
                            style={{ color: sg.target ? accent : '#a1a1aa' }}>{sg.target || '0'}</span>
                          <button type="button" onClick={() => updateSub(i, si, { target: String((Number(sg.target) || 0) + 1) })}
                            className="px-2 py-1 text-xs font-bold text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors select-none">+</button>
                        </div>
                        <button onClick={() => removeSub(i, si)}
                          className="text-zinc-200 dark:text-zinc-600 hover:text-red-400 transition-colors shrink-0">
                          <Trash2 size={11} />
                        </button>
                      </div>
                      <UnitSelect value={sg.unit} onChange={u => updateSub(i, si, { unit: u })} accent={accent} />
                    </div>
                  ))}
                  <button type="button" onClick={() => addSub(i)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 pl-2 transition-colors">
                    <Plus size={10} /> add breakdown
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}

      <button type="button" onClick={add}
        className="w-full py-3 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600 hover:border-emerald-400 hover:text-emerald-500 transition-all text-sm font-bold flex items-center justify-center gap-2 group">
        <span className="text-base group-hover:scale-125 transition-transform">+</span> Add another goal
      </button>
    </div>
  )
}
