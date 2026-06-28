import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'

const EMPTY_GOAL = () => ({ text: '', type: 'habit', target: '', unit: '', subGoals: [] })
const EMPTY_SUB  = () => ({ text: '', target: '', unit: '' })

const UNIT_SUGGESTIONS = ['reps','sets','miles','km','min','hrs','pages','times','steps','calories','lbs','kg','cups','meals','sessions']

const PLACEHOLDERS = [
  'Hit the gym',
  'Read every day',
  'No junk food',
  'Cold shower',
  'Meditate',
  'Code something',
  'Go for a run',
  'Sleep by 11pm',
]

function UnitPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const matches = query
    ? UNIT_SUGGESTIONS.filter(u => u.includes(query.toLowerCase()))
    : UNIT_SUGGESTIONS

  return (
    <div className="relative">
      {value ? (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-zinc-800 rounded-lg">
          <span className="text-xs font-semibold text-zinc-300">{value}</span>
          <button type="button" onClick={() => { onChange(''); setQuery('') }}
            className="text-zinc-500 hover:text-red-400 transition-colors text-xs leading-none ml-0.5">✕</button>
        </div>
      ) : (
        <input
          type="text"
          placeholder="unit…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={e => {
            if (e.key === 'Enter' && query.trim()) { onChange(query.trim()); setQuery(''); setOpen(false) }
          }}
          style={{ fontSize: 16 }}
          className="w-24 px-2 py-0.5 bg-zinc-800 rounded-lg text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        />
      )}
      {open && !value && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden min-w-[180px]">
          <div className="flex flex-wrap gap-1 p-2">
            {matches.slice(0, 10).map(u => (
              <button key={u} type="button" onMouseDown={() => { onChange(u); setQuery(''); setOpen(false) }}
                className="px-2 py-0.5 rounded-md bg-zinc-800 text-[11px] font-medium text-zinc-400 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors">
                {u}
              </button>
            ))}
          </div>
        </div>
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
    <div className="space-y-0">
      <div className="divide-y divide-zinc-800">
        {goals.map((goal, i) => (
          <div key={i} className="py-3 space-y-2.5">

            {/* Name row */}
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-bold text-zinc-700 w-4 text-center shrink-0 tabular-nums">{i + 1}</span>
              <input
                type="text"
                placeholder={PLACEHOLDERS[i % PLACEHOLDERS.length]}
                value={goal.text}
                onChange={e => update(i, { text: e.target.value })}
                style={{ fontSize: 16 }}
                className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-white placeholder-zinc-700 focus:outline-none"
              />
              <button onClick={() => remove(i)}
                className="text-zinc-700 hover:text-red-400 transition-colors shrink-0 p-0.5">
                <Trash2 size={12} />
              </button>
            </div>

            {/* Type + target row */}
            <div className="flex items-center gap-2 pl-6">
              {/* Type pills */}
              <div className="flex items-center gap-1 p-0.5 bg-zinc-900 rounded-lg shrink-0">
                <button type="button"
                  onClick={() => update(i, { type: 'habit', subGoals: [] })}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                    goal.type === 'habit'
                      ? 'bg-emerald-500 text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}>
                  Daily
                </button>
                <button type="button"
                  onClick={() => update(i, { type: 'weekly', subGoals: [] })}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                    goal.type === 'weekly'
                      ? 'bg-emerald-500 text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}>
                  Count
                </button>
              </div>

              {/* Target stepper + unit (only for count) */}
              {goal.type === 'weekly' && goal.subGoals.length === 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center bg-zinc-900 rounded-lg overflow-hidden">
                    <button type="button"
                      onClick={() => update(i, { target: String(Math.max(1, (Number(goal.target) || 0) - 1)) })}
                      className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors select-none text-sm">−</button>
                    <span className="w-7 text-center text-xs font-black text-white tabular-nums">
                      {goal.target || '0'}
                    </span>
                    <button type="button"
                      onClick={() => update(i, { target: String((Number(goal.target) || 0) + 1) })}
                      className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors select-none text-sm">+</button>
                  </div>
                  <UnitPicker value={goal.unit} onChange={u => update(i, { unit: u })} />
                </div>
              )}
            </div>

            {/* Sub-goals (count type) */}
            {goal.type === 'weekly' && (
              <div className="pl-6 space-y-1.5">
                {goal.subGoals.map((sg, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <span className="text-zinc-700 text-xs shrink-0">↳</span>
                    <input type="text" placeholder="e.g. Hard problems"
                      value={sg.text}
                      onChange={e => updateSub(i, si, { text: e.target.value })}
                      style={{ fontSize: 16 }}
                      className="flex-1 min-w-0 bg-transparent text-xs font-medium text-zinc-300 placeholder-zinc-700 focus:outline-none"
                    />
                    <div className="flex items-center bg-zinc-900 rounded-md overflow-hidden shrink-0">
                      <button type="button" onClick={() => updateSub(i, si, { target: String(Math.max(1, (Number(sg.target) || 0) - 1)) })}
                        className="w-5 h-6 flex items-center justify-center text-zinc-600 text-xs hover:text-zinc-300 transition-colors select-none">−</button>
                      <span className="w-5 text-center text-[10px] font-black text-zinc-300 tabular-nums">{sg.target || '0'}</span>
                      <button type="button" onClick={() => updateSub(i, si, { target: String((Number(sg.target) || 0) + 1) })}
                        className="w-5 h-6 flex items-center justify-center text-zinc-600 text-xs hover:text-zinc-300 transition-colors select-none">+</button>
                    </div>
                    <button onClick={() => removeSub(i, si)}
                      className="text-zinc-700 hover:text-red-400 transition-colors shrink-0">
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addSub(i)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-zinc-600 hover:text-emerald-500 transition-colors ml-3">
                  <Plus size={10} /> add breakdown
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <button type="button" onClick={add}
        className="w-full py-2.5 mt-1 rounded-xl border border-dashed border-zinc-800 text-zinc-600 hover:border-emerald-500/50 hover:text-emerald-500 transition-all text-xs font-semibold flex items-center justify-center gap-1.5">
        <Plus size={12} /> Add goal
      </button>
    </div>
  )
}
