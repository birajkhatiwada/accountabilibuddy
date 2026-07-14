import { useEditor, EditorContent } from '@tiptap/react'
import { createPortal } from 'react-dom'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Camera, Bold, Italic, List, CheckSquare, Plus, Pencil, X } from 'lucide-react'
import useLockBodyScroll from '../useLockBodyScroll'

const NOTE_COLORS = [
  { id: 'default', bg: 'bg-zinc-50 dark:bg-zinc-800/50',       border: 'border-zinc-200 dark:border-zinc-700/50',        dot: 'bg-zinc-300 dark:bg-zinc-600' },
  { id: 'yellow',  bg: 'bg-yellow-50 dark:bg-yellow-950/60',   border: 'border-yellow-200 dark:border-yellow-800/60',    dot: 'bg-yellow-300 dark:bg-yellow-600' },
  { id: 'blue',    bg: 'bg-sky-50 dark:bg-sky-950/60',         border: 'border-sky-200 dark:border-sky-800/60',          dot: 'bg-sky-300 dark:bg-sky-600' },
  { id: 'green',   bg: 'bg-green-50 dark:bg-green-950/60',     border: 'border-green-200 dark:border-green-800/60',      dot: 'bg-green-300 dark:bg-green-600' },
  { id: 'pink',    bg: 'bg-rose-50 dark:bg-rose-950/60',       border: 'border-rose-200 dark:border-rose-800/60',        dot: 'bg-rose-300 dark:bg-rose-600' },
  { id: 'purple',  bg: 'bg-purple-50 dark:bg-purple-950/60',   border: 'border-purple-200 dark:border-purple-800/60',    dot: 'bg-purple-300 dark:bg-purple-600' },
]

function ToolbarBtn({ onClick, active, children }) {
  return (
    <button
      onPointerDown={e => { e.preventDefault(); onClick() }}
      className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-black/10 dark:bg-white/10 text-zinc-700 dark:text-zinc-200' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5'}`}>
      {children}
    </button>
  )
}

// Reads inline (so you can glance at a note while scrolling without
// opening anything), but editing happens in a centered popup — matching
// how every other edit action in the app works (Edit Profile, logging,
// goal templates), instead of an inline-expanding toolbar that used to
// shove the rest of the page around while writing.
export default function DailyNote({ daily, photos, canEdit, dayLabel, onSave, onColorSave, onPhotoUpload, onPhotoRemove, uploadingPhoto }) {
  const photoList = photos ?? (daily.photoUrl ? [daily.photoUrl] : [])
  const [open, setOpen] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  useLockBodyScroll(open)

  // This block usually sits near the bottom of the page. Unmounting it
  // outright while the popup is open would shrink <main>'s scrollable
  // height right as you're scrolled down to reach it — the browser then
  // clamps scrollTop to the new (smaller) max, which looks exactly like
  // the page scrolling itself up the instant the popup opens. Reserving
  // its measured height with a placeholder avoids that entirely.
  const inlineRef = useRef(null)
  const [reservedHeight, setReservedHeight] = useState(null)
  useLayoutEffect(() => {
    if (!open && inlineRef.current) setReservedHeight(inlineRef.current.offsetHeight)
  })

  const colorId = daily.color || 'default'
  const noteColor = NOTE_COLORS.find(c => c.id === colorId) || NOTE_COLORS[0]

  // Whether there's text is tracked from the editor itself, not the
  // `daily` prop — the prop only updates once the save round-trips back
  // through Firestore, so right after hitting Done the inline view would
  // still think the note was empty and show the "+ Add note" button
  // instead of what was just typed.
  const [textEmpty, setTextEmpty] = useState(!(daily.content || daily.note))
  const isEmpty = textEmpty && !photoList.length

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Write something here…' }),
    ],
    content: daily.content || daily.note || '',
    editable: false,
    onUpdate: ({ editor }) => setTextEmpty(editor.isEmpty),
  })

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.setEditable(open && canEdit)
  }, [open, canEdit, editor])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const incoming = daily.content || daily.note || ''
    editor.commands.setContent(incoming, false)
    setTextEmpty(editor.isEmpty)
  }, [daily.content, daily.note, editor])

  // Drop straight into typing the moment the popup opens — but bypass
  // Tiptap's own focus() command to get there. On iOS/Android it always
  // calls the raw DOM focus() *without* preventScroll internally
  // (regardless of the scrollIntoView option, which only gates a
  // separate follow-up scroll call), so the browser drags the whole
  // page to wherever it thinks the cursor needs to be visible. Calling
  // the underlying view's focus ourselves with preventScroll skips that
  // entirely — there's nothing to scroll into view anyway right after
  // the popup has just opened centered on screen.
  useEffect(() => {
    if (open && editor && !editor.isDestroyed) {
      editor.view.dom.focus({ preventScroll: true })
    }
  }, [open])

  const handleDone = () => {
    if (!editor || editor.isDestroyed) return
    const text = editor.getText().trim()
    onSave(editor.getJSON(), text)
    setShowColorPicker(false)
    setOpen(false)
  }

  if (!canEdit && isEmpty) return null

  return (
    <>
      {/* Only ever mount one EditorContent at a time — while the popup is
          open it owns the editor's DOM view; if the inline card below
          mounted its own EditorContent simultaneously (which could
          happen the instant typing makes `isEmpty` flip), the two would
          fight over the same editor instance and the view would end up
          attached to neither correctly. While open, a same-height blank
          placeholder holds this block's space (see reservedHeight above)
          instead of unmounting it outright. */}
      {open ? (
        <div style={{ height: reservedHeight ?? undefined }} className="mt-4" aria-hidden="true" />
      ) : (
        <div ref={inlineRef}>
          {isEmpty && canEdit ? (
            <button
              onPointerDown={e => e.preventDefault()}
              onClick={() => setOpen(true)}
              className="mt-4 w-full py-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-500 hover:border-emerald-500/50 hover:text-emerald-500 transition-all text-xs font-semibold flex items-center justify-center gap-1.5">
              <Plus size={12} /> Add note
            </button>
          ) : (
            <div
              role={canEdit ? 'button' : undefined}
              tabIndex={canEdit ? 0 : undefined}
              onPointerDown={e => canEdit && e.preventDefault()}
              onClick={() => canEdit && setOpen(true)}
              onKeyDown={e => { if (canEdit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(true) } }}
              className={`mt-4 w-full text-left rounded-2xl shadow-sm overflow-hidden border ${noteColor.bg} ${noteColor.border} transition-colors duration-300 ${canEdit ? 'cursor-pointer' : ''}`}>
              <div className="px-4 pt-3 pb-1 flex items-start justify-between gap-2 pointer-events-none">
                <div>
                  <p className="font-bold text-sm text-zinc-700 dark:text-zinc-200">{dayLabel}</p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">Daily note</p>
                </div>
                {canEdit && <Pencil size={12} className="text-zinc-400 dark:text-zinc-500 shrink-0 mt-1" />}
              </div>
              {photoList.length > 0 && (
                <div className={`px-4 pb-2 pointer-events-none grid gap-1.5 ${photoList.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {photoList.map(url => (
                    <img key={url} src={url} alt="" className={`w-full rounded-xl object-cover ${photoList.length === 1 ? 'max-h-48' : 'h-24'}`} />
                  ))}
                </div>
              )}
              <div className="px-4 pb-3 pointer-events-none">
                <EditorContent editor={editor} className="tiptap-note" />
              </div>
            </div>
          )}
        </div>
      )}

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleDone}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className={`relative w-full max-w-lg modal-pop max-h-[85vh] overflow-y-auto flex flex-col rounded-2xl shadow-2xl border ${noteColor.bg} ${noteColor.border}`}
            onClick={e => e.stopPropagation()}>
            <div className="px-4 pt-3 pb-1 flex items-center justify-between shrink-0">
              <p className="font-bold text-sm text-zinc-700 dark:text-zinc-200">{dayLabel}</p>
              <button onClick={handleDone} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><X size={16} /></button>
            </div>

            {photoList.length > 0 && (
              <div className={`px-4 pb-2 shrink-0 grid gap-1.5 ${photoList.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {photoList.map(url => (
                  <div key={url} className="relative rounded-xl overflow-hidden">
                    <img src={url} alt="" className={`w-full object-cover ${photoList.length === 1 ? 'max-h-48' : 'h-24'}`} />
                    {canEdit && (
                      <button onClick={() => onPhotoRemove(url)}
                        className="absolute top-1.5 right-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="px-4 pb-3 min-h-[96px] flex-1">
              <EditorContent editor={editor} className="tiptap-note" />
            </div>

            <div className={`px-3 py-2 border-t ${noteColor.border} flex items-center justify-between shrink-0`}>
              <div className="flex items-center gap-0.5">
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')}>
                  <Bold size={14} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')}>
                  <Italic size={14} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')}>
                  <List size={14} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleTaskList().run()} active={editor?.isActive('taskList')}>
                  <CheckSquare size={14} />
                </ToolbarBtn>
                <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-1.5" />
                <label className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer">
                  {uploadingPhoto
                    ? <div className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                    : <Camera size={14} />}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhotoUpload} />
                </label>
                <button
                  onPointerDown={e => { e.preventDefault(); setShowColorPicker(v => !v) }}
                  className={`ml-1 w-4 h-4 rounded-sm border border-black/10 dark:border-white/10 shadow-sm ${noteColor.dot} hover:scale-110 transition-transform`} />
              </div>
              <button onClick={handleDone}
                className="px-3 py-1 bg-zinc-700 dark:bg-zinc-600 hover:bg-zinc-800 dark:hover:bg-zinc-500 text-zinc-100 text-xs font-semibold rounded-lg transition-colors">
                Done
              </button>
            </div>

            {showColorPicker && (
              <div className={`px-4 pb-3 pt-1.5 flex items-center gap-2.5 border-t ${noteColor.border} shrink-0`}>
                {NOTE_COLORS.map(c => (
                  <button key={c.id}
                    onPointerDown={e => { e.preventDefault(); onColorSave(c.id); setShowColorPicker(false) }}
                    className={`w-6 h-6 rounded-full ${c.dot} border-2 transition-transform hover:scale-110 ${colorId === c.id ? 'border-zinc-500 dark:border-zinc-300 scale-110' : 'border-transparent'}`} />
                ))}
              </div>
            )}
          </div>
        </div>
      , document.body)}
    </>
  )
}
