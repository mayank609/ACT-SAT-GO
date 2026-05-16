import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical, Save, Eye, Settings2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import type { Section, Question, QuestionType, Difficulty } from '../../types';

const TOPICS = ['Algebra', 'Geometry', 'Trigonometry', 'Statistics', 'Grammar', 'Punctuation', 'Rhetorical Skills', 'Main Idea', 'Inference', 'Vocabulary', 'Data Analysis', 'Scientific Method'];

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function newQuestion(): Question {
  return {
    id: generateId(),
    text: '',
    type: 'mcq_single',
    options: [
      { id: 'a', text: '' },
      { id: 'b', text: '' },
      { id: 'c', text: '' },
      { id: 'd', text: '' },
    ],
    correctAnswer: 'a',
    topic: '',
    difficulty: 'medium',
  };
}

function newSection(): Section {
  return {
    id: generateId(),
    name: 'New Section',
    timeLimit: 45,
    questions: [newQuestion()],
  };
}

interface QuestionEditorProps {
  question: Question;
  index: number;
  onUpdate: (q: Question) => void;
  onDelete: () => void;
}

function QuestionEditor({ question, index, onUpdate, onDelete }: QuestionEditorProps) {
  const [expanded, setExpanded] = useState(index === 0);

  const difficultyColors: Record<Difficulty, string> = {
    easy: 'success',
    medium: 'warning',
    hard: 'danger',
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical size={14} className="text-slate-400 cursor-grab" />
        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
          {index + 1}
        </div>
        <span className="flex-1 text-sm text-slate-700 truncate">
          {question.text || 'Untitled question'}
        </span>
        <div className="flex items-center gap-2">
          <Badge variant="default" size="sm">{question.type.replace(/_/g, ' ')}</Badge>
          <Badge variant={difficultyColors[question.difficulty] as 'success' | 'warning' | 'danger'} size="sm">
            {question.difficulty}
          </Badge>
          {question.topic && <Badge variant="info" size="sm">{question.topic}</Badge>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-red-400 hover:text-red-600 rounded transition-colors">
          <Trash2 size={14} />
        </button>
        {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </div>

      {expanded && (
        <div className="p-4 space-y-4 bg-white">
          {/* Question text */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Question Text</label>
            <textarea
              rows={2}
              value={question.text}
              onChange={(e) => onUpdate({ ...question, text: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Enter question text..."
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Type</label>
              <select
                value={question.type}
                onChange={(e) => onUpdate({ ...question, type: e.target.value as QuestionType })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="mcq_single">Multiple Choice (Single)</option>
                <option value="mcq_multi">Multiple Choice (Multi)</option>
                <option value="numeric">Numeric Response</option>
              </select>
            </div>
            {/* Topic */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Topic</label>
              <select
                value={question.topic}
                onChange={(e) => onUpdate({ ...question, topic: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select topic</option>
                {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {/* Difficulty */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Difficulty</label>
              <select
                value={question.difficulty}
                onChange={(e) => onUpdate({ ...question, difficulty: e.target.value as Difficulty })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Options for MCQ */}
          {(question.type === 'mcq_single' || question.type === 'mcq_multi') && question.options && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Options</label>
              <div className="space-y-2">
                {question.options.map((opt) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      {question.type === 'mcq_single' ? (
                        <input
                          type="radio"
                          name={`correct-${question.id}`}
                          checked={question.correctAnswer === opt.id}
                          onChange={() => onUpdate({ ...question, correctAnswer: opt.id })}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                      ) : (
                        <input
                          type="checkbox"
                          checked={Array.isArray(question.correctAnswer) && question.correctAnswer.includes(opt.id)}
                          onChange={(e) => {
                            const curr = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
                            const next = e.target.checked ? [...curr, opt.id] : curr.filter((x) => x !== opt.id);
                            onUpdate({ ...question, correctAnswer: next });
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                      )}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                      {opt.id.toUpperCase()}
                    </div>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => {
                        const opts = question.options!.map((o) => o.id === opt.id ? { ...o, text: e.target.value } : o);
                        onUpdate({ ...question, options: opts });
                      }}
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Option ${opt.id.toUpperCase()}`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {question.type === 'mcq_single' ? 'Select the radio button for the correct answer' : 'Check all correct answers'}
              </p>
            </div>
          )}

          {/* Numeric answer */}
          {question.type === 'numeric' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Correct Answer</label>
              <input
                type="number"
                value={typeof question.correctAnswer === 'number' ? question.correctAnswer : ''}
                onChange={(e) => onUpdate({ ...question, correctAnswer: parseFloat(e.target.value) })}
                className="w-48 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Numeric answer"
              />
            </div>
          )}

          {/* Explanation */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Explanation (optional)</label>
            <textarea
              rows={2}
              value={question.explanation || ''}
              onChange={(e) => onUpdate({ ...question, explanation: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Explain the correct answer..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function TestBuilderPage() {
  const [testTitle, setTestTitle] = useState('');
  const [testDesc, setTestDesc] = useState('');
  const [sections, setSections] = useState<Section[]>([newSection()]);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [allowBack, setAllowBack] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [saved, setSaved] = useState(false);

  const activeSection = sections[activeSectionIdx];

  const updateSection = (idx: number, updates: Partial<Section>) => {
    setSections((prev) => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
  };

  const updateQuestion = (qId: string, updated: Question) => {
    const qs = activeSection.questions.map((q) => q.id === qId ? updated : q);
    updateSection(activeSectionIdx, { questions: qs });
  };

  const deleteQuestion = (qId: string) => {
    const qs = activeSection.questions.filter((q) => q.id !== qId);
    updateSection(activeSectionIdx, { questions: qs });
  };

  const addQuestion = () => {
    updateSection(activeSectionIdx, { questions: [...activeSection.questions, newQuestion()] });
  };

  const addSection = () => {
    const s = newSection();
    setSections((prev) => [...prev, s]);
    setActiveSectionIdx(sections.length);
  };

  const deleteSection = (idx: number) => {
    setSections((prev) => prev.filter((_, i) => i !== idx));
    setActiveSectionIdx(Math.max(0, idx - 1));
  };

  const totalQuestions = sections.reduce((a, s) => a + s.questions.length, 0);
  const totalTime = sections.reduce((a, s) => a + s.timeLimit, 0);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Test Builder</h1>
          <p className="text-slate-500 text-sm mt-0.5">Create and manage test content</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" icon={<Settings2 size={14} />} onClick={() => setShowSettings(true)}>
            Settings
          </Button>
          <Button variant="secondary" size="sm" icon={<Eye size={14} />}>Preview</Button>
          <Button size="sm" icon={<Save size={14} />} onClick={handleSave} variant={saved ? 'success' : 'primary'}>
            {saved ? '✓ Saved' : 'Save Test'}
          </Button>
        </div>
      </div>

      {/* Test meta */}
      <Card padding="sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Test Title *</label>
            <input
              type="text"
              value={testTitle}
              onChange={(e) => setTestTitle(e.target.value)}
              placeholder="e.g. ACT Full Practice Test #3"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3">
            <div className="text-center px-4 py-2 bg-blue-50 rounded-xl flex-1">
              <p className="text-xl font-bold text-blue-700">{totalQuestions}</p>
              <p className="text-xs text-slate-500">Questions</p>
            </div>
            <div className="text-center px-4 py-2 bg-emerald-50 rounded-xl flex-1">
              <p className="text-xl font-bold text-emerald-700">{totalTime}m</p>
              <p className="text-xs text-slate-500">Total Time</p>
            </div>
            <div className="text-center px-4 py-2 bg-purple-50 rounded-xl flex-1">
              <p className="text-xl font-bold text-purple-700">{sections.length}</p>
              <p className="text-xs text-slate-500">Sections</p>
            </div>
          </div>
        </div>
        {testDesc !== undefined && (
          <div className="mt-3">
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Description</label>
            <input
              type="text"
              value={testDesc}
              onChange={(e) => setTestDesc(e.target.value)}
              placeholder="Brief description of this test..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </Card>

      <div className="flex gap-4">
        {/* Section tabs */}
        <div className="w-52 flex-shrink-0 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 mb-2">Sections</p>
          {sections.map((sec, idx) => (
            <div key={sec.id} className="group flex items-center gap-1">
              <button
                onClick={() => setActiveSectionIdx(idx)}
                className={`flex-1 text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                  activeSectionIdx === idx
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <p className="truncate">{sec.name}</p>
                <p className={`text-xs mt-0.5 ${activeSectionIdx === idx ? 'text-blue-200' : 'text-slate-400'}`}>
                  {sec.questions.length}q · {sec.timeLimit}m
                </p>
              </button>
              {sections.length > 1 && (
                <button
                  onClick={() => deleteSection(idx)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 rounded transition-all"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addSection}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-dashed border-blue-200"
          >
            <Plus size={14} />
            Add Section
          </button>
        </div>

        {/* Section editor */}
        <div className="flex-1 space-y-3">
          {/* Section settings */}
          <Card padding="sm">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Section Name</label>
                <input
                  type="text"
                  value={activeSection.name}
                  onChange={(e) => updateSection(activeSectionIdx, { name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Time Limit (min)</label>
                <input
                  type="number"
                  value={activeSection.timeLimit}
                  onChange={(e) => updateSection(activeSectionIdx, { timeLimit: parseInt(e.target.value) || 0 })}
                  min={1}
                  max={180}
                  className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <span className="text-xs text-slate-500">{activeSection.questions.length} questions</span>
              </div>
            </div>
          </Card>

          {/* Questions */}
          <div className="space-y-2">
            {activeSection.questions.map((q, idx) => (
              <QuestionEditor
                key={q.id}
                question={q}
                index={idx}
                onUpdate={(updated) => updateQuestion(q.id, updated)}
                onDelete={() => deleteQuestion(q.id)}
              />
            ))}
          </div>

          <Button
            variant="secondary"
            onClick={addQuestion}
            icon={<Plus size={14} />}
            className="w-full py-3 border-dashed"
          >
            Add Question to {activeSection.name}
          </Button>
        </div>
      </div>

      {/* Settings Modal */}
      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Test Settings" size="sm">
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowBack}
                onChange={(e) => setAllowBack(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <div>
                <p className="text-sm font-medium text-slate-900">Allow Backward Navigation</p>
                <p className="text-xs text-slate-500">Students can go back to previous sections</p>
              </div>
            </label>
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" />
              <div>
                <p className="text-sm font-medium text-slate-900">Show Results After Submission</p>
                <p className="text-xs text-slate-500">Students can review answers immediately</p>
              </div>
            </label>
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" />
              <div>
                <p className="text-sm font-medium text-slate-900">Enforce Full Screen</p>
                <p className="text-xs text-slate-500">Force students to stay in full-screen mode</p>
              </div>
            </label>
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" />
              <div>
                <p className="text-sm font-medium text-slate-900">Track Tab Switching</p>
                <p className="text-xs text-slate-500">Log when students switch browser tabs</p>
              </div>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Publish Status</label>
            <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowSettings(false)}>Apply Settings</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
