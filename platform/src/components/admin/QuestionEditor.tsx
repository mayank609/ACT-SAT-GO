'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { Save, Loader2 } from 'lucide-react'
import RichTextEditor from './RichTextEditor'
import { MathRenderer } from './MathRenderer'
import { updateQuestion, createQuestion } from '@/actions/test-actions'
import { Difficulty, QuestionType } from '@prisma/client'

export type QuestionData = {
  id?: string
  content: { text: string }
  options?: any
  correctAnswer: any
  difficultyLevel: Difficulty
  topicId?: string
  type: QuestionType
}

export default function QuestionEditor({ 
  initialData, 
  topics 
}: { 
  initialData?: QuestionData,
  topics: { id: string, name: string }[]
}) {
  const [data, setData] = useState<QuestionData>(initialData || {
    content: { text: '' },
    options: { A: '', B: '', C: '', D: '' },
    correctAnswer: { correct: 'A' },
    difficultyLevel: 'MEDIUM',
    type: 'MCQ'
  })

  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Prevent accidental tab closure if unsaved
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const handleSave = useCallback(async (isAutoSave = false) => {
    if (!isDirty && !isAutoSave) return

    if (!isAutoSave) setIsSaving(true)
    
    try {
      let res: any;
      if (data.id) {
        res = await updateQuestion(data.id, {
          content: data.content,
          options: data.options,
          correctAnswer: data.correctAnswer,
          difficultyLevel: data.difficultyLevel,
          topicId: data.topicId
        })
      } else {
        res = await createQuestion({
          type: data.type,
          content: data.content,
          options: data.options,
          correctAnswer: data.correctAnswer,
          difficultyLevel: data.difficultyLevel,
          topicId: data.topicId
        })
        
        if (res.success && res.question) {
           setData(prev => ({ ...prev, id: res.question!.id }))
        }
      }

      if (res.success) {
        setIsDirty(false)
        if (!isAutoSave) toast.success('Question saved successfully!')
      } else {
        if (!isAutoSave) toast.error('Failed to save question.')
      }
    } catch (error) {
      if (!isAutoSave) toast.error('An error occurred while saving.')
    } finally {
      if (!isAutoSave) setIsSaving(false)
    }
  }, [data, isDirty])

  // Auto-save logic (Debounced)
  useEffect(() => {
    if (isDirty) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        handleSave(true)
      }, 3000) // Auto-save after 3 seconds of inactivity
    }
  }, [data, isDirty, handleSave])

  const updateField = (field: string, value: any) => {
    setData(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
  }

  const updateContent = (html: string) => {
    setData(prev => ({ ...prev, content: { ...prev.content, text: html } }))
    setIsDirty(true)
  }

  const updateOption = (key: string, value: string) => {
    setData(prev => ({
      ...prev,
      options: { ...prev.options, [key]: value }
    }))
    setIsDirty(true)
  }

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">
          {data.id ? 'Edit Question' : 'Create New Question'}
        </h2>
        <div className="flex items-center gap-4">
          {isDirty && <span className="text-amber-500 text-sm animate-pulse">Unsaved changes...</span>}
          <button
            onClick={() => handleSave(false)}
            disabled={isSaving || !isDirty}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {isSaving ? 'Saving...' : 'Save Question'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400">Topic Tag</label>
          <select 
            value={data.topicId || ''} 
            onChange={(e) => updateField('topicId', e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
          >
            <option value="">Select a Topic</option>
            {topics.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400">Difficulty Level</label>
          <select 
            value={data.difficultyLevel} 
            onChange={(e) => updateField('difficultyLevel', e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
          >
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400">Question Content</label>
          <RichTextEditor 
            content={data.content.text} 
            onChange={updateContent} 
          />
        </div>

        {/* Live Equation / Science Renderer Preview Panel */}
        <div className="space-y-2 border border-slate-800 bg-slate-950/60 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-900">
            <span>Exam Rendering Preview (Dynamic Math & Science)</span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">KaTeX Active</span>
          </div>
          <div className="min-h-[80px] flex items-center p-2 text-slate-100">
            {data.content.text ? (
              <MathRenderer html={data.content.text} className="w-full prose-invert prose-emerald" />
            ) : (
              <span className="text-slate-500 italic text-sm">Write equations or select formulas from the toolbar to see standard exam previews...</span>
            )}
          </div>
        </div>
      </div>

      {data.type === 'MCQ' && (
        <div className="space-y-4">
          <label className="text-sm font-medium text-slate-400">Answer Options (MCQ)</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {['A', 'B', 'C', 'D'].map((opt) => (
              <div key={opt} className="flex gap-3 items-start">
                <button
                  type="button"
                  onClick={() => updateField('correctAnswer', { correct: opt })}
                  className={`mt-1 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-all ${
                    data.correctAnswer.correct === opt 
                      ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {opt}
                </button>
                <div className="flex-grow">
                   {/* We could use RichTextEditor here too, but simple textarea is fine for options unless requested otherwise */}
                   <textarea
                     value={data.options?.[opt] || ''}
                     onChange={(e) => updateOption(opt, e.target.value)}
                     className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 min-h-[80px]"
                     placeholder={`Option ${opt} text...`}
                   />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">Click the letter to mark it as the correct answer.</p>
        </div>
      )}
    </div>
  )
}
