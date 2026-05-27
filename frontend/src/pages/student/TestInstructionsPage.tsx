import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Clock, FileText, AlertTriangle, Play, Loader2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useTestStore } from '../../store/useTestStore';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../lib/api';
import type { Test, Section, Question, QuestionType, Difficulty, Option, TestStatus, TestAttempt, SectionAttempt } from '../../types';

// ─── DB → Frontend transforms ─────────────────────────────────────────────────

interface DbQuestion {
  id: string
  type: string
  content: { text: string; explanation?: string | null }
  options: Record<string, string> | null
  correctAnswer: { key?: string; keys?: string[]; value?: number }
  difficultyLevel: string
}

interface DbTestQuestion {
  id: string
  questionId: string
  orderIndex: number
  question: DbQuestion
}

interface DbSection {
  id: string
  name: string
  durationMinutes: number
  orderIndex: number
  questions: DbTestQuestion[]
}

interface DbTest {
  id: string
  title: string
  description?: string | null
  status: string
  createdAt: string
  createdById: string
  sections: DbSection[]
}

export function transformDbTest(raw: DbTest): Test {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? undefined,
    status: raw.status.toLowerCase() as TestStatus,
    createdBy: raw.createdById,
    createdAt: raw.createdAt,
    allowBackNavigation: false,
    showResults: true,
    sections: raw.sections.slice().sort((a, b) => a.orderIndex - b.orderIndex).map((sec): Section => ({
      id: sec.id,
      name: sec.name,
      timeLimit: sec.durationMinutes,
      questions: sec.questions.slice().sort((a, b) => a.orderIndex - b.orderIndex).map((tq): Question => {
        const q = tq.question
        const type: QuestionType = q.type === 'MCQ' ? 'mcq_single' : q.type === 'MSQ' ? 'mcq_multi' : 'numeric'
        const difficulty: Difficulty = q.difficultyLevel.toLowerCase() as Difficulty
        const options: Option[] | undefined = q.options
          ? Object.entries(q.options).map(([k, v]) => ({ id: k.toLowerCase(), text: v }))
          : undefined
        const ca = q.correctAnswer
        let correctAnswer: string | string[] | number = ''
        if (ca.value !== undefined) correctAnswer = ca.value
        else if (ca.keys) correctAnswer = ca.keys.map((k) => k.toLowerCase())
        else if (ca.key) correctAnswer = ca.key.toLowerCase()
        return {
          id: q.id,
          text: q.content.text,
          type,
          options,
          correctAnswer,
          topic: '',
          difficulty,
          explanation: q.content.explanation ?? undefined,
          marks: 1,
          marksNegative: 0,
        }
      }),
    })),
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TestInstructionsPage() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isPreview = searchParams.get('preview') === 'true';

  const { startAttempt } = useTestStore();
  const { dbId } = useAuthStore();

  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [test, setTest] = useState<Test | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!testId) { setError('No test ID'); setLoading(false); return; }
    api.getTest(testId)
      .then(({ test: raw }) => setTest(transformDbTest(raw as DbTest)))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [testId]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 size={24} className="text-blue-500 animate-spin" />
    </div>
  );

  if (error || !test) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-500 font-medium">{error ?? 'Test not found'}</p>
        <button onClick={() => navigate(-1)} className="mt-3 text-sm text-blue-600 hover:underline">Go back</button>
      </div>
    </div>
  );

  const totalQ = test.sections.reduce((a, s) => a + s.questions.length, 0);
  const totalTime = test.sections.reduce((a, s) => a + s.timeLimit, 0);

  const handleStart = async () => {
    if (!agreed || !dbId || !testId) return;
    setStarting(true);
    setError(null);
    try {
      let attemptId = 'preview';

      if (!isPreview) {
        // 1. Create attempt in DB
        const res = await api.startAttempt(testId, dbId) as { attemptId: string };
        attemptId = res.attemptId;
        // 2. Start first section in DB + Redis
        await api.startSection(attemptId, test.sections[0].id);
      }

      // 3. Build local attempt state (keyed by section/question UUIDs from DB)
      const sections: Record<string, SectionAttempt> = {};
      test.sections.forEach((sec) => {
        const questions: SectionAttempt['questions'] = {};
        sec.questions.forEach((q) => {
          questions[q.id] = { questionId: q.id, state: 'not_visited', timeSpent: 0 };
        });
        sections[sec.id] = {
          sectionId: sec.id,
          startedAt: new Date().toISOString(),
          completedAt: undefined,
          timeUsed: 0,
          questions,
        };
      });

      const attempt: TestAttempt = {
        id: attemptId,          // DB UUID — used for all API calls
        testId,
        studentId: dbId,
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        currentSectionIndex: 0,
        currentQuestionIndex: 0,
        sections,
        tabSwitchCount: 0,
        isFullScreen: false,
      };

      startAttempt(attempt, test);
      navigate(`/test/${testId}${isPreview ? '?preview=true' : ''}`);
    } catch (e) {
      setError(`Failed to start: ${(e as Error).message}`);
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-slate-900 text-sm md:text-base truncate">{test.title}</h1>
            <p className="text-xs text-slate-500">Instructions & Exam Agreement</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600 flex-shrink-0">
          <span className="flex items-center gap-1.5"><FileText size={13} /> {totalQ} questions</span>
          <span className="flex items-center gap-1.5"><Clock size={13} /> {totalTime} min</span>
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 md:py-8 space-y-4 md:space-y-6">
        {/* Section overview */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6">
          <h2 className="font-bold text-slate-900 text-base md:text-lg mb-4">Test Overview</h2>
          <div className="divide-y divide-slate-100">
            {test.sections.map((sec, idx) => (
              <div key={sec.id} className="flex items-center gap-3 py-3">
                <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-sm font-bold flex-shrink-0">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm">{sec.name}</p>
                  <p className="text-xs text-slate-500">{sec.questions.length} questions</p>
                </div>
                <Badge variant="info" size="sm"><Clock size={9} className="mr-1" />{sec.timeLimit} min</Badge>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-medium">
            <span className="text-slate-600">Total</span>
            <div className="flex gap-4 text-slate-900">
              <span>{totalQ} questions</span>
              <span>{totalTime} minutes</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6">
          <h2 className="font-bold text-slate-900 text-base md:text-lg mb-4 flex items-center gap-2">
            <FileText size={16} className="text-blue-600" /> Important Instructions
          </h2>
          <div className="space-y-4 text-sm text-slate-700">
            {[
              {
                title: 'Saving Your Answers:',
                items: [
                  'Click Save & Next to save your answer and go to the next question.',
                  'Click Mark for Review & Next to flag the question and move on.',
                  'Your answers are auto-saved every time you click Save & Next.',
                ],
              },
              {
                title: 'Answering a Question:',
                items: [
                  'For MCQ: click an option to select. Click again or use Clear Response to deselect.',
                  'For Numeric: type your answer in the input field.',
                  'You MUST click Save & Next to record your answer.',
                ],
              },
              {
                title: 'Navigating Sections:',
                items: [
                  'Sections are shown at the top. Click to view questions in that section.',
                  'After Save & Next on the last question, you move to the next section automatically.',
                  ...(!test.allowBackNavigation ? ['⚠ Backward navigation between sections is NOT allowed.'] : []),
                ],
              },
            ].map((group) => (
              <div key={group.title}>
                <h3 className="font-semibold text-slate-900 mb-1.5">{group.title}</h3>
                <ul className="space-y-1 text-slate-600">
                  {group.items.map((item, i) => (
                    <li key={i} className={`flex gap-2 ${item.startsWith('⚠') ? 'text-red-600 font-medium' : ''}`}>
                      <span className="text-blue-500 font-bold flex-shrink-0">{String.fromCharCode(96 + i + 1)}.</span>
                      {item.replace('⚠ ', '')}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Anti-cheating notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 md:p-5 flex gap-3">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold mb-1">Academic Integrity Notice</p>
            <p className="text-xs md:text-sm">This test is monitored. Tab switching is tracked and logged. Ensure you are in a quiet, distraction-free environment with no prohibited materials.</p>
          </div>
        </div>

        {/* Palette legend */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Question Palette Legend</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            {[
              { color: 'bg-slate-200', label: 'Not Visited' },
              { color: 'bg-red-500', label: 'Not Answered' },
              { color: 'bg-emerald-500', label: 'Answered' },
              { color: 'bg-purple-500', label: 'Marked for Review' },
              { color: 'bg-blue-500', label: 'Answered & Marked' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full ${item.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>1</div>
                <span className="text-slate-600 text-xs md:text-sm">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Agreement */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5">
          {error && <p className="text-red-500 text-sm mb-3 bg-red-50 p-2 rounded-lg">{error}</p>}
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0" />
            <p className="text-sm text-slate-700 leading-relaxed">
              I have read and understood the instructions. All computer hardware allotted to me is in proper working condition. I declare that I am not in possession of any prohibited materials. I agree that any violation shall make me liable for disciplinary action.
            </p>
          </label>
        </div>

        {/* Start button */}
        <div className="flex justify-center pb-4">
          <Button
            size="lg"
            disabled={!agreed || starting}
            onClick={handleStart}
            icon={starting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            className="px-8 md:px-12 py-3 text-sm md:text-base w-full sm:w-auto"
          >
            {starting ? 'Starting…' : 'Proceed to Start Test'}
          </Button>
        </div>
      </div>
    </div>
  );
}
