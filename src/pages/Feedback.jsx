import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft, Bold, Italic, List, ListOrdered, CheckSquare, Heading2 } from 'lucide-react'

function ToolBtn({ onClick, active, children }) {
  return (
    <button onMouseDown={e => { e.preventDefault(); onClick() }}
      className={`p-2 rounded-lg transition-colors ${active
        ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white'
        : 'text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200'}`}>
      {children}
    </button>
  )
}

export default function Feedback() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const timerRef = useRef(null)
  const savedRef = useRef(false)

  const draftRef = user ? doc(db, 'feedback_drafts', user.uid) : null

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Write your thoughts here…' }),
    ],
    content: '',
    editorProps: {
      attributes: { class: 'outline-none min-h-[60vh]' },
    },
    onUpdate: ({ editor }) => {
      savedRef.current = false
      setStatus('')
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => save(editor.getJSON()), 1500)
    },
  })

  // Load from Firestore on mount
  useEffect(() => {
    if (!draftRef || !editor) return
    getDoc(draftRef).then(snap => {
      if (snap.exists() && snap.data().content) {
        editor.commands.setContent(snap.data().content, false)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [editor])

  const save = async (content) => {
    if (!draftRef) return
    setStatus('saving')
    try {
      await setDoc(draftRef, {
        content,
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

  const handleBack = async () => {
    clearTimeout(timerRef.current)
    if (!savedRef.current && editor) await save(editor.getJSON())
    navigate(-1)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col max-w-lg mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-zinc-100 dark:border-zinc-900">
        <button onClick={handleBack}
          className="p-2 -ml-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <span className={`text-xs font-medium ${status === 'error' ? 'text-red-400' : 'text-zinc-400 dark:text-zinc-600'}`}>
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : status === 'error' ? 'Save failed' : ''}
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-zinc-100 dark:border-zinc-900">
        <ToolBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')}>
          <Bold size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')}>
          <Italic size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })}>
          <Heading2 size={15} />
        </ToolBtn>
        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-800 mx-1" />
        <ToolBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')}>
          <List size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')}>
          <ListOrdered size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleTaskList().run()} active={editor?.isActive('taskList')}>
          <CheckSquare size={15} />
        </ToolBtn>
      </div>

      {/* Editor */}
      <div className="flex-1 px-5 py-4">
        <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-1">Feedback</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-zinc-400">
            <div className="w-4 h-4 border-2 border-zinc-300 dark:border-zinc-700 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <EditorContent editor={editor} className="tiptap-note" />
        )}
      </div>
    </div>
  )
}
