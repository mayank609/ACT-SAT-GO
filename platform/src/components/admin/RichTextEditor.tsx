'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Bold, Italic, ImageIcon, List, ListOrdered } from 'lucide-react'
import { useEffect } from 'react'

export default function RichTextEditor({ 
  content, 
  onChange 
}: { 
  content: string
  onChange: (html: string) => void 
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-emerald sm:prose-base focus:outline-none min-h-[150px] p-4 text-slate-200',
      },
    },
  })

  // Prevent hydration mismatch or stale content issues
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  if (!editor) {
    return null
  }

  const addImage = () => {
    // For this iteration, we use a URL prompt. 
    // In a production scenario, you would implement a file uploader that pushes to Supabase Storage and returns the URL.
    const url = window.prompt('URL of the image (e.g. https://...):')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900/50">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-700 p-2 bg-slate-800">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
          type="button"
        >
          <Bold size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
          type="button"
        >
          <Italic size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded-lg transition-colors ${editor.isActive('bulletList') ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
          type="button"
        >
          <List size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded-lg transition-colors ${editor.isActive('orderedList') ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
          type="button"
        >
          <ListOrdered size={18} />
        </button>
        
        <div className="w-px h-6 bg-slate-700 mx-1"></div>
        
        <button
          onClick={addImage}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          title="Add Image via URL"
          type="button"
        >
          <ImageIcon size={18} />
        </button>
      </div>
      
      <div className="bg-slate-900/20 max-w-none">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
