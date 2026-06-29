import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { useState, useEffect } from 'react'
import { Camera, Bold, Italic, List, CheckSquare } from 'lucide-react'

const NOTE_COLORS = [
  { id: 'yellow', bg: 'bg-yellow-100', border: 'border-yellow-200', dot: 'bg-yellow-300' },
  { id: 'blue',   bg: 'bg-sky-100',    border: 'border-sky-200',    dot: 'bg-sky-300' },
  { id: 'green',  bg: 'bg-green-100',  border: 'border-green-200',  dot: 'bg-green-300' },
  { id: 'pink',   bg: 'bg-rose-100',   border: 'border-rose-200',   dot: 'bg-rose-300' },
  { id: 'purple', bg: 'bg-purple-100', border: 'border-purple-200', dot: 'bg-purple-300' },
]

function ToolbarBtn({ onClick, active, children }) {
  return (
    <button onMouseDown={e => { e.preventDefault(); onClick() }}
      className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-black/10 text-zinc-700' : 'text-zinc-400 hover:text-zinc-600 hover:bg-black/5'}`}>
      {children}
    </button>
  )
}

export default function DailyNote({ daily, canEdit, dayLabel, onSave, onColorSave, onPhotoUpload, uploadingPhoto }) {
  const [isEditing, setIsEditing] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)

  const colorId = daily.color || 'yellow'
  const noteColor = NOTE_COLORS.find(c => c.id === colorId) || NOTE_COLORS[0]
  const isEmpty = !daily.content && !daily.note && !daily.photoUrl

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Write a note for today…' }),
    ],
    content: daily.content || daily.note || '',
    editable: false,
  })

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.setEditable(isEditing)
    if (!isEditing) return
    const t = setTimeout(() => {
      if (!editor.isDestroyed) editor.commands.focus('end')
    }, 30)
    return () => clearTimeout(t)
  }, [isEditing, editor])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const incoming = daily.content || daily.note || ''
    editor.commands.setContent(incoming, false)
  }, [daily.content, daily.note, editor])

  const handleDone = () => {
    if (!editor || editor.isDestroyed) return
    onSave(editor.getJSON(), editor.getText().trim())
    setIsEditing(false)
    setShowColorPicker(false)
  }

  if (!canEdit && isEmpty) return null

  return (
    <div className={`mt-4 rounded-2xl shadow-sm overflow-hidden border ${noteColor.bg} ${noteColor.border}`}>
      {/* Header */}
      <div className="px-4 pt-3 pb-1">
        <p className="font-bold text-sm text-zinc-700">{dayLabel}</p>
        {!isEmpty && <p className="text-[10px] text-zinc-400 mt-0.5">Daily note</p>}
      </div>

      {/* Photo */}
      {daily.photoUrl && (
        <div className="px-4 pb-2">
          <img src={daily.photoUrl} alt="" className="w-full max-h-48 rounded-xl object-cover" />
        </div>
      )}

      {/* Editor area */}
      <div
        className="px-4 pb-3 min-h-[72px] cursor-text"
        onClick={() => { if (canEdit && !isEditing) setIsEditing(true) }}>
        {isEmpty && !isEditing ? (
          <p className="text-sm text-zinc-400 italic select-none">Add a note…</p>
        ) : (
          <EditorContent editor={editor} className="tiptap-note" />
        )}
      </div>

      {/* Toolbar */}
      {canEdit && (
        <>
          <div className={`px-3 py-2 border-t ${noteColor.border} flex items-center justify-between`}>
            <div className="flex items-center gap-0.5">
              {isEditing && (
                <>
                  <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor?.isActive('bold')}>
                    <Bold size={14} />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')}>
                    <Italic size={14} />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')}>
                    <List size={14} />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor?.isActive('taskList')}>
                    <CheckSquare size={14} />
                  </ToolbarBtn>
                  <div className="w-px h-4 bg-black/10 mx-1.5" />
                </>
              )}
              <label className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-black/5 rounded-lg transition-colors cursor-pointer">
                {uploadingPhoto
                  ? <div className="w-3.5 h-3.5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                  : <Camera size={14} />}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhotoUpload} />
              </label>
              <button onClick={() => setShowColorPicker(v => !v)}
                className={`ml-1 w-4 h-4 rounded-sm border border-black/10 shadow-sm ${noteColor.dot} hover:scale-110 transition-transform`} />
            </div>
            {isEditing && (
              <button onClick={handleDone}
                className="px-3 py-1 bg-zinc-700 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg transition-colors">
                Done
              </button>
            )}
          </div>

          {showColorPicker && (
            <div className={`px-4 pb-3 pt-1.5 flex items-center gap-2.5 border-t ${noteColor.border}`}>
              {NOTE_COLORS.map(c => (
                <button key={c.id}
                  onClick={() => { onColorSave(c.id); setShowColorPicker(false) }}
                  className={`w-6 h-6 rounded-full ${c.dot} border-2 transition-transform hover:scale-110 ${colorId === c.id ? 'border-zinc-500 scale-110' : 'border-transparent'}`} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
