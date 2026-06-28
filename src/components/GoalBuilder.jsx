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
  const matches = query ? UNIT_SUGGESTIONS.filter(u => u.includes(query.toLowerCase())) : UNIT_SUGGESTIONS

  return (
    <div className="relative">
      {value ? (
        <div className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex-1">{value}</span>
          <button type="button" onClick={() => { onChange(''); setQuery('') }}
            className="text-zinc-400 hover:text-red-400 transition-colors text-xs leading-none">✕</button>
        </div>
      ) : (
        <input
          type="text"
          placeholder="unit (e.g. reps, min…)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={e => {
            if (e.key === 'Enter' && query.trim()) { onChange(query.trim()); setQuery(''); setOpen(false) }
          }}
          className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
        />
      )}
      {open && !value && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden">
          <div className="flex flex-wrap gap-1.5 p-2.5">
            {matches.slice(0, 10).map(u => (
              <button key={u} type="button" onMouseDown={() => { onChange(u); setQuery(''); setOpen(false) }}
                className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
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
    <div className="space-y-2.5">
      {goals.map((goal, i) => (
        <div key={i} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 space-y-3 border border-zinc-100 dark:border-zinc-800">

          {/* Name row */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-300 dark:text-zinc-600 w-4 text-center shrink-0">{i + 1}</span>
            <input
              type="text"
              placeholder={PLACEHOLDERS[i % PLACEHOLDERS.length]}
              value={goal.text}
              onChange={e => update(i, { text: e.target.value })}
              style={{ fontSize: 16 }}
              className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-zinc-800 dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-600 focus:outline-none"
            />
            <button onClick={() => remove(i)} className="text-zinc-300 dark:text-zinc-600 hover:text-red-400 transition-colors shrink-0 p-0.5">
              <Trash2 size={13} />
            </button>
          </div>

          {/* Type toggle — segmented control */}
          <div className="flex bg-white dark:bg-zinc-900 rounded-xl p-0.5 border border-zinc-100 dark:border-zinc-800">
            <button type="button"
              onClick={() => update(i, { type: 'habit', subGoals: [] })}
              className={`flex-1 py-1.5 rounded-[10px] text-xs font-bold transition-all ${
                goal.type === 'habit'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}>
              Daily habit
            </button>
            <button type="button"
              onClick={() => update(i, { type: 'weekly', subGoals: [] })}
              className={`flex-1 py-1.5 rounded-[10px] text-xs font-bold transition-all ${
                goal.type === 'weekly'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}>
              Hit a number
            </button>
          </div>

          {/* Count goal: target + unit */}
          {goal.type === 'weekly' && goal.subGoals.length === 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden shrink-0">
                  <button type="button"
                    onClick={() => update(i, { target: String(Math.max(1, (Number(goal.target) || 0) - 1)) })}
                    className="w-8 h-9 flex items-center justify-center text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors select-none text-base">−</button>
                  <span className="w-10 text-center text-sm font-black text-zinc-800 dark:text-zinc-100 tabular-nums">
                    {goal.target || '0'}
                  </span>
                  <button type="button"
                    onClick={() => update(i, { target: String((Number(goal.target) || 0) + 1) })}
                    className="w-8 h-9 flex items-center justify-center text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors select-none text-base">+</button>
                </div>
                <div className="flex-1">
                  <UnitPicker value={goal.unit} onChange={u => update(i, { unit: u })} />
                </div>
              </div>
            </div>
          )}

          {/* Sub-goals */}
          {goal.type === 'weekly' && (
            <div className="space-y-2">
              {goal.subGoals.map((sg, si) => (
                <div key={si} className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 border border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-200 dark:text-zinc-700 text-xs shrink-0">↳</span>
                  <input type="text" placeholder="breakdown (e.g. Hard problems)"
                    value={sg.text}
                    onChange={e => updateSub(i, si, { text: e.target.value })}
                    className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-zinc-700 dark:text-zinc-300 placeholder-zinc-300 dark:placeholder-zinc-600 focus:outline-none"
                    style={{ fontSize: 16 }}
                  />
                  <div className="flex items-center bg-zinc-50 dark:bg-zinc-800 rounded-lg overflow-hidden shrink-0">
                    <button type="button" onClick={() => updateSub(i, si, { target: String(Math.max(1, (Number(sg.target) || 0) - 1)) })}
                      className="w-6 h-7 flex items-center justify-center text-zinc-400 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors select-none">−</button>
                    <span className="w-6 text-center text-xs font-black text-zinc-700 dark:text-zinc-200 tabular-nums">{sg.target || '0'}</span>
                    <button type="button" onClick={() => updateSub(i, si, { target: String((Number(sg.target) || 0) + 1) })}
                      className="w-6 h-7 flex items-center justify-center text-zinc-400 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors select-none">+</button>
                  </div>
                  <button onClick={() => removeSub(i, si)} className="text-zinc-300 dark:text-zinc-600 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => addSub(i)}
                className="flex items-center gap-1 text-xs font-semibold text-zinc-400 dark:text-zinc-500 hover:text-emerald-500 transition-colors pl-1">
                <Plus size={11} /> add breakdown
              </button>
            </div>
          )}
        </div>
      ))}

      <button type="button" onClick={add}
        className="w-full py-3 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600 hover:border-emerald-400 hover:text-emerald-500 transition-all text-sm font-semibold flex items-center justify-center gap-1.5">
        <Plus size={14} /> Add goal
      </button>
    </div>
  )
}
