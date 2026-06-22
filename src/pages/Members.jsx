import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { UserPlus, Trash2, ChevronRight } from 'lucide-react'

const MEMBERS_DOC = doc(db, 'config', 'members')

export default function Members() {
  const navigate = useNavigate()
  const [members, setMembers] = useState([])
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(MEMBERS_DOC, (snap) => {
      setMembers(snap.exists() ? (snap.data().names || []) : [])
    })
    return unsub
  }, [])

  const addMember = async () => {
    const name = input.trim()
    if (!name) return
    if (members.some(m => m.toLowerCase() === name.toLowerCase())) {
      setInput('')
      return
    }
    setAdding(true)
    try {
      await updateDoc(MEMBERS_DOC, { names: arrayUnion(name) })
    } catch {
      await setDoc(MEMBERS_DOC, { names: [name] })
    }
    setInput('')
    setAdding(false)
  }

  const removeMember = async (name) => {
    await updateDoc(MEMBERS_DOC, { names: arrayRemove(name) })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Members</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Everyone in the accountability group</p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Add a name..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addMember()}
          className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-600 transition-colors"
        />
        <button
          onClick={addMember}
          disabled={adding || !input.trim()}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl px-4 py-3 transition-colors"
        >
          <UserPlus size={18} />
        </button>
      </div>

      {members.length === 0 && (
        <div className="text-center py-12 text-zinc-500 dark:text-zinc-600">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-medium text-zinc-500 dark:text-zinc-400">No members yet</p>
          <p className="text-sm mt-1">Add your group above</p>
        </div>
      )}

      <div className="space-y-2">
        {members.map(name => (
          <div key={name} className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-700 dark:text-zinc-300">
              {name[0].toUpperCase()}
            </div>
            <button
              onClick={() => navigate(`/member/${encodeURIComponent(name)}`)}
              className="flex-1 text-left font-medium text-zinc-800 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              {name}
            </button>
            <button
              onClick={() => navigate(`/member/${encodeURIComponent(name)}`)}
              className="text-zinc-500 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors p-1"
            >
              <ChevronRight size={15} />
            </button>
            <button
              onClick={() => removeMember(name)}
              className="text-zinc-500 dark:text-zinc-600 hover:text-red-400 transition-colors p-1"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
