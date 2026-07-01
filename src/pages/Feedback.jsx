import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft } from 'lucide-react'

export default function Feedback() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const timerRef = useRef(null)
  const savedRef = useRef(false)

  const draftRef = user ? doc(db, 'feedback_drafts', user.uid) : null

  // Load draft from Firestore on mount
  useEffect(() => {
    if (!draftRef) return
    getDoc(draftRef).then(snap => {
      if (snap.exists()) setText(snap.data().text || '')
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const save = async (value) => {
    if (!draftRef) return
    setStatus('saving')
    try {
      await setDoc(draftRef, {
        text: value,
        uid: user.uid,
        name: user.displayName || 'Anonymous',
        updatedAt: Timestamp.now(),
      })
      savedRef.current = true
      setStatus('saved')
    } catch (e) {
      console.error('feedback save failed', e)
      setStatus('error')
    }
  }

  const handleChange = (e) => {
    const val = e.target.value
    setText(val)
    savedRef.current = false
    setStatus('')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(val), 1500)
  }

  const handleBack = async () => {
    clearTimeout(timerRef.current)
    if (!savedRef.current) await save(text)
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
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : status === 'error' ? 'Save failed' : ''}
        </span>
      </div>

      <div className="flex-1 flex flex-col px-5 pt-2 pb-10">
        <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-1">Feedback</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        {loading ? (
          <div className="flex-1 flex items-start pt-2">
            <div className="w-4 h-4 border-2 border-zinc-300 dark:border-zinc-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <textarea
            value={text}
            onChange={handleChange}
            placeholder="Write your thoughts here…"
            style={{ fontSize: 16, lineHeight: '1.75' }}
            className="flex-1 w-full bg-transparent text-zinc-800 dark:text-zinc-200 placeholder-zinc-300 dark:placeholder-zinc-700 focus:outline-none resize-none"
            autoFocus
          />
        )}
      </div>
    </div>
  )
}
