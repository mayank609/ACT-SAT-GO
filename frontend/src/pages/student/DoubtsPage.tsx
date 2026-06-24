import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, ChevronDown, ChevronUp, Loader2, AlertCircle, HelpCircle, ExternalLink } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { RichContentRenderer } from '../../components/admin/RichContentRenderer';
import { OptionRenderer } from '../../components/admin/OptionRenderer';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';

// ─── Types ─────────────────────────────────────────────────────────────────

interface DbAnswer {
  key?: string
  keys?: string[]
  value?: number
}

interface DbQuestion {
  id: string
  type: string
  content: { text: string; explanation?: string | null }
  options: Record<string, string> | null
  correctAnswer: DbAnswer
  difficultyLevel: string
  subject?: string
  childQuestions?: DbQuestion[]
}

interface DbTestQuestion {
  id: string
  questionId: string
  orderIndex: number
  question: DbQuestion
}

interface DbSectionAttempt {
  id: string
  sectionId: string
  section: {
    id: string
    name: string
    orderIndex: number
    questions: DbTestQuestion[]
  }
}

interface DbAttemptAnswer {
  id: string
  questionId: string
  answerGiven: DbAnswer | null
  timeSpentSeconds: number
  isFlagged: boolean
  doubtStatus?: 'doubt' | 'cleared' | null
}

interface DbAttempt {
  id: string
  testId: string
  status: string
  test: { id: string; title: string }
  sectionAttempts: DbSectionAttempt[]
  answers: DbAttemptAnswer[]
}

interface DoubtItem {
  questionId: string
  question: DbQuestion
  sectionName: string
  testTitle: string
  attemptId: string
  answerGiven: DbAnswer | null
  parentQuestionText?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function dbAnswerToDisplay(ans: DbAnswer | null): string | string[] | number | null {
  if (!ans) return null
  if (ans.value !== undefined) return ans.value
  if (ans.keys) return ans.keys.map((k) => k.toLowerCase())
  if (ans.key) return ans.key.toLowerCase()
  return null
}

function dbOptionsToDisplay(options: Record<string, string> | null): Array<{ id: string; text: string }> {
  if (!options) return []
  return Object.entries(options).map(([k, v]) => ({ id: k.toLowerCase(), text: v }))
}

function answersMatch(given: DbAnswer | null, correct: DbAnswer): boolean {
  if (!given) return false;
  if (correct.value !== undefined) return given.value === correct.value;
  if (correct.keys) {
    return JSON.stringify([...(given.keys ?? [])].sort()) === JSON.stringify([...correct.keys].sort());
  }
  if (correct.key) return given.key?.toUpperCase() === correct.key.toUpperCase();
  return false;
}

function getDoubtStatus(item: DoubtItem): 'wrong' | 'unattempted' | 'correct' {
  if (!item.answerGiven) return 'unattempted';
  return answersMatch(item.answerGiven, item.question.correctAnswer) ? 'correct' : 'wrong';
}

function getSubject(item: DoubtItem): 'math' | 'english' | 'other' {
  const subject = (item.question.subject || '').toLowerCase();
  if (subject.includes('math')) return 'math';
  if (subject.includes('english') || subject.includes('reading') || subject.includes('writing')) return 'english';

  const secName = (item.sectionName || '').toLowerCase();
  if (secName.includes('math') || secName.includes('calc')) return 'math';
  if (secName.includes('english') || secName.includes('reading') || secName.includes('writing') || secName.includes('verbal') || secName.includes('grammar')) return 'english';

  const testTitle = (item.testTitle || '').toLowerCase();
  if (testTitle.includes('math')) return 'math';
  if (testTitle.includes('english') || testTitle.includes('reading') || testTitle.includes('writing')) return 'english';

  return 'other';
}

// ─── Doubt card ──────────────────────────────────────────────────────────────

function DoubtItemComponent({ item, index, onCleared }: {
  item: DoubtItem
  index: number
  onCleared: (attemptId: string, questionId: string) => void
}) {
  const navigate = useNavigate();
  const [showExplanation, setShowExplanation] = useState(false);
  const [clearing, setClearing] = useState(false);
  const q = item.question;
  const options = dbOptionsToDisplay(q.options);
  const userAnswerDisplay = dbAnswerToDisplay(item.answerGiven);
  const correctAnswerDisplay = dbAnswerToDisplay(q.correctAnswer);

  const handleClear = async () => {
    setClearing(true);
    try {
      await api.setDoubtStatus(item.attemptId, item.questionId, 'cleared');
      onCleared(item.attemptId, item.questionId);
    } catch (err) {
      console.error('Failed to clear doubt', err);
      setClearing(false);
    }
  };

  const questionBody = (
    <div className="px-3 md:px-4 py-3 bg-white">
      {options.length > 0 && (
        <div className="space-y-2 mb-3 text-left">
          {options.map((opt) => {
            const isUserAnswer = Array.isArray(userAnswerDisplay) ? userAnswerDisplay.includes(opt.id) : userAnswerDisplay === opt.id;
            const isCorrectOption = Array.isArray(correctAnswerDisplay) ? correctAnswerDisplay.includes(opt.id) : correctAnswerDisplay === opt.id;
            return (
              <OptionRenderer
                key={opt.id}
                label={opt.id.toUpperCase()}
                text={opt.text}
                isSelected={isUserAnswer && !isCorrectOption}
                isCorrect={isCorrectOption}
                isIncorrect={isUserAnswer && !isCorrectOption}
                showFeedback={true}
              />
            );
          })}
        </div>
      )}
      {q.type === 'NUMERIC' && (
        <div className="flex gap-4 text-sm mb-3 text-left">
          <span className="text-slate-500">Your answer: <strong className="text-slate-700">{item.answerGiven?.value ?? '—'}</strong></span>
          <span className="text-slate-500">Correct: <strong className="text-emerald-600">{q.correctAnswer.value}</strong></span>
        </div>
      )}
      <div className="text-xs text-slate-500 mb-3 p-2 bg-slate-50 rounded border border-slate-100 flex items-center justify-between gap-2">
        <span><strong className="text-slate-700">{item.testTitle}</strong> • {item.sectionName}</span>
        <button
          onClick={() => navigate(`/test-review/${item.attemptId}`)}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium flex-shrink-0"
        >
          <ExternalLink size={11} /> Open in review
        </button>
      </div>
      {q.content.explanation && (
        <div className="text-left">
          <button onClick={() => setShowExplanation(!showExplanation)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
            {showExplanation ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {showExplanation ? 'Hide' : 'Show'} Explanation
          </button>
        </div>
      )}
      {showExplanation && q.content.explanation && (
        <div className="mt-3 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500 text-left">
          <RichContentRenderer content={q.content.explanation} variant="explanation" />
        </div>
      )}

      {/* Mark cleared — removes from doubts */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
        <button
          onClick={handleClear}
          disabled={clearing}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 transition-colors disabled:opacity-50"
        >
          {clearing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Mark Cleared
        </button>
      </div>
    </div>
  );

  if (item.parentQuestionText) {
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 bg-white">
          <div className="p-4 bg-slate-50 text-left overflow-y-auto max-h-[400px]">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 border-b border-slate-200/60 pb-1">Reading Passage</h4>
            <div className="prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed">
              <RichContentRenderer content={item.parentQuestionText} variant="question" className="prose-sm" />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="px-3 md:px-4 py-3 flex items-start gap-2 md:gap-3 bg-white">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-slate-600">
                  {index + 1}
                </div>
                <HelpCircle size={14} className="text-amber-500" />
              </div>
              <div className="text-sm text-slate-800 flex-1 leading-relaxed min-w-0 text-left font-medium">
                <RichContentRenderer content={q.content.text || `Question ${index + 1}`} variant="question" className="prose-sm" />
              </div>
              <Badge variant="warning" size="sm">Doubt</Badge>
            </div>
            {questionBody}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <div className="px-3 md:px-4 py-3 flex items-start gap-2 md:gap-3 bg-white">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-slate-600">
            {index + 1}
          </div>
          <HelpCircle size={14} className="text-amber-500" />
        </div>
        <div className="text-sm text-slate-800 flex-1 leading-relaxed min-w-0 text-left">
          <RichContentRenderer content={q.content.text || `Question ${index + 1}`} variant="question" className="prose-sm" />
        </div>
        <Badge variant="warning" size="sm">Doubt</Badge>
      </div>
      {questionBody}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export function DoubtsView({ studentId, title, subtitle, onBack }: {
  studentId: string | null | undefined;
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  const [doubts, setDoubts] = useState<DoubtItem[]>([]);
  const [subjectFilter, setSubjectFilter] = useState<'all' | 'math' | 'english'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'wrong' | 'unattempted'>('all');
  const [testScope, setTestScope] = useState<'all' | 'latest' | 'last2' | 'last5' | 'custom'>('all');
  const [selectedAttemptIds, setSelectedAttemptIds] = useState<string[]>([]);
  const [submittedAttempts, setSubmittedAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    if (!studentId) { setLoading(false); return; }

    api.getStudentAttempts(studentId)
      .then(({ attempts: rawAttempts }) => {
        if (!Array.isArray(rawAttempts)) return;
        const submitted = (rawAttempts as any[]).filter(a => a?.status === 'SUBMITTED');
        setSubmittedAttempts(submitted);

        Promise.all(submitted.map(a => api.getAttempt(a.id).catch(() => null)))
          .then((fullAttempts) => {
            const allDoubts: DoubtItem[] = [];

            fullAttempts.forEach((fullData) => {
              if (!fullData) return;
              const attempt = (fullData as any).attempt as DbAttempt;
              const answersMap = new Map((attempt.answers ?? []).map((a: DbAttemptAnswer) => [a.questionId, a]));

              (attempt.sectionAttempts ?? []).forEach((sa: DbSectionAttempt) => {
                const section = sa.section;
                const flattened: DbTestQuestion[] = [];

                (section.questions ?? []).forEach((tq: DbTestQuestion) => {
                  const q = tq.question;
                  const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
                  if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
                    q.childQuestions.forEach((cq: DbQuestion) => {
                      flattened.push({
                        id: cq.id,
                        questionId: cq.id,
                        orderIndex: tq.orderIndex,
                        question: { ...cq, parentQuestionText: q.content.text } as any,
                      });
                    });
                  } else if (!(q as any).parentQuestionId) {
                    flattened.push(tq);
                  }
                });

                flattened.forEach((tq: DbTestQuestion) => {
                  const ans = answersMap.get(tq.questionId);
                  if (ans?.doubtStatus === 'doubt') {
                    allDoubts.push({
                      questionId: tq.questionId,
                      question: tq.question,
                      sectionName: section.name,
                      testTitle: attempt.test?.title ?? 'Unknown Test',
                      attemptId: attempt.id,
                      answerGiven: ans.answerGiven ?? null,
                      parentQuestionText: (tq.question as any).parentQuestionText,
                    });
                  }
                });
              });
            });

            setDoubts(allDoubts);
          })
          .catch((e: Error) => setError(e.message))
          .finally(() => setLoading(false));
      })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [studentId]);

  const handleCleared = (attemptId: string, questionId: string) => {
    setDoubts(prev => prev.filter(d => !(d.attemptId === attemptId && d.questionId === questionId)));
  };

  const matchesScope = (d: DoubtItem) => {
    if (testScope === 'all') return true;
    if (testScope === 'latest') return d.attemptId === submittedAttempts[0]?.id;
    if (testScope === 'last2') return submittedAttempts.slice(0, 2).map(a => a.id).includes(d.attemptId);
    if (testScope === 'last5') return submittedAttempts.slice(0, 5).map(a => a.id).includes(d.attemptId);
    if (testScope === 'custom') return selectedAttemptIds.includes(d.attemptId);
    return true;
  };

  const filtered = doubts.filter(d =>
    (subjectFilter === 'all' || getSubject(d) === subjectFilter) &&
    matchesScope(d) &&
    (statusFilter === 'all' || getDoubtStatus(d) === statusFilter)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60 gap-2 text-slate-400 text-sm">
        <Loader2 size={18} className="animate-spin" /> Loading your doubts…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Go back">
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {doubts.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle size={48} className="mx-auto text-emerald-400 mb-3" />
          <p className="text-slate-600 font-medium">No doubts right now</p>
          <p className="text-slate-400 text-sm mt-1">Mark “Still Doubt” on a question's explanation and it'll show up here.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
              {/* Status filter */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500 mr-1 uppercase tracking-wider">Status:</span>
                {[
                  { value: 'all' as const, label: 'All' },
                  { value: 'wrong' as const, label: 'Wrong Only' },
                  { value: 'unattempted' as const, label: 'Unattempted' },
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      statusFilter === f.value
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Subject filter */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500 mr-1 uppercase tracking-wider">Subject:</span>
                {[
                  { value: 'all' as const, label: 'All Subjects' },
                  { value: 'math' as const, label: 'Maths' },
                  { value: 'english' as const, label: 'English' },
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setSubjectFilter(f.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      subjectFilter === f.value
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Test Range filter */}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200/60 pt-3">
              <span className="text-xs font-semibold text-slate-500 mr-1 uppercase tracking-wider">Test Range:</span>
              {[
                { value: 'all' as const, label: 'All Tests' },
                { value: 'latest' as const, label: 'Latest Test' },
                { value: 'last2' as const, label: 'Last 2 Tests' },
                { value: 'last5' as const, label: 'Last 5 Tests' },
                { value: 'custom' as const, label: 'Select Specific...' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => {
                    setTestScope(f.value);
                    if (f.value === 'custom' && selectedAttemptIds.length === 0 && submittedAttempts.length > 0) {
                      setSelectedAttemptIds([submittedAttempts[0].id]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    testScope === f.value
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <span className="ml-auto text-xs font-semibold text-blue-600">{filtered.length} open</span>
            </div>

            {/* Custom Test Selection Multi-Picker */}
            {testScope === 'custom' && submittedAttempts.length > 0 && (
              <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-2 max-h-40 overflow-y-auto">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Check tests to include:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {submittedAttempts.map((attempt) => {
                    const isChecked = selectedAttemptIds.includes(attempt.id);
                    const formattedDate = attempt.completedAt
                      ? new Date(attempt.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : new Date(attempt.startedAt).toLocaleDateString();
                    return (
                      <label
                        key={attempt.id}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer select-none transition-all ${
                          isChecked
                            ? 'bg-blue-50/40 border-blue-200 text-blue-700 font-semibold'
                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedAttemptIds((prev) =>
                              prev.includes(attempt.id)
                                ? prev.filter((id) => id !== attempt.id)
                                : [...prev, attempt.id]
                            );
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-slate-800">{attempt.test?.title ?? 'Unknown Test'}</p>
                          <p className="text-[10px] text-slate-400 font-normal mt-0.5">{formattedDate}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {filtered.map((item, idx) => (
              <DoubtItemComponent
                key={`${item.attemptId}-${item.questionId}`}
                item={item}
                index={idx}
                onCleared={handleCleared}
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle size={48} className="mx-auto text-emerald-400 mb-3" />
              <p className="text-slate-600 font-medium">No doubts in this subject</p>
              <p className="text-slate-400 text-sm mt-1">Try a different filter</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Student entrypoint ──────────────────────────────────────────────────────

export function DoubtsPage() {
  const navigate = useNavigate();
  const { dbId } = useAuthStore();
  return (
    <DoubtsView
      studentId={dbId}
      title="My Doubts"
      subtitle="Questions you marked as “still a doubt” while reviewing tests"
      onBack={() => navigate(-1)}
    />
  );
}
