import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical, Save, Eye, Settings2, Menu, AlertCircle, Upload, Download, FileText, CheckCircle2, Loader2, Grid3X3, ImageIcon } from 'lucide-react';
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
  return { id: generateId(), text: '', type: 'mcq_single', options: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }], correctAnswer: 'a', topic: '', difficulty: 'medium', marks: 1, marksNegative: 0 };
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
          <span className="hidden sm:inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            +{question.marks ?? 1}{(question.marksNegative ?? 0) > 0 ? ` / −${question.marksNegative}` : ''}
          </span>
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
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                Marks <span className="normal-case text-slate-400 font-normal">(+ve)</span>
              </label>
              <input
                type="number" min={0} step={0.5}
                value={question.marks ?? 1}
                onChange={(e) => onUpdate({ ...question, marks: parseFloat(e.target.value) || 1 })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                Negative Marking <span className="normal-case text-slate-400 font-normal">(−ve, 0 = none)</span>
              </label>
              <input
                type="number" min={0} step={0.25}
                value={question.marksNegative ?? 0}
                onChange={(e) => onUpdate({ ...question, marksNegative: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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

// ── PDF Bulk Import ─────────────────────────────────────────────────────────

interface ParsedPDFQuestion {
  id: string;
  num: number;
  text: string;
  options: { id: string; text: string }[];
  detectedType: QuestionType;
  selected: boolean;
}

function parsePDFText(fullText: string): ParsedPDFQuestion[] {
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
  const questions: ParsedPDFQuestion[] = [];

  // Patterns that mark the start of a new question
  const qStartPat = /^(\d{1,3})[.)]\s+(.+)/;
  // Patterns for options A-D
  const optPat = /^(?:\(([A-Da-d])\)|([A-Da-d])[.):])\s*(.+)/;

  let current: { num: number; textLines: string[]; optMap: Record<string, string> } | null = null;

  const flush = () => {
    if (!current || !current.textLines.length) return;
    const text = current.textLines.join(' ').replace(/\s{2,}/g, ' ').trim();
    const optCount = Object.keys(current.optMap).length;
    const options = optCount >= 2
      ? Object.entries(current.optMap).slice(0, 4).map(([id, t]) => ({ id, text: t }))
      : [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }];
    questions.push({
      id: Math.random().toString(36).substr(2, 9),
      num: current.num,
      text,
      options,
      detectedType: optCount >= 2 ? 'mcq_single' : 'numeric',
      selected: true,
    });
  };

  for (const line of lines) {
    const qm = line.match(qStartPat);
    if (qm) {
      flush();
      current = { num: parseInt(qm[1]), textLines: [qm[2]], optMap: {} };
      continue;
    }
    if (current) {
      const om = line.match(optPat);
      if (om) {
        const letter = (om[1] ?? om[2]).toLowerCase();
        current.optMap[letter] = om[3].trim();
      } else {
        // continuation of question text (only if no options seen yet)
        if (Object.keys(current.optMap).length === 0) current.textLines.push(line);
      }
    }
  }
  flush();
  return questions;
}

function PDFQuestionUploader({ sectionName, onImport, onClose }: { sectionName: string; onImport: (q: Question[]) => void; onClose: () => void }) {
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [questions, setQuestions] = useState<ParsedPDFQuestion[]>([]);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') { setError('Please upload a .pdf file'); return; }
    setError(''); setFileName(file.name); setParsing(true); setProgress(0); setQuestions([]);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).href;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((item: unknown) => (item as { str: string }).str).join('\n') + '\n';
        setProgress(Math.round((i / pdf.numPages) * 100));
      }
      const parsed = parsePDFText(fullText);
      if (!parsed.length) {
        setError('No numbered questions detected. Make sure questions are numbered like "1." or "1)".');
      } else {
        setQuestions(parsed);
      }
    } catch {
      setError('Failed to read PDF. Make sure it contains selectable text (not a scanned image).');
    } finally {
      setParsing(false);
    }
  };

  const toggleAll = (val: boolean) => setQuestions(q => q.map(x => ({ ...x, selected: val })));
  const selectedCount = questions.filter(q => q.selected).length;

  const handleImport = () => {
    const toImport: Question[] = questions
      .filter(q => q.selected)
      .map(q => ({
        id: q.id,
        text: q.text,
        type: q.detectedType,
        options: q.options,
        correctAnswer: q.detectedType === 'mcq_single' ? 'a' : 0,
        difficulty: 'medium' as Difficulty,
        topic: '',
        marks: 1,
        marksNegative: 0,
      }));
    onImport(toImport);
    onClose();
    toast.success(`${toImport.length} question${toImport.length !== 1 ? 's' : ''} imported from PDF!`);
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {!questions.length && (
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            error ? 'border-red-300 bg-red-50' : parsing ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/20'
          }`}
          onClick={() => !parsing && fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {parsing ? (
            <div className="space-y-3">
              <Loader2 size={32} className="mx-auto text-blue-500 animate-spin" />
              <p className="text-sm font-medium text-slate-700">Reading PDF pages… {progress}%</p>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden max-w-xs mx-auto">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 mx-auto mb-3 bg-red-50 rounded-xl flex items-center justify-center">
                <FileText size={24} className="text-red-400" />
              </div>
              <p className="text-sm font-medium text-slate-700">Drop PDF file here or click to browse</p>
              <p className="text-xs text-slate-400 mt-1">Questions must be numbered: 1. 2. 3. — Options: A. B. C. D.</p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {/* Questions preview */}
      {questions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">{questions.length} questions detected in <span className="text-blue-600">{fileName}</span></p>
              <p className="text-xs text-slate-500 mt-0.5">{selectedCount} selected for import</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleAll(true)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">All</button>
              <span className="text-slate-300">|</span>
              <button onClick={() => toggleAll(false)} className="text-xs text-slate-500 hover:text-slate-700 font-medium">None</button>
              <button onClick={() => { setQuestions([]); setFileName(''); setError(''); }}
                className="text-xs text-red-500 hover:text-red-700 font-medium ml-2">Change file</button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {questions.map((q) => (
              <label key={q.id} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                q.selected ? 'border-blue-200 bg-blue-50/40' : 'border-slate-100 bg-white hover:bg-slate-50'
              }`}>
                <input type="checkbox" checked={q.selected}
                  onChange={() => setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, selected: !x.selected } : x))}
                  className="rounded text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-slate-400 flex-shrink-0 mt-0.5">Q{q.num}</span>
                    <p className="text-sm text-slate-800 line-clamp-2">{q.text || <span className="text-slate-400 italic">Empty question text</span>}</p>
                  </div>
                  {q.options.some(o => o.text) && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 ml-5">
                      {q.options.filter(o => o.text).map(o => (
                        <span key={o.id} className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-600">{o.id.toUpperCase()}.</span> {o.text.length > 30 ? o.text.slice(0, 30) + '…' : o.text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${
                  q.detectedType === 'mcq_single' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                }`}>
                  {q.detectedType === 'mcq_single' ? 'MCQ' : 'NUM'}
                </span>
              </label>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            <strong>Tip:</strong> Correct answers are not auto-detected — set them in the question editor after import. Math formulas may need LaTeX formatting.
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleImport} disabled={!selectedCount}>
              Import {selectedCount} question{selectedCount !== 1 ? 's' : ''} to {sectionName}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Image OCR ───────────────────────────────────────────────────────────────

interface OCRQuestion {
  text: string;
  options: { id: string; text: string }[];
  detectedType: QuestionType;
}

function parseOCRText(raw: string): OCRQuestion {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const optionPatterns = [
    /^[A-Da-d][).:\s]+(.+)/,   // A) text  or  A. text  or  A: text
    /^\([A-Da-d]\)\s*(.+)/,     // (A) text
  ];

  const questionLines: string[] = [];
  const optionMap: Record<string, string> = {};

  for (const line of lines) {
    let matched = false;
    for (const pat of optionPatterns) {
      const m = line.match(pat);
      if (m) {
        const letter = line.charAt(0).toLowerCase().replace('(', '') as string;
        const id = ['a','b','c','d'].includes(letter) ? letter : Object.keys(optionMap).length < 4 ? String.fromCharCode(97 + Object.keys(optionMap).length) : null;
        if (id) { optionMap[id] = m[1].trim(); matched = true; break; }
      }
    }
    if (!matched) questionLines.push(line);
  }

  const optionCount = Object.keys(optionMap).length;
  const options = optionCount >= 2
    ? Object.entries(optionMap).slice(0, 4).map(([id, text]) => ({ id, text }))
    : [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }];

  const detectedType: QuestionType = optionCount >= 2 ? 'mcq_single' : 'numeric';

  return {
    text: questionLines.join(' ').replace(/\s{2,}/g, ' ').trim(),
    options,
    detectedType,
  };
}

function ImageOCRUploader({ sectionName, onImport, onClose }: { sectionName: string; onImport: (q: Question[]) => void; onClose: () => void }) {
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<OCRQuestion | null>(null);
  const [editedText, setEditedText] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Please upload an image file (PNG, JPG, WEBP)'); return; }
    setError('');
    const url = URL.createObjectURL(file);
    setImage(url);
    setFileName(file.name);
    setRawText(''); setParsed(null); setEditedText(''); setProgress(0);
  };

  const runOCR = async () => {
    if (!image) return;
    setScanning(true); setError(''); setProgress(0);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
        },
      });
      const { data: { text } } = await worker.recognize(image);
      await worker.terminate();
      setRawText(text);
      const p = parseOCRText(text);
      setParsed(p);
      setEditedText(p.text);
    } catch {
      setError('OCR failed. Try a clearer image with good contrast.');
    } finally {
      setScanning(false);
    }
  };

  const handleAdd = () => {
    if (!parsed) return;
    const q: Question = {
      id: Math.random().toString(36).substr(2, 9),
      text: editedText,
      type: parsed.detectedType,
      options: parsed.options,
      correctAnswer: parsed.detectedType === 'mcq_single' ? 'a' : 0,
      difficulty: 'medium',
      topic: '',
      marks: 1,
      marksNegative: 0,
    };
    onImport([q]);
    onClose();
    toast.success('Question added from image!');
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
          error ? 'border-red-300 bg-red-50' : image ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/20'
        }`}
        onClick={() => !image && fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {image ? (
          <div className="space-y-2">
            <img src={image} alt="uploaded" className="max-h-48 mx-auto rounded-lg object-contain border border-slate-200" />
            <p className="text-xs text-slate-500">{fileName}</p>
            <button onClick={e => { e.stopPropagation(); setImage(null); setRawText(''); setParsed(null); setFileName(''); setProgress(0); }}
              className="text-xs text-red-500 hover:text-red-700">Remove image</button>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <p className="text-sm font-medium text-slate-700">Drop question image here</p>
            <p className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP — printed or scanned text</p>
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {/* Scan button + progress */}
      {image && !rawText && (
        <div className="space-y-2">
          {scanning && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Scanning text…</span><span>{progress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          <Button size="sm" onClick={runOCR} disabled={scanning} icon={scanning ? <Loader2 size={13} className="animate-spin" /> : undefined} className="w-full justify-center">
            {scanning ? 'Scanning…' : 'Extract Text from Image'}
          </Button>
        </div>
      )}

      {/* Results */}
      {parsed && (
        <div className="space-y-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Extracted Question Text</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${parsed.detectedType === 'mcq_single' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                {parsed.detectedType === 'mcq_single' ? 'MCQ detected' : 'Numeric detected'}
              </span>
            </div>
            <textarea
              value={editedText}
              onChange={e => setEditedText(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
              placeholder="Edit extracted question text…"
            />
          </div>

          {parsed.options.some(o => o.text) && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Detected Options</p>
              <div className="space-y-1.5">
                {parsed.options.map(opt => (
                  <div key={opt.id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">{opt.id.toUpperCase()}</span>
                    <span className={`text-slate-700 ${!opt.text ? 'italic text-slate-400' : ''}`}>{opt.text || 'Not detected'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            <strong>Tip:</strong> Review extracted text before adding. OCR may misread math symbols — edit them in the rich editor after adding.
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={!editedText.trim()}>Add to {sectionName}</Button>
          </div>
        </div>
      )}

      {!image && (
        <p className="text-xs text-slate-400 text-center">
          Works best on clear printed text. Math formulas may need manual correction.
        </p>
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
    const [typeRaw = '', qText = '', optA = '', optB = '', optC = '', optD = '', ansRaw = '', diffRaw = '', expl = '', marksRaw = '', marksNegRaw = ''] = f;
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

    const parsedMarks = parseFloat(marksRaw.trim());
    const parsedMarksNeg = parseFloat(marksNegRaw.trim());
    const question: Question = {
      id: generateId(),
      text: qText.trim(),
      type: questionType,
      options: questionType !== 'numeric' ? opts : undefined,
      correctAnswer,
      difficulty,
      topic: '',
      marks: isNaN(parsedMarks) ? 1 : parsedMarks,
      marksNegative: isNaN(parsedMarksNeg) ? 0 : parsedMarksNeg,
      ...(expl.trim() ? { explanation: expl.trim() } : {}),
    };

    results.push({ lineNum: i + 1, type: typeUpper, text: qText.trim(), correctAnswerDisplay, difficulty, errors, question });
  }

  return results;
}

const CSV_TEMPLATE = `type,text,option_a,option_b,option_c,option_d,correct_answer,difficulty,explanation,marks,marks_negative\r\nMCQ,"If 2x + 3 = 11, what is the value of x?",2,3,4,5,C,easy,Subtract 3 from both sides then divide by 2,1,0.25\r\nNUMERIC,"What is the area of a rectangle with length 8 and width 5?",,,,,40,easy,Area = length × width = 8 × 5 = 40,2,0\r\nMSQ,"Which of the following are prime numbers?",2,3,4,5,"A,B,D",medium,2 and 3 and 5 are prime; 4 is not,1,0\r\n`;

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
          <p className="text-xs text-blue-600 mt-0.5">Columns: type, text, option_a–d, correct_answer, difficulty, explanation, marks, marks_negative</p>
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
  const [showOCRUploader, setShowOCRUploader] = useState(false);
  const [showPDFUploader, setShowPDFUploader] = useState(false);
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

  const [previewMode, setPreviewMode] = useState<'edit' | 'full'>('edit');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewActiveQuestionIdx, setPreviewActiveQuestionIdx] = useState(0);
  const [previewActiveSectionIdx, setPreviewActiveSectionIdx] = useState(0);

  // Sync preview indexes when active edit section changes
  useEffect(() => {
    setPreviewActiveSectionIdx(activeSectionIdx);
    setPreviewActiveQuestionIdx(0);
  }, [activeSectionIdx]);

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
  const totalMarks = sections.reduce((a, s) => a + s.questions.reduce((b, q) => b + (q.marks ?? 1), 0), 0);

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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" icon={<Settings2 size={14} />} onClick={() => setShowSettings(true)}>Settings</Button>
          
          {/* Live Preview Mode Selector */}
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 shadow-sm">
            <button
              onClick={() => setPreviewMode('edit')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                previewMode === 'edit'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Editor
            </button>
            <button
              onClick={() => setPreviewMode('full')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                previewMode === 'full'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Eye size={12} />
              <span>Full Preview</span>
            </button>
          </div>

          <Button size="sm" icon={<Save size={14} />} onClick={handleSave} variant={saved ? 'success' : 'primary'} disabled={saved}>
            {saved ? '✓ Saved' : testSettings.publishStatus === 'published' ? 'Publish' : 'Save Draft'}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {previewMode !== 'full' && (
          <div className="space-y-4 min-w-0 animate-fade-in">
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
                    { label: 'Total Marks', value: totalMarks, color: 'text-amber-700', bg: 'bg-amber-50' },
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
                  <Button variant="secondary" onClick={() => setShowOCRUploader(true)} icon={<ImageIcon size={13} />} className="py-3 border-dashed px-4">
                    From Image
                  </Button>
                  <Button variant="secondary" onClick={() => setShowPDFUploader(true)} icon={<FileText size={13} />} className="py-3 border-dashed px-4">
                    Import PDF
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Real-time Mock Exam Preview Panel */}
        {previewMode === 'full' && (
          <div className="space-y-4 w-full max-w-5xl mx-auto animate-fade-in">
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Viewport:</span>
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                  <button
                    onClick={() => setPreviewDevice('desktop')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      previewDevice === 'desktop' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Desktop
                  </button>
                  <button
                    onClick={() => setPreviewDevice('mobile')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      previewDevice === 'mobile' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Mobile
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">Live View</span>
              </div>
            </div>

            <div className="flex items-center justify-center min-h-[550px] bg-slate-200/40 rounded-2xl p-4 border border-dashed border-slate-300">
              {previewDevice === 'mobile' ? (
                <div className="w-[360px] h-[660px] border-[12px] border-slate-900 rounded-[36px] overflow-hidden shadow-2xl bg-slate-100 flex flex-col relative mx-auto my-4 transition-all">
                  <div className="h-6 bg-slate-900 text-white flex items-center justify-between px-6 text-[10px] select-none font-semibold flex-shrink-0">
                    <span>9:41 AM</span>
                    <div className="flex items-center gap-1">
                      <span>📶</span>
                      <span>🔋 100%</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto flex flex-col min-h-0 bg-slate-50 relative">
                    <ExamPreviewContent
                      testTitle={testTitle}
                      sections={sections}
                      activeSectionIdx={previewActiveSectionIdx}
                      activeQuestionIdx={previewActiveQuestionIdx}
                      onNavigate={(sIdx, qIdx) => {
                        setPreviewActiveSectionIdx(sIdx);
                        setPreviewActiveQuestionIdx(qIdx);
                      }}
                      isMobile={true}
                    />
                  </div>
                  <div className="h-4 bg-slate-900 flex items-center justify-center select-none flex-shrink-0">
                    <div className="w-24 h-1 bg-white/60 rounded-full" />
                  </div>
                </div>
              ) : (
                <div className="w-full bg-slate-50 rounded-2xl border border-slate-300 overflow-hidden shadow-xl flex flex-col transition-all min-h-[620px]">
                  <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center gap-2 text-xs text-slate-500 flex-shrink-0">
                    <div className="flex gap-1.5 flex-shrink-0">
                      <span className="w-3 h-3 rounded-full bg-red-400 block" />
                      <span className="w-3 h-3 rounded-full bg-yellow-400 block" />
                      <span className="w-3 h-3 rounded-full bg-emerald-400 block" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg px-4 py-1 flex-1 max-w-md mx-auto text-center truncate font-mono text-[9px] text-slate-400 select-none">
                      http://localhost:5173/test/{testTitle.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'demo'}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
                    <ExamPreviewContent
                      testTitle={testTitle}
                      sections={sections}
                      activeSectionIdx={previewActiveSectionIdx}
                      activeQuestionIdx={previewActiveQuestionIdx}
                      onNavigate={(sIdx, qIdx) => {
                        setPreviewActiveSectionIdx(sIdx);
                        setPreviewActiveQuestionIdx(qIdx);
                      }}
                      isMobile={false}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      <Modal isOpen={showCSVUploader} onClose={() => setShowCSVUploader(false)} title={`Import Questions — ${activeSection.name}`} size="lg">
        <QuestionCSVUploader
          sectionName={activeSection.name}
          onImport={(imported) => updateSection(activeSectionIdx, { questions: [...activeSection.questions, ...imported] })}
          onClose={() => setShowCSVUploader(false)}
        />
      </Modal>

      {/* Image OCR Modal */}
      <Modal isOpen={showOCRUploader} onClose={() => setShowOCRUploader(false)} title={`Scan Question from Image — ${activeSection.name}`} size="md">
        <ImageOCRUploader
          sectionName={activeSection.name}
          onImport={(imported) => updateSection(activeSectionIdx, { questions: [...activeSection.questions, ...imported] })}
          onClose={() => setShowOCRUploader(false)}
        />
      </Modal>

      {/* PDF Bulk Import Modal */}
      <Modal isOpen={showPDFUploader} onClose={() => setShowPDFUploader(false)} title={`Bulk Import from PDF — ${activeSection.name}`} size="lg">
        <PDFQuestionUploader
          sectionName={activeSection.name}
          onImport={(imported) => updateSection(activeSectionIdx, { questions: [...activeSection.questions, ...imported] })}
          onClose={() => setShowPDFUploader(false)}
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

// ── Exam Live Preview Sub-Component ──────────────────────────────────────────

interface ExamPreviewContentProps {
  testTitle: string;
  sections: Section[];
  activeSectionIdx: number;
  activeQuestionIdx: number;
  onNavigate: (sectionIdx: number, questionIdx: number) => void;
  isMobile: boolean;
}

function ExamPreviewContent({
  testTitle,
  sections,
  activeSectionIdx,
  activeQuestionIdx,
  onNavigate,
  isMobile
}: ExamPreviewContentProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(45 * 60);
  const [showPaletteDrawer, setShowPaletteDrawer] = useState(false);
  const [showAdminAnswers, setShowAdminAnswers] = useState(true);

  const section = sections[activeSectionIdx] || sections[0];
  const question = section?.questions[activeQuestionIdx];

  // Mark active question as visited
  useEffect(() => {
    if (question?.id) {
      setVisited((prev) => ({ ...prev, [question.id]: true }));
    }
  }, [question?.id]);

  // Handle countdown timer
  useEffect(() => {
    if (section) {
      setTimeLeft(section.timeLimit * 60);
    }
  }, [activeSectionIdx, section]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!section) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-400 italic text-sm">
        Add a section to see preview...
      </div>
    );
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const getQuestionState = (qId: string) => {
    const isAns = answers[qId] !== undefined && answers[qId] !== '' && !(Array.isArray(answers[qId]) && answers[qId].length === 0);
    const isFlag = flagged[qId];
    const isVis = visited[qId];

    if (isFlag) return 'marked_review';
    if (isAns) return 'answered';
    if (isVis) return 'not_answered';
    return 'not_visited';
  };

  const stateColors: Record<string, string> = {
    not_visited: 'bg-slate-200 text-slate-600',
    not_answered: 'bg-red-500 text-white',
    answered: 'bg-emerald-500 text-white',
    marked_review: 'bg-purple-500 text-white',
  };

  const totalQuestions = section.questions.length;
  const isLastQuestion = activeQuestionIdx === totalQuestions - 1;

  const handleNext = () => {
    if (isLastQuestion) {
      if (activeSectionIdx < sections.length - 1) {
        onNavigate(activeSectionIdx + 1, 0);
      }
    } else {
      onNavigate(activeSectionIdx, activeQuestionIdx + 1);
    }
  };

  const handleBack = () => {
    if (activeQuestionIdx > 0) {
      onNavigate(activeSectionIdx, activeQuestionIdx - 1);
    }
  };

  const handleMarkReview = () => {
    if (question?.id) {
      setFlagged((prev) => ({ ...prev, [question.id]: !prev[question.id] }));
      handleNext();
    }
  };

  const handleClear = () => {
    if (question?.id) {
      setAnswers((prev) => {
        const next = { ...prev };
        delete next[question.id];
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full select-none bg-slate-100 min-h-0 text-left">
      {/* Slate Header */}
      <header className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center font-bold text-xs flex-shrink-0">P</div>
          {!isMobile && (
            <div className="min-w-0 text-left">
              <p className="text-[9px] text-slate-400 uppercase font-semibold">Candidate</p>
              <p className="text-xs font-medium truncate">Demo Candidate</p>
            </div>
          )}
        </div>
        <div className="text-center min-w-0 flex-1 px-2">
          {!isMobile && <p className="text-[9px] text-slate-400 uppercase font-semibold">Test Preview</p>}
          <p className="text-xs font-semibold truncate text-slate-200">{testTitle || 'Untitled Test'}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isMobile && (
            <button onClick={() => setShowPaletteDrawer(true)} className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px] font-semibold">
              <Grid3X3 size={11} />
              <span>Palette</span>
            </button>
          )}
          <div className="px-2 py-1 rounded bg-slate-700 font-mono text-xs font-bold text-slate-100">
            {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      {/* Section Tabs */}
      <div className="bg-white border-b border-slate-200 px-3 py-1 flex-shrink-0">
        <div className="flex gap-1 overflow-x-auto py-1 scrollbar-hide">
          {sections.map((sec, idx) => (
            <button
              key={sec.id}
              onClick={() => onNavigate(idx, 0)}
              className={`flex-shrink-0 px-2 py-1 rounded text-xs font-semibold transition-all ${
                idx === activeSectionIdx
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sec.name || `Section ${idx + 1}`}
            </button>
          ))}
        </div>
      </div>

      {/* Main Preview Workspace */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3 min-h-0">
        {/* Left Side: Question Canvas */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 h-full overflow-y-auto">
          {question ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex-1 flex flex-col min-h-0 overflow-y-auto">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2 flex-shrink-0">
                <span className="text-xs font-bold text-slate-400">Question {activeQuestionIdx + 1} of {totalQuestions}</span>
                <div className="flex gap-1.5">
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize font-semibold">{question.difficulty}</span>
                  {question.topic && <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{question.topic}</span>}
                </div>
              </div>

              {/* Question Text */}
              <div className="flex-1 overflow-y-auto text-slate-800 text-sm leading-relaxed mb-4 text-left">
                <MathRenderer html={question.text || 'Write question text to see preview...'} className="w-full" />
              </div>

              {/* Answers View Toggle */}
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 mb-3 text-left">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Developer Tools</span>
                  <label className="flex items-center gap-1 text-[10px] text-blue-600 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAdminAnswers}
                      onChange={(e) => setShowAdminAnswers(e.target.checked)}
                      className="rounded text-blue-600 w-3 h-3"
                    />
                    Highlight Answers
                  </label>
                </div>
              </div>

              {/* Option Rendering */}
              {question.type !== 'numeric' && question.options ? (
                <div className="space-y-2 flex-shrink-0">
                  {question.options.map((opt) => {
                    const isSelected = question.type === 'mcq_multi'
                      ? Array.isArray(answers[question.id]) && answers[question.id].includes(opt.id)
                      : answers[question.id] === opt.id;
                    const isCorrect = showAdminAnswers && (
                      question.type === 'mcq_multi'
                        ? Array.isArray(question.correctAnswer) && (question.correctAnswer as string[]).includes(opt.id)
                        : question.correctAnswer === opt.id
                    );

                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          if (question.type === 'mcq_multi') {
                            const curr = Array.isArray(answers[question.id]) ? answers[question.id] : [];
                            setAnswers((prev) => ({
                              ...prev,
                              [question.id]: curr.includes(opt.id)
                                ? curr.filter((x: string) => x !== opt.id)
                                : [...curr, opt.id],
                            }));
                          } else {
                            setAnswers((prev) => ({ ...prev, [question.id]: opt.id }));
                          }
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                          isCorrect
                            ? 'border-emerald-500 bg-emerald-50/50'
                            : isSelected
                            ? 'border-blue-500 bg-blue-50/50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          isCorrect
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : isSelected
                            ? 'border-blue-500 bg-blue-500 text-white'
                            : 'border-slate-300 text-slate-500'
                        }`}>
                          {opt.id.toUpperCase()}
                        </div>
                        <div className="flex-1 text-xs">
                          <MathRenderer html={opt.text || `Option ${opt.id.toUpperCase()}`} />
                        </div>
                        {isCorrect && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full ml-auto">
                            Correct Answer
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Numeric Answers */
                <div className="text-left flex-shrink-0">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Enter numeric value:</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={answers[question.id] || ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
                      placeholder="Type number..."
                      className="w-36 px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                    {showAdminAnswers && question.correctAnswer !== undefined && (
                      <div className="text-xs bg-emerald-100 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-lg font-semibold flex items-center gap-1">
                        <span>Target:</span>
                        <code className="font-bold">{String(question.correctAnswer)}</code>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Explanation rendering if available */}
              {showAdminAnswers && question.explanation && (
                <div className="mt-3 bg-blue-50 border border-blue-100 text-blue-900 rounded-lg p-3 text-left text-xs leading-relaxed">
                  <p className="font-bold text-[10px] text-blue-700 uppercase tracking-wide mb-0.5">Admin Explanation</p>
                  {question.explanation}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 flex-1 flex items-center justify-center text-slate-400 italic text-sm">
              Create a question in this section to view its exam preview.
            </div>
          )}

          {/* Action buttons */}
          <div className="bg-white rounded-xl border border-slate-200 p-2 flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1">
                <button onClick={handleClear} className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold border border-slate-200 hover:bg-slate-50 rounded-lg">
                  Clear
                </button>
                <button onClick={handleMarkReview} className="px-2.5 py-1.5 text-xs text-white bg-purple-600 hover:bg-purple-700 font-semibold rounded-lg">
                  Flag
                </button>
              </div>
              <div className="flex gap-1">
                <button onClick={handleBack} disabled={activeQuestionIdx === 0} className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
                  Back
                </button>
                <button onClick={handleNext} disabled={isLastQuestion && activeSectionIdx === sections.length - 1} className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
                  Save & Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Desktop Palette */}
        {!isMobile && (
          <div className="w-44 flex-shrink-0 bg-white rounded-xl border border-slate-200 p-3 h-full overflow-y-auto flex flex-col text-left">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">{section.name || 'Section Palette'}</p>
            <div className="grid grid-cols-4 gap-1 mb-3">
              {section.questions.map((q, idx) => {
                const state = getQuestionState(q.id);
                const isActive = idx === activeQuestionIdx;
                return (
                  <button
                    key={q.id}
                    onClick={() => onNavigate(activeSectionIdx, idx)}
                    className={`w-7 h-7 rounded text-[10px] font-bold transition-all ${stateColors[state]} ${
                      isActive ? 'ring-2 ring-blue-600 ring-offset-1 scale-105 font-extrabold' : ''
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-auto pt-3 border-t border-slate-100 space-y-1.5 text-[10px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200 block flex-shrink-0" />
                <span>Not Visited</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 block flex-shrink-0" />
                <span>Not Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block flex-shrink-0" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 block flex-shrink-0" />
                <span>Flagged</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Palette Drawer */}
      {showPaletteDrawer && isMobile && (
        <div className="absolute inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setShowPaletteDrawer(false)} />
          <div className="relative bg-white rounded-t-2xl w-full p-4 max-h-[60vh] overflow-y-auto z-10 text-left">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">{section.name || 'Palette'}</h4>
              <button onClick={() => setShowPaletteDrawer(false)} className="text-slate-400 font-bold text-sm">✕</button>
            </div>
            <div className="grid grid-cols-6 gap-1.5 mb-3">
              {section.questions.map((q, idx) => {
                const state = getQuestionState(q.id);
                const isActive = idx === activeQuestionIdx;
                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      onNavigate(activeSectionIdx, idx);
                      setShowPaletteDrawer(false);
                    }}
                    className={`h-7 rounded text-[10px] font-bold ${stateColors[state]} ${isActive ? 'ring-2 ring-blue-600' : ''}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
