import { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical, Save, Eye, Settings2, Menu, AlertCircle, Upload, Download, FileText, CheckCircle2, Loader2, Grid3X3, ImageIcon, Database, Search, X, Clock } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { ALL_DOMAIN_NAMES, SUBDOMAINS_BY_DOMAIN, SKILLS_BY_SUBDOMAIN } from '../../data/satDomains';

// Question tagging uses the official SAT blueprint (domain → subdomain) so the
// tags here line up exactly with the Test Review performance breakdown.
const TOPICS = ALL_DOMAIN_NAMES;
const SUB_TOPICS = SUBDOMAINS_BY_DOMAIN;

function generateId() { return Math.random().toString(36).substr(2, 9); }

function newQuestion(): Question {
  return { id: generateId(), text: '', type: 'mcq_single', options: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }], correctAnswer: 'a', topic: '', subTopic: '', skill: '', difficulty: 'medium', marks: 1, marksNegative: 0, linkedQuestions: [] };
}

// A single passage-based MCQ to live inside a passage question.
function newInternalMcq(parentId: string): Question {
  const q = newQuestion();
  q.parentQuestionId = parentId;
  return q;
}

// A passage question pre-seeded with one internal MCQ — the mandatory format for
// the Reading and Writing section.
function newPassageQuestion(): Question {
  const id = generateId();
  return { id, text: '', type: 'passage', correctAnswer: 'a', topic: '', subTopic: '', skill: '', difficulty: 'medium', marks: 1, marksNegative: 0, linkedQuestions: [newInternalMcq(id)] };
}

// The Reading and Writing section is identified by its name (sections only carry
// a free-text name). Every R&W question must be a passage with MCQs inside.
function isReadingWritingSection(name: string): boolean {
  return /read|writing|english|verbal/i.test(name);
}

function getNumericAnswers(correctAnswer: Question['correctAnswer']): string[] {
  if (Array.isArray(correctAnswer)) return correctAnswer.map(String);
  if (typeof correctAnswer === 'number') return [String(correctAnswer)];
  if (typeof correctAnswer === 'string' && correctAnswer !== '') return [correctAnswer];
  return [''];
}
function newSection(): Section {
  return { id: generateId(), name: 'New Section', timeLimit: 45, questions: [newQuestion()] };
}

// An empty module/section (no starter question, default 45 min).
function emptyModule(name: string): Section {
  return { id: generateId(), name, timeLimit: 45, questions: [] };
}

// Each test type dictates its own fixed module structure. Modules are auto-built
// up front but remain editable afterwards.
function buildSectionsForType(category: string, subject?: string): Section[] {
  switch (category) {
    case 'Mock':
      return [
        emptyModule('Reading Writing Module 1'),
        emptyModule('Reading Writing Module 2'),
        emptyModule('Math Module 1'),
        emptyModule('Math Module 2'),
      ];
    case 'Sectional':
      return subject === 'Math'
        ? [emptyModule('Math Module 1'), emptyModule('Math Module 2')]
        : [emptyModule('Reading Writing Module 1'), emptyModule('Reading Writing Module 2')];
    case 'Practice Sheet':
      return [emptyModule(`${subject ?? 'Practice'} Practice`)];
    default: // Diagnostic / free-form
      return [newSection()];
  }
}

// Subject options per test type.
const SECTIONAL_SUBJECTS = ['Reading & Writing', 'Math'];
const PRACTICE_SUBJECTS = ['Math', 'Reading', 'Writing'];
const ASSIGNMENT_TYPES = [
  { key: 'Homework',  label: 'Homework',  emoji: '📚' },
  { key: 'Classwork', label: 'Classwork', emoji: '🏫' },
  { key: 'General',   label: 'General',   emoji: '📊' },
];

interface QuestionEditorProps {
  question: Question;
  index: number;
  onUpdate: (q: Question) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  isDragOver: boolean;
  isReadingWriting: boolean;
}

function QuestionEditor({ question, index, onUpdate, onDelete, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver, isReadingWriting }: QuestionEditorProps) {
  // R&W questions must always be passage-based. Coerce any legacy/non-passage
  // question in this section into a passage, preserving its content by wrapping
  // it as the first internal MCQ rather than discarding it.
  useEffect(() => {
    if (isReadingWriting && question.type !== 'passage') {
      const internals = question.linkedQuestions?.length
        ? question.linkedQuestions
        : [{
            ...question,
            id: generateId(),
            // numeric isn't allowed inside R&W passages — fall back to single MCQ
            type: question.type === 'numeric' ? 'mcq_single' : question.type,
            correctAnswer: question.type === 'numeric' ? 'a' : question.correctAnswer,
            parentQuestionId: question.id,
            linkedQuestions: [],
          } as Question];
      onUpdate({ ...question, type: 'passage', text: '', options: undefined, correctAnswer: 'a', linkedQuestions: internals });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReadingWriting, question.type]);

  const [expanded, setExpanded] = useState(index === 0);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const dragFromHandle = useRef(false);
  const difficultyColors: Record<Difficulty, 'success' | 'warning' | 'danger'> = { easy: 'success', medium: 'warning', hard: 'danger' };

  const handleSaveQuestion = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setIsSaving(false);
    toast.success(`Question ${index + 1} updated. Click 'Update' at the top to save all changes.`, { duration: 4000 });
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        if (!dragFromHandle.current) { e.preventDefault(); return; }
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e); }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      onDragEnd={() => { dragFromHandle.current = false; onDragEnd(); }}
      className={`rounded-xl overflow-hidden bg-white transition-all ${isDragOver ? 'ring-2 ring-blue-400 border-blue-300 shadow-lg scale-[1.01]' : 'border border-slate-200 shadow-sm hover:shadow-md'}`}
    >
      <div className="flex items-center gap-2 px-3 md:px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setExpanded(!expanded)}>
        <GripVertical
          size={13}
          className="text-slate-400 cursor-grab active:cursor-grabbing flex-shrink-0"
          onPointerDown={(e) => { e.stopPropagation(); dragFromHandle.current = true; }}
          onPointerUp={() => { dragFromHandle.current = false; }}
        />
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
              {isReadingWriting ? (
                <div className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-between gap-2">
                  <span>Passage Question</span>
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap">Required for R&amp;W</span>
                </div>
              ) : (
                <select value={question.type} onChange={(e) => onUpdate({ ...question, type: e.target.value as QuestionType })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="mcq_single">MCQ — Single Correct</option>
                  <option value="mcq_multi">MCQ — Multiple Correct</option>
                  <option value="numeric">Numeric Response</option>
                  <option value="passage">Passage Question</option>
                </select>
              )}
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
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Domain</label>
              <select value={question.topic} onChange={(e) => onUpdate({ ...question, topic: e.target.value, subTopic: '', skill: '' })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select domain</option>
                {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Subdomain</label>
              <select value={question.subTopic ?? ''} onChange={(e) => onUpdate({ ...question, subTopic: e.target.value, skill: '' })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!question.topic || !SUB_TOPICS[question.topic]}>
                <option value="">Select subdomain</option>
                {(SUB_TOPICS[question.topic] ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Skill</label>
              <select value={question.skill ?? ''} onChange={(e) => onUpdate({ ...question, skill: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!question.subTopic || !SKILLS_BY_SUBDOMAIN[question.subTopic]}>
                <option value="">Select skill</option>
                {(question.subTopic ? SKILLS_BY_SUBDOMAIN[question.subTopic] ?? [] : []).map((skill) => <option key={skill} value={skill}>{skill}</option>)}
              </select>
            </div>
          </div>

          {(question.type === 'mcq_single' || question.type === 'mcq_multi') && question.options && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Options</label>
              <div className="space-y-2">
                {question.options.map((opt) => {
                  const isCorrect = question.type === 'mcq_single'
                    ? question.correctAnswer === opt.id
                    : Array.isArray(question.correctAnswer) && question.correctAnswer.includes(opt.id);
                  return (
                    <div key={opt.id} className={`flex items-start gap-2 rounded-xl border p-2 transition-colors ${isCorrect ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
                      {question.type === 'mcq_single' ? (
                        <input type="radio" name={`correct-${question.id}`} checked={isCorrect}
                          onChange={() => onUpdate({ ...question, correctAnswer: opt.id })}
                          className="text-emerald-600 mt-2.5 flex-shrink-0" />
                      ) : (
                        <input type="checkbox" checked={isCorrect}
                          onChange={(e) => {
                            const curr = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
                            onUpdate({ ...question, correctAnswer: e.target.checked ? [...curr, opt.id] : curr.filter((x) => x !== opt.id) });
                          }}
                          className="rounded text-emerald-600 mt-2.5 flex-shrink-0" />
                      )}
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1.5 ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {opt.id.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <RichTextEditor
                          compact
                          content={opt.text}
                          onChange={(html) => {
                            const opts = question.options!.map((o) => o.id === opt.id ? { ...o, text: html } : o);
                            onUpdate({ ...question, options: opts });
                          }}
                        />
                        {opt.text && opt.text.includes('$') && (
                          <div className="px-2 py-1 bg-slate-50 border border-slate-100 rounded text-xs text-slate-500">
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mr-1">Preview:</span>
                            <MathRenderer html={opt.text} className="inline" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {question.type === 'numeric' && (() => {
            const answers = getNumericAnswers(question.correctAnswer);
            const setAnswers = (next: string[]) => onUpdate({ ...question, correctAnswer: next.length ? next : [''] });
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Accepted Answers (grid-in)</label>
                  <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">+ve max 5 chars &nbsp;·&nbsp; −ve max 6 chars</span>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0">ℹ</span>
                  <span>Add every equivalent form — a student's answer matches if it equals <strong>any one</strong> entry. Allowed: digits <code>0–9</code>, decimal <code>.</code>, fraction slash <code>/</code>, minus sign <code>-</code> (start only).</span>
                </div>

                <div className="space-y-2">
                  {answers.map((ans, i) => {
                    const isNeg = ans.startsWith('-');
                    const limit = isNeg ? 6 : 5;
                    const len = ans.length;
                    const over = len > limit;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <div className="relative">
                          <input
                            type="text"
                            value={ans}
                            maxLength={7}
                            onChange={(e) => {
                              let val = e.target.value.replace(/[^0-9./\-]/g, '');
                              if (val.indexOf('-') > 0) val = val.replace(/-/g, '');
                              const next = [...answers];
                              next[i] = val;
                              setAnswers(next);
                            }}
                            placeholder={i === 0 ? 'e.g. 3/4' : i === 1 ? 'e.g. 0.75' : 'e.g. .75'}
                            className={`w-36 px-3 py-2 text-sm border rounded-lg font-mono focus:outline-none focus:ring-2 ${over ? 'border-red-400 focus:ring-red-300 bg-red-50' : 'border-slate-200 focus:ring-blue-500'}`}
                          />
                        </div>
                        <span className={`text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded ${over ? 'bg-red-100 text-red-600' : len === limit ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                          {len}/{limit}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium w-20 truncate">
                          {ans.includes('/') ? 'fraction' : ans.includes('.') ? 'decimal' : ans.startsWith('-') ? 'negative' : ans.length > 0 ? 'integer' : ''}
                        </span>
                        {answers.length > 1 && (
                          <button type="button" onClick={() => setAnswers(answers.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-500 transition-colors">
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {answers.length < 6 && (
                  <button
                    type="button"
                    onClick={() => setAnswers([...answers, ''])}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    <Plus size={12} /> Add another accepted form
                  </button>
                )}
              </div>
            );
          })()}

          {question.type === 'passage' && (
            <div className="space-y-4 border-t border-slate-200 pt-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800 flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0">ℹ</span>
                <span>
                  <strong>Passage Question Format:</strong> Add internal questions below. The passage text above appears on the left, and these questions appear on the right during the test.
                </span>
              </div>

              {/* Linked Questions Editor */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Internal Questions ({(question.linkedQuestions || []).length})</h4>
                  <button
                    type="button"
                    onClick={() => {
                      const newLinkedQ = newQuestion();
                      newLinkedQ.id = generateId();
                      newLinkedQ.parentQuestionId = question.id;
                      const updated = { ...question, linkedQuestions: [...(question.linkedQuestions || []), newLinkedQ] };
                      onUpdate(updated);
                    }}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Question
                  </button>
                </div>

                {(question.linkedQuestions && question.linkedQuestions.length > 0) ? (
                  <div className="space-y-3">
                    {question.linkedQuestions.map((linkedQ, idx) => (
                      <div key={linkedQ.id} className="border border-slate-300 rounded-lg p-3 bg-white">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-xs font-semibold text-slate-600">Question {idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = {
                                ...question,
                                linkedQuestions: (question.linkedQuestions || []).filter((q) => q.id !== linkedQ.id),
                              };
                              onUpdate(updated);
                            }}
                            className="p-0.5 text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        <div className="space-y-2">
                          {/* Type */}
                          <select
                            value={linkedQ.type}
                            onChange={(e) => {
                              const updated = { ...linkedQ, type: e.target.value as QuestionType };
                              if (e.target.value === 'mcq_single' || e.target.value === 'mcq_multi') {
                                updated.options = linkedQ.options || [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }];
                                updated.correctAnswer = e.target.value === 'mcq_single' ? 'a' : ['a'];
                              }
                              const passageUpdated = {
                                ...question,
                                linkedQuestions: (question.linkedQuestions || []).map((q) => (q.id === linkedQ.id ? updated : q)),
                              };
                              onUpdate(passageUpdated);
                            }}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="mcq_single">MCQ — Single</option>
                            <option value="mcq_multi">MCQ — Multiple</option>
                            {!isReadingWriting && <option value="numeric">Numeric</option>}
                          </select>

                          {/* Question Text */}
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Question Text</label>
                            <RichTextEditor
                              compact
                              content={linkedQ.text}
                              onChange={(html) => {
                                const updated = { ...linkedQ, text: html };
                                const passageUpdated = {
                                  ...question,
                                  linkedQuestions: (question.linkedQuestions || []).map((q) => (q.id === linkedQ.id ? updated : q)),
                                };
                                onUpdate(passageUpdated);
                              }}
                            />
                          </div>

                          {/* MCQ Options */}
                          {(linkedQ.type === 'mcq_single' || linkedQ.type === 'mcq_multi') && linkedQ.options && (
                            <div>
                              <label className="text-xs font-semibold text-slate-600 block mb-1">Options</label>
                              <div className="space-y-1">
                                {linkedQ.options.map((opt) => {
                                  const isCorrect = linkedQ.type === 'mcq_single'
                                    ? linkedQ.correctAnswer === opt.id
                                    : Array.isArray(linkedQ.correctAnswer) && linkedQ.correctAnswer.includes(opt.id);
                                  return (
                                    <div key={opt.id} className="flex items-center gap-1.5">
                                      {linkedQ.type === 'mcq_single' ? (
                                        <input
                                          type="radio"
                                          checked={isCorrect}
                                          onChange={() => {
                                            const updated = { ...linkedQ, correctAnswer: opt.id };
                                            const passageUpdated = {
                                              ...question,
                                              linkedQuestions: (question.linkedQuestions || []).map((q) => (q.id === linkedQ.id ? updated : q)),
                                            };
                                            onUpdate(passageUpdated);
                                          }}
                                          className="text-emerald-600"
                                        />
                                      ) : (
                                        <input
                                          type="checkbox"
                                          checked={isCorrect}
                                          onChange={(e) => {
                                            const curr = Array.isArray(linkedQ.correctAnswer) ? linkedQ.correctAnswer : [];
                                            const updated = {
                                              ...linkedQ,
                                              correctAnswer: e.target.checked ? [...curr, opt.id] : curr.filter((x) => x !== opt.id),
                                            };
                                            const passageUpdated = {
                                              ...question,
                                              linkedQuestions: (question.linkedQuestions || []).map((q) => (q.id === linkedQ.id ? updated : q)),
                                            };
                                            onUpdate(passageUpdated);
                                          }}
                                          className="rounded text-emerald-600"
                                        />
                                      )}
                                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-slate-100 text-slate-600">
                                        {opt.id.toUpperCase()}
                                      </div>
                                      <input
                                        type="text"
                                        value={opt.text}
                                        onChange={(e) => {
                                          const opts = linkedQ.options!.map((o) => (o.id === opt.id ? { ...o, text: e.target.value } : o));
                                          const updated = { ...linkedQ, options: opts };
                                          const passageUpdated = {
                                            ...question,
                                            linkedQuestions: (question.linkedQuestions || []).map((q) => (q.id === linkedQ.id ? updated : q)),
                                          };
                                          onUpdate(passageUpdated);
                                        }}
                                        placeholder={`Option ${opt.id.toUpperCase()}`}
                                        className="flex-1 px-2 py-0.5 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Numeric Answer */}
                          {linkedQ.type === 'numeric' && (
                            <div>
                              <label className="text-xs font-semibold text-slate-600 block mb-1">Correct Answer</label>
                              <input
                                type="number"
                                value={typeof linkedQ.correctAnswer === 'number' ? linkedQ.correctAnswer : ''}
                                onChange={(e) => {
                                  const updated = { ...linkedQ, correctAnswer: parseFloat(e.target.value) || 0 };
                                  const passageUpdated = {
                                    ...question,
                                    linkedQuestions: (question.linkedQuestions || []).map((q) => (q.id === linkedQ.id ? updated : q)),
                                  };
                                  onUpdate(passageUpdated);
                                }}
                                placeholder="e.g. 42"
                                className="w-24 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No internal questions added yet. Click "Add Question" to create one.</p>
                )}
              </div>

              {/* Preview Toggle + Split Preview */}
              <div className="flex items-center justify-between mt-3">
                <div className="text-xs text-slate-500">Preview how this passage and its internal questions will appear to students.</div>
                <button
                  type="button"
                  onClick={() => setShowPreview((s) => !s)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md border border-slate-200"
                >
                  {showPreview ? 'Hide Preview' : 'Show Preview'}
                </button>
              </div>

              {showPreview && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="prose-slate max-h-64 overflow-y-auto p-3 border border-slate-200 rounded-lg bg-white">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Passage (Left)</div>
                    <MathRenderer html={question.text || '<p>(No passage text)</p>'} />
                  </div>

                  <div className="max-h-64 overflow-y-auto p-3 border border-slate-200 rounded-lg bg-white">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Internal Questions (Right)</div>
                    {(question.linkedQuestions && question.linkedQuestions.length > 0) ? (
                      <div className="space-y-3">
                        {question.linkedQuestions.map((lq, _i) => (
                          <div key={lq.id} className="border rounded-md p-2">
                            <div className="text-sm text-slate-700 mb-2"><MathRenderer html={lq.text || 'Untitled question'} /></div>
                            {(lq.type === 'mcq_single' || lq.type === 'mcq_multi') && lq.options && (
                              <div className="space-y-1">
                                {lq.options.map((opt) => (
                                  <div key={opt.id} className="flex items-start gap-2">
                                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">{opt.id.toUpperCase()}</div>
                                    <div className="text-sm text-slate-700"><MathRenderer html={opt.text || ''} /></div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {lq.type === 'numeric' && (
                              <div className="text-sm text-slate-600 italic">Numeric answer input</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic">No internal questions added yet.</div>
                    )}
                  </div>
                </div>
              )}
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

interface ParsedPDFSection {
  id: string;
  name: string;
  questions: ParsedPDFQuestion[];
  collapsed: boolean;
}

const SECTION_PATTERNS = [
  /^section\s+\d+\s*(?:[:\-–]\s*(.+))?$/i,
  /^part\s+\d+\s*(?:[:\-–]\s*(.+))?$/i,
  /^module\s+\d+\s*(?:[:\-–]\s*(.+))?$/i,
  /^(english|mathematics?|math|reading|science|writing)\s*(?:test|section|module)?\s*\d*$/i,
  /^\d+\s*[:\-–]\s*(english|mathematics?|math|reading|science|writing)\s*(?:test|section)?$/i,
];

function isSectionHeader(line: string): boolean {
  if (line.length > 80) return false;
  if (/^(\d{1,3})[.)]\s+/.test(line)) return false;
  return SECTION_PATTERNS.some(p => p.test(line));
}

// Split lines like "A. foo   B. bar   C. baz   D. qux" into separate option lines.
// Also handles (A), F/G/H/J style (ACT).
function expandInlineOptions(line: string): string[] {
  // Match 2+ option markers on the same line
  const markerRe = /(?:^|\s{2,})(\(([A-Ja-j])\)|([A-Ja-j])[.)]\s)/g;
  const matches = [...line.matchAll(markerRe)];
  if (matches.length < 2) return [line];

  const parts: string[] = [];
  let prev = 0;
  for (const m of matches) {
    // trim leading whitespace to find the real start of this option
    const rawIdx = m.index! + (m[0].length - m[0].trimStart().length);
    if (rawIdx > prev) {
      const head = line.slice(prev, rawIdx).trim();
      if (head) parts.push(head);
    }
    prev = rawIdx;
  }
  const tail = line.slice(prev).trim();
  if (tail) parts.push(tail);
  return parts.filter(Boolean);
}

function parsePDFText(fullText: string): ParsedPDFSection[] {
  // Pre-process: expand inline options before splitting into lines
  const rawLines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
  const lines: string[] = [];
  for (const l of rawLines) lines.push(...expandInlineOptions(l));

  const sections: ParsedPDFSection[] = [];
  let currentName = 'Imported';
  let currentQuestions: ParsedPDFQuestion[] = [];

  const qStartPat = /^(\d{1,3})[.)]\s+(.+)/;
  // Support A-D and ACT's F-J, with . ) or : after the letter, or just a space
  const optPat = /^(?:\(([A-Ja-j])\)|([A-Ja-j])[.):\s])\s*(.+)/;

  let current: { num: number; textLines: string[]; optMap: Record<string, string> } | null = null;

  const flushQuestion = () => {
    if (!current || !current.textLines.length) return;
    const text = current.textLines.join(' ').replace(/\s{2,}/g, ' ').trim();
    const optCount = Object.keys(current.optMap).length;
    const options = optCount >= 2
      ? Object.entries(current.optMap).slice(0, 4).map(([id, t]) => ({ id, text: t }))
      : [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }];
    currentQuestions.push({
      id: Math.random().toString(36).substr(2, 9),
      num: current.num,
      text,
      options,
      detectedType: optCount >= 2 ? 'mcq_single' : 'numeric',
      selected: true,
    });
    current = null;
  };

  const flushSection = () => {
    if (currentQuestions.length > 0) {
      sections.push({ id: Math.random().toString(36).substr(2, 9), name: currentName, questions: currentQuestions, collapsed: false });
    }
    currentQuestions = [];
  };

  for (const line of lines) {
    if (isSectionHeader(line)) {
      flushQuestion();
      flushSection();
      currentName = line.replace(/\s+/g, ' ').trim();
      continue;
    }
    const qm = line.match(qStartPat);
    if (qm) {
      flushQuestion();
      current = { num: parseInt(qm[1]), textLines: [qm[2]], optMap: {} };
      continue;
    }
    if (current) {
      const om = line.match(optPat);
      if (om) {
        const letter = (om[1] ?? om[2]).toLowerCase();
        // Avoid treating single-letter answers mid-sentence as options
        if (['a','b','c','d','e','f','g','h','j'].includes(letter)) {
          current.optMap[letter] = (om[3] ?? '').trim();
        }
      } else {
        if (Object.keys(current.optMap).length === 0) current.textLines.push(line);
      }
    }
  }
  flushQuestion();
  flushSection();
  return sections;
}

function PDFQuestionUploader({ onImport, onClose }: { onImport: (sections: { name: string; questions: Question[] }[]) => void; onClose: () => void }) {
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [sections, setSections] = useState<ParsedPDFSection[]>([]);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') { setError('Please upload a .pdf file'); return; }
    setError(''); setFileName(file.name); setParsing(true); setProgress(0); setSections([]);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();

        // Group text items by Y position (rounded to 3px buckets) so fragments
        // on the same visual line get joined into one string, not separate lines.
        const yBuckets = new Map<number, Array<{ x: number; str: string }>>();
        for (const item of content.items as Array<{ str: string; transform: number[] }>) {
          if (!item.str) continue;
          const y = Math.round(item.transform[5] / 3) * 3;
          if (!yBuckets.has(y)) yBuckets.set(y, []);
          yBuckets.get(y)!.push({ x: item.transform[4], str: item.str });
        }
        const pageLines = [...yBuckets.entries()]
          .sort(([ya], [yb]) => yb - ya) // PDF y-axis is bottom-up
          .map(([, items]) => {
            const sorted = items.sort((a, b) => a.x - b.x);
            let line = '';
            for (const it of sorted) {
              if (line && !line.endsWith(' ') && !it.str.startsWith(' ')) line += ' ';
              line += it.str;
            }
            return line.trim();
          })
          .filter(Boolean);
        fullText += pageLines.join('\n') + '\n';
        setProgress(Math.round((i / pdf.numPages) * 100));
      }
      const parsed = parsePDFText(fullText);
      if (!parsed.length || parsed.every(s => s.questions.length === 0)) {
        setError('No numbered questions detected. Make sure questions are numbered like "1." or "1)".');
      } else {
        setSections(parsed);
      }
    } catch {
      setError('Failed to read PDF. Make sure it contains selectable text (not a scanned image).');
    } finally {
      setParsing(false);
    }
  };

  const toggleQuestion = (secId: string, qId: string) =>
    setSections(prev => prev.map(s => s.id !== secId ? s : { ...s, questions: s.questions.map(q => q.id === qId ? { ...q, selected: !q.selected } : q) }));

  const toggleSection = (secId: string, val: boolean) =>
    setSections(prev => prev.map(s => s.id !== secId ? s : { ...s, questions: s.questions.map(q => ({ ...q, selected: val })) }));

  const toggleCollapse = (secId: string) =>
    setSections(prev => prev.map(s => s.id !== secId ? s : { ...s, collapsed: !s.collapsed }));

  const updateSectionName = (secId: string, name: string) =>
    setSections(prev => prev.map(s => s.id !== secId ? s : { ...s, name }));

  const totalSelected = sections.reduce((a, s) => a + s.questions.filter(q => q.selected).length, 0);
  const totalQuestions = sections.reduce((a, s) => a + s.questions.length, 0);

  const handleImport = () => {
    const toImport = sections
      .map(s => ({
        name: s.name,
        questions: s.questions.filter(q => q.selected).map(q => ({
          id: q.id,
          text: q.text,
          type: q.detectedType,
          options: q.options,
          correctAnswer: q.detectedType === 'mcq_single' ? 'a' : 0,
          difficulty: 'medium' as Difficulty,
          topic: '',
          marks: 1,
          marksNegative: 0,
        } as Question)),
      }))
      .filter(s => s.questions.length > 0);
    onImport(toImport);
    onClose();
    const sCount = toImport.length;
    toast.success(`${totalSelected} question${totalSelected !== 1 ? 's' : ''} imported across ${sCount} section${sCount !== 1 ? 's' : ''}!`);
  };

  return (
    <div className="space-y-4">
      {!sections.length && (
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
              <p className="text-xs text-slate-400 mt-1">Questions: numbered 1. 2. 3. — Options: A. B. C. D.</p>
              <p className="text-xs text-slate-400">Section headers like "Section 1", "English Test", "Math Section" are auto-detected</p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {sections.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {totalQuestions} questions across {sections.length} section{sections.length !== 1 ? 's' : ''} in <span className="text-blue-600">{fileName}</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{totalSelected} selected for import</p>
            </div>
            <button onClick={() => { setSections([]); setFileName(''); setError(''); }}
              className="text-xs text-red-500 hover:text-red-700 font-medium">Change file</button>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {sections.map(sec => {
              const secSelected = sec.questions.filter(q => q.selected).length;
              const allSelected = secSelected === sec.questions.length;
              return (
                <div key={sec.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100">
                    <input type="checkbox" checked={allSelected}
                      onChange={e => toggleSection(sec.id, e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 flex-shrink-0" />
                    <input
                      value={sec.name}
                      onChange={e => updateSectionName(sec.id, e.target.value)}
                      className="flex-1 text-sm font-semibold text-blue-800 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1 min-w-0"
                    />
                    <span className="text-xs text-blue-500 flex-shrink-0">{secSelected}/{sec.questions.length}</span>
                    <button onClick={() => toggleCollapse(sec.id)} className="text-blue-400 hover:text-blue-600 flex-shrink-0">
                      {sec.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                  </div>
                  {!sec.collapsed && (
                    <div className="divide-y divide-slate-50">
                      {sec.questions.map(q => (
                        <label key={q.id} className={`flex items-start gap-3 px-3 py-2 cursor-pointer transition-colors ${q.selected ? 'bg-blue-50/40' : 'bg-white hover:bg-slate-50'}`}>
                          <input type="checkbox" checked={q.selected}
                            onChange={() => toggleQuestion(sec.id, q.id)}
                            className="rounded text-blue-600 mt-0.5 flex-shrink-0" />
                          <span className="flex-1 min-w-0 flex flex-col">
                            <span className="flex items-start gap-2">
                              <span className="text-xs font-bold text-slate-400 flex-shrink-0 mt-0.5">Q{q.num}</span>
                              <span className="text-sm text-slate-800 line-clamp-2">{q.text || <span className="text-slate-400 italic">Empty</span>}</span>
                            </span>
                            {q.options.some(o => o.text) && (
                              <span className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 ml-5">
                                {q.options.filter(o => o.text).map(o => (
                                  <span key={o.id} className="text-xs text-slate-500">
                                    <span className="font-semibold text-slate-600">{o.id.toUpperCase()}.</span> {o.text.length > 25 ? o.text.slice(0, 25) + '…' : o.text}
                                  </span>
                                ))}
                              </span>
                            )}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${q.detectedType === 'mcq_single' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {q.detectedType === 'mcq_single' ? 'MCQ' : 'NUM'}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            <strong>Tip:</strong> Section names are editable — rename before importing. Correct answers are not auto-detected.
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleImport} disabled={!totalSelected}>
              Import {totalSelected > 0 ? `${totalSelected} question${totalSelected !== 1 ? 's' : ''}` : 'questions'} → {sections.filter(s => s.questions.some(q => q.selected)).length} section{sections.filter(s => s.questions.some(q => q.selected)).length !== 1 ? 's' : ''}
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

const CSV_TEMPLATE = [
  // Header row
  'type,text,option_a,option_b,option_c,option_d,correct_answer,difficulty,explanation,marks,marks_negative',

  // ── MCQ (single correct) ──────────────────────────────────────────────────
  // correct_answer = one letter: A B C or D
  'MCQ,"If 2x + 3 = 11, what is the value of x?",2,3,4,5,C,easy,"Subtract 3: 2x = 8, then divide by 2: x = 4",1,0.25',
  'MCQ,"Which planet is closest to the Sun?",Venus,Mercury,Mars,Earth,B,easy,Mercury is the closest planet to the Sun.,1,0',
  'MCQ,"A train travels 120 km in 2 hours. What is its average speed?","40 km/h","60 km/h","80 km/h","100 km/h",B,medium,Speed = Distance / Time = 120 / 2 = 60 km/h,1,0.25',
  'MCQ,"What is the value of sin(90°)?",0,1,-1,0.5,B,easy,sin(90°) = 1,1,0',

  // ── MSQ (multiple correct) — correct_answer = comma-separated letters in quotes ──
  // correct_answer must be quoted when multiple: "A,C" not A,C
  'MSQ,"Which of the following are prime numbers?",2,3,4,6,"A,B",medium,"2 and 3 are prime; 4 = 2×2, 6 = 2×3",1,0',
  'MSQ,"Select all correct simplifications of √48.",4√3,2√12,√3 × 4,"48^0.5","A,B,C",hard,"√48 = √(16×3) = 4√3 = 2√12 = 4×√3",2,0.5',

  // ── NUMERIC (number answer — leave options blank) ─────────────────────────
  // correct_answer = a number (integer or decimal). Commas in text need quotes.
  'NUMERIC,"What is the area of a rectangle with length 8 cm and width 5 cm?",,,,,40,easy,Area = length × width = 8 × 5 = 40 cm²,2,0',
  'NUMERIC,"If f(x) = 3x² − 2x + 1, what is f(2)?",,,,,9,medium,"f(2) = 3(4) − 2(2) + 1 = 12 − 4 + 1 = 9",1,0',
  'NUMERIC,"A circle has radius 7. What is its area to the nearest whole number? (use π ≈ 3.14)",,,,,154,medium,Area = π × r² ≈ 3.14 × 49 ≈ 153.86 ≈ 154,2,0.5',
  '',
].join('\r\n');

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
      {/* Template download + column guide */}
      <div className="space-y-2">
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div>
            <p className="text-sm font-medium text-blue-900">Download Template</p>
            <p className="text-xs text-blue-600 mt-0.5">Pre-filled with examples for all 3 question types</p>
          </div>
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
            <Download size={12} /> Download
          </button>
        </div>

        {/* Column reference */}
        <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
          <div className="bg-slate-50 px-3 py-1.5 font-semibold text-slate-600 uppercase tracking-wide border-b border-slate-200">Column Reference</div>
          <div className="divide-y divide-slate-100">
            {[
              { col: 'type', req: true,  vals: 'MCQ · MSQ · NUMERIC', note: 'MCQ = single correct, MSQ = multiple correct, NUMERIC = number answer' },
              { col: 'text', req: true,  vals: 'Any text',             note: 'Wrap in quotes if it contains commas: "If x=2, find y?"' },
              { col: 'option_a … option_d', req: false, vals: 'Any text', note: 'Required for MCQ/MSQ. Leave all 4 blank for NUMERIC.' },
              { col: 'correct_answer', req: true, vals: 'A/B/C/D · "A,C" · 42',  note: 'MCQ → single letter. MSQ → quoted comma list "A,B,D". NUMERIC → the number.' },
              { col: 'difficulty', req: false, vals: 'easy · medium · hard', note: 'Defaults to medium if blank or misspelled.' },
              { col: 'explanation', req: false, vals: 'Any text', note: 'Shown to students after submission. Optional.' },
              { col: 'marks', req: false, vals: '1 · 1.5 · 2', note: 'Points for correct answer. Defaults to 1.' },
              { col: 'marks_negative', req: false, vals: '0 · 0.25 · 0.5', note: 'Points deducted for wrong answer. Use 0 for no penalty.' },
            ].map(({ col, req, vals, note }) => (
              <div key={col} className="grid grid-cols-[140px_1fr] gap-2 px-3 py-2 hover:bg-slate-50">
                <div className="flex items-start gap-1">
                  <code className="text-blue-700 font-mono">{col}</code>
                  {req && <span className="text-red-400 font-bold leading-none mt-px">*</span>}
                </div>
                <div>
                  <span className="text-emerald-700 font-medium">{vals}</span>
                  <span className="text-slate-400 ml-2">{note}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-amber-50 border-t border-amber-100 px-3 py-1.5 text-amber-700">
            <span className="font-semibold">Rule:</span> If your text contains a comma, wrap the entire cell in double-quotes. To include a literal quote inside, use two quotes: <code className="bg-amber-100 px-1 rounded">""like this""</code>
          </div>
        </div>
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

// ── Bank Picker Modal ────────────────────────────────────────────────────────

type BankQuestion = Awaited<ReturnType<typeof api.getQuestions>>['questions'][0];

const BANK_DIFF_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = { EASY: 'success', MEDIUM: 'warning', HARD: 'danger' };

function BankPickerModal({ onAdd, onClose }: { onAdd: (questions: Question[]) => void; onClose: () => void }) {
  const [bankQs, setBankQs] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [diffFilter, setDiffFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getQuestions().then((res) => setBankQs(res.questions)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = bankQs.filter((q) => {
    const text = ((q.content as Record<string, unknown>).text as string) ?? '';
    return (
      (!typeFilter || q.type === typeFilter) &&
      (!diffFilter || q.difficultyLevel === diffFilter) &&
      (!search || text.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleAdd = () => {
    const TYPE_MAP: Record<string, QuestionType> = { MCQ: 'mcq_single', MSQ: 'mcq_multi', NUMERIC: 'numeric', PASSAGE: 'passage' };
    const DIFF_MAP: Record<string, Difficulty> = { EASY: 'easy', MEDIUM: 'medium', HARD: 'hard' };

    const mapped: Question[] = bankQs
      .filter((q) => selected.has(q.id))
      .map((q) => {
        const content = q.content as { text: string; explanation?: string };
        const rawOptions = q.options as Record<string, string> | null;
        const options = rawOptions
          ? Object.entries(rawOptions).map(([k, v]) => ({ id: k.toLowerCase(), text: v }))
          : [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }];

        const ca = (q.correctAnswer ?? {}) as Record<string, unknown>;
        let correctAnswer: string | string[] | number;
        if (ca.value !== undefined) correctAnswer = ca.value as number;
        else if (ca.keys) correctAnswer = (ca.keys as string[]).map((k: string) => k.toLowerCase());
        else correctAnswer = ((ca.key as string) ?? 'a').toLowerCase();

        return {
          id: generateId(),
          text: content.text ?? '',
          type: (TYPE_MAP[q.type] ?? 'mcq_single') as QuestionType,
          options,
          correctAnswer,
          difficulty: (DIFF_MAP[q.difficultyLevel] ?? 'medium') as Difficulty,
          topic: q.topic?.name ?? '',
          explanation: content.explanation ?? undefined,
          marks: 1,
          marksNegative: 0,
        };
      });

    onAdd(mapped);
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Add from Question Bank"
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-sm text-slate-500">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" icon={<Plus size={13} />} onClick={handleAdd} disabled={selected.size === 0}>
              Add {selected.size > 0 ? `${selected.size} Question${selected.size > 1 ? 's' : ''}` : 'Questions'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-40 relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions..."
              className="w-full pl-7 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Types</option>
            <option value="MCQ">MCQ Single</option>
            <option value="MSQ">MCQ Multi</option>
            <option value="NUMERIC">Numeric</option>
          </select>
          <select value={diffFilter} onChange={(e) => setDiffFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Levels</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </div>

        {/* List */}
        <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading bank…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Database size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No questions match your filters</p>
            </div>
          ) : (
            filtered.map((q) => {
              const text = ((q.content as Record<string, unknown>).text as string ?? '').replace(/<[^>]*>/g, '').slice(0, 100);
              const isSelected = selected.has(q.id);
              return (
                <button
                  key={q.id}
                  onClick={() => toggle(q.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                  }`}>
                    {isSelected && <CheckCircle2 size={10} className="text-white" />}
                  </div>
                  <p className="flex-1 text-sm text-slate-700 truncate">{text || 'Untitled'}</p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge variant="info" size="sm">{q.type}</Badge>
                    <Badge variant={BANK_DIFF_VARIANT[q.difficultyLevel] ?? 'default'} size="sm">{q.difficultyLevel}</Badge>
                    {q.topic && <span className="text-xs text-slate-400 hidden sm:inline">{q.topic.name}</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Test Builder ─────────────────────────────────────────────────────────────

export function TestBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [editTestId, setEditTestId] = useState<string | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);

  const [testSettings, setTestSettings] = useState({
    allowBackNavigation: false,
    showResults: true,
    enforceFullscreen: false,
    trackTabSwitching: true,
    publishStatus: 'draft' as TestStatus,
    category: '',
    subCategory: '',
    assignmentType: '', // for Practice Sheet: Homework | Classwork | General
  });

  // For new tests, the admin must pick a test type first; this gates the builder.
  const [typeSelected, setTypeSelected] = useState(false);

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

  // Load existing test into builder when editing
  useEffect(() => {
    const testId = searchParams.get('testId');
    if (!testId) return;

    setEditTestId(testId);
    setTypeSelected(true); // editing an existing test skips the type-picker gate
    setIsLoadingEdit(true);

    api.getTest(testId).then((data: any) => {
      const test = data.test as any;
      setTestTitle(test.title ?? '');
      setTestDesc(test.description ?? '');
      // Decode assignmentType from subCategory (e.g. 'Math-Homework' → subject='Math', assignmentType='Homework')
      const rawSub = test.subCategory ?? '';
      const subParts = rawSub.split('-');
      const decodedSub = subParts[0] ?? '';
      const decodedAssignment = subParts[1] ?? '';
      setTestSettings((prev) => ({
        ...prev,
        publishStatus: (test.status?.toLowerCase() ?? 'draft') as TestStatus,
        category: test.category ?? '',
        subCategory: decodedSub,
        assignmentType: decodedAssignment,
      }));

      const TYPE_MAP: Record<string, QuestionType> = { MCQ: 'mcq_single', MSQ: 'mcq_multi', NUMERIC: 'numeric', PASSAGE: 'passage' };
      const DIFF_MAP: Record<string, Difficulty> = { EASY: 'easy', MEDIUM: 'medium', HARD: 'hard' };

      const mappedSections: Section[] = (test.sections ?? []).map((sec: any) => ({
        id: generateId(),
        name: sec.name,
        timeLimit: sec.durationMinutes,
        questions: (sec.questions ?? []).map((tq: any) => {
          const q = tq.question;
          const content = q.content as { text: string; explanation?: string; meta?: { isPassage?: boolean; subTopic?: string; skill?: string } };
          const rawOptions = q.options as Record<string, string> | null;
          const options = rawOptions
            ? Object.entries(rawOptions).map(([k, v]) => ({ id: k.toLowerCase(), text: v as string }))
            : [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }];

          const ca = (q.correctAnswer ?? {}) as Record<string, unknown>;
          let correctAnswer: string | string[] | number;
          if (ca.value !== undefined) correctAnswer = ca.value as number;
          else if (ca.keys) correctAnswer = (ca.keys as string[]).map((k: string) => k.toLowerCase());
          else correctAnswer = ((ca.key as string) ?? 'a').toLowerCase();

          const isPassage = q.type === 'PASSAGE' || content?.meta?.isPassage === true;
          const type = (isPassage ? 'passage' : TYPE_MAP[q.type] ?? 'mcq_single') as QuestionType;

          const linkedQuestions = (q.childQuestions ?? []).map((cq: any) => {
            const cqContent = cq.content as { text: string; explanation?: string; meta?: { subTopic?: string; skill?: string } };
            const cqRawOptions = cq.options as Record<string, string> | null;
            const cqOptions = cqRawOptions
              ? Object.entries(cqRawOptions).map(([k, v]) => ({ id: k.toLowerCase(), text: v as string }))
              : [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }];

            const cqCa = (cq.correctAnswer ?? {}) as Record<string, unknown>;
            let cqCorrectAnswer: string | string[] | number;
            if (cqCa.value !== undefined) cqCorrectAnswer = cqCa.value as number;
            else if (cqCa.keys) cqCorrectAnswer = (cqCa.keys as string[]).map((k: string) => k.toLowerCase());
            else cqCorrectAnswer = ((cqCa.key as string) ?? 'a').toLowerCase();

            return {
              id: cq.id || generateId(),
              text: cqContent?.text ?? '',
              type: (TYPE_MAP[cq.type] ?? 'mcq_single') as QuestionType,
              options: cqOptions,
              correctAnswer: cqCorrectAnswer,
              difficulty: (DIFF_MAP[cq.difficultyLevel] ?? 'medium') as Difficulty,
              topic: cq.topic?.name ?? '',
              subTopic: cqContent?.meta?.subTopic ?? '',
              skill: cqContent?.meta?.skill ?? '',
              explanation: cqContent?.explanation ?? undefined,
              parentQuestionId: q.id,
            };
          });

          return {
            id: q.id || generateId(),
            text: content?.text ?? '',
            type,
            options,
            correctAnswer,
            difficulty: (DIFF_MAP[q.difficultyLevel] ?? 'medium') as Difficulty,
            topic: q.topic?.name ?? '',
            subTopic: content?.meta?.subTopic ?? '',
            skill: content?.meta?.skill ?? '',
            explanation: content?.explanation ?? undefined,
            marks: tq.marksPositive ?? 1,
            marksNegative: tq.marksNegative ?? 0,
            linkedQuestions,
          } as Question;
        }),
      }));

      setSections(mappedSections.length > 0 ? mappedSections : [newSection()]);
    }).catch(() => {
      toast.error('Failed to load test for editing');
    }).finally(() => {
      setIsLoadingEdit(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [dragSrcIdx, setDragSrcIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const updateSection = (idx: number, updates: Partial<Section>) =>
    setSections((prev) => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));

  const updateQuestion = (qId: string, updated: Question) => {
    const qs = activeSection.questions.map((q) => q.id === qId ? updated : q);
    updateSection(activeSectionIdx, { questions: qs });
  };
  const deleteQuestion = (qId: string) => updateSection(activeSectionIdx, { questions: activeSection.questions.filter((q) => q.id !== qId) });
  const addQuestion = () => updateSection(activeSectionIdx, {
    questions: [...activeSection.questions, isReadingWritingSection(activeSection.name) ? newPassageQuestion() : newQuestion()],
  });

  const handleQuestionDrop = (targetIdx: number) => {
    if (dragSrcIdx === null || dragSrcIdx === targetIdx) { setDragSrcIdx(null); setDragOverIdx(null); return; }
    const qs = [...activeSection.questions];
    const [moved] = qs.splice(dragSrcIdx, 1);
    qs.splice(targetIdx, 0, moved);
    updateSection(activeSectionIdx, { questions: qs });
    setDragSrcIdx(null);
    setDragOverIdx(null);
  };
  const addSection = () => { setSections((prev) => [...prev, newSection()]); setActiveSectionIdx(sections.length); };
  const deleteSection = (idx: number) => { setSections((prev) => prev.filter((_, i) => i !== idx)); setActiveSectionIdx(Math.max(0, idx - 1)); };

  // Confirm the chosen test type: build its module structure and open the builder.
  const startBuilding = () => {
    setSections(buildSectionsForType(testSettings.category, testSettings.subCategory));
    setActiveSectionIdx(0);
    setTypeSelected(true);
  };

  // Whether the current gate selection is complete enough to start building.
  const gateReady = (() => {
    switch (testSettings.category) {
      case 'Mock':
      case 'Diagnostic':
        return true;
      case 'Sectional':
        return !!testSettings.subCategory;
      case 'Practice Sheet':
        return !!testSettings.subCategory && !!testSettings.assignmentType;
      default:
        return false;
    }
  })();

  const totalQ = sections.reduce((a, s) => a + s.questions.length, 0);
  const totalTime = sections.reduce((a, s) => a + s.timeLimit, 0);
  const hasUntimedSection = sections.some(s => s.timeLimit === 0);
  const totalMarks = sections.reduce((a, s) => a + s.questions.reduce((b, q) => b + (q.marks ?? 1), 0), 0);

  const handleSave = async () => {
    if (!testTitle.trim()) {
      setTitleError(true);
      return;
    }
    setTitleError(false);

    // Sanitize: ensure no NaN/null/undefined correctAnswer reaches the backend
    const sanitizedSections = sections.map(sec => ({
      ...sec,
      questions: sec.questions.map(q => ({
        ...q,
        correctAnswer: (() => {
          if (q.type === 'numeric') {
            const n = typeof q.correctAnswer === 'number' ? q.correctAnswer : parseFloat(String(q.correctAnswer));
            return isNaN(n) ? 0 : n;
          }
          if (Array.isArray(q.correctAnswer)) return q.correctAnswer.length ? q.correctAnswer : ['a'];
          return (q.correctAnswer as string) || 'a';
        })(),
      })),
    }));

    try {
      if (editTestId) {
        await api.updateTest(editTestId, {
          title: testTitle.trim(),
          description: testDesc.trim() || undefined,
          sections: sanitizedSections,
          status: testSettings.publishStatus,
          category: testSettings.category || undefined,
          subCategory: testSettings.category === 'Practice Sheet' && testSettings.subCategory
            ? (testSettings.assignmentType ? `${testSettings.subCategory}-${testSettings.assignmentType}` : testSettings.subCategory)
            : testSettings.subCategory || undefined,
        });
      } else {
        await api.createTest({
          title: testTitle.trim(),
          description: testDesc.trim() || undefined,
          sections: sanitizedSections,
          status: testSettings.publishStatus,
          category: testSettings.category || undefined,
          subCategory: testSettings.category === 'Practice Sheet' && testSettings.subCategory
            ? (testSettings.assignmentType ? `${testSettings.subCategory}-${testSettings.assignmentType}` : testSettings.subCategory)
            : testSettings.subCategory || undefined,
          createdById: dbId ?? user?.id ?? '',
          allowBackNavigation: testSettings.allowBackNavigation,
          showResults: testSettings.showResults,
        });
      }
      setSaved(true);
      setTimeout(() => navigate('/tests'), 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save test';
      toast.error(msg);
    }
  };

  if (isLoadingEdit) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-slate-500">
        <Loader2 size={20} className="animate-spin" />
        <span>Loading test for editing…</span>
      </div>
    );
  }

  // ── Step 1: choose the test type (new tests only) ──────────────────────────
  if (!typeSelected) {
    const TYPE_OPTIONS = [
      { key: 'Mock',           label: 'Mock Test',      desc: 'Full composite — Reading & Writing + Math, 2 modules each.', color: 'border-blue-400 bg-blue-50 text-blue-800' },
      { key: 'Sectional',      label: 'Sectional',      desc: 'One subject, delivered as 2 modules.',                       color: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
      { key: 'Practice Sheet', label: 'Practice Sheet', desc: 'Single drill for one subject — Homework / Classwork / General.', color: 'border-purple-400 bg-purple-50 text-purple-800' },
      { key: 'Diagnostic',     label: 'Diagnostic',     desc: 'Free-form structure — build sections yourself.',             color: 'border-amber-400 bg-amber-50 text-amber-800' },
    ];
    const pickCategory = (key: string) =>
      setTestSettings((prev) => ({ ...prev, category: key, subCategory: '', assignmentType: '' }));

    return (
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        <Toaster position="bottom-right" />
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">New Test</h1>
          <p className="text-slate-500 text-sm mt-0.5">Choose the type of test you want to build. This sets up its module structure.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TYPE_OPTIONS.map((t) => (
            <button key={t.key} type="button" onClick={() => pickCategory(t.key)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${testSettings.category === t.key ? t.color : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <p className="text-sm font-bold">{t.label}</p>
              <p className={`text-xs mt-1 ${testSettings.category === t.key ? '' : 'text-slate-400'}`}>{t.desc}</p>
            </button>
          ))}
        </div>

        {/* Sectional → subject */}
        {testSettings.category === 'Sectional' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
            <div className="flex flex-wrap gap-2">
              {SECTIONAL_SUBJECTS.map((s) => (
                <button key={s} type="button" onClick={() => setTestSettings((prev) => ({ ...prev, subCategory: s }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${testSettings.subCategory === s ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 text-slate-600 hover:border-emerald-400'}`}
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        {/* Practice Sheet → subject + assignment type */}
        {testSettings.category === 'Practice Sheet' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
              <div className="flex flex-wrap gap-2">
                {PRACTICE_SUBJECTS.map((s) => (
                  <button key={s} type="button" onClick={() => setTestSettings((prev) => ({ ...prev, subCategory: s }))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${testSettings.subCategory === s ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-200 text-slate-600 hover:border-purple-400'}`}
                  >{s}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Assign As</label>
              <div className="flex flex-wrap gap-2">
                {ASSIGNMENT_TYPES.map((a) => (
                  <button key={a.key} type="button" onClick={() => setTestSettings((prev) => ({ ...prev, assignmentType: a.key }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${testSettings.assignmentType === a.key ? 'bg-slate-800 border-slate-800 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}
                  >{a.emoji} {a.label}</button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={startBuilding} disabled={!gateReady} icon={<Plus size={15} />}>
            Start building
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Toaster position="bottom-right" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Test Builder</h1>
            {editTestId && (
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Editing
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            {editTestId ? 'Edit questions and sections, then save.' : 'Create and manage test content'}
          </p>
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
            {saved ? '✓ Saved' : editTestId ? 'Update' : testSettings.publishStatus === 'published' ? 'Publish' : 'Save Draft'}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {previewMode !== 'full' && (
          <div className="space-y-4 min-w-0 animate-fade-in">
            {/* Test meta */}
            <Card padding="sm">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4 items-start">
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
                    { label: 'Minutes', value: hasUntimedSection ? (totalTime > 0 ? `${totalTime}m+` : '∞') : `${totalTime}m`, color: 'text-emerald-700', bg: 'bg-emerald-50' },
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

            <div className="flex flex-col lg:flex-row gap-4">
              {/* Mobile/tablet section nav toggle — hidden only on lg+ */}
              <button onClick={() => setShowSectionNav(!showSectionNav)}
                className="lg:hidden flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700">
                <Menu size={15} />
                Sections ({sections.length}) — {activeSection.name}
                <ChevronDown size={14} className={`ml-auto transition-transform ${showSectionNav ? 'rotate-180' : ''}`} />
              </button>

              {/* Section sidebar */}
              <div className={`${showSectionNav ? 'block' : 'hidden'} lg:block lg:w-60 xl:w-64 flex-shrink-0 space-y-1`}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 mb-2 hidden lg:block">Sections</p>
                {sections.map((sec, idx) => (
                  <div key={sec.id} className="group flex items-center gap-1">
                    <button onClick={() => { setActiveSectionIdx(idx); setShowSectionNav(false); }}
                      className={`flex-1 text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                        activeSectionIdx === idx ? 'bg-blue-600 text-white font-medium' : 'text-slate-600 hover:bg-slate-100'
                      }`}>
                      <p className="truncate text-xs leading-snug">{sec.name}</p>
                      <p className={`text-xs mt-0.5 ${activeSectionIdx === idx ? 'text-blue-200' : 'text-slate-400'}`}>{sec.questions.length}q · {sec.timeLimit === 0 ? 'Untimed' : `${sec.timeLimit}m`}</p>
                    </button>
                    {sections.length > 1 && (
                      <button onClick={() => deleteSection(idx)} className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 rounded transition-all flex-shrink-0">
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
              <div className="flex-1 space-y-3 min-w-0 overflow-hidden">
                {/* Section settings */}
                <Card padding="sm">
                  <div className="flex flex-col md:flex-row gap-3 md:items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Section Name</label>
                      <input type="text" value={activeSection.name} onChange={(e) => updateSection(activeSectionIdx, { name: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Time (min)</label>
                      <div className="flex items-center gap-2">
                        <input type="number" value={activeSection.timeLimit || ''} onChange={(e) => updateSection(activeSectionIdx, { timeLimit: parseInt(e.target.value) || 0 })}
                          min={1} max={180}
                          disabled={activeSection.timeLimit === 0}
                          placeholder="∞"
                          className={`w-24 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${activeSection.timeLimit === 0 ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed' : 'border-slate-200'}`} />
                        <button
                          type="button"
                          onClick={() => updateSection(activeSectionIdx, { timeLimit: activeSection.timeLimit === 0 ? 45 : 0 })}
                          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                            activeSection.timeLimit === 0
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                          }`}
                          title={activeSection.timeLimit === 0 ? 'Click to add a time limit' : 'Click to remove time limit'}
                        >
                          <Clock size={13} />
                          {activeSection.timeLimit === 0 ? 'Untimed ✓' : 'No Limit'}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 pb-2">{activeSection.questions.length} questions</p>
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
                      onDragStart={() => setDragSrcIdx(idx)}
                      onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                      onDrop={() => handleQuestionDrop(idx)}
                      onDragEnd={() => { setDragSrcIdx(null); setDragOverIdx(null); }}
                      isDragOver={dragOverIdx === idx && dragSrcIdx !== idx}
                      isReadingWriting={isReadingWritingSection(activeSection.name)}
                    />
                  ))}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button variant="secondary" onClick={addQuestion} icon={<Plus size={13} />} className="flex-1 py-3 border-dashed">
                    Add Question
                  </Button>
                  <Button variant="secondary" onClick={() => setShowBankPicker(true)} icon={<Database size={13} />} className="py-3 border-dashed px-4">
                    From Bank
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

                {showBankPicker && (
                  <BankPickerModal
                    onAdd={(qs) => updateSection(activeSectionIdx, { questions: [...activeSection.questions, ...qs] })}
                    onClose={() => setShowBankPicker(false)}
                  />
                )}
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
      <Modal isOpen={showPDFUploader} onClose={() => setShowPDFUploader(false)} title="Bulk Import from PDF" size="lg">
        <PDFQuestionUploader
          onImport={(importedSections) => {
            setSections(prev => {
              const updated = [...prev];
              const isDefaultBlank = updated.length === 1 && updated[0].questions.length === 0 && updated[0].name === 'New Section';
              if (isDefaultBlank) updated.splice(0, 1);
              for (const sec of importedSections) {
                const existingIdx = updated.findIndex(s => s.name.toLowerCase() === sec.name.toLowerCase());
                if (existingIdx >= 0) {
                  updated[existingIdx] = { ...updated[existingIdx], questions: [...updated[existingIdx].questions, ...sec.questions] };
                } else {
                  updated.push({ id: generateId(), name: sec.name, timeLimit: 45, questions: sec.questions });
                }
              }
              return updated.length > 0 ? updated : [newSection()];
            });
            setActiveSectionIdx(0);
          }}
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
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-slate-900">{s.label}</span>
                <span className="text-xs text-slate-500">{s.desc}</span>
              </span>
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
          {/* ── Test Type ── */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Test Type</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: 'Mock',           label: 'Mock Test',       desc: 'Full composite — mixed subjects',          color: 'border-blue-400 bg-blue-50 text-blue-800' },
                { key: 'Sectional',      label: 'Sectional',       desc: 'Subject-wise section test',                color: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
                { key: 'Practice Sheet', label: 'Practice Sheet',  desc: 'No sections — topic drills & homework',    color: 'border-purple-400 bg-purple-50 text-purple-800' },
                { key: 'Diagnostic',     label: 'Diagnostic',      desc: 'Admission diagnostic test',                color: 'border-amber-400 bg-amber-50 text-amber-800' },
              ] as const).map((t) => (
                <button key={t.key} type="button"
                  onClick={() => setTestSettings((prev) => ({ ...prev, category: t.key, subCategory: '', assignmentType: '' }))}
                  className={`text-left p-3 rounded-lg border-2 transition-all ${testSettings.category === t.key ? t.color + ' border-2' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className={`text-[11px] mt-0.5 ${testSettings.category === t.key ? '' : 'text-slate-400'}`}>{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Subject (Sectional) ── */}
          {testSettings.category === 'Sectional' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
              <div className="flex flex-wrap gap-2">
                {SECTIONAL_SUBJECTS.map((s) => (
                  <button key={s} type="button"
                    onClick={() => setTestSettings((prev) => ({ ...prev, subCategory: s }))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${testSettings.subCategory === s ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 text-slate-600 hover:border-emerald-400'}`}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}

          {/* ── Subject + Assignment Type (Practice Sheet) ── */}
          {testSettings.category === 'Practice Sheet' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
                <div className="flex gap-2">
                  {PRACTICE_SUBJECTS.map((s) => (
                    <button key={s} type="button"
                      onClick={() => setTestSettings((prev) => ({ ...prev, subCategory: s }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${testSettings.subCategory === s ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-200 text-slate-600 hover:border-purple-400'}`}
                    >{s}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Assign As</label>
                <div className="flex gap-2">
                  {ASSIGNMENT_TYPES.map((a) => (
                    <button key={a.key} type="button"
                      onClick={() => setTestSettings((prev) => ({ ...prev, assignmentType: a.key }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${testSettings.assignmentType === a.key ? 'bg-slate-800 border-slate-800 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}
                    >{a.emoji} {a.label}</button>
                  ))}
                </div>
              </div>
            </>
          )}
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

  const flattenedSections = useMemo(() => {
    return sections.map((sec) => ({
      ...sec,
      questions: sec.questions.flatMap((q) => {
        if (q.type !== 'passage' || !q.linkedQuestions?.length) return [q];
        return q.linkedQuestions.map((lq, idx) => ({
          ...lq,
          type: lq.type,
          parentQuestionId: q.id,
          parentQuestionText: q.text,
          marks: lq.marks ?? q.marks,
          marksNegative: lq.marksNegative ?? q.marksNegative,
          _passageSubIndex: idx,
        }));
      }),
    }));
  }, [sections]);

  const section = flattenedSections[activeSectionIdx] || flattenedSections[0];
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
          {flattenedSections.map((sec, idx) => (
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
            question.parentQuestionText ? (
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 min-w-0 h-full overflow-hidden">
                {/* Passage Panel (Left) */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col overflow-y-auto min-w-0 h-full">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 border-b border-slate-100 pb-1.5 flex-shrink-0">Reading Passage</h3>
                  <div className="prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed overflow-y-auto flex-1 text-left">
                    <MathRenderer html={question.parentQuestionText} className="w-full" />
                  </div>
                </div>

                {/* Question Panel (Right) */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col overflow-y-auto min-w-0 h-full">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2 flex-shrink-0">
                    <span className="text-xs font-bold text-slate-400">Question {activeQuestionIdx + 1} of {totalQuestions}</span>
                    <div className="flex gap-1.5">
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize font-semibold">{question.difficulty}</span>
                      {question.topic && <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{question.topic}</span>}
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className="text-slate-800 text-sm leading-relaxed mb-4 text-left font-medium flex-shrink-0">
                    <MathRenderer html={question.text || 'Write question text to see preview...'} className="w-full" />
                  </div>

                  {/* Answers View Toggle */}
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 mb-3 text-left flex-shrink-0">
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
                    <div className="mt-3 bg-blue-50 border border-blue-100 text-blue-900 rounded-lg p-3 text-left text-xs leading-relaxed flex-shrink-0">
                      <p className="font-bold text-[10px] text-blue-700 uppercase tracking-wide mb-0.5">Admin Explanation</p>
                      {question.explanation}
                    </div>
                  )}
                </div>
              </div>
            ) : (
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
            )
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
