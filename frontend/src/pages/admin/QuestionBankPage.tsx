import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Trash2, Eye, Database, ChevronDown, ChevronUp, Filter, Plus, Save, Loader2, FileText, Upload, Download, ImageIcon } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Card, StatCard } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { MathRenderer } from '../../components/admin/MathRenderer';
import { RichTextEditor } from '../../components/admin/RichTextEditor';
import { api } from '../../lib/api';
import { toast, Toaster } from 'react-hot-toast';

type Question = Awaited<ReturnType<typeof api.getQuestions>>['questions'][0];
type QType = 'mcq_single' | 'mcq_multi' | 'numeric' | 'passage';
type Diff = 'easy' | 'medium' | 'hard';

const TYPE_LABELS: Record<string, string> = { MCQ: 'MCQ Single', MSQ: 'MCQ Multi', NUMERIC: 'Numeric' };
const DIFF_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = { EASY: 'success', MEDIUM: 'warning', HARD: 'danger' };
const TOPICS = ['Algebra', 'Geometry', 'Trigonometry', 'Statistics', 'Grammar', 'Punctuation', 'Rhetorical Skills', 'Main Idea', 'Inference', 'Vocabulary', 'Data Analysis', 'Scientific Method'];

// ── Shared types ──────────────────────────────────────────────────────────────

interface DraftQuestion {
  id: string;
  referenceId: string;
  subject: string;
  text: string;
  type: QType;
  options: { id: string; text: string }[];
  correctAnswer: string | string[] | number;
  difficulty: Diff;
  topic: string;
  explanation: string;
  marks: number;
  marksNegative: number;
}

function emptyDraft(): DraftQuestion {
  return {
    id: Math.random().toString(36).substr(2, 9),
    referenceId: '',
    subject: '',
    type: 'mcq_single',
    text: '',
    options: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }],
    correctAnswer: 'a',
    difficulty: 'medium',
    topic: '',
    explanation: '',
    marks: 1,
    marksNegative: 0,
  };
}

// ── Save helpers ──────────────────────────────────────────────────────────────

async function saveQuestionsToBank(questions: DraftQuestion[]): Promise<Question[]> {
  const results = await Promise.all(
    questions.map((q) =>
      api.createQuestion({
        type: q.type,
        text: q.text,
        options: q.type !== 'numeric' ? q.options : undefined,
        correctAnswer: q.correctAnswer,
        difficulty: q.difficulty,
        topic: q.topic || undefined,
        subject: q.subject || undefined,
        referenceId: q.referenceId || undefined,
        explanation: q.explanation || undefined,
        marks: q.marks,
        marksNegative: q.marksNegative,
      }) as Promise<{ question: Question }>
    )
  );
  return results.map((r) => r.question);
}

// ── PDF parsing ───────────────────────────────────────────────────────────────

interface ParsedPDFQuestion {
  id: string;
  num: number;
  text: string;
  options: { id: string; text: string }[];
  detectedType: QType;
  selected: boolean;
}

function parsePDFText(fullText: string): ParsedPDFQuestion[] {
  const lines = fullText.split('\n').map((l) => l.trim()).filter(Boolean);
  const questions: ParsedPDFQuestion[] = [];
  const qStartPat = /^(\d{1,3})[.)]\s+(.+)/;
  const optPat = /^(?:\(([A-Da-d])\)|([A-Da-d])[.):])\s*(.+)/;
  let current: { num: number; textLines: string[]; optMap: Record<string, string> } | null = null;

  const flush = () => {
    if (!current || !current.textLines.length) return;
    const text = current.textLines.join(' ').replace(/\s{2,}/g, ' ').trim();
    const optCount = Object.keys(current.optMap).length;
    const options = optCount >= 2
      ? Object.entries(current.optMap).slice(0, 4).map(([id, t]) => ({ id, text: t }))
      : [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }];
    questions.push({ id: Math.random().toString(36).substr(2, 9), num: current.num, text, options, detectedType: optCount >= 2 ? 'mcq_single' : 'numeric', selected: true });
  };

  for (const line of lines) {
    const qm = line.match(qStartPat);
    if (qm) { flush(); current = { num: parseInt(qm[1]), textLines: [qm[2]], optMap: {} }; continue; }
    if (current) {
      const om = line.match(optPat);
      if (om) { const letter = (om[1] ?? om[2]).toLowerCase(); current.optMap[letter] = om[3].trim(); }
      else if (Object.keys(current.optMap).length === 0) current.textLines.push(line);
    }
  }
  flush();
  return questions;
}

// ── OCR parsing ───────────────────────────────────────────────────────────────

function parseOCRText(raw: string): { text: string; options: { id: string; text: string }[]; detectedType: QType } {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const optionPatterns = [/^[A-Da-d][).:\s]+(.+)/, /^\([A-Da-d]\)\s*(.+)/];
  const questionLines: string[] = [];
  const optionMap: Record<string, string> = {};

  for (const line of lines) {
    let matched = false;
    for (const pat of optionPatterns) {
      const m = line.match(pat);
      if (m) {
        const letter = line.charAt(0).toLowerCase().replace('(', '');
        const id = ['a', 'b', 'c', 'd'].includes(letter) ? letter : Object.keys(optionMap).length < 4 ? String.fromCharCode(97 + Object.keys(optionMap).length) : null;
        if (id) { optionMap[id] = m[1].trim(); matched = true; break; }
      }
    }
    if (!matched) questionLines.push(line);
  }

  const optionCount = Object.keys(optionMap).length;
  const options = optionCount >= 2
    ? Object.entries(optionMap).slice(0, 4).map(([id, text]) => ({ id, text }))
    : [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }];

  return { text: questionLines.join(' ').replace(/\s{2,}/g, ' ').trim(), options, detectedType: optionCount >= 2 ? 'mcq_single' : 'numeric' };
}

// ── CSV parsing ───────────────────────────────────────────────────────────────

interface CSVParseResult {
  lineNum: number;
  type: string;
  text: string;
  correctAnswerDisplay: string;
  difficulty: string;
  errors: string[];
  question: DraftQuestion;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let j = i + 1; let field = '';
      while (j < line.length) {
        if (line[j] === '"' && j + 1 < line.length && line[j + 1] === '"') { field += '"'; j += 2; }
        else if (line[j] === '"') { j++; break; }
        else { field += line[j]; j++; }
      }
      result.push(field); i = j + 1;
    } else {
      let j = i;
      while (j < line.length && line[j] !== ',') j++;
      result.push(line.slice(i, j).trim()); i = j + 1;
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
    const [typeRaw = '', qText = '', optA = '', optB = '', optC = '', optD = '', ansRaw = '', diffRaw = '', expl = '', marksRaw = '', marksNegRaw = '', refIdRaw = '', subjectRaw = ''] = f;
    const errors: string[] = [];
    const typeUpper = typeRaw.trim().toUpperCase();
    let questionType: QType;
    if (typeUpper === 'MCQ') questionType = 'mcq_single';
    else if (typeUpper === 'MSQ') questionType = 'mcq_multi';
    else if (typeUpper === 'NUMERIC') questionType = 'numeric';
    else { errors.push(`Unknown type "${typeRaw}" — use MCQ, MSQ, or NUMERIC`); questionType = 'mcq_single'; }

    if (!qText.trim()) errors.push('Question text is required');
    const diffLower = diffRaw.trim().toLowerCase();
    const difficulty: Diff = (['easy', 'medium', 'hard'] as Diff[]).includes(diffLower as Diff) ? (diffLower as Diff) : 'medium';
    if (diffRaw.trim() && !['easy', 'medium', 'hard'].includes(diffLower)) errors.push(`Unknown difficulty "${diffRaw}"`);

    const opts = [optA, optB, optC, optD].map((t, idx) => ({ id: ['a', 'b', 'c', 'd'][idx], text: t }));
    let correctAnswer: DraftQuestion['correctAnswer'] = 'a';
    const correctAnswerDisplay = ansRaw.trim().toUpperCase();

    if (questionType === 'numeric') {
      const num = parseFloat(ansRaw.trim());
      if (isNaN(num)) errors.push('Numeric answer must be a number'); else correctAnswer = num;
    } else if (questionType === 'mcq_multi') {
      const keys = ansRaw.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
      if (keys.length === 0) errors.push('MSQ requires at least one correct answer');
      else if (keys.some((k) => !['a', 'b', 'c', 'd'].includes(k))) errors.push('Answer keys must be A–D');
      else correctAnswer = keys;
    } else {
      const key = ansRaw.trim().toLowerCase();
      if (!['a', 'b', 'c', 'd'].includes(key)) errors.push('Answer key must be A, B, C, or D');
      else correctAnswer = key;
    }

    if (questionType !== 'numeric' && !optA.trim()) errors.push('Option A is required for MCQ/MSQ');
    const parsedMarks = parseFloat(marksRaw.trim());
    const parsedMarksNeg = parseFloat(marksNegRaw.trim());

    results.push({
      lineNum: i + 1, type: typeUpper, text: qText.trim(), correctAnswerDisplay, difficulty, errors,
      question: {
        id: Math.random().toString(36).substr(2, 9),
        referenceId: refIdRaw.trim(),
        subject: subjectRaw.trim(),
        text: qText.trim(), type: questionType,
        options: questionType !== 'numeric' ? opts : [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }],
        correctAnswer, difficulty, topic: '',
        explanation: expl.trim(),
        marks: isNaN(parsedMarks) ? 1 : parsedMarks,
        marksNegative: isNaN(parsedMarksNeg) ? 0 : parsedMarksNeg,
      },
    });
  }
  return results;
}

const CSV_TEMPLATE = `type,text,option_a,option_b,option_c,option_d,correct_answer,difficulty,explanation,marks,marks_negative,reference_id,subject\r\nMCQ,"If 2x + 3 = 11, what is the value of x?",2,3,4,5,C,easy,Subtract 3 from both sides then divide by 2,1,0.25,MATH-001,Math\r\nNUMERIC,"What is the area of a rectangle with length 8 and width 5?",,,,,40,easy,Area = length × width = 8 × 5 = 40,2,0,MATH-002,Math\r\nMSQ,"Which of the following are prime numbers?",2,3,4,5,"A,B,D",medium,2 and 3 and 5 are prime; 4 is not,1,0,MATH-003,Math\r\n`;

// ── Add Question (Manual) Modal ───────────────────────────────────────────────

function AddQuestionModal({ onClose, onSaved }: { onClose: () => void; onSaved: (qs: Question[]) => void }) {
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);
  const update = (patch: Partial<DraftQuestion>) => setDraft((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    if (!draft.text.trim()) { toast.error('Question text is required'); return; }
    setSaving(true);
    try {
      const saved = await saveQuestionsToBank([draft]);
      toast.success('Question added to bank!');
      onSaved(saved);
      onClose();
    } catch { toast.error('Failed to save question'); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Add Question to Bank" size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" icon={saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save to Bank'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Type</label>
            <select value={draft.type} onChange={(e) => {
              const t = e.target.value as QType;
              update({ type: t, correctAnswer: t === 'numeric' ? 0 : t === 'mcq_multi' ? [] : 'a' });
            }} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="mcq_single">MCQ — Single Correct</option>
              <option value="mcq_multi">MCQ — Multiple Correct</option>
              <option value="numeric">Numeric Response</option>
              <option value="passage">Passage Question</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Difficulty</label>
            <select value={draft.difficulty} onChange={(e) => update({ difficulty: e.target.value as Diff })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Question ID / Reference</label>
            <input type="text" value={draft.referenceId} onChange={(e) => update({ referenceId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. MATH-001" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Subject Filter</label>
            <input type="text" value={draft.subject} onChange={(e) => update({ subject: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Math, English" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Question Text</label>
          <RichTextEditor content={draft.text} onChange={(html) => update({ text: html })} />
          {draft.text && (
            <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
              <MathRenderer html={draft.text} className="w-full" />
            </div>
          )}
        </div>

        {draft.type !== 'numeric' && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Options</label>
            <div className="space-y-2">
              {draft.options.map((opt) => {
                const isSingle = draft.type === 'mcq_single';
                const isChecked = isSingle ? draft.correctAnswer === opt.id : Array.isArray(draft.correctAnswer) && draft.correctAnswer.includes(opt.id);
                return (
                  <div key={opt.id} className="flex items-center gap-2">
                    {isSingle ? (
                      <input type="radio" name="correct-bank" checked={isChecked} onChange={() => update({ correctAnswer: opt.id })} className="text-blue-600" />
                    ) : (
                      <input type="checkbox" checked={isChecked} onChange={(e) => {
                        const curr = Array.isArray(draft.correctAnswer) ? draft.correctAnswer as string[] : [];
                        update({ correctAnswer: e.target.checked ? [...curr, opt.id] : curr.filter((x) => x !== opt.id) });
                      }} className="rounded text-blue-600" />
                    )}
                    <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">{opt.id.toUpperCase()}</span>
                    <input type="text" value={opt.text}
                      onChange={(e) => update({ options: draft.options.map((o) => o.id === opt.id ? { ...o, text: e.target.value } : o) })}
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Option ${opt.id.toUpperCase()}`} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {draft.type === 'numeric' && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Correct Answer</label>
            <input type="number" value={typeof draft.correctAnswer === 'number' ? draft.correctAnswer : ''}
              onChange={(e) => update({ correctAnswer: parseFloat(e.target.value) || 0 })}
              className="w-40 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Numeric answer" />
          </div>
        )}

        {draft.type === 'passage' && (
          <div className="space-y-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">ℹ</span>
              <div className="text-xs text-blue-800">
                <p className="font-semibold mb-1">Passage Question</p>
                <p>The passage text is entered in the "Question Text" field above. This question type groups multiple related questions under one reading passage.</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Topic</label>
            <select value={draft.topic} onChange={(e) => update({ topic: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">No topic</option>
              {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Marks (+ve)</label>
            <input type="number" min={0} step={0.5} value={draft.marks}
              onChange={(e) => update({ marks: parseFloat(e.target.value) || 1 })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Neg. Marking</label>
            <input type="number" min={0} step={0.25} value={draft.marksNegative}
              onChange={(e) => update({ marksNegative: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Explanation (optional)</label>
          <textarea rows={2} value={draft.explanation} onChange={(e) => update({ explanation: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Explain the correct answer..." />
        </div>
      </div>
    </Modal>
  );
}

// ── PDF Import Modal ──────────────────────────────────────────────────────────

function PDFImportModal({ onClose, onSaved }: { onClose: () => void; onSaved: (qs: Question[]) => void }) {
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [questions, setQuestions] = useState<ParsedPDFQuestion[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') { setError('Please upload a .pdf file'); return; }
    setError(''); setFileName(file.name); setParsing(true); setProgress(0); setQuestions([]);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
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
      if (!parsed.length) setError('No numbered questions detected. Make sure questions are numbered like "1." or "1)".');
      else setQuestions(parsed);
    } catch { setError('Failed to read PDF. Make sure it contains selectable text (not a scanned image).'); }
    finally { setParsing(false); }
  };

  const selectedCount = questions.filter((q) => q.selected).length;
  const toggleAll = (val: boolean) => setQuestions((q) => q.map((x) => ({ ...x, selected: val })));

  const handleSave = async () => {
    const toSave: DraftQuestion[] = questions.filter((q) => q.selected).map((q) => ({
      id: q.id, referenceId: '', subject: '', text: q.text, type: q.detectedType, options: q.options,
      correctAnswer: q.detectedType === 'mcq_single' ? 'a' : 0,
      difficulty: 'medium', topic: '', explanation: '', marks: 1, marksNegative: 0,
    }));
    setSaving(true);
    try {
      const saved = await saveQuestionsToBank(toSave);
      toast.success(`${saved.length} question${saved.length !== 1 ? 's' : ''} added to bank!`);
      onSaved(saved);
      onClose();
    } catch { toast.error('Failed to save some questions'); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Import from PDF" size="lg"
      footer={questions.length > 0 ? (
        <div className="flex items-center justify-between w-full">
          <span className="text-sm text-slate-500">{selectedCount} selected</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" icon={saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              onClick={handleSave} disabled={!selectedCount || saving}>
              {saving ? 'Saving…' : `Save ${selectedCount} to Bank`}
            </Button>
          </div>
        </div>
      ) : undefined}
    >
      <div className="space-y-4">
        {!questions.length && (
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              error ? 'border-red-300 bg-red-50' : parsing ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/20'
            }`}
            onClick={() => !parsing && fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
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
                    onChange={() => setQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, selected: !x.selected } : x))}
                    className="rounded text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-slate-400 flex-shrink-0 mt-0.5">Q{q.num}</span>
                      <p className="text-sm text-slate-800 line-clamp-2">{q.text || <span className="text-slate-400 italic">Empty</span>}</p>
                    </div>
                    {q.options.some((o) => o.text) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 ml-5">
                        {q.options.filter((o) => o.text).map((o) => (
                          <span key={o.id} className="text-xs text-slate-500">
                            <span className="font-semibold text-slate-600">{o.id.toUpperCase()}.</span> {o.text.length > 30 ? o.text.slice(0, 30) + '…' : o.text}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${q.detectedType === 'mcq_single' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {q.detectedType === 'mcq_single' ? 'MCQ' : 'NUM'}
                  </span>
                </label>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <strong>Tip:</strong> Correct answers are not auto-detected — edit them in the question bank after import.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Image OCR Import Modal ────────────────────────────────────────────────────

function OCRImportModal({ onClose, onSaved }: { onClose: () => void; onSaved: (qs: Question[]) => void }) {
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [parsed, setParsed] = useState<{ text: string; options: { id: string; text: string }[]; detectedType: QType } | null>(null);
  const [editedText, setEditedText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Please upload an image file (PNG, JPG, WEBP)'); return; }
    setError('');
    setImage(URL.createObjectURL(file));
    setFileName(file.name);
    setParsed(null); setEditedText(''); setProgress(0);
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
      const p = parseOCRText(text);
      setParsed(p);
      setEditedText(p.text);
    } catch { setError('OCR failed. Try a clearer image with good contrast.'); }
    finally { setScanning(false); }
  };

  const handleSave = async () => {
    if (!parsed) return;
    const draft: DraftQuestion = {
      id: Math.random().toString(36).substr(2, 9),
      referenceId: '', subject: '',
      text: editedText,
      type: parsed.detectedType,
      options: parsed.options,
      correctAnswer: parsed.detectedType === 'mcq_single' ? 'a' : 0,
      difficulty: 'medium', topic: '', explanation: '', marks: 1, marksNegative: 0,
    };
    setSaving(true);
    try {
      const saved = await saveQuestionsToBank([draft]);
      toast.success('Question added to bank!');
      onSaved(saved);
      onClose();
    } catch { toast.error('Failed to save question'); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Import from Image (OCR)" size="lg">
      <div className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
            error ? 'border-red-300 bg-red-50' : image ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/20'
          }`}
          onClick={() => !image && fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {image ? (
            <div className="space-y-2">
              <img src={image} alt="uploaded" className="max-h-48 mx-auto rounded-lg object-contain border border-slate-200" />
              <p className="text-xs text-slate-500">{fileName}</p>
              <button onClick={(e) => { e.stopPropagation(); setImage(null); setParsed(null); setFileName(''); setProgress(0); }}
                className="text-xs text-red-500 hover:text-red-700">Remove image</button>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 rounded-xl flex items-center justify-center">
                <ImageIcon size={22} className="text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700">Drop question image here</p>
              <p className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP — printed or scanned text</p>
            </>
          )}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        {image && !parsed && (
          <div className="space-y-2">
            {scanning && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-500"><span>Scanning text…</span><span>{progress}%</span></div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <Button size="sm" onClick={runOCR} disabled={scanning}
              icon={scanning ? <Loader2 size={13} className="animate-spin" /> : undefined} className="w-full justify-center">
              {scanning ? 'Scanning…' : 'Extract Text from Image'}
            </Button>
          </div>
        )}

        {parsed && (
          <div className="space-y-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Extracted Question Text</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${parsed.detectedType === 'mcq_single' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                  {parsed.detectedType === 'mcq_single' ? 'MCQ detected' : 'Numeric detected'}
                </span>
              </div>
              <textarea value={editedText} onChange={(e) => setEditedText(e.target.value)} rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                placeholder="Edit extracted question text…" />
            </div>

            {parsed.options.some((o) => o.text) && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Detected Options</p>
                <div className="space-y-1.5">
                  {parsed.options.map((opt) => (
                    <div key={opt.id} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">{opt.id.toUpperCase()}</span>
                      <span className={`text-slate-700 ${!opt.text ? 'italic text-slate-400' : ''}`}>{opt.text || 'Not detected'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <strong>Tip:</strong> Review extracted text before saving. Edit the question in the bank after import if needed.
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
              <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" icon={saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                onClick={handleSave} disabled={!editedText.trim() || saving}>
                {saving ? 'Saving…' : 'Save to Bank'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── CSV Import Modal ──────────────────────────────────────────────────────────

function CSVImportModal({ onClose, onSaved }: { onClose: () => void; onSaved: (qs: Question[]) => void }) {
  const [rows, setRows] = useState<CSVParseResult[]>([]);
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) { alert('Please select a .csv file'); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setRows(parseCSVContent(e.target?.result as string ?? ''));
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'questions_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const validRows = rows.filter((r) => r.errors.length === 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveQuestionsToBank(validRows.map((r) => r.question));
      toast.success(`${saved.length} question${saved.length !== 1 ? 's' : ''} added to bank!`);
      onSaved(saved);
      onClose();
    } catch { toast.error('Failed to save some questions'); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Import from CSV" size="xl"
      footer={rows.length > 0 ? (
        <div className="flex items-center justify-between w-full">
          <span className="text-sm text-slate-500">{validRows.length} valid / {rows.length} total rows</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" icon={saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              onClick={handleSave} disabled={validRows.length === 0 || saving}>
              {saving ? 'Saving…' : `Save ${validRows.length} to Bank`}
            </Button>
          </div>
        </div>
      ) : undefined}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div>
            <p className="text-sm font-medium text-blue-900">CSV Template</p>
            <p className="text-xs text-blue-600 mt-0.5">Columns: type, text, option_a–d, correct_answer, difficulty, explanation, marks, marks_negative, reference_id, subject</p>
          </div>
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
            <Download size={12} /> Download
          </button>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragging ? 'border-blue-400 bg-blue-50/20' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/10'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
        >
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
          <Upload size={20} className="mx-auto mb-2 text-slate-400" />
          <p className="text-sm font-medium text-slate-700">{fileName || 'Drop CSV file here or click to browse'}</p>
          {!fileName && <p className="text-xs text-slate-400 mt-1">Download the template above to get started</p>}
        </div>

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-gradient-to-r from-blue-50 to-blue-100/40 border-b border-blue-100">
                <tr>
                  {['Row', 'Type', 'Question Text', 'Answer', 'Difficulty', 'Status'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-blue-800">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.lineNum} className={row.errors.length ? 'bg-red-50' : 'bg-white'}>
                    <td className="px-3 py-2 text-slate-400 font-mono">{row.lineNum}</td>
                    <td className="px-3 py-2"><span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">{row.type}</span></td>
                    <td className="px-3 py-2 text-slate-700 max-w-xs">
                      <p className="truncate">{row.text || <span className="italic text-slate-400">empty</span>}</p>
                      {row.errors.length > 0 && <ul className="mt-0.5 space-y-0.5">{row.errors.map((e, i) => <li key={i} className="text-red-600">• {e}</li>)}</ul>}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600">{row.correctAnswerDisplay}</td>
                    <td className="px-3 py-2 text-slate-600 capitalize">{row.difficulty}</td>
                    <td className="px-3 py-2">
                      {row.errors.length === 0
                        ? <span className="text-emerald-600 font-semibold">✓</span>
                        : <span className="text-red-500 font-semibold">✗</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Question Preview Modal ────────────────────────────────────────────────────

function QuestionPreviewModal({ question, onClose }: { question: Question; onClose: () => void }) {
  const opts = question.options as Record<string, string> | null;
  const ans = question.correctAnswer as Record<string, unknown>;
  const correctKeys: string[] = ans.key ? [ans.key as string] : ans.keys ? (ans.keys as string[]) : [];
  const numericAns = ans.value as number | undefined;

  return (
    <Modal isOpen onClose={onClose} title="Question Preview" size="lg">
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Badge variant="info" size="sm">{TYPE_LABELS[question.type] ?? question.type}</Badge>
          <Badge variant={DIFF_VARIANT[question.difficultyLevel] ?? 'default'} size="sm">{question.difficultyLevel}</Badge>
          {question.topic && <Badge variant="default" size="sm">{question.topic.name}</Badge>}
          {question.subject && <Badge variant="default" size="sm">Subject: {question.subject}</Badge>}
          {question.referenceId && <Badge variant="default" size="sm">ID: {question.referenceId}</Badge>}
        </div>
        <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-800 leading-relaxed">
          <MathRenderer html={question.content.text} />
        </div>
        {opts && (
          <div className="space-y-2">
            {Object.entries(opts).map(([key, text]) => (
              <div key={key} className={`flex items-start gap-3 p-3 rounded-lg border ${correctKeys.includes(key) ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${correctKeys.includes(key) ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{key}</span>
                <span className="text-sm text-slate-700">{text}</span>
              </div>
            ))}
          </div>
        )}
        {numericAns !== undefined && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <span className="text-sm font-semibold text-emerald-700">Correct Answer: {numericAns}</span>
          </div>
        )}
        {question.content.explanation && (
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Explanation</p>
            <p className="text-sm text-blue-800">{question.content.explanation}</p>
          </div>
        )}
        {question.usedInTests.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Used In</p>
            <div className="flex flex-wrap gap-2">
              {question.usedInTests.map((t) => (
                <span key={t.testId} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{t.testTitle}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Question Row ──────────────────────────────────────────────────────────────

function QuestionRow({ q, onPreview, onDelete }: { q: Question; onPreview: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const opts = q.options as Record<string, string> | null;
  const ans = q.correctAnswer as Record<string, unknown>;
  const correctDisplay = ans.key ? String(ans.key) : ans.keys ? (ans.keys as string[]).join(', ') : String(ans.value);
  const text = q.content.text.replace(/<[^>]*>/g, '').slice(0, 120);

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {q.referenceId && <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{q.referenceId}</span>}
            <p className="text-sm text-slate-800 truncate">{text || 'No text'}</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          {q.subject && <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{q.subject}</span>}
          <Badge variant="info" size="sm">{q.type}</Badge>
          <Badge variant={DIFF_VARIANT[q.difficultyLevel] ?? 'default'} size="sm">{q.difficultyLevel}</Badge>
          {q.topic && <span className="text-xs text-slate-400">{q.topic.name}</span>}
          {q.usedInTests.length > 0 && (
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{q.usedInTests.length} test{q.usedInTests.length > 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onPreview(); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Eye size={14} /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
          {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </div>
      {expanded && opts && (
        <div className="px-4 pb-3 bg-slate-50/50 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
            {Object.entries(opts).map(([key, val]) => (
              <div key={key} className={`flex items-center gap-2 text-xs p-2 rounded-lg ${
                (ans.key === key || (Array.isArray(ans.keys) && (ans.keys as string[]).includes(key))) ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600'
              }`}>
                <span className="font-bold">{key}.</span> {val}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">Correct: <span className="font-semibold text-emerald-600">{correctDisplay}</span></p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function QuestionBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [diffFilter, setDiffFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [previewQ, setPreviewQ] = useState<Question | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getQuestions({ type: typeFilter || undefined, difficulty: diffFilter || undefined, search: search || undefined, subject: subjectFilter || undefined });
      setQuestions(res.questions);
    } catch { setQuestions([]); }
    finally { setLoading(false); }
  }, [typeFilter, diffFilter, search, subjectFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.deleteQuestion(deleteId);
      setQuestions((prev) => prev.filter((q) => q.id !== deleteId));
    } finally { setDeleting(false); setDeleteId(null); }
  };

  const onSaved = (qs: Question[]) => setQuestions((prev) => [...qs, ...prev]);

  const counts = {
    total: questions.length,
    mcq: questions.filter((q) => q.type === 'MCQ').length,
    msq: questions.filter((q) => q.type === 'MSQ').length,
    numeric: questions.filter((q) => q.type === 'NUMERIC').length,
    easy: questions.filter((q) => q.difficultyLevel === 'EASY').length,
    medium: questions.filter((q) => q.difficultyLevel === 'MEDIUM').length,
    hard: questions.filter((q) => q.difficultyLevel === 'HARD').length,
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <Toaster position="bottom-right" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Question Bank</h1>
          <p className="text-slate-500 text-sm mt-0.5">Browse, manage, and add questions</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowAddModal(true)}>
            Add Question
          </Button>
          <Button variant="secondary" size="sm" icon={<FileText size={13} />} onClick={() => setShowPDFModal(true)}>
            PDF Scan
          </Button>
          <Button variant="secondary" size="sm" icon={<ImageIcon size={13} />} onClick={() => setShowOCRModal(true)}>
            From Image
          </Button>
          <Button variant="secondary" size="sm" icon={<Upload size={13} />} onClick={() => setShowCSVModal(true)}>
            Import CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Questions" value={counts.total} subtitle={`${counts.easy} easy · ${counts.medium} medium · ${counts.hard} hard`} icon={<Database size={20} />} color="blue" />
        <StatCard title="MCQ Single" value={counts.mcq} subtitle="single correct" icon={<Filter size={20} />} color="emerald" />
        <StatCard title="MCQ Multi" value={counts.msq} subtitle="multiple correct" icon={<Filter size={20} />} color="purple" />
        <StatCard title="Numeric" value={counts.numeric} subtitle="numeric response" icon={<Filter size={20} />} color="amber" />
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Search</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search question text..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Types</option>
              <option value="MCQ">MCQ Single</option>
              <option value="MSQ">MCQ Multi</option>
              <option value="NUMERIC">Numeric</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Subject</label>
            <input value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} placeholder="e.g. Math"
              className="w-32 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Difficulty</label>
            <select value={diffFilter} onChange={(e) => setDiffFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Levels</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Questions list */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12 text-slate-400">
            <Database size={32} className="mx-auto mb-2 opacity-30 animate-pulse" />
            <p className="text-sm">Loading questions...</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white border border-slate-100 rounded-xl">
            <Database size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No questions found</p>
            <p className="text-xs mt-1">Add questions using the buttons above</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-slate-500">{questions.length} question{questions.length !== 1 ? 's' : ''}</p>
            </div>
            {questions.map((q) => (
              <QuestionRow key={q.id} q={q} onPreview={() => setPreviewQ(q)} onDelete={() => setDeleteId(q.id)} />
            ))}
          </>
        )}
      </div>

      {showAddModal && <AddQuestionModal onClose={() => setShowAddModal(false)} onSaved={onSaved} />}
      {showPDFModal && <PDFImportModal onClose={() => setShowPDFModal(false)} onSaved={onSaved} />}
      {showOCRModal && <OCRImportModal onClose={() => setShowOCRModal(false)} onSaved={onSaved} />}
      {showCSVModal && <CSVImportModal onClose={() => setShowCSVModal(false)} onSaved={onSaved} />}

      {previewQ && <QuestionPreviewModal question={previewQ} onClose={() => setPreviewQ(null)} />}

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Question" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        }>
        <p className="text-sm text-slate-600">Permanently delete this question? It will be removed from all tests that use it.</p>
      </Modal>
    </div>
  );
}
