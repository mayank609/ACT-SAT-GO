import { fmtSec } from '../../lib/utils';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, CheckCircle, Clock, ChevronUp, ArrowLeft, ExternalLink,
  Loader2, AlertCircle, HelpCircle, ChevronDown, User, Calendar, Target
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { RichContentRenderer } from '../../components/admin/RichContentRenderer';
import { OptionRenderer } from '../../components/admin/OptionRenderer';
import { api, type DbUser } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { useSkillCategories, getSkillForTest } from '../../hooks/useSkillCategories';
import { formatNumericDisplay, numericEqual } from '../../lib/numericAnswer';

// ─── Types ─────────────────────────────────────────────────────────────────

interface DbAnswer {
  key?: string;
  keys?: string[];
  value?: number;
  values?: number[];
  text?: string;
  displayValues?: string[];
}

interface DbQuestion {
  id: string;
  type: string;
  content: { text: string; explanation?: string | null };
  options: Record<string, string> | null;
  correctAnswer: DbAnswer;
  difficultyLevel: string;
  subject?: string;
  childQuestions?: DbQuestion[];
}

interface DbTestQuestion {
  id: string;
  questionId: string;
  orderIndex: number;
  question: DbQuestion;
}

interface DbSectionAttempt {
  id: string;
  sectionId: string;
  startedAt: string;
  completedAt: string | null;
  section: {
    id: string;
    name: string;
    questions: DbTestQuestion[];
  };
}

interface DbAttemptAnswer {
  id: string;
  questionId: string;
  answerGiven: DbAnswer | null;
  timeSpentSeconds: number;
  isFlagged: boolean;
}

interface DbAttempt {
  id: string;
  testId: string;
  startedAt: string;
  completedAt: string | null;
  test: { id: string; title: string; category?: string };
  sectionAttempts: DbSectionAttempt[];
  answers: DbAttemptAnswer[];
}

interface MistakeItem {
  attemptId: string;
  testTitle: string;
  sectionName: string;
  question: DbQuestion;
  answerGiven: DbAnswer | null;
  status: 'wrong' | 'unattempted';
  orderIndex: number;
  parentQuestionText?: string;
  doubtStatus?: 'doubt' | 'cleared' | null;
}

// ─── Helper functions ──────────────────────────────────────────────────────

function dbAnswerToDisplay(ans: DbAnswer | null): string | string[] | number | null {
  if (!ans) return null;
  if (ans.value !== undefined) return ans.text ?? ans.displayValues?.[0] ?? formatNumericDisplay(ans.value);
  if (ans.keys) return ans.keys.map((k) => k.toLowerCase());
  if (ans.key) return ans.key.toLowerCase();
  return null;
}

function answersMatch(given: DbAnswer | null, correct: DbAnswer): boolean {
  if (!given) return false;
  if (correct.value !== undefined) {
    if (Array.isArray(correct.values) && correct.values.length > 0) {
      return correct.values.some((v) => numericEqual(given.value, v));
    }
    return numericEqual(given.value, correct.value);
  }
  if (correct.keys) {
    return (
      JSON.stringify([...(given.keys ?? [])].sort()) ===
      JSON.stringify([...correct.keys].sort())
    );
  }
  if (correct.key) return given.key?.toUpperCase() === correct.key.toUpperCase();
  return false;
}

function dbOptionsToDisplay(options: Record<string, string> | null): Array<{ id: string; text: string }> {
  if (!options) return [];
  return Object.entries(options).map(([k, v]) => ({ id: k.toLowerCase(), text: v }));
}

function getSubject(item: MistakeItem): 'math' | 'english' | 'other' {
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


// ─── Question item component ────────────────────────────────────────────────

interface MistakeItemComponentProps {
  item: MistakeItem;
  index: number;
  onDoubtStatusChange: (questionId: string, nextStatus: 'doubt' | 'cleared' | null) => void;
}

function MistakeItemComponent({ item, index, onDoubtStatusChange }: MistakeItemComponentProps) {
  const [showExplanation, setShowExplanation] = useState(false);
  const [savingDoubt, setSavingDoubt] = useState(false);

  const q = item.question;
  const options = dbOptionsToDisplay(q.options);
  const userAnswerDisplay = dbAnswerToDisplay(item.answerGiven);
  const correctAnswerDisplay = dbAnswerToDisplay(q.correctAnswer);
  const doubtStatus = item.doubtStatus ?? null;

  const handleSetDoubt = async (next: 'doubt' | 'cleared') => {
    setSavingDoubt(true);
    try {
      await api.setDoubtStatus(item.attemptId, q.id, next);
      onDoubtStatusChange(q.id, next);
    } catch (err) {
      console.error('Failed to set doubt status', err);
    } finally {
      setSavingDoubt(false);
    }
  };

  const badgeBgColor = 'bg-slate-600';

  const renderContent = () => (
    <div className="px-3 md:px-4 py-3 bg-white">
      {options.length > 0 && q.type !== 'NUMERIC' && (
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
          <span className="text-slate-500">Student answer: <strong className={item.status === 'wrong' ? 'text-red-500' : 'text-slate-500'}>{item.answerGiven?.text ?? (item.answerGiven?.value !== undefined ? formatNumericDisplay(item.answerGiven.value) : null) ?? '—'}</strong></span>
          <span className="text-slate-500">Correct: <strong className="text-emerald-600">{q.correctAnswer.displayValues?.[0] ?? (q.correctAnswer.value !== undefined ? formatNumericDisplay(q.correctAnswer.value) : '')}</strong></span>
        </div>
      )}
      <div className="text-xs text-slate-500 mb-3 p-2 bg-slate-50 rounded border border-slate-100">
        <strong className="text-slate-700">{item.testTitle}</strong> • {item.sectionName}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3">
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors"
        >
          {showExplanation ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span>Explanation & Doubt Status</span>
        </button>

        {/* Doubt Status Pill */}
        {doubtStatus === 'doubt' && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            <HelpCircle size={10} /> Marked as Doubt
          </span>
        )}
        {doubtStatus === 'cleared' && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <CheckCircle size={10} /> Cleared
          </span>
        )}
      </div>

      {showExplanation && (
        <div className="mt-3 space-y-3 border-t border-slate-50 pt-3">
          {q.content.explanation ? (
            <div className="p-3 bg-blue-50/50 rounded-lg border-l-4 border-blue-500 text-left text-xs leading-relaxed text-slate-800">
              <RichContentRenderer content={q.content.explanation} variant="explanation" className="prose-xs" />
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic text-left">No explanation available for this question.</div>
          )}

          {/* Doubt Resolution Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
            <p className="text-[11px] font-medium text-slate-500 text-left">
              {doubtStatus === 'cleared'
                ? "Doubt cleared. Student has revised this question."
                : doubtStatus === 'doubt'
                  ? "Student is struggling with this. Help them clear it below."
                  : "You can update this question's doubt status for the student:"}
            </p>
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                onClick={() => handleSetDoubt('doubt')}
                disabled={savingDoubt}
                className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded border transition-colors disabled:opacity-50 ${doubtStatus === 'doubt'
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
                  }`}
              >
                <HelpCircle size={10} /> Keep Doubt
              </button>
              <button
                onClick={() => handleSetDoubt('cleared')}
                disabled={savingDoubt}
                className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded border transition-colors disabled:opacity-50 ${doubtStatus === 'cleared'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                  }`}
              >
                <CheckCircle size={10} /> Mark Cleared
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (item.parentQuestionText) {
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 bg-white">
          {/* Left Panel: Passage */}
          <div className="p-4 bg-slate-50 text-left overflow-y-auto max-h-[400px]">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 border-b border-slate-200/60 pb-1 flex-shrink-0">Reading Passage</h4>
            <div className="prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed">
              <RichContentRenderer content={item.parentQuestionText} variant="question" className="prose-sm" />
            </div>
          </div>

          {/* Right Panel: Question & Answers */}
          <div className="flex flex-col">
            <div className="px-3 md:px-4 py-3 flex items-start gap-2 md:gap-3 bg-white">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${badgeBgColor}`}>
                  {index + 1}
                </div>
              </div>
              <div className="text-sm text-slate-800 flex-1 leading-relaxed min-w-0 text-left font-medium">
                <RichContentRenderer content={q.content.text || `Question ${index + 1}`} variant="question" className="prose-sm" />
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {item.timeSpentSeconds ? (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded text-[11px] font-semibold">
                    <Clock size={11} className="text-blue-600" />
                    <span>{fmtSec(item.timeSpentSeconds)}</span>
                  </span>
                ) : null}
                <Badge variant={item.status === 'unattempted' ? 'default' : 'danger'} size="sm">
                  {item.status === 'unattempted' ? 'Unattempted' : 'Wrong'}
                </Badge>
              </div>
            </div>
            {renderContent()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="px-3 md:px-4 py-3 flex items-start gap-2 md:gap-3 bg-white">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${badgeBgColor}`}>
            {index + 1}
          </div>
        </div>
        <div className="text-sm text-slate-800 flex-1 leading-relaxed min-w-0 text-left">
          <RichContentRenderer content={q.content.text || `Question ${index + 1}`} variant="question" className="prose-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {item.timeSpentSeconds ? (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded text-[11px] font-semibold">
              <Clock size={11} className="text-blue-600" />
              <span>{fmtSec(item.timeSpentSeconds)}</span>
            </span>
          ) : null}
          <Badge variant={item.status === 'unattempted' ? 'default' : 'danger'} size="sm">
            {item.status === 'unattempted' ? 'Unattempted' : 'Wrong'}
          </Badge>
        </div>
      </div>
      {renderContent()}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function StudentMistakesPage() {
  const { dbId, user } = useAuthStore();

  const [searchParams] = useSearchParams();

  const [students, setStudents] = useState<DbUser[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<DbUser | null>(null);
  const [studentSearch, setStudentSearch] = useState('');

  // Open a specific student directly when navigated here with ?studentId=… (e.g. from Analytics).
  useEffect(() => {
    const sid = searchParams.get('studentId');
    if (sid && !selectedStudent && students.length > 0) {
      const found = students.find(s => s.id === sid);
      if (found) setSelectedStudent(found);
    }
  }, [searchParams, students, selectedStudent]);

  const { skills } = useSkillCategories();
  const activeSkills = skills.filter(s => s.active).sort((a, b) => a.order - b.order);

  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'wrong' | 'unattempted'>('all');
  const [subjectFilter, setSubjectFilter] = useState<'all' | 'math' | 'english'>('all');
  const [testTypeFilter, setTestTypeFilter] = useState<string>('all');
  const [testScope, setTestScope] = useState<'all' | 'latest' | 'last2' | 'last5' | 'custom'>('all');
  const [selectedAttemptIds, setSelectedAttemptIds] = useState<string[]>([]);
  const [submittedAttempts, setSubmittedAttempts] = useState<any[]>([]);
  const [loadingMistakes, setLoadingMistakes] = useState(false);
  const [mistakesError, setMistakesError] = useState<string | null>(null);

  // 1. Fetch Student List based on Role
  useEffect(() => {
    if (!dbId || !user) return;
    setLoadingStudents(true);

    if (user.role === 'super_admin' || user.role === 'admin') {
      api.getUsersByRole('STUDENT')
        .then(({ users }) => {
          setStudents(users || []);
        })
        .catch((err) => console.error('Failed to load students', err))
        .finally(() => setLoadingStudents(false));
    } else if (user.role === 'tutor') {
      api.getTutorAssignments({ tutorId: dbId })
        .then(({ assignments }) => {
          const tutorStudents = assignments.map(a => a.student).filter(Boolean);
          setStudents(tutorStudents);
        })
        .catch((err) => console.error('Failed to load tutor students', err))
        .finally(() => setLoadingStudents(false));
    } else {
      setLoadingStudents(false);
    }
  }, [dbId, user]);

  // 2. Fetch Mistakes when Student Selection changes
  useEffect(() => {
    if (!selectedStudent) {
      setMistakes([]);
      setSubmittedAttempts([]);
      return;
    }

    setLoadingMistakes(true);
    setMistakesError(null);
    setFilter('all');
    setSubjectFilter('all');
    setTestTypeFilter('all');
    setTestScope('all');
    setSelectedAttemptIds([]);

    api.getStudentAttempts(selectedStudent.id)
      .then(({ attempts: rawAttempts }) => {
        if (!Array.isArray(rawAttempts)) {
          setLoadingMistakes(false);
          return;
        }

        const submitted = (rawAttempts as any[]).filter(a => a?.status === 'SUBMITTED');
        setSubmittedAttempts(submitted);

        if (submitted.length === 0) {
          setMistakes([]);
          setLoadingMistakes(false);
          return;
        }

        // Fetch full details for each attempt
        Promise.all(submitted.map(a => api.getAttempt(a.id).catch(() => null)))
          .then((fullAttempts) => {
            const allMistakes: MistakeItem[] = [];

            fullAttempts.forEach((fullData) => {
              if (!fullData) return;
              const attempt = fullData.attempt as DbAttempt;

              const answersMap = new Map((attempt.answers ?? []).map((a: DbAttemptAnswer) => [a.questionId, a]));
              const sections = attempt.sectionAttempts ?? [];

              sections.forEach((sa: DbSectionAttempt) => {
                const section = sa.section;
                const flattenedQuestions: DbTestQuestion[] = [];

                (section.questions ?? []).forEach((tq: DbTestQuestion) => {
                  const q = tq.question;
                  const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);

                  if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
                    q.childQuestions.forEach((cq: DbQuestion) => {
                      flattenedQuestions.push({
                        id: cq.id,
                        questionId: cq.id,
                        orderIndex: tq.orderIndex,
                        question: {
                          ...cq,
                          parentQuestionText: q.content.text,
                        } as any,
                      });
                    });
                  } else if (!(q as any).parentQuestionId) {
                    flattenedQuestions.push(tq);
                  }
                });

                flattenedQuestions.forEach((tq: DbTestQuestion) => {
                  const ans = answersMap.get(tq.questionId);
                  const isUnattempted = !ans || !ans.answerGiven;
                  const isWrong = ans && ans.answerGiven && !answersMatch(ans.answerGiven, tq.question.correctAnswer);

                  if (isWrong || isUnattempted) {
                    allMistakes.push({
                      questionId: tq.questionId,
                      question: tq.question,
                      sectionName: section.name,
                      testTitle: attempt.test?.title ?? 'Unknown Test',
                      testId: attempt.testId,
                      attemptId: attempt.id,
                      answerGiven: ans?.answerGiven ?? null,
                      timeSpentSeconds: ans?.timeSpentSeconds ?? 0,
                      status: isUnattempted ? 'unattempted' : 'wrong',
                      orderIndex: tq.orderIndex,
                      parentQuestionText: (tq.question as any).parentQuestionText,
                      doubtStatus: ans?.doubtStatus ?? null,
                    });
                  }
                });
              });
            });

            setMistakes(allMistakes);
          })
          .catch((e: Error) => setMistakesError(e.message))
          .finally(() => setLoadingMistakes(false));
      })
      .catch((e: Error) => {
        setMistakesError(e.message);
        setLoadingMistakes(false);
      });
  }, [selectedStudent]);

  // Callback to update doubt status in local state when resolved/marked
  const handleDoubtStatusChange = (questionId: string, nextStatus: 'doubt' | 'cleared' | null) => {
    setMistakes(prev =>
      prev.map(m =>
        m.questionId === questionId
          ? { ...m, doubtStatus: nextStatus }
          : m
      )
    );
  };

  // 1. Filter by test scope
  const mistakesForScope = mistakes.filter(m => {
    if (testScope === 'all') return true;
    if (testScope === 'latest') {
      return m.attemptId === submittedAttempts[0]?.id;
    }
    if (testScope === 'last2') {
      const activeIds = submittedAttempts.slice(0, 2).map(a => a.id);
      return activeIds.includes(m.attemptId);
    }
    if (testScope === 'last5') {
      const activeIds = submittedAttempts.slice(0, 5).map(a => a.id);
      return activeIds.includes(m.attemptId);
    }
    if (testScope === 'custom') {
      return selectedAttemptIds.includes(m.attemptId);
    }
    return true;
  });

  // 2. Filter by test type
  const mistakesForTestType = mistakesForScope.filter(m => {
    if (testTypeFilter === 'all') return true;
    return getSkillForTest(m.testTitle, skills) === testTypeFilter;
  });

  // 3. Filter by subject
  const mistakesForSubject = mistakesForTestType.filter(m => {
    if (subjectFilter === 'all') return true;
    return getSubject(m) === subjectFilter;
  });

  const totalCount = mistakesForSubject.length;
  const wrongCount = mistakesForSubject.filter(m => m.status === 'wrong').length;
  const unattemptedCount = mistakesForSubject.filter(m => m.status === 'unattempted').length;

  // 3. Filter by status (wrong vs unattempted)
  const filteredMistakes = mistakesForSubject.filter(m => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  // Filter students based on search term
  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const formatTargetDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr.replace(/-/g, '/'));
    return isNaN(date.getTime())
      ? '—'
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="w-full pb-10">
      {!selectedStudent ? (
        /* STUDENT LIST */
        <div className="space-y-5 max-w-4xl mx-auto">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-slate-900">Student Mistakes</h1>
            </div>
            <p className="text-sm text-slate-500">Click a student to review their incorrect and unattempted questions.</p>
          </div>

          {/* Search */}
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              placeholder="Search students…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-50 to-blue-100/40 border-b border-blue-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-blue-800 uppercase tracking-wide border-r border-blue-100 whitespace-nowrap">
                      Student
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wide whitespace-nowrap w-28">
                      Review
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loadingStudents ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-10 text-center text-sm text-slate-400">
                        <Loader2 size={18} className="animate-spin inline mr-2" /> Loading students…
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-10 text-center text-sm text-slate-400">
                        {students.length === 0 ? 'No students found.' : 'No matching students.'}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(student => (
                      <tr
                        key={student.id}
                        onClick={() => setSelectedStudent(student)}
                        className="border-b border-slate-100 hover:bg-blue-50/40 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 border-r border-slate-200">
                          <div className="flex items-center gap-2.5 min-w-[160px]">
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{student.name}</p>
                              <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedStudent(student); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          >
                            <ExternalLink size={12} />
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ACTIVE STATE — mistakes for selected student */
        <div className="space-y-6 w-full">
          {/* Back button + student header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectedStudent(null); setStudentSearch(''); }}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft size={16} /> Back to Students
            </button>
          </div>

          {/* Student Profile Overview Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-lg font-extrabold flex-shrink-0">
                {selectedStudent.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">{selectedStudent.name}</h1>
                <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1"><User size={12} /> {selectedStudent.email}</p>
              </div>
            </div>

            {/* Student target stats */}
            <div className="flex flex-wrap gap-2 md:gap-3 border-t border-slate-50 sm:border-0 pt-3 sm:pt-0">
              {selectedStudent.targetScore && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-800 rounded-xl text-xs font-bold border border-blue-100">
                  <Target size={12} className="text-blue-600" />
                  Target: {selectedStudent.targetScore}
                </span>
              )}
              {selectedStudent.targetDate && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-800 rounded-xl text-xs font-bold border border-indigo-100">
                  <Calendar size={12} className="text-indigo-600" />
                  Test Date: {formatTargetDate(selectedStudent.targetDate)}
                </span>
              )}
              {selectedStudent.grade && (
                <span className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold">
                  Grade {selectedStudent.grade}
                </span>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          {loadingMistakes ? null : mistakes.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Mistakes', value: totalCount, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
                { label: 'Wrong Answers', value: wrongCount, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
                { label: 'Unattempted', value: unattemptedCount, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200/60' },
              ].map((s) => (
                <div key={s.label} className={`bg-white border rounded-2xl p-4 text-center shadow-sm`}>
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-400 mt-1 font-medium">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Loading Mistakes State */}
          {loadingMistakes ? (
            <div className="flex flex-col items-center justify-center h-60 gap-3 text-slate-400 text-sm bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
              <Loader2 size={24} className="animate-spin text-blue-500" />
              <span className="font-medium">Retrieving student attempts and mapping mistakes…</span>
            </div>
          ) : mistakesError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
              <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">{mistakesError}</div>
            </div>
          ) : mistakes.length === 0 ? (
            /* NO MISTAKES DETECTED */
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
              <CheckCircle size={48} className="mx-auto text-emerald-400 mb-3" />
              <p className="text-slate-800 font-bold text-base">Perfect record! No mistakes found</p>
              <p className="text-slate-400 text-xs mt-1">This student has answered all questions correctly in their submitted attempts.</p>
            </div>
          ) : (
            /* DETAILED VIEW WITH WORKSPACE FILTERS */
            <>
              {/* Filters Board */}
              <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">

                {/* Test Type Filter — driven by Skills Management page */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-400 mr-1.5 uppercase tracking-wide">Test Type:</span>
                  <button
                    onClick={() => setTestTypeFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${testTypeFilter === 'all'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    All
                  </button>
                  {activeSkills.map((skill) => (
                    <button
                      key={skill.id}
                      onClick={() => setTestTypeFilter(skill.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${testTypeFilter === skill.value
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      {skill.label}
                    </button>
                  ))}
                  {activeSkills.length === 0 && (
                    <span className="text-xs text-slate-400 italic">No skills configured — go to Skills in the sidebar to add some.</span>
                  )}
                </div>

                <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between border-t border-slate-50 pt-3">
                  {/* Status filter */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-400 mr-1.5 uppercase tracking-wide">Status:</span>
                    {[
                      { value: 'all' as const, label: 'All' },
                      { value: 'wrong' as const, label: 'Wrong Only' },
                      { value: 'unattempted' as const, label: 'Unattempted' },
                    ].map((f) => (
                      <button
                        key={f.value}
                        onClick={() => setFilter(f.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filter === f.value
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Subject Filter */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-400 mr-1.5 uppercase tracking-wide">Subject:</span>
                    {[
                      { value: 'all' as const, label: 'All Subjects' },
                      { value: 'math' as const, label: 'Maths' },
                      { value: 'english' as const, label: 'English' },
                    ].map((f) => (
                      <button
                        key={f.value}
                        onClick={() => setSubjectFilter(f.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${subjectFilter === f.value
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scope filter */}
                <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-50 pt-3">
                  <span className="text-xs font-bold text-slate-400 mr-1.5 uppercase tracking-wide">Test Range:</span>
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
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${testScope === f.value
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Custom Test Selection Multi-Picker */}
                {testScope === 'custom' && submittedAttempts.length > 0 && (
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 space-y-2 max-h-40 overflow-y-auto animate-fadeIn mt-1">
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
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer select-none transition-all ${isChecked
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
                              <p className="text-[10px] text-slate-400 font-normal mt-0.5">{formattedDate} · Score: {attempt.totalScore ?? '—'}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Questions Listing */}
              <div className="space-y-4">
                {filteredMistakes.map((item, idx) => (
                  <MistakeItemComponent
                    key={`${item.attemptId}-${item.questionId}`}
                    item={item}
                    index={idx}
                    onDoubtStatusChange={handleDoubtStatusChange}
                  />
                ))}
              </div>

              {filteredMistakes.length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
                  <CheckCircle size={48} className="mx-auto text-emerald-400 mb-3" />
                  <p className="text-slate-800 font-bold text-sm">No mistake questions match these filters</p>
                  <p className="text-slate-400 text-xs mt-1">Try switching filters or selecting other tests.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
