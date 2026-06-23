import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

const EMPTY_GOAL = () => ({ text: '', type: 'habit', target: '', unit: '', subGoals: [] })
const EMPTY_SUB  = () => ({ text: '', target: '', unit: '' })

const TYPE_PILLS = [
  { value: 'habit', label: 'daily' },
  { value: 'count', label: 'count' },
  { value: 'total', label: 'total' },
]

export default function GoalBuilder({ onChange, initialGoals }) {
  const [goals, setGoals] = useState(() =>
    initialGoals?.length
      ? initialGoals.map(g => ({
          text: g.text || '', type: g.type || 'habit',
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
    <div className="space-y-1">
      {goals.map((goal, i) => (
        <div key={i} className="space-y-1.5">
          {/* Main row */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={i === 0 ? 'e.g. Go to gym, Read, Leetcode' : 'Goal name'}
              value={goal.text}
              onChange={e => update(i, { text: e.target.value })}
              className="flex-1 min-w-0 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
            />

            {/* Type pills */}
            <div className="flex shrink-0 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
              {TYPE_PILLS.map(t => (
                <button key={t.value} type="button" onClick={() => update(i, { type: t.value, subGoals: [] })}
                  className={`px-2 py-1.5 text-[10px] font-bold transition-colors ${
                    goal.type === t.value
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            <button onClick={() => remove(i)} className="text-zinc-300 dark:text-zinc-700 hover:text-red-400 transition-colors shrink-0">
              <Trash2 size={14} />
            </button>
          </div>

          {/* Target + unit — only for count/total with no sub-goals */}
          {(goal.type === 'count' || goal.type === 'total') && goal.subGoals.length === 0 && (
            <div className="flex gap-1.5">
              <input type="number" min="1" placeholder="target"
                value={goal.target}
                onChange={e => update(i, { target: e.target.value })}
                className="w-20 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 text-center placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <input type="text" placeholder={goal.type === 'count' ? 'times, reps…' : 'pages, km…'}
                value={goal.unit}
                onChange={e => update(i, { unit: e.target.value })}
                className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>
          )}

          {/* Sub-goals */}
          {(goal.type === 'count' || goal.type === 'total') && (
            <div className="pl-3 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-1.5">
              {goal.subGoals.map((sg, si) => (
                <div key={si} className="flex gap-1.5 items-center">
                  <input type="text" placeholder="e.g. Hard"
                    value={sg.text}
                    onChange={e => updateSub(i, si, { text: e.target.value })}
                    className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                  <input type="number" min="0" placeholder="0"
                    value={sg.target}
                    onChange={e => updateSub(i, si, { target: e.target.value })}
                    className="w-12 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 text-center placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <input type="text" placeholder="unit"
                    value={sg.unit}
                    onChange={e => updateSub(i, si, { unit: e.target.value })}
                    className="w-14 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                  <button onClick={() => removeSub(i, si)} className="text-zinc-300 dark:text-zinc-700 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => addSub(i)}
                className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 hover:text-emerald-500 transition-colors flex items-center gap-1">
                <Plus size={10} /> breakdown
              </button>
            </div>
          )}

          {i < goals.length - 1 && <div className="border-t border-zinc-100 dark:border-zinc-800 pt-0.5" />}
        </div>
      ))}

      <button type="button" onClick={add}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600 hover:text-emerald-500 hover:border-emerald-500/50 transition-colors text-xs font-semibold mt-1">
        <Plus size={12} /> Add goal
      </button>
    </div>
  )
}
