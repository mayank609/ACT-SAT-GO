import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, FileText, AlertTriangle, Play } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { MOCK_TESTS } from '../../data/mockData';
import { useTestStore } from '../../store/useTestStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { TestAttempt, SectionAttempt } from '../../types';

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function TestInstructionsPage() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { startAttempt } = useTestStore();
  const { user } = useAuthStore();
  const [agreed, setAgreed] = useState(false);

  const test = MOCK_TESTS.find((t) => t.id === testId) ?? MOCK_TESTS[0];
  const totalQ = test.sections.reduce((a, s) => a + s.questions.length, 0);
  const totalTime = test.sections.reduce((a, s) => a + s.timeLimit, 0);

  const handleStart = () => {
    if (!agreed) return;

    // Initialize attempt
    const sections: Record<string, SectionAttempt> = {};
    test.sections.forEach((sec) => {
      const questions: SectionAttempt['questions'] = {};
      sec.questions.forEach((q) => {
        questions[q.id] = { questionId: q.id, state: 'not_visited', timeSpent: 0 };
      });
      sections[sec.id] = {
        sectionId: sec.id,
        startedAt: undefined,
        completedAt: undefined,
        timeUsed: 0,
        questions,
      };
    });

    const attempt: TestAttempt = {
      id: generateId(),
      testId: test.id,
      studentId: user?.id ?? 's-1',
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      currentSectionIndex: 0,
      currentQuestionIndex: 0,
      sections,
      tabSwitchCount: 0,
      isFullScreen: false,
    };

    startAttempt(attempt, test);
    navigate(`/test/${test.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <div>
            <h1 className="font-semibold text-slate-900">{test.title}</h1>
            <p className="text-xs text-slate-500">Instructions & Exam Agreement</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span className="flex items-center gap-1.5"><FileText size={14} /> {totalQ} questions</span>
          <span className="flex items-center gap-1.5"><Clock size={14} /> {totalTime} minutes</span>
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {/* Section overview */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h2 className="font-bold text-slate-900 text-lg mb-4">Test Overview</h2>
          <div className="divide-y divide-slate-100">
            {test.sections.map((sec, idx) => (
              <div key={sec.id} className="flex items-center gap-4 py-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-sm font-bold">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900 text-sm">{sec.name}</p>
                  <p className="text-xs text-slate-500">{sec.questions.length} questions</p>
                </div>
                <Badge variant="info" size="sm">
                  <Clock size={10} className="mr-1" />{sec.timeLimit} min
                </Badge>
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
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h2 className="font-bold text-slate-900 text-lg mb-4 flex items-center gap-2">
            <FileText size={18} className="text-blue-600" />
            Important Instructions
          </h2>
          <div className="space-y-4 text-sm text-slate-700">
            <div>
              <h3 className="font-semibold text-slate-900 mb-1.5">Saving Your Answers:</h3>
              <ul className="space-y-1.5 text-slate-600 list-none">
                <li className="flex gap-2"><span className="text-blue-500 font-bold">a.</span> Click <strong>Save &amp; Next</strong> to save your answer and go to the next question.</li>
                <li className="flex gap-2"><span className="text-blue-500 font-bold">b.</span> Click <strong>Mark for Review &amp; Next</strong> to flag the question and move on.</li>
                <li className="flex gap-2"><span className="text-blue-500 font-bold">c.</span> Your answers are <strong>auto-saved</strong> every 30 seconds.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-1.5">Answering a Question:</h3>
              <ul className="space-y-1.5 text-slate-600 list-none">
                <li className="flex gap-2"><span className="text-blue-500 font-bold">a.</span> For MCQ: click on the option to select. Click again or use <strong>Clear Response</strong> to deselect.</li>
                <li className="flex gap-2"><span className="text-blue-500 font-bold">b.</span> For Numeric: type your answer in the input field.</li>
                <li className="flex gap-2"><span className="text-blue-500 font-bold">c.</span> You MUST click Save &amp; Next to record your answer.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-1.5">Navigating Sections:</h3>
              <ul className="space-y-1.5 text-slate-600 list-none">
                <li className="flex gap-2"><span className="text-blue-500 font-bold">a.</span> Sections are shown at the top. Click to view questions in a section.</li>
                <li className="flex gap-2"><span className="text-blue-500 font-bold">b.</span> After clicking Save &amp; Next on the last question, you automatically move to the next section.</li>
                {!test.allowBackNavigation && <li className="flex gap-2 text-red-600"><span className="font-bold">⚠</span> <strong>Backward navigation between sections is not allowed.</strong></li>}
              </ul>
            </div>
          </div>
        </div>

        {/* Anti-cheating notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 flex gap-3">
          <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold mb-1">Academic Integrity Notice</p>
            <p>This test is monitored. Tab switching is tracked and logged. Any attempt to access external resources may result in test invalidation. Please ensure:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>You are in a quiet, distraction-free environment</li>
              <li>No electronic devices other than this computer</li>
              <li>No prohibited materials within reach</li>
            </ul>
          </div>
        </div>

        {/* Question palette legend */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-3">Question Palette Legend</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {[
              { color: 'bg-slate-200', label: 'Not Visited' },
              { color: 'bg-red-500', label: 'Not Answered' },
              { color: 'bg-emerald-500', label: 'Answered' },
              { color: 'bg-purple-500', label: 'Marked for Review' },
              { color: 'bg-blue-500', label: 'Answered & Marked' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-full ${item.color} flex items-center justify-center text-white text-xs font-bold`}>
                  1
                </div>
                <span className="text-slate-600">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Agreement */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <p className="text-sm text-slate-700 leading-relaxed">
              I have read and understood the instructions. All computer hardware allotted to me is in proper working condition. I declare that I am not in possession of / not carrying any prohibited materials. I agree that any violation of these instructions shall make me liable for disciplinary action, which may include being barred from future tests.
            </p>
          </label>
        </div>

        {/* Start button */}
        <div className="flex justify-center">
          <Button
            size="lg"
            disabled={!agreed}
            onClick={handleStart}
            icon={<Play size={18} />}
            className="px-12 py-3.5 text-base"
          >
            Proceed to Start Test
          </Button>
        </div>
      </div>
    </div>
  );
}
