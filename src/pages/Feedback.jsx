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

  const submit = async () => {
    if (!text.trim()) return
    await addDoc(collection(db, 'feedback'), {
      text: text.trim(),
      name: user?.displayName || 'Anonymous',
      createdAt: Timestamp.now(),
      uid: user?.uid || null,
    })
    setText('')
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col max-w-lg mx-auto">
      <header className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-xl text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-black text-zinc-900 dark:text-white">Feedback</h1>
          <p className="text-xs text-zinc-400 dark:text-zinc-600">Tell us what's on your mind</p>
        </div>
      </header>

      <div className="flex-1 px-4 pt-2 pb-10 flex flex-col gap-4">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="What's working? What's broken? What's missing?"
          rows={8}
          maxLength={800}
          style={{ fontSize: 16 }}
          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-all resize-none"
          autoFocus
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-400 dark:text-zinc-600">{text.length}/800</span>
          <button
            onClick={submit}
            disabled={!text.trim()}
            className="px-5 py-2.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-bold disabled:opacity-30 transition-all active:scale-95">
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}
