import { useState, useRef } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'
import { Send, Camera } from 'lucide-react'

const REACTIONS = ['🔥', '💪', '👏', '❤️']

// Stripped-down: notes, photos, reactions for the selected day.
// Logging is handled inline in MemberProfile goal cards.
export default function WeekCalendar({ entryId, selectedDay, logs = {} }) {
  const [noteInput, setNoteInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const dayLog = logs[selectedDay] || {}

  const patch = async (data) => {
    if (!entryId) return
    await setDoc(doc(db, 'entries', entryId, 'dailyLogs', selectedDay), { ...dayLog, ...data })
  }

  const addNote = async () => {
    if (!noteInput.trim()) return
    setSaving(true)
    await patch({ notes: [...(dayLog.notes || []), noteInput.trim()] })
    setNoteInput('')
    setSaving(false)
  }

  const addReaction = async (emoji) => {
    const reactions = { ...(dayLog.reactions || {}) }
    reactions[emoji] = (reactions[emoji] || 0) + 1
    await patch({ reactions })
  }

  const uploadPhoto = async (file) => {
    if (!entryId || !file) return
    setUploading(true)
    try {
      const path = `photos/${entryId}/${selectedDay}/${Date.now()}_${file.name}`
      const snap = await uploadBytes(storageRef(storage, path), file)
      const url = await getDownloadURL(snap.ref)
      await patch({ photos: [...(dayLog.photos || []), url] })
    } catch (e) { console.error('Upload failed:', e) }
    setUploading(false)
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-4">
      {/* Reactions */}
      <div className="space-y-2">
        <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Cheer</p>
        <div className="flex gap-2">
          {REACTIONS.map(emoji => {
            const count = dayLog.reactions?.[emoji] || 0
            return (
              <button key={emoji} onClick={() => addReaction(emoji)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all active:scale-95 ${
                  count > 0
                    ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}>
                <span className="text-base leading-none">{emoji}</span>
                {count > 0 && <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{count}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* Notes */}
      {dayLog.notes?.length > 0 && (
        <div className="space-y-1.5">
          {dayLog.notes.map((note, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="text-emerald-500 mt-0.5 shrink-0">→</span>
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input type="text" placeholder="Add a note..."
          value={noteInput}
          onChange={e => setNoteInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addNote()}
          style={{ fontSize: 16 }}
          className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
        />
        <button onClick={addNote} disabled={saving || !noteInput.trim()}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl px-3 transition-colors">
          <Send size={15} />
        </button>
      </div>

      {/* Photos */}
      {dayLog.photos?.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {dayLog.photos.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
              <img src={url} alt="" className="w-full aspect-square object-cover rounded-xl border border-zinc-200 dark:border-zinc-800" />
            </a>
          ))}
        </div>
      )}

      <input type="file" accept="image/*" ref={fileInputRef} className="hidden"
        onChange={e => { if (e.target.files[0]) uploadPhoto(e.target.files[0]); e.target.value = '' }}
      />
      <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-500 transition-colors text-sm disabled:opacity-40">
        <Camera size={14} />
        {uploading ? 'Uploading...' : 'Add photo proof'}
      </button>
    </div>
  )
}
