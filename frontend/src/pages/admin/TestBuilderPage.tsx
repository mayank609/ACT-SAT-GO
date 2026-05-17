import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical, Save, Eye, Settings2, Menu, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { useAdminStore } from '../../store/useAdminStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { Section, Question, QuestionType, Difficulty, TestStatus } from '../../types';

const TOPICS = ['Algebra', 'Geometry', 'Trigonometry', 'Statistics', 'Grammar', 'Punctuation', 'Rhetorical Skills', 'Main Idea', 'Inference', 'Vocabulary', 'Data Analysis', 'Scientific Method'];
const SUB_TOPICS: Record<string, string[]> = {
  'Algebra': ['Linear Equations', 'Quadratic Equations', 'Functions', 'Inequalities'],
  'Geometry': ['Triangles', 'Circles', 'Coordinate Geometry', 'Area & Volume'],
  'Trigonometry': ['Sin/Cos/Tan', 'Unit Circle', 'Identities'],
  'Statistics': ['Mean/Median/Mode', 'Probability', 'Distributions'],
  'Grammar': ['Subject-Verb Agreement', 'Pronoun Agreement', 'Modifiers'],
  'Punctuation': ['Commas', 'Semicolons', 'Apostrophes'],
  'Rhetorical Skills': ['Organization', 'Style', 'Strategy'],
  'Data Analysis': ['Charts', 'Tables', 'Graphs'],
  'Scientific Method': ['Hypothesis', 'Variables', 'Conclusions'],
};

function generateId() { return Math.random().toString(36).substr(2, 9); }

function newQuestion(): Question {
  return { id: generateId(), text: '', type: 'mcq_single', options: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }], correctAnswer: 'a', topic: '', difficulty: 'medium' };
}
function newSection(): Section {
  return { id: generateId(), name: 'New Section', timeLimit: 45, questions: [newQuestion()] };
}

interface QuestionEditorProps {
  question: Question;
  index: number;
  onUpdate: (q: Question) => void;
  onDelete: () => void;
}

function QuestionEditor({ question, index, onUpdate, onDelete }: QuestionEditorProps) {
  const [expanded, setExpanded] = useState(index === 0);
  const difficultyColors: Record<Difficulty, 'success' | 'warning' | 'danger'> = { easy: 'success', medium: 'warning', hard: 'danger' };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 md:px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setExpanded(!expanded)}>
        <GripVertical size={13} className="text-slate-400 cursor-grab flex-shrink-0" />
        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">{index + 1}</div>
        <span className="flex-1 text-sm text-slate-700 truncate min-w-0">{question.text || 'Untitled question'}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Badge variant="default" size="sm" className="hidden sm:inline-flex">{question.type.replace(/_/g, ' ')}</Badge>
          <Badge variant={difficultyColors[question.difficulty]} size="sm">{question.difficulty}</Badge>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-red-400 hover:text-red-600 rounded flex-shrink-0"><Trash2 size={13} /></button>
        {expanded ? <ChevronUp size={13} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={13} className="text-slate-400 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="p-3 md:p-4 space-y-3 md:space-y-4 bg-white">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Question Text</label>
            <textarea rows={2} value={question.text} onChange={(e) => onUpdate({ ...question, text: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Enter question text..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Type</label>
              <select value={question.type} onChange={(e) => onUpdate({ ...question, type: e.target.value as QuestionType })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="mcq_single">MCQ — Single Correct</option>
                <option value="mcq_multi">MCQ — Multiple Correct</option>
                <option value="numeric">Numeric Response</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Difficulty</label>
              <select value={question.difficulty} onChange={(e) => onUpdate({ ...question, difficulty: e.target.value as Difficulty })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Topic</label>
              <select value={question.topic} onChange={(e) => onUpdate({ ...question, topic: e.target.value, subTopic: '' })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select topic</option>
                {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Sub-Topic</label>
              <select value={question.subTopic ?? ''} onChange={(e) => onUpdate({ ...question, subTopic: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!question.topic || !SUB_TOPICS[question.topic]}>
                <option value="">Select sub-topic</option>
                {(SUB_TOPICS[question.topic] ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {(question.type === 'mcq_single' || question.type === 'mcq_multi') && question.options && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Options</label>
              <div className="space-y-2">
                {question.options.map((opt) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    {question.type === 'mcq_single' ? (
                      <input type="radio" name={`correct-${question.id}`} checked={question.correctAnswer === opt.id} onChange={() => onUpdate({ ...question, correctAnswer: opt.id })} className="text-blue-600" />
                    ) : (
                      <input type="checkbox" checked={Array.isArray(question.correctAnswer) && question.correctAnswer.includes(opt.id)}
                        onChange={(e) => {
                          const curr = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
                          onUpdate({ ...question, correctAnswer: e.target.checked ? [...curr, opt.id] : curr.filter((x) => x !== opt.id) });
                        }} className="rounded text-blue-600" />
                    )}
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">{opt.id.toUpperCase()}</div>
                    <input type="text" value={opt.text}
                      onChange={(e) => {
                        const opts = question.options!.map((o) => o.id === opt.id ? { ...o, text: e.target.value } : o);
                        onUpdate({ ...question, options: opts });
                      }}
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                      placeholder={`Option ${opt.id.toUpperCase()}`} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {question.type === 'numeric' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Correct Answer</label>
              <input type="number" value={typeof question.correctAnswer === 'number' ? question.correctAnswer : ''}
                onChange={(e) => onUpdate({ ...question, correctAnswer: parseFloat(e.target.value) })}
                className="w-40 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Numeric answer" />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Explanation (optional)</label>
            <textarea rows={2} value={question.explanation || ''} onChange={(e) => onUpdate({ ...question, explanation: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Explain the correct answer..." />
          </div>
        </div>
      )}
    </div>
  );
}

export function TestBuilderPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addTest } = useAdminStore();

  const [testTitle, setTestTitle] = useState('');
  const [testDesc, setTestDesc] = useState('');
  const [sections, setSections] = useState<Section[]>([newSection()]);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showSectionNav, setShowSectionNav] = useState(false);
  const [saved, setSaved] = useState(false);
  const [titleError, setTitleError] = useState(false);

  const [testSettings, setTestSettings] = useState({
    allowBackNavigation: false,
    showResults: true,
    enforceFullscreen: false,
    trackTabSwitching: true,
    publishStatus: 'draft' as TestStatus,
  });

  const activeSection = sections[activeSectionIdx];

  const updateSection = (idx: number, updates: Partial<Section>) =>
    setSections((prev) => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));

  const updateQuestion = (qId: string, updated: Question) => {
    const qs = activeSection.questions.map((q) => q.id === qId ? updated : q);
    updateSection(activeSectionIdx, { questions: qs });
  };
  const deleteQuestion = (qId: string) => updateSection(activeSectionIdx, { questions: activeSection.questions.filter((q) => q.id !== qId) });
  const addQuestion = () => updateSection(activeSectionIdx, { questions: [...activeSection.questions, newQuestion()] });
  const addSection = () => { setSections((prev) => [...prev, newSection()]); setActiveSectionIdx(sections.length); };
  const deleteSection = (idx: number) => { setSections((prev) => prev.filter((_, i) => i !== idx)); setActiveSectionIdx(Math.max(0, idx - 1)); };

  const totalQ = sections.reduce((a, s) => a + s.questions.length, 0);
  const totalTime = sections.reduce((a, s) => a + s.timeLimit, 0);

  const handleSave = () => {
    if (!testTitle.trim()) {
      setTitleError(true);
      return;
    }
    setTitleError(false);
    addTest({
      id: generateId(),
      title: testTitle.trim(),
      description: testDesc.trim() || undefined,
      sections,
      status: testSettings.publishStatus,
      createdBy: user?.id ?? 'admin',
      createdAt: new Date().toISOString(),
      assignedStudentIds: [],
      allowBackNavigation: testSettings.allowBackNavigation,
      showResults: testSettings.showResults,
    });
    setSaved(true);
    setTimeout(() => navigate('/tests'), 1000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Test Builder</h1>
          <p className="text-slate-500 text-sm mt-0.5">Create and manage test content</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" icon={<Settings2 size={14} />} onClick={() => setShowSettings(true)}>Settings</Button>
          <Button variant="secondary" size="sm" icon={<Eye size={14} />}>Preview</Button>
          <Button size="sm" icon={<Save size={14} />} onClick={handleSave} variant={saved ? 'success' : 'primary'} disabled={saved}>
            {saved ? '✓ Saved' : testSettings.publishStatus === 'published' ? 'Publish' : 'Save Draft'}
          </Button>
        </div>
      </div>

      {/* Test meta */}
      <Card padding="sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 items-start">
          <div className="md:col-span-2 space-y-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Test Title *</label>
              <input type="text" value={testTitle} onChange={(e) => { setTestTitle(e.target.value); if (e.target.value.trim()) setTitleError(false); }}
                placeholder="e.g. ACT Full Practice Test #3"
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${titleError ? 'border-red-400 bg-red-50' : 'border-slate-200'}`} />
              {titleError && (
                <p className="flex items-center gap-1 text-xs text-red-600 mt-1"><AlertCircle size={11} /> Title is required before saving</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Description</label>
              <input type="text" value={testDesc} onChange={(e) => setTestDesc(e.target.value)}
                placeholder="Brief description..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Questions', value: totalQ, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Minutes', value: `${totalTime}m`, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Sections', value: sections.length, color: 'text-purple-700', bg: 'bg-purple-50' },
            ].map((s) => (
              <div key={s.label} className={`text-center px-2 py-3 ${s.bg} rounded-xl`}>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Mobile section nav toggle */}
        <button onClick={() => setShowSectionNav(!showSectionNav)}
          className="md:hidden flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700">
          <Menu size={15} />
          Sections ({sections.length}) — {activeSection.name}
          <ChevronDown size={14} className={`ml-auto transition-transform ${showSectionNav ? 'rotate-180' : ''}`} />
        </button>

        {/* Section sidebar */}
        <div className={`${showSectionNav ? 'block' : 'hidden'} md:block md:w-48 lg:w-52 flex-shrink-0 space-y-1`}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 mb-2 hidden md:block">Sections</p>
          {sections.map((sec, idx) => (
            <div key={sec.id} className="group flex items-center gap-1">
              <button onClick={() => { setActiveSectionIdx(idx); setShowSectionNav(false); }}
                className={`flex-1 text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                  activeSectionIdx === idx ? 'bg-blue-600 text-white font-medium' : 'text-slate-600 hover:bg-slate-100'
                }`}>
                <p className="truncate">{sec.name}</p>
                <p className={`text-xs mt-0.5 ${activeSectionIdx === idx ? 'text-blue-200' : 'text-slate-400'}`}>{sec.questions.length}q · {sec.timeLimit}m</p>
              </button>
              {sections.length > 1 && (
                <button onClick={() => deleteSection(idx)} className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 rounded transition-all">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
          <button onClick={addSection} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-dashed border-blue-200">
            <Plus size={13} /> Add Section
          </button>
        </div>

        {/* Section editor */}
        <div className="flex-1 space-y-3 min-w-0">
          {/* Section settings */}
          <Card padding="sm">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Section Name</label>
                <input type="text" value={activeSection.name} onChange={(e) => updateSection(activeSectionIdx, { name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Time (min)</label>
                <input type="number" value={activeSection.timeLimit} onChange={(e) => updateSection(activeSectionIdx, { timeLimit: parseInt(e.target.value) || 0 })}
                  min={1} max={180}
                  className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <p className="text-xs text-slate-500 pb-2">{activeSection.questions.length} questions</p>
            </div>
          </Card>

          {/* Questions */}
          <div className="space-y-2">
            {activeSection.questions.map((q, idx) => (
              <QuestionEditor key={q.id} question={q} index={idx} onUpdate={(updated) => updateQuestion(q.id, updated)} onDelete={() => deleteQuestion(q.id)} />
            ))}
          </div>

          <Button variant="secondary" onClick={addQuestion} icon={<Plus size={13} />} className="w-full py-3 border-dashed">
            Add Question to {activeSection.name}
          </Button>
        </div>
      </div>

      {/* Settings Modal */}
      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Test Settings" size="sm">
        <div className="space-y-4">
          {([
            { key: 'allowBackNavigation' as const, label: 'Allow Backward Navigation', desc: 'Students can revisit previous sections' },
            { key: 'showResults' as const, label: 'Show Results After Submission', desc: 'Students can review answers immediately' },
            { key: 'enforceFullscreen' as const, label: 'Enforce Full Screen', desc: 'Force full-screen mode during exam' },
            { key: 'trackTabSwitching' as const, label: 'Track Tab Switching', desc: 'Log when students switch browser tabs' },
          ] as const).map((s) => (
            <label key={s.key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={testSettings[s.key]}
                onChange={(e) => setTestSettings((prev) => ({ ...prev, [s.key]: e.target.checked }))}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-slate-900">{s.label}</p>
                <p className="text-xs text-slate-500">{s.desc}</p>
              </div>
            </label>
          ))}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Publish Status</label>
            <select
              value={testSettings.publishStatus}
              onChange={(e) => setTestSettings((prev) => ({ ...prev, publishStatus: e.target.value as TestStatus }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowSettings(false)}>Apply</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
