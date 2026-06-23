import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

const TYPES = [
  { value: 'habit',  label: '✓ Daily habit',    desc: 'Check off each day you do it' },
  { value: 'count',  label: '× Weekly count',   desc: 'Do it X times this week' },
  { value: 'total',  label: '# Running total',  desc: 'Log how much each session' },
]

const EMPTY_GOAL = () => ({ text: '', type: 'habit', target: '', unit: '', subGoals: [] })
const EMPTY_SUB  = () => ({ text: '', target: '', unit: '' })

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
    <div className="space-y-2">
      {goals.map((goal, i) => (
        <div key={i} className="bg-zinc-100/60 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 rounded-2xl p-3 space-y-3">

          {/* Goal name */}
          <div className="flex gap-2 items-center">
            <span className="text-zinc-500 dark:text-zinc-600 text-xs font-bold w-4 text-center shrink-0">{i + 1}</span>
            <input
              type="text"
              placeholder="Goal name (e.g. Leetcode, Go to gym)"
              value={goal.text}
              onChange={e => update(i, { text: e.target.value })}
              className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button onClick={() => remove(i)} className="text-zinc-400 dark:text-zinc-700 hover:text-red-400 transition-colors p-1 shrink-0">
              <Trash2 size={14} />
            </button>
          </div>

          {/* Type selector */}
          <div className="pl-6 grid grid-cols-3 gap-1.5">
            {TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => update(i, { type: t.value })}
                className={`flex flex-col items-start px-2.5 py-2 rounded-xl border text-left transition-all ${
                  goal.type === t.value
                    ? 'border-emerald-600 bg-emerald-950/40 text-emerald-300'
                    : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}>
                <span className="text-[11px] font-bold">{t.label}</span>
                <span className="text-[10px] mt-0.5 leading-tight opacity-70">{t.desc}</span>
              </button>
            ))}
          </div>

          {/* Target + unit for count/total (only when no sub-goals) */}
          {(goal.type === 'count' || goal.type === 'total') && goal.subGoals.length === 0 && (
            <div className="pl-6 flex gap-2 items-center">
              <input type="number" min="1" placeholder="0" value={goal.target}
                onChange={e => update(i, { target: e.target.value })}
                className="w-20 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 text-center focus:outline-none focus:border-emerald-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <input type="text" placeholder={goal.type === 'count' ? 'times' : 'unit (pages, km…)'} value={goal.unit}
                onChange={e => update(i, { unit: e.target.value })}
                className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          )}

          {/* Sub-goals (breakdowns) */}
          {(goal.type === 'count' || goal.type === 'total') && (
            <div className="pl-6 space-y-2">
              {goal.subGoals.map((sg, si) => (
                <div key={si} className="flex gap-1.5 items-center">
                  <input type="text" placeholder="e.g. Hard" value={sg.text}
                    onChange={e => updateSub(i, si, { text: e.target.value })}
                    className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <input type="number" min="0" placeholder="0" value={sg.target}
                    onChange={e => updateSub(i, si, { target: e.target.value })}
                    className="w-14 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 text-center focus:outline-none focus:border-emerald-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <input type="text" placeholder="unit" value={sg.unit}
                    onChange={e => updateSub(i, si, { unit: e.target.value })}
                    className="w-16 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button onClick={() => removeSub(i, si)} className="text-zinc-400 hover:text-red-400 transition-colors p-0.5 shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => addSub(i)}
                className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors">
                <Plus size={11} /> Add breakdown
              </button>
            </div>
          )}
        </div>
      ))}

      <button type="button" onClick={add}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors text-sm font-semibold">
        <Plus size={14} /> Add goal
      </button>
    </div>
  )
}
