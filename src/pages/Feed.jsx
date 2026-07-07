import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, Timestamp, query, where, doc } from 'firebase/firestore'
import { useParams } from 'react-router-dom'
import { db } from '../firebase'
import { getCurrentWeekId } from '../utils'
import { Megaphone, Send, MessageCircle, X } from 'lucide-react'

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600', 'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',     'from-indigo-500 to-blue-600',
  'from-teal-500 to-emerald-600',  'from-fuchsia-500 to-pink-600',
]

const SHOUTOUT_EMOJIS = ['🔥', '💪', '👏', '🏆', '⭐', '🚀']

function Avatar({ name, emoji, members }) {
  const color = AVATAR_COLORS[members.indexOf(name) % AVATAR_COLORS.length] || AVATAR_COLORS[0]
  return (
    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${color} flex items-center justify-center shrink-0 text-sm`}>
      {emoji ? emoji : <span className="text-white font-black text-xs">{name[0]?.toUpperCase()}</span>}
    </div>
  )
}

function timeAgo(ts) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function Feed() {
  const weekId = getCurrentWeekId()
  const { sessionId } = useParams()
  const [members, setMembers] = useState([])
  const [avatars, setAvatars] = useState({})
  const [penalty, setPenalty] = useState(15)
  const [entries, setEntries] = useState([])
  const [shoutouts, setShoutouts] = useState([])
  const [comments, setComments] = useState([])
  const [expandedComments, setExpandedComments] = useState(new Set())
  const [commentInputs, setCommentInputs] = useState({})
  const [postingComment, setPostingComment] = useState(null)
  const [showShoutoutForm, setShowShoutoutForm] = useState(false)
  const [shoutoutFrom, setShoutoutFrom] = useState('')
  const [shoutoutTo, setShoutoutTo] = useState('')
  const [shoutoutMsg, setShoutoutMsg] = useState('')
  const [shoutoutEmoji, setShoutoutEmoji] = useState('🔥')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    return onSnapshot(doc(db, 'sessions', sessionId), snap => {
      if (snap.exists()) {
        setMembers(snap.data().names || [])
        setAvatars(snap.data().avatars || {})
        setPenalty(snap.data().penalty ?? 15)
      }
    })
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    const q = query(collection(db, 'comments'), where('sessionId', '==', sessionId))
    return onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    const q = query(collection(db, 'entries'), where('sessionId', '==', sessionId))
    return onSnapshot(q, snap => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    const q = query(collection(db, 'shoutouts'), where('sessionId', '==', sessionId))
    return onSnapshot(q, snap => {
      setShoutouts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [sessionId])

  const postShoutout = async () => {
    if (!shoutoutFrom || !shoutoutTo || !shoutoutMsg.trim()) return
    setPosting(true)
    await addDoc(collection(db, 'shoutouts'), {
      from: shoutoutFrom,
      to: shoutoutTo,
      message: shoutoutMsg.trim(),
      emoji: shoutoutEmoji,
      timestamp: Timestamp.now(),
      weekId,
      sessionId,
    })
    setShoutoutMsg('')
    setShowShoutoutForm(false)
    setPosting(false)
  }

  // Build unified feed from proof updates + goals set + shoutouts
  const feedItems = []

  entries.forEach(entry => {
    // Goals set event
    if (entry.createdAt) {
      feedItems.push({
        id: `goals-${entry.id}`,
        type: 'goals_set',
        name: entry.name,
        weekId: entry.weekId,
        timestamp: entry.createdAt,
        goals: entry.goalItems?.map(g => g.text) || [],
      })
    }
    // Week completed/failed
    if (entry.status === 'completed' || entry.status === 'failed') {
      if (entry.weekId === weekId && entry.status !== 'active') {
        feedItems.push({
          id: `status-${entry.id}`,
          type: entry.status,
          name: entry.name,
          weekId: entry.weekId,
          timestamp: entry.createdAt,
        })
      }
    }
    // Proof updates
    ;(entry.updates || []).forEach((u, i) => {
      feedItems.push({
        id: `proof-${entry.id}-${u.timestamp?.seconds ?? i}`,
        type: 'proof',
        name: entry.name,
        weekId: entry.weekId,
        timestamp: u.timestamp,
        text: u.text,
      })
    })
  })

  shoutouts.forEach(s => {
    feedItems.push({
      id: `shoutout-${s.id}`,
      type: 'shoutout',
      from: s.from,
      to: s.to,
      message: s.message,
      emoji: s.emoji,
      timestamp: s.timestamp,
      weekId: s.weekId,
    })
  })

  // Sort newest first
  feedItems.sort((a, b) => {
    const ta = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0)
    const tb = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0)
    return tb - ta
  })

  const commentsByParent = comments.reduce((acc, c) => {
    if (!acc[c.parentId]) acc[c.parentId] = []
    acc[c.parentId].push(c)
    return acc
  }, {})

  const toggleComments = (id) => setExpandedComments(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const postComment = async (parentId) => {
    const input = commentInputs[parentId] || {}
    if (!input.from || !input.text?.trim()) return
    setPostingComment(parentId)
    await addDoc(collection(db, 'comments'), {
      parentId,
      sessionId,
      from: input.from,
      text: input.text.trim(),
      timestamp: Timestamp.now(),
    })
    setCommentInputs(p => ({ ...p, [parentId]: { from: input.from, text: '' } }))
    setPostingComment(null)
  }

  return (
    <div className="space-y-4">
      {/* Header + shoutout button */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wide">Activity</p>
        <button
          onClick={() => setShowShoutoutForm(v => !v)}
          className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 hover:text-amber-400 transition-colors"
        >
          <Megaphone size={13} />
          Shoutout
        </button>
      </div>

      {/* Shoutout form */}
      {showShoutoutForm && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Give a shoutout 📣</p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wide">From</p>
              <select
                value={shoutoutFrom}
                onChange={e => setShoutoutFrom(e.target.value)}
                style={{ fontSize: 16 }}
                className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="">You...</option>
                {members.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wide">To</p>
              <select
                value={shoutoutTo}
                onChange={e => setShoutoutTo(e.target.value)}
                style={{ fontSize: 16 }}
                className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="">Who...</option>
                {members.filter(m => m !== shoutoutFrom).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-1.5">
            {SHOUTOUT_EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => setShoutoutEmoji(e)}
                className={`text-xl rounded-xl p-1.5 transition-all ${shoutoutEmoji === e ? 'bg-zinc-200 dark:bg-zinc-700 ring-2 ring-amber-400 scale-110' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
              >
                {e}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Say something..."
              value={shoutoutMsg}
              onChange={e => setShoutoutMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && postShoutout()}
              style={{ fontSize: 16 }}
              className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
            />
            <button
              onClick={postShoutout}
              disabled={posting || !shoutoutFrom || !shoutoutTo || !shoutoutMsg.trim()}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white rounded-xl px-3 transition-colors"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Feed */}
      {feedItems.length === 0 && (
        <div className="text-center py-16 text-zinc-500 dark:text-zinc-600">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium text-zinc-500 dark:text-zinc-400">Nothing yet</p>
          <p className="text-sm mt-1">Activity will show up here as the week progresses</p>
        </div>
      )}

      <div className="space-y-2">
        {feedItems.map(item => (
          <FeedItem
            key={item.id}
            item={item}
            members={members}
            avatars={avatars}
            penalty={penalty}
            itemComments={(commentsByParent[item.id] || []).sort((a, b) => {
              const ta = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(0)
              const tb = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(0)
              return ta - tb
            })}
            commentsExpanded={expandedComments.has(item.id)}
            onToggleComments={() => toggleComments(item.id)}
            commentInput={commentInputs[item.id] || { from: '', text: '' }}
            onCommentInputChange={(field, val) => setCommentInputs(p => ({ ...p, [item.id]: { ...(p[item.id] || {}), [field]: val } }))}
            onPostComment={() => postComment(item.id)}
            postingComment={postingComment === item.id}
            commentMembers={members}
          />
        ))}
      </div>
    </div>
  )
}

function FeedItem({ item, members, avatars, penalty, itemComments, commentsExpanded, onToggleComments, commentInput, onCommentInputChange, onPostComment, postingComment, commentMembers }) {
  const commentSection = (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <button onClick={onToggleComments}
          className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
          <MessageCircle size={11} />
          {itemComments.length > 0 ? `${itemComments.length} comment${itemComments.length !== 1 ? 's' : ''}` : 'Reply'}
        </button>
      </div>
      {commentsExpanded && (
        <div className="mt-2 space-y-2">
          {itemComments.map(c => (
            <div key={c.id} className="flex gap-2 items-start">
              <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 shrink-0 mt-0.5">{c.from}</span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 break-words min-w-0">{c.text}</span>
            </div>
          ))}
          <div className="flex gap-1.5 mt-1">
            <select value={commentInput.from} onChange={e => onCommentInputChange('from', e.target.value)}
              style={{ fontSize: 16 }}
              className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-zinc-400 shrink-0">
              <option value="">Who?</option>
              {commentMembers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input value={commentInput.text} onChange={e => onCommentInputChange('text', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onPostComment()}
              placeholder="Say something..."
              style={{ fontSize: 16 }}
              className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-400 transition-colors min-w-0" />
            <button onClick={onPostComment}
              disabled={postingComment || !commentInput.from || !commentInput.text?.trim()}
              className="bg-zinc-800 dark:bg-zinc-200 hover:bg-zinc-700 dark:hover:bg-white disabled:opacity-40 text-white dark:text-zinc-900 rounded-lg px-2.5 transition-colors shrink-0">
              <Send size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )

  if (item.type === 'shoutout') {
    return (
      <div className="bg-amber-950/30 border border-amber-800/40 rounded-2xl px-4 py-3">
        <div className="flex gap-3">
          <div className="text-xl shrink-0 mt-0.5">{item.emoji}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-800 dark:text-zinc-200">
              <span className="font-bold text-amber-300">{item.from}</span>
              <span className="text-zinc-500"> → </span>
              <span className="font-bold text-zinc-900 dark:text-white">{item.to}</span>
            </p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-0.5">"{item.message}"</p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-600 mt-1">{timeAgo(item.timestamp)}</p>
          </div>
        </div>
        {commentSection}
      </div>
    )
  }

  if (item.type === 'proof') {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3">
        <div className="flex gap-3">
          <Avatar name={item.name} emoji={avatars[item.name]} members={members} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-800 dark:text-zinc-200">
              <span className="font-bold">{item.name}</span>
              <span className="text-zinc-500"> posted proof</span>
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 italic">"{item.text}"</p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-600 mt-1">{timeAgo(item.timestamp)}</p>
          </div>
        </div>
        {commentSection}
      </div>
    )
  }

  if (item.type === 'goals_set') {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 flex gap-3">
        <Avatar name={item.name} emoji={avatars[item.name]} members={members} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-800 dark:text-zinc-200">
            <span className="font-bold">{item.name}</span>
            <span className="text-zinc-500"> locked in their goals</span>
            {item.weekId !== getCurrentWeekId() && (
              <span className="text-[10px] text-zinc-500 dark:text-zinc-600 ml-1">· week of {item.weekId}</span>
            )}
          </p>
          {item.goals.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.goals.map((g, i) => (
                <span key={i} className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-lg px-2 py-0.5">{g}</span>
              ))}
            </div>
          )}
          <p className="text-[10px] text-zinc-500 dark:text-zinc-600 mt-1">{timeAgo(item.timestamp)}</p>
        </div>
      </div>
    )
  }

  if (item.type === 'completed') {
    return (
      <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl px-4 py-3">
        <div className="flex gap-3">
          <Avatar name={item.name} emoji={avatars[item.name]} members={members} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-800 dark:text-zinc-200">
              <span className="font-bold text-emerald-300">{item.name}</span>
              <span className="text-zinc-500"> crushed the week ✅</span>
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-600 mt-1">{timeAgo(item.timestamp)}</p>
          </div>
        </div>
        {commentSection}
      </div>
    )
  }

  if (item.type === 'failed') {
    return (
      <div className="bg-red-950/20 border border-red-800/30 rounded-2xl px-4 py-3">
        <div className="flex gap-3">
          <Avatar name={item.name} emoji={avatars[item.name]} members={members} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-800 dark:text-zinc-200">
              <span className="font-bold text-red-400">{item.name}</span>
              <span className="text-zinc-500"> missed the week ❌ +${penalty} to the pot</span>
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-600 mt-1">{timeAgo(item.timestamp)}</p>
          </div>
        </div>
        {commentSection}
      </div>
    )
  }

  return null
}
