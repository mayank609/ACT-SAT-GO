import { useState, useEffect, useCallback } from 'react';
import { Search, Trash2, Eye, Database, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Card, StatCard } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { MathRenderer } from '../../components/admin/MathRenderer';
import { api } from '../../lib/api';

type Question = Awaited<ReturnType<typeof api.getQuestions>>['questions'][0];

const TYPE_LABELS: Record<string, string> = { MCQ: 'MCQ Single', MSQ: 'MCQ Multi', NUMERIC: 'Numeric' };
const DIFF_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = { EASY: 'success', MEDIUM: 'warning', HARD: 'danger' };

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
        </div>
        <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-800 leading-relaxed">
          <MathRenderer html={question.content.text} />
        </div>
        {opts && (
          <div className="space-y-2">
            {Object.entries(opts).map(([key, text]) => (
              <div key={key} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                correctKeys.includes(key) ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'
              }`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  correctKeys.includes(key) ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}>{key}</span>
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
          <p className="text-sm text-slate-800 truncate">{text || 'No text'}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
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

export function QuestionBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [diffFilter, setDiffFilter] = useState('');
  const [previewQ, setPreviewQ] = useState<Question | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getQuestions({ type: typeFilter || undefined, difficulty: diffFilter || undefined, search: search || undefined });
      setQuestions(res.questions);
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, diffFilter, search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.deleteQuestion(deleteId);
      setQuestions((prev) => prev.filter((q) => q.id !== deleteId));
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Question Bank</h1>
          <p className="text-slate-500 text-sm mt-0.5">Browse and manage all questions across tests</p>
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
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search question text..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
            <p className="text-xs mt-1">Try adjusting your filters or create questions using the Test Builder</p>
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
