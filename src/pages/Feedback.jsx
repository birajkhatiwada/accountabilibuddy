import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft, Send, Check, Star } from 'lucide-react'

const TAGS = ['Bug', 'Idea', 'Design', 'Performance', 'Other']

export default function Feedback() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [name, setName] = useState(user?.displayName || '')
  const [tag, setTag] = useState('')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async () => {
    if (!text.trim()) return
    setSending(true)
    await addDoc(collection(db, 'feedback'), {
      text: text.trim(),
      name: name.trim() || 'Anonymous',
      tag: tag || null,
      rating: rating || null,
      createdAt: Timestamp.now(),
      uid: user?.uid || null,
    })
    setSent(true)
    setSending(false)
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-12 pb-6">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors mb-6">
          <ArrowLeft size={16} />
          <span className="text-sm font-semibold">Back</span>
        </button>
        <h1 className="text-2xl font-black text-white">Beta Feedback</h1>
        <p className="text-sm text-zinc-500 mt-1">Help us make it better. All feedback is read.</p>
      </div>

      <div className="flex-1 px-4 space-y-5 max-w-sm mx-auto w-full">
        {sent ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <Check size={28} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-black text-white">Thanks!</p>
              <p className="text-sm text-zinc-500 mt-1">Your feedback means a lot.</p>
            </div>
            <button onClick={() => { setSent(false); setText(''); setTag(''); setRating(0) }}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-2">
              Send more
            </button>
          </div>
        ) : (
          <>
            {/* Name (if not signed in) */}
            {!user?.displayName && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Your name</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Anonymous" maxLength={40} style={{ fontSize: 16 }}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-all" />
              </div>
            )}

            {/* Star rating */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Overall rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(n)}
                    className="transition-transform active:scale-90">
                    <Star size={28}
                      className="transition-colors duration-100"
                      fill={(hoverRating || rating) >= n ? '#f59e0b' : 'transparent'}
                      stroke={(hoverRating || rating) >= n ? '#f59e0b' : '#52525b'} />
                  </button>
                ))}
              </div>
            </div>

            {/* Tag */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Category</label>
              <div className="flex flex-wrap gap-2">
                {TAGS.map(t => (
                  <button key={t} onClick={() => setTag(tag === t ? '' : t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      tag === t
                        ? 'bg-zinc-700 border-zinc-600 text-white'
                        : 'bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Message</label>
              <textarea value={text} onChange={e => setText(e.target.value)}
                placeholder="What's working? What's broken? What's missing?"
                rows={5} maxLength={800} style={{ fontSize: 16 }}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-all resize-none" />
              <p className="text-right text-[10px] text-zinc-700">{text.length}/800</p>
            </div>

            <button onClick={submit} disabled={sending || !text.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all disabled:opacity-40 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #34d399, #2dd4bf)', color: '#000' }}>
              <Send size={14} />
              {sending ? 'Sending…' : 'Send feedback'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
