import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, setDoc, doc, Timestamp, query, where } from 'firebase/firestore'
import { useParams } from 'react-router-dom'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import { getCurrentWeekId, formatWeekLabel } from '../utils'
import { Megaphone, Send, Check, SmilePlus } from 'lucide-react'

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600', 'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',     'from-indigo-500 to-blue-600',
  'from-teal-500 to-emerald-600',  'from-fuchsia-500 to-pink-600',
]

const SHOUTOUT_EMOJIS = ['🔥', '💪', '👏', '🏆', '⭐', '🚀']
const QUICK_REACTIONS = ['💪', '🔥', '👏', '❤️', '🎉', '😤']

function Avatar({ name, emoji, members, px = 32 }) {
  const color = AVATAR_COLORS[members.indexOf(name) % AVATAR_COLORS.length] || AVATAR_COLORS[0]
  return (
    <div className={`rounded-full bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}
      style={{ width: px, height: px, fontSize: px * 0.5 }}>
      {emoji ? emoji : <span className="text-white font-black" style={{ fontSize: px * 0.4 }}>{name[0]?.toUpperCase()}</span>}
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

// A day only shows up in the feed if something was actually logged —
// merely opening the page or an empty log doc doesn't count.
function dayHasRealActivity(log) {
  if (!log) return false
  return Object.values(log.habits || {}).some(Boolean) ||
    Object.values(log.counts || {}).some(v => v > 0) ||
    Object.values(log.totals || {}).some(v => v > 0) ||
    Object.values(log.proof || {}).some(p => p?.note || p?.photoUrls?.length > 0 || p?.photoUrl)
}

// One compact tag per goal that was actually touched that day — skips
// anything untouched instead of listing the member's full goal list.
function summarizeGoalForDay(g, log) {
  if (g.type === 'habit') {
    return log.habits?.[g.text] ? { text: g.text, detail: null } : null
  }
  if (g.subGoals?.length > 0) {
    const touched = g.subGoals.filter(sg => (Number(log.counts?.[`${g.text}::${sg.text}`]) || 0) > 0)
    if (!touched.length) return null
    return {
      text: g.text,
      detail: touched.map(sg => `${sg.text} ${log.counts[`${g.text}::${sg.text}`]}${sg.unit ? ` ${sg.unit}` : ''}`).join(', '),
    }
  }
  const count = (Number(log.counts?.[g.text]) || 0) + (Number(log.totals?.[g.text]) || 0)
  if (count <= 0) return null
  return { text: g.text, detail: `${count}${g.unit ? ` ${g.unit}` : ''}` }
}

// Every daily-note/goal-proof photo attached that day, daily note's own
// photos first.
function collectPhotos(log) {
  const proof = log.proof || {}
  const daily = proof.daily || {}
  const dailyPhotos = daily.photoUrls || (daily.photoUrl ? [daily.photoUrl] : [])
  const goalPhotos = Object.entries(proof)
    .filter(([k]) => k !== 'daily')
    .flatMap(([, p]) => p?.photoUrls || (p?.photoUrl ? [p.photoUrl] : []))
  return [...dailyPhotos, ...goalPhotos]
}

function effectiveTime(item) {
  if (item.timestamp?.toDate) return item.timestamp.toDate().getTime()
  if (item.timestamp) return new Date(item.timestamp).getTime()
  if (item.day) return new Date(item.day + 'T12:00:00').getTime()
  return 0
}

export default function Feed() {
  const weekId = getCurrentWeekId()
  const { sessionId } = useParams()
  const { user } = useAuth()
  const [members, setMembers] = useState([])
  const [avatars, setAvatars] = useState({})
  const [penalty, setPenalty] = useState(15)
  const [entries, setEntries] = useState([])
  const [shoutouts, setShoutouts] = useState([])
  const [logsByEntry, setLogsByEntry] = useState({})
  const [reactionPickerOpen, setReactionPickerOpen] = useState(null)
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

  // One dailyLogs subscription per entry, so the feed reflects live edits
  // (including re-edits to an old day) without writing anything new itself.
  useEffect(() => {
    const unsubs = entries.map(entry =>
      onSnapshot(collection(db, 'entries', entry.id, 'dailyLogs'), snap => {
        const data = {}
        snap.docs.forEach(d => { data[d.id] = d.data() })
        setLogsByEntry(prev => ({ ...prev, [entry.id]: data }))
      })
    )
    return () => unsubs.forEach(u => u())
  }, [entries.map(e => e.id).join(',')])

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

  // Anyone signed in can react to anyone's day — the Firestore rule scopes
  // this to just the `reactions` field so it can't touch someone else's
  // counts/notes/photos.
  const toggleDayReaction = async (entryId, day, emoji) => {
    if (!user) return
    const log = logsByEntry[entryId]?.[day] || {}
    const arr = Array.isArray(log.reactions?.daily) ? log.reactions.daily : []
    const i = arr.findIndex(r => r.e === emoji)
    let updated
    if (i >= 0) {
      const alreadyReacted = arr[i].users?.includes(user.uid)
      if (alreadyReacted) {
        const users = arr[i].users.filter(u => u !== user.uid)
        updated = users.length === 0
          ? arr.filter((_, j) => j !== i)
          : arr.map((r, j) => j === i ? { ...r, users } : r)
      } else {
        updated = arr.map((r, j) => j === i ? { ...r, users: [...(r.users || []), user.uid] } : r)
      }
    } else {
      updated = [...arr, { e: emoji, users: [user.uid] }]
    }
    await setDoc(doc(db, 'entries', entryId, 'dailyLogs', day), {
      ...log,
      reactions: { ...(log.reactions || {}), daily: updated },
    })
  }

  // Build the feed: one card per member per day that had real activity,
  // plus shoutouts and week status changes — sorted newest first.
  const feedItems = []

  entries.forEach(entry => {
    if (entry.status === 'completed' || entry.status === 'failed') {
      if (entry.weekId === weekId && entry.status !== 'active') {
        feedItems.push({
          id: `status-${entry.id}`, type: entry.status, name: entry.name,
          weekId: entry.weekId, timestamp: entry.createdAt,
        })
      }
    }
    const logs = logsByEntry[entry.id] || {}
    Object.entries(logs).forEach(([day, log]) => {
      if (!dayHasRealActivity(log)) return
      const goalTags = (entry.goalItems || []).map(g => summarizeGoalForDay(g, log)).filter(Boolean)
      const noteText = log.proof?.daily?.note ||
        Object.values(log.proof || {}).map(p => p?.note).find(Boolean) || ''
      feedItems.push({
        id: `day-${entry.id}-${day}`, type: 'day_summary', name: entry.name,
        entryId: entry.id, day, goalTags, noteText, weekId: entry.weekId,
        photos: collectPhotos(log),
        reactions: Array.isArray(log.reactions?.daily) ? log.reactions.daily : [],
        timestamp: log.updatedAt,
      })
    })
  })

  shoutouts.forEach(s => {
    feedItems.push({
      id: `shoutout-${s.id}`, type: 'shoutout', from: s.from, to: s.to,
      message: s.message, emoji: s.emoji, timestamp: s.timestamp, weekId: s.weekId,
    })
  })

  feedItems.sort((a, b) => effectiveTime(b) - effectiveTime(a))

  // Group into week sections, newest week first.
  const weekGroups = []
  feedItems.forEach(item => {
    const wid = item.weekId || weekId
    let group = weekGroups.find(g => g.weekId === wid)
    if (!group) { group = { weekId: wid, items: [] }; weekGroups.push(group) }
    group.items.push(item)
  })
  weekGroups.sort((a, b) => b.weekId.localeCompare(a.weekId))

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

      {weekGroups.map(group => (
        <div key={group.weekId}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-1 mb-1.5">
            {group.weekId === weekId ? 'This week' : formatWeekLabel(group.weekId)}
          </p>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-3 [&>*:last-child]:border-b-0">
            {group.items.map(item => (
              <FeedItem
                key={item.id}
                item={item}
                members={members}
                avatars={avatars}
                penalty={penalty}
                currentUid={user?.uid}
                reactionPickerOpen={reactionPickerOpen === item.id}
                onToggleReactionPicker={() => setReactionPickerOpen(p => p === item.id ? null : item.id)}
                onReact={key => { toggleDayReaction(item.entryId, item.day, key); setReactionPickerOpen(null) }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ReactionRow({ reactions, currentUid, open, onToggleOpen, onReact }) {
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5">
      {reactions.map(({ e: emoji, users: us = [] }) => {
        const reacted = us.includes(currentUid)
        return (
          <button key={emoji} onClick={() => onReact(emoji)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
              reacted
                ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300'
                : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-600 text-zinc-500 hover:border-emerald-400'
            }`}>
            {emoji}<span className="font-semibold ml-0.5">{us.length}</span>
          </button>
        )
      })}
      <div className="relative">
        <button onClick={onToggleOpen}
          className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-all active:scale-90">
          <SmilePlus size={13} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={onToggleOpen} />
            <div className="absolute bottom-7 left-0 flex items-center gap-0.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full px-2 py-1.5 shadow-xl z-20">
              {QUICK_REACTIONS.map(emoji => (
                <button key={emoji} onClick={() => onReact(emoji)}
                  className="text-lg hover:scale-125 active:scale-125 transition-transform px-0.5">
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function FeedItem({ item, members, avatars, penalty, currentUid, reactionPickerOpen, onToggleReactionPicker, onReact }) {
  if (item.type === 'shoutout') {
    return (
      <div className="border-b border-zinc-200 dark:border-zinc-800 py-3">
        <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="text-base leading-none">{item.emoji}</span>
          <span className="font-bold text-amber-500 dark:text-amber-400">{item.from}</span>
          <span>→</span>
          <span className="font-bold text-zinc-800 dark:text-zinc-200">{item.to}</span>
          <span>·</span>
          <span>{timeAgo(item.timestamp)}</span>
        </p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1.5">{item.message}</p>
      </div>
    )
  }

  if (item.type === 'day_summary') {
    const dayLabel = new Date(item.day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return (
      <div className="border-b border-zinc-200 dark:border-zinc-800 py-3">
        {/* Reddit-style byline: small inline avatar + name · date */}
        <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <Avatar name={item.name} emoji={avatars[item.name]} members={members} px={18} />
          <span className="font-bold text-zinc-800 dark:text-zinc-200">{item.name}</span>
          <span>·</span>
          <span>{dayLabel}</span>
          {item.timestamp && <span className="text-zinc-400 dark:text-zinc-600">(edited {timeAgo(item.timestamp)})</span>}
        </p>
        {/* Body: what changed that day */}
        {item.goalTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {item.goalTags.map((t, i) => (
              <span key={i} className="flex items-center gap-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-full pl-1.5 pr-2 py-0.5">
                {t.detail ? (
                  <>
                    <span className="font-semibold">{t.text}</span>
                    <span className="text-zinc-400 dark:text-zinc-500">·</span>
                    <span className="font-bold tabular-nums">{t.detail}</span>
                  </>
                ) : (
                  <>
                    <Check size={11} strokeWidth={3} />
                    <span className="font-semibold">{t.text}</span>
                  </>
                )}
              </span>
            ))}
          </div>
        )}
        {item.noteText && <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1.5">{item.noteText}</p>}
        {item.photos.length > 0 && (
          <div className={`grid gap-1 mt-2 ${item.photos.length === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>
            {item.photos.slice(0, 6).map((url, i) => (
              <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-lg" />
            ))}
          </div>
        )}
        <ReactionRow reactions={item.reactions} currentUid={currentUid}
          open={reactionPickerOpen} onToggleOpen={onToggleReactionPicker} onReact={onReact} />
      </div>
    )
  }

  if (item.type === 'completed') {
    return (
      <div className="border-b border-zinc-200 dark:border-zinc-800 py-3">
        <p className="flex items-center gap-1.5 text-sm text-zinc-800 dark:text-zinc-200">
          <Avatar name={item.name} emoji={avatars[item.name]} members={members} px={18} />
          <span className="font-bold text-emerald-500 dark:text-emerald-400">{item.name}</span>
          <span className="text-zinc-500 text-xs">crushed the week ✅ · {timeAgo(item.timestamp)}</span>
        </p>
      </div>
    )
  }

  if (item.type === 'failed') {
    return (
      <div className="border-b border-zinc-200 dark:border-zinc-800 py-3">
        <p className="flex items-center gap-1.5 text-sm text-zinc-800 dark:text-zinc-200">
          <Avatar name={item.name} emoji={avatars[item.name]} members={members} px={18} />
          <span className="font-bold text-red-500 dark:text-red-400">{item.name}</span>
          <span className="text-zinc-500 text-xs">missed the week ❌ +${penalty} to the pot · {timeAgo(item.timestamp)}</span>
        </p>
      </div>
    )
  }

  return null
}
