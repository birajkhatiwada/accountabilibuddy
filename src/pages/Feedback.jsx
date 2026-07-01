import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft } from 'lucide-react'

const DRAFT_KEY = 'feedback_draft'

export default function Feedback() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [text, setText] = useState(() => localStorage.getItem(DRAFT_KEY) || '')
  const [status, setStatus] = useState('')
  const timerRef = useRef(null)
  const savedRef = useRef(false)

  // Persist draft to localStorage on every keystroke
  const handleChange = (e) => {
    const val = e.target.value
    setText(val)
    localStorage.setItem(DRAFT_KEY, val)
    savedRef.current = false
    setStatus('')
  }

  const save = async (value) => {
    if (!value.trim()) return
    setStatus('saving')
    try {
      await addDoc(collection(db, 'feedback'), {
        text: value.trim(),
        name: user?.displayName || 'Anonymous',
        createdAt: Timestamp.now(),
        uid: user?.uid || null,
      })
      savedRef.current = true
      localStorage.removeItem(DRAFT_KEY)
      setStatus('saved')
    } catch (e) {
      console.error('feedback save failed', e)
      setStatus('error')
    }
  }

  // Autosave 2s after stopping
  useEffect(() => {
    if (!text.trim() || savedRef.current) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(text), 2000)
    return () => clearTimeout(timerRef.current)
  }, [text])

  const handleBack = async () => {
    clearTimeout(timerRef.current)
    if (text.trim() && !savedRef.current) await save(text)
    navigate(-1)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col max-w-lg mx-auto">
      <div className="flex items-center justify-between px-4 pt-12 pb-2">
        <button onClick={handleBack}
          className="p-2 -ml-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <span className={`text-xs transition-opacity ${status === 'error' ? 'text-red-400' : 'text-zinc-400 dark:text-zinc-600'}`}>
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : status === 'error' ? 'Save failed — check connection' : ''}
        </span>
      </div>

      <div className="flex-1 flex flex-col px-5 pt-2 pb-10">
        <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-1">Feedback</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <textarea
          value={text}
          onChange={handleChange}
          placeholder="Write your thoughts here…"
          style={{ fontSize: 16, lineHeight: '1.75' }}
          className="flex-1 w-full bg-transparent text-zinc-800 dark:text-zinc-200 placeholder-zinc-300 dark:placeholder-zinc-700 focus:outline-none resize-none"
          autoFocus
        />
      </div>
    </div>
  )
}
