import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Timer, BarChart3, LifeBuoy, Laptop, CheckCircle2, Play, Loader2 } from 'lucide-react';
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
  childQuestions?: DbQuestion[]
  parentQuestionId?: string
}

interface DbTestQuestion {
  id: string
  questionId: string
  orderIndex: number
  question: DbQuestion
  marksPositive?: number
  marksNegative?: number
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
      questions: sec.questions
        .filter((tq) => !(tq.question as any).parentQuestionId)
        .slice().sort((a, b) => a.orderIndex - b.orderIndex).map((tq): Question => {
        const q = tq.question
        const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true)
        const type: QuestionType = isPassage ? 'passage' : q.type === 'MCQ' ? 'mcq_single' : q.type === 'MSQ' ? 'mcq_multi' : 'numeric'
        const difficulty: Difficulty = q.difficultyLevel.toLowerCase() as Difficulty
        const options: Option[] | undefined = q.options
          ? Object.entries(q.options).map(([k, v]) => ({ id: k.toLowerCase(), text: v }))
          : undefined
        const ca = q.correctAnswer
        let correctAnswer: string | string[] | number = ''
        if (ca.value !== undefined) correctAnswer = ca.value
        else if (ca.keys) correctAnswer = ca.keys.map((k) => k.toLowerCase())
        else if (ca.key) correctAnswer = ca.key.toLowerCase()

        const linkedQuestions = q.childQuestions
          ? q.childQuestions.map((cq: any): Question => {
              const cType: QuestionType = cq.type === 'MCQ' ? 'mcq_single' : cq.type === 'MSQ' ? 'mcq_multi' : 'numeric'
              const cDiff: Difficulty = cq.difficultyLevel.toLowerCase() as Difficulty
              const cOptions: Option[] | undefined = cq.options
                ? Object.entries(cq.options).map(([k, v]) => ({ id: k.toLowerCase(), text: v as string }))
                : undefined
              const cCa = cq.correctAnswer
              let cCorrectAnswer: string | string[] | number = ''
              if (cCa.value !== undefined) cCorrectAnswer = cCa.value
              else if (cCa.keys) cCorrectAnswer = cCa.keys.map((k: string) => k.toLowerCase())
              else if (cCa.key) cCorrectAnswer = cCa.key.toLowerCase()

              return {
                id: cq.id,
                text: cq.content?.text ?? '',
                type: cType,
                options: cOptions,
                correctAnswer: cCorrectAnswer,
                topic: '',
                difficulty: cDiff,
                explanation: cq.content?.explanation ?? undefined,
                marks: 1,
                marksNegative: 0,
                parentQuestionId: q.id,
              }
            })
          : undefined

        return {
          id: q.id,
          text: q.content?.text ?? '',
          type,
          options,
          correctAnswer,
          topic: '',
          difficulty,
          explanation: q.content?.explanation ?? undefined,
          marks: tq.marksPositive ?? 1,
          marksNegative: tq.marksNegative ?? 0,
          linkedQuestions,
        }
      }),
    })),
  }
}

export function flattenTest(test: import('../../types').Test): import('../../types').Test {
  return {
    ...test,
    sections: test.sections.map((sec) => ({
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
    })),
  };
}

// ─── Instruction sections config ─────────────────────────────────────────────

const SECTIONS = [
  {
    icon: Timer,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'Timing',
    content: (
      <ul className="space-y-1.5 text-xs text-gray-600">
        <li className="flex gap-2">
          <span className="text-gray-300 mt-0.5 flex-shrink-0">&#8226;</span>
          The test must be completed in one sitting. Closing it midway may result in data loss.
        </li>
        <li className="flex gap-2">
          <span className="text-gray-300 mt-0.5 flex-shrink-0">&#8226;</span>
          Once you move to the next module, you cannot return to the previous module.
        </li>
      </ul>
    ),
  },
  {
    icon: BarChart3,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: 'Score & Performance Analysis',
    content: (
      <div className="text-xs text-gray-600 space-y-2">
        <p>Once you complete the test, you will receive:</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
            <span className="font-medium text-gray-700">Tentative Scaled Score</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-gray-700">Detailed Performance Analysis</span>
              <span className="text-gray-500">, including:</span>
              <ul className="mt-1 space-y-1 pl-1.5">
                {[
                  'Time spent on each question',
                  'Topic-wise performance breakdown',
                  'Identification of weak areas',
                  'Accuracy analysis across question types',
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-gray-300 mt-0.5 flex-shrink-0">&#8722;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: LifeBuoy,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    title: 'Assistive Technology',
    content: (
      <ul className="space-y-1.5 text-xs text-gray-600">
        <li className="flex gap-2">
          <span className="text-gray-300 mt-0.5 flex-shrink-0">&#8226;</span>
          For any issues, contact the Mock Helpline (not your WhatsApp group).
        </li>
        <li className="flex gap-2">
          <span className="text-gray-300 mt-0.5 flex-shrink-0">&#8226;</span>
          If the test gets stuck, do not log out of the application. This may cause data loss.
        </li>
      </ul>
    ),
  },
  {
    icon: Laptop,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    title: 'Device Check',
    content: (
      <ul className="space-y-1.5 text-xs text-gray-600">
        <li className="flex gap-2">
          <span className="text-gray-300 mt-0.5 flex-shrink-0">&#8226;</span>
          Some features may not work properly on tablets or touchscreen devices.
        </li>
        <li className="flex gap-2">
          <span className="text-gray-300 mt-0.5 flex-shrink-0">&#8226;</span>
          Use only a laptop or desktop with a keyboard to take the test.
        </li>
      </ul>
    ),
  },
];

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 size={28} className="text-[#1b3d6e] animate-spin" />
    </div>
  );

  if (error || !test) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-500 font-medium">{error ?? 'Test not found'}</p>
        <button onClick={() => navigate(-1)} className="mt-3 text-sm text-blue-600 hover:underline">Go back</button>
      </div>
    </div>
  );

  const handleStart = async () => {
    if (!agreed || !dbId || !testId) return;
    setStarting(true);
    setError(null);
    try {
      let attemptId = 'preview';

      if (!isPreview) {
        const res = await api.startAttempt(testId, dbId) as { attemptId: string };
        attemptId = res.attemptId;
        await api.startSection(attemptId, test.sections[0].id);
      }

      const flatTest = flattenTest(test);

      const sections: Record<string, SectionAttempt> = {};
      flatTest.sections.forEach((sec) => {
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
        id: attemptId,
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

      startAttempt(attempt, flatTest);
      navigate(`/test/${testId}${isPreview ? '?preview=true' : ''}`);
    } catch (e) {
      setError(`Failed to start: ${(e as Error).message}`);
      setStarting(false);
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col px-4 py-4 overflow-hidden">
      {/* Page header */}
      <div className="text-center mb-3 flex-shrink-0">
        <h1 className="text-2xl font-bold text-[#1b3d6e]">{test.title}</h1>
        <p className="mt-1 text-gray-500 text-sm">
          Please read the instructions carefully before starting the test.
        </p>
      </div>

      {/* 2×2 grid of instruction cards */}
      <div className="max-w-3xl w-full mx-auto grid grid-cols-2 gap-3 flex-shrink-0">
        {SECTIONS.map((sec) => {
          const Icon = sec.icon;
          return (
            <div key={sec.title} className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className={`w-8 h-8 rounded-full ${sec.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={16} className={sec.iconColor} />
                </div>
                <h2 className="text-sm font-bold text-gray-900">{sec.title}</h2>
              </div>
              <div className="pl-10">
                {sec.content}
              </div>
            </div>
          );
        })}
      </div>

      {/* Agreement + Start button in one row */}
      <div className="max-w-3xl w-full mx-auto mt-3 bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-3 flex items-center gap-4 flex-shrink-0">
        {error && (
          <p className="text-red-500 text-xs bg-red-50 px-3 py-1.5 rounded-lg">{error}</p>
        )}
        <label className="flex items-start gap-2.5 cursor-pointer select-none flex-1">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-[#1b3d6e] focus:ring-[#1b3d6e] cursor-pointer flex-shrink-0 accent-[#1b3d6e]"
          />
          <p className="text-xs text-gray-600 leading-relaxed">
            I have read and understood all the instructions above. I declare that I am not in
            possession of any prohibited materials and agree that any violation shall make me
            liable for disciplinary action.
          </p>
        </label>
        <button
          disabled={!agreed || starting}
          onClick={handleStart}
          className={`inline-flex items-center gap-2 px-7 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0
            ${agreed && !starting
              ? 'bg-[#1b3d6e] hover:bg-[#15305a] text-white shadow-md hover:shadow-lg'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
        >
          {starting
            ? <><Loader2 size={15} className="animate-spin" /> Starting…</>
            : <><Play size={15} /> Start Test</>
          }
        </button>
      </div>
    </div>
  );
}
