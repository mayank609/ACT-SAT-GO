import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Bold, Italic, ImageIcon, List, ListOrdered, Sigma, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const MATH_CATEGORIES = [
  {
    name: "General Math",
    items: [
      { label: "Fraction", latex: "\\frac{a}{b}" },
      { label: "Square Root", latex: "\\sqrt{x}" },
      { label: "N-th Root", latex: "\\sqrt[n]{x}" },
      { label: "Exponent", latex: "x^{y}" },
      { label: "Subscript", latex: "x_{i}" },
      { label: "Vector", latex: "\\vec{v}" },
    ]
  },
  {
    name: "Calculus & Matrices",
    items: [
      { label: "Integral", latex: "\\int_{a}^{b} x dx" },
      { label: "Summation (Σ)", latex: "\\sum_{i=1}^{n} i" },
      { label: "Limit", latex: "\\lim_{x \\to \\infty}" },
      { label: "2x2 Matrix", latex: "\\begin{matrix} a & b \\\\ c & d \\end{matrix}" },
    ]
  },
  {
    name: "Greek Letters",
    items: [
      { label: "Alpha (α)", latex: "\\alpha" },
      { label: "Beta (β)", latex: "\\beta" },
      { label: "Theta (θ)", latex: "\\theta" },
      { label: "Pi (π)", latex: "\\pi" },
      { label: "Sigma (σ)", latex: "\\sigma" },
      { label: "Delta (Δ)", latex: "\\Delta" },
    ]
  },
  {
    name: "Physics & Chemistry",
    items: [
      { label: "Mass-Energy", latex: "E = mc^2" },
      { label: "Water", latex: "H_2O" },
      { label: "Carbon Dioxide", latex: "CO_2" },
      { label: "Chemical Arrow", latex: "A + B \\to C" },
    ]
  }
];

export function RichTextEditor({ 
  content, 
  onChange 
}: { 
  content: string;
  onChange: (html: string) => void;
}) {
  const [showMathToolbar, setShowMathToolbar] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[120px] p-3 text-slate-800',
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  const addImage = () => {
    const url = window.prompt('Enter Image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const insertFormula = (latex: string) => {
    const isBlockStructure = latex.includes('\\begin{matrix}');
    const wrapper = isBlockStructure ? `$$${latex}$$` : `$${latex}$`;
    editor.chain().focus().insertContent(wrapper).run();
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 p-2 bg-slate-50">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded transition-colors ${editor.isActive('bold') ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
          type="button"
          title="Bold"
        >
          <Bold size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded transition-colors ${editor.isActive('italic') ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
          type="button"
          title="Italic"
        >
          <Italic size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded transition-colors ${editor.isActive('bulletList') ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
          type="button"
          title="Bullet List"
        >
          <List size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded transition-colors ${editor.isActive('orderedList') ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
          type="button"
          title="Numbered List"
        >
          <ListOrdered size={16} />
        </button>
        
        <div className="w-px h-5 bg-slate-200 mx-1"></div>
        
        <button
          onClick={addImage}
          className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Add Image URL"
          type="button"
        >
          <ImageIcon size={16} />
        </button>

        <button
          onClick={() => setShowMathToolbar(!showMathToolbar)}
          className={`p-1.5 rounded transition-colors ${showMathToolbar ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
          title="Insert Math/Scientific Formula"
          type="button"
        >
          <Sigma size={16} />
        </button>
      </div>

      {/* Math Insert Helper Toolbar */}
      {showMathToolbar && (
        <div className="bg-slate-50 border-b border-slate-200 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">LaTeX Formula Helper</span>
            <button 
              onClick={() => setShowMathToolbar(false)}
              className="text-slate-400 hover:text-slate-700 transition-colors"
              type="button"
            >
              <X size={14} />
            </button>
          </div>
          
          {/* Category Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {MATH_CATEGORIES.map((cat, idx) => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(idx)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${activeCategory === idx ? 'bg-slate-200 text-emerald-800' : 'text-slate-500 hover:bg-slate-100'}`}
                type="button"
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Preset buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {MATH_CATEGORIES[activeCategory].items.map((item) => (
              <button
                key={item.label}
                onClick={() => insertFormula(item.latex)}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border border-slate-200 hover:border-emerald-500 hover:bg-slate-50 transition-all text-center"
                type="button"
                title={`Insert ${item.label}`}
              >
                <code className="text-slate-700 text-xs font-mono mb-1">{item.latex}</code>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}

