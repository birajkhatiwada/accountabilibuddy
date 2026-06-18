import { useState, useEffect } from 'react'
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentWeekId, formatWeekLabel } from '../utils'
import { CheckCircle } from 'lucide-react'

export default function SubmitGoals() {
  const weekId = getCurrentWeekId()
  const [name, setName] = useState('')
  const [goals, setGoals] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [checking, setChecking] = useState(false)

  // Check if this name already submitted this week
  const checkExisting = async (nameVal) => {
    if (!nameVal.trim()) return
    setChecking(true)
    try {
      const q = query(collection(db, 'entries'), where('weekId', '==', weekId))
      const snap = await getDocs(q)
      const exists = snap.docs.some(
        d => (d.data().nameLower || d.data().name.toLowerCase()) === nameVal.trim().toLowerCase()
      )
      setAlreadySubmitted(exists)
    } catch {
      setAlreadySubmitted(false)
    }
    setChecking(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !goals.trim() || alreadySubmitted) return
    setSubmitting(true)
    await addDoc(collection(db, 'entries'), {
      weekId,
      name: name.trim(),
      nameLower: name.trim().toLowerCase(),
      goals: goals.trim(),
      status: 'active',
      updates: [],
      createdAt: serverTimestamp(),
    })
    setDone(true)
    setSubmitting(false)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <CheckCircle size={48} className="text-emerald-400" />
        <h2 className="text-xl font-bold text-white">Goals submitted!</h2>
        <p className="text-zinc-400 text-sm">Now go get it. No excuses.</p>
        <button
          onClick={() => { setDone(false); setName(''); setGoals(''); setAlreadySubmitted(false) }}
          className="mt-4 text-sm text-zinc-500 underline"
        >
          Submit for someone else
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Submit your goals</h2>
        <p className="text-sm text-zinc-500 mt-0.5">{formatWeekLabel(weekId)}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Your name</label>
          <input
            type="text"
            placeholder="e.g. Jordan"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={e => checkExisting(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 transition-colors"
            required
          />
          {alreadySubmitted && (
            <p className="text-xs text-red-400 mt-1">
              {name.trim()} already submitted goals this week.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Your goals this week</label>
          <textarea
            placeholder={"- Run 3x this week\n- Finish chapter 5\n- No takeout"}
            value={goals}
            onChange={e => setGoals(e.target.value)}
            rows={6}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 transition-colors resize-none"
            required
          />
          <p className="text-xs text-zinc-600 mt-1">Make them hard. Make them easy. Just make them honest.</p>
        </div>

        <button
          type="submit"
          disabled={submitting || alreadySubmitted || !name.trim() || !goals.trim()}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 transition-colors"
        >
          {submitting ? 'Submitting...' : 'Lock in my goals'}
        </button>
      </form>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">How it works</p>
        <ul className="text-sm text-zinc-500 space-y-1.5 list-none">
          <li>🎯 Submit your goals every week (Mon–Sun)</li>
          <li>📸 Drop proof as you make progress</li>
          <li>❌ Failed week = $15 into the pot</li>
          <li>🎉 When the pot is fat, we hang out</li>
        </ul>
      </div>
    </div>
  )
}
