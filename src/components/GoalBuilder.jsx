import { useState } from 'react'
import { Plus, Trash2, Hash } from 'lucide-react'

const EMPTY_GOAL = () => ({ text: '', hasTarget: false, target: '', unit: '' })

export default function GoalBuilder({ onChange }) {
  const [goals, setGoals] = useState([EMPTY_GOAL()])

  const update = (i, patch) => {
    const next = goals.map((g, idx) => idx === i ? { ...g, ...patch } : g)
    setGoals(next)
    onChange(next)
  }

  const add = () => {
    const next = [...goals, EMPTY_GOAL()]
    setGoals(next)
    onChange(next)
  }

  const remove = (i) => {
    const next = goals.filter((_, idx) => idx !== i)
    setGoals(next.length ? next : [EMPTY_GOAL()])
    onChange(next.length ? next : [EMPTY_GOAL()])
  }

  return (
    <div className="space-y-2">
      {goals.map((goal, i) => (
        <div key={i} className="bg-zinc-800/60 border border-zinc-700/60 rounded-2xl p-3 space-y-2">
          {/* Goal text row */}
          <div className="flex gap-2 items-center">
            <span className="text-zinc-600 text-sm font-bold w-4 shrink-0 text-center">{i + 1}</span>
            <input
              type="text"
              placeholder="e.g. Read pages, Go to gym, No takeout"
              value={goal.text}
              onChange={e => update(i, { text: e.target.value })}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              onClick={() => remove(i)}
              className="text-zinc-700 hover:text-red-400 transition-colors p-1 shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {/* Target toggle */}
          <div className="pl-6 space-y-2">
            <button
              type="button"
              onClick={() => update(i, { hasTarget: !goal.hasTarget })}
              className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                goal.hasTarget ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              <Hash size={11} />
              {goal.hasTarget ? 'Has a target' : 'Add a target number'}
            </button>

            {goal.hasTarget && (
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min="1"
                  placeholder="0"
                  value={goal.target}
                  onChange={e => update(i, { target: e.target.value })}
                  className="w-20 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-sm text-zinc-200 text-center focus:outline-none focus:border-emerald-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <input
                  type="text"
                  placeholder="unit (pages, km, mins…)"
                  value={goal.unit}
                  onChange={e => update(i, { unit: e.target.value })}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors text-sm font-semibold"
      >
        <Plus size={14} /> Add goal
      </button>
    </div>
  )
}
