import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft } from 'lucide-react'

export default function Feedback() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)

  const submit = async () => {
    if (!text.trim()) return
    await addDoc(collection(db, 'feedback'), {
      text: text.trim(),
      name: user?.displayName || 'Anonymous',
      createdAt: Timestamp.now(),
      uid: user?.uid || null,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col max-w-lg mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-12 pb-2">
        <button onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <button onClick={submit} disabled={!text.trim()}
          className="text-sm font-bold text-emerald-500 disabled:opacity-30 transition-opacity active:scale-95">
          {saved ? 'Saved' : 'Done'}
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col px-5 pt-2 pb-10">
        <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-1">Feedback</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-5">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Write your thoughts here…"
          maxLength={800}
          style={{ fontSize: 16, lineHeight: '1.75' }}
          className="flex-1 w-full bg-transparent text-zinc-800 dark:text-zinc-200 placeholder-zinc-300 dark:placeholder-zinc-700 focus:outline-none resize-none"
          autoFocus
        />
      </div>

      {/* Bottom char count */}
      {text.length > 0 && (
        <div className="px-5 pb-6 text-right">
          <span className="text-[11px] text-zinc-300 dark:text-zinc-700">{text.length}/800</span>
        </div>
      )}
    </div>
  )
}
