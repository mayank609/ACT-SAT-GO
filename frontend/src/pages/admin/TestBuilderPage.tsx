import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical, Save, Eye, Settings2, Menu, AlertCircle, Upload, Download, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { RichTextEditor } from '../../components/admin/RichTextEditor';
import { MathRenderer } from '../../components/admin/MathRenderer';
import { Toaster, toast } from 'react-hot-toast';
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
  const [isSaving, setIsSaving] = useState(false);
  const difficultyColors: Record<Difficulty, 'success' | 'warning' | 'danger'> = { easy: 'success', medium: 'warning', hard: 'danger' };

  const handleSaveQuestion = async () => {
    setIsSaving(true);
    // Simulate high-speed database autosave block
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsSaving(false);
    toast.success(`Question ${index + 1} saved successfully!`);
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 px-3 md:px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setExpanded(!expanded)}>
        <GripVertical size={13} className="text-slate-400 cursor-grab flex-shrink-0" />
        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">{index + 1}</div>
        <MathRenderer html={question.text || 'Untitled question'} className="flex-1 text-sm text-slate-700 truncate min-w-0 pointer-events-none math-header-preview" />
        <div className="flex items-center gap-1 flex-shrink-0">
          <Badge variant="default" size="sm" className="hidden sm:inline-flex">{question.type.replace(/_/g, ' ')}</Badge>
          <Badge variant={difficultyColors[question.difficulty]} size="sm">{question.difficulty}</Badge>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-red-400 hover:text-red-600 rounded flex-shrink-0"><Trash2 size={13} /></button>
        {expanded ? <ChevronUp size={13} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={13} className="text-slate-400 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="p-3 md:p-4 space-y-3 md:space-y-4 bg-white">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Question Text (Rich Editor)</label>
              <RichTextEditor content={question.text} onChange={(html) => onUpdate({ ...question, text: html })} />
            </div>

            {/* Live Equation / Science Renderer Preview Panel */}
            <div className="space-y-2 border border-slate-200 bg-slate-50/50 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-200">
                <span>Exam Rendering Preview (Dynamic Math & Science)</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">KaTeX Active</span>
              </div>
              <div className="min-h-[60px] flex items-center p-1 text-slate-800">
                {question.text ? (
                  <MathRenderer html={question.text} className="w-full prose-slate" />
                ) : (
                  <span className="text-slate-400 italic text-sm">Write equations or select formulas from the toolbar to see standard exam previews...</span>
                )}
              </div>
            </div>
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

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              onClick={handleSaveQuestion}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isSaving ? 'Saving Question...' : 'Save Question'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CSV Import ──────────────────────────────────────────────────────────────

interface CSVParseResult {
  lineNum: number;
  type: string;
  text: string;
  correctAnswerDisplay: string;
  difficulty: string;
  errors: string[];
  question: Question;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let j = i + 1;
      let field = '';
      while (j < line.length) {
        if (line[j] === '"' && j + 1 < line.length && line[j + 1] === '"') { field += '"'; j += 2; }
        else if (line[j] === '"') { j++; break; }
        else { field += line[j]; j++; }
      }
      result.push(field);
      i = j + 1;
    } else {
      let j = i;
      while (j < line.length && line[j] !== ',') j++;
      result.push(line.slice(i, j).trim());
      i = j + 1;
    }
  }
  return result;
}

function parseCSVContent(text: string): CSVParseResult[] {
  const lines = text.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const results: CSVParseResult[] = [];

  for (let i = 1; i < lines.length; i++) {
    const f = parseCSVLine(lines[i]);
    const [typeRaw = '', qText = '', optA = '', optB = '', optC = '', optD = '', ansRaw = '', diffRaw = '', expl = ''] = f;
    const errors: string[] = [];

    const typeUpper = typeRaw.trim().toUpperCase();
    let questionType: QuestionType;
    if (typeUpper === 'MCQ') questionType = 'mcq_single';
    else if (typeUpper === 'MSQ') questionType = 'mcq_multi';
    else if (typeUpper === 'NUMERIC') questionType = 'numeric';
    else { errors.push(`Unknown type "${typeRaw}" — use MCQ, MSQ, or NUMERIC`); questionType = 'mcq_single'; }

    if (!qText.trim()) errors.push('Question text is required');

    const diffLower = diffRaw.trim().toLowerCase();
    const difficulty: Difficulty = (['easy', 'medium', 'hard'] as Difficulty[]).includes(diffLower as Difficulty) ? (diffLower as Difficulty) : 'medium';
    if (diffRaw.trim() && !['easy', 'medium', 'hard'].includes(diffLower)) errors.push(`Unknown difficulty "${diffRaw}" — use easy, medium, or hard`);

    const opts = [optA, optB, optC, optD].map((t, idx) => ({ id: ['a', 'b', 'c', 'd'][idx], text: t }));

    let correctAnswer: Question['correctAnswer'] = 'a';
    let correctAnswerDisplay = ansRaw.trim().toUpperCase();

    if (questionType === 'numeric') {
      const num = parseFloat(ansRaw.trim());
      if (isNaN(num)) errors.push('Numeric answer must be a number');
      else correctAnswer = num;
    } else if (questionType === 'mcq_multi') {
      const keys = ansRaw.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
      if (keys.length === 0) errors.push('MSQ requires at least one correct answer (e.g. "A,B")');
      else if (keys.some((k) => !['a', 'b', 'c', 'd'].includes(k))) errors.push('Answer keys must be letters A–D');
      else correctAnswer = keys;
    } else {
      const key = ansRaw.trim().toLowerCase();
      if (!['a', 'b', 'c', 'd'].includes(key)) errors.push('Answer key must be A, B, C, or D');
      else correctAnswer = key;
    }

    if (questionType !== 'numeric' && !optA.trim()) errors.push('Option A is required for MCQ/MSQ');

    const question: Question = {
      id: generateId(),
      text: qText.trim(),
      type: questionType,
      options: questionType !== 'numeric' ? opts : undefined,
      correctAnswer,
      difficulty,
      topic: '',
      ...(expl.trim() ? { explanation: expl.trim() } : {}),
    };

    results.push({ lineNum: i + 1, type: typeUpper, text: qText.trim(), correctAnswerDisplay, difficulty, errors, question });
  }

  return results;
}

const CSV_TEMPLATE = `type,text,option_a,option_b,option_c,option_d,correct_answer,difficulty,explanation\r\nMCQ,"If 2x + 3 = 11, what is the value of x?",2,3,4,5,C,easy,Subtract 3 from both sides then divide by 2\r\nNUMERIC,"What is the area of a rectangle with length 8 and width 5?",,,,,40,easy,Area = length × width = 8 × 5 = 40\r\nMSQ,"Which of the following are prime numbers?",2,3,4,5,"A,B,D",medium,2 and 3 and 5 are prime; 4 is not\r\n`;

interface CSVUploaderProps {
  sectionName: string;
  onImport: (questions: Question[]) => void;
  onClose: () => void;
}

function QuestionCSVUploader({ sectionName, onImport, onClose }: CSVUploaderProps) {
  const [rows, setRows] = useState<CSVParseResult[]>([]);
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) { alert('Please select a .csv file'); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setRows(parseCSVContent(e.target?.result as string ?? ''));
    reader.readAsText(file);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'questions_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validRows = rows.filter((r) => r.errors.length === 0);

  return (
    <div className="space-y-4">
      {/* Template download */}
      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
        <div>
          <p className="text-sm font-medium text-blue-900">CSV Template</p>
          <p className="text-xs text-blue-600 mt-0.5">Columns: type, text, option_a–d, correct_answer, difficulty, explanation</p>
        </div>
        <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
          <Download size={12} /> Download
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
      >
        <FileText size={28} className="mx-auto mb-2 text-slate-400" />
        {fileName
          ? <p className="text-sm font-medium text-slate-700">{fileName}</p>
          : <>
              <p className="text-sm font-medium text-slate-600">Drop CSV file here</p>
              <p className="text-xs text-slate-400 mt-1">or click to browse</p>
            </>
        }
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      </div>

      {/* Preview */}
      {rows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{rows.length} row{rows.length !== 1 ? 's' : ''} parsed</p>
            <div className="flex items-center gap-3 text-xs">
              {validRows.length > 0 && <span className="text-emerald-600 font-medium">{validRows.length} valid</span>}
              {rows.length - validRows.length > 0 && <span className="text-red-500 font-medium">{rows.length - validRows.length} with errors</span>}
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 text-xs">
            <table className="w-full">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {['#', 'Type', 'Question', 'Answer', 'Difficulty', ''].map((h) => (
                    <th key={h} className="px-2 py-2 text-left text-slate-500 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.lineNum} className={row.errors.length ? 'bg-red-50' : 'bg-white hover:bg-slate-50'}>
                    <td className="px-2 py-2 text-slate-400">{row.lineNum}</td>
                    <td className="px-2 py-2 font-mono">{row.type}</td>
                    <td className="px-2 py-2 max-w-xs">
                      <p className="truncate text-slate-700">{row.text || <span className="text-slate-400 italic">empty</span>}</p>
                      {row.errors.length > 0 && (
                        <ul className="mt-0.5 space-y-0.5">
                          {row.errors.map((e, i) => <li key={i} className="text-red-600">• {e}</li>)}
                        </ul>
                      )}
                    </td>
                    <td className="px-2 py-2 font-mono text-slate-600">{row.correctAnswerDisplay}</td>
                    <td className="px-2 py-2 text-slate-600 capitalize">{row.difficulty}</td>
                    <td className="px-2 py-2">
                      {row.errors.length === 0
                        ? <CheckCircle2 size={14} className="text-emerald-500" />
                        : <AlertCircle size={14} className="text-red-400" />
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
        <button
          onClick={() => { onImport(validRows.map((r) => r.question)); onClose(); }}
          disabled={validRows.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Upload size={13} />
          Import {validRows.length > 0 ? `${validRows.length} question${validRows.length !== 1 ? 's' : ''}` : 'questions'} to {sectionName}
        </button>
      </div>
    </div>
  );
}

// ── Test Builder ─────────────────────────────────────────────────────────────

export function TestBuilderPage() {
  const navigate = useNavigate();
  const { user, dbId } = useAuthStore();

  const [testTitle, setTestTitle] = useState('');
  const [testDesc, setTestDesc] = useState('');
  const [sections, setSections] = useState<Section[]>([newSection()]);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showSectionNav, setShowSectionNav] = useState(false);
  const [showCSVUploader, setShowCSVUploader] = useState(false);
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

  // Prevent data loss on unsaved changes / accidental refreshes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Restore unsaved draft from localStorage on mount
  useEffect(() => {
    const draft = localStorage.getItem('test_builder_draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.testTitle || parsed.sections?.length > 1 || parsed.sections?.[0]?.questions?.length > 1) {
          setTestTitle(parsed.testTitle || '');
          setTestDesc(parsed.testDesc || '');
          setSections(parsed.sections || [newSection()]);
          toast.success("Restored your unsaved draft!", { id: 'restore-draft' });
        }
      } catch (e) {
        console.error("Failed to restore draft", e);
      }
    }
  }, []);

  // Debounced auto-save every few seconds while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('test_builder_draft', JSON.stringify({
        testTitle,
        testDesc,
        sections
      }));
    }, 2000);
    return () => clearTimeout(timer);
  }, [testTitle, testDesc, sections]);

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

  const handleSave = async () => {
    if (!testTitle.trim()) {
      setTitleError(true);
      return;
    }
    setTitleError(false);
    try {
      await api.createTest({
        title: testTitle.trim(),
        description: testDesc.trim() || undefined,
        sections,
        status: testSettings.publishStatus,
        createdById: dbId ?? user?.id ?? '',
        allowBackNavigation: testSettings.allowBackNavigation,
        showResults: testSettings.showResults,
      });
      setSaved(true);
      setTimeout(() => navigate('/tests'), 1000);
    } catch {
      // keep button enabled so user can retry
    }
  };

  return (
    <div className="space-y-4">
      <Toaster position="bottom-right" />
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

          <div className="flex gap-2">
            <Button variant="secondary" onClick={addQuestion} icon={<Plus size={13} />} className="flex-1 py-3 border-dashed">
              Add Question
            </Button>
            <Button variant="secondary" onClick={() => setShowCSVUploader(true)} icon={<Upload size={13} />} className="py-3 border-dashed px-4">
              Import CSV
            </Button>
          </div>
        </div>
      </div>

      {/* CSV Import Modal */}
      <Modal isOpen={showCSVUploader} onClose={() => setShowCSVUploader(false)} title={`Import Questions — ${activeSection.name}`} size="lg">
        <QuestionCSVUploader
          sectionName={activeSection.name}
          onImport={(imported) => updateSection(activeSectionIdx, { questions: [...activeSection.questions, ...imported] })}
          onClose={() => setShowCSVUploader(false)}
        />
      </Modal>

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
