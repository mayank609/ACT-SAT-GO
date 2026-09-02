import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Sparkles, CheckCircle2, Clock, AlertCircle, ArrowRight, ArrowLeft,
  Bookmark, Calculator, Send, Phone, MessageSquare, X, ChevronRight,
  Layers, Check, AlertTriangle
} from 'lucide-react';
import { PLATFORM_API_BASE, QUERY_API_BASE } from '../config';
import { FALLBACK_SAT_TEST, FALLBACK_ACT_TEST } from '../data/mockDiagnosticTest';
import { WHATSAPP_HREF, CALL_HREF } from '../components/WhatsAppButton';

type ExamType = 'SAT' | 'ACT' | 'AP' | 'GENERAL';

interface Question {
  id: string;
  type: 'MCQ' | 'MSQ' | 'NUMERIC' | 'PASSAGE';
  content: {
    text: string;
    explanation?: string;
    meta?: { domain?: string; skill?: string; topic?: string };
  };
  options?: Record<string, string>;
  correctAnswer?: any;
  difficultyLevel?: string;
  marksPositive?: number;
  marksNegative?: number;
  childQuestions?: Question[];
}

interface TestSection {
  id: string;
  name: string;
  durationMinutes: number;
  orderIndex: number;
  questions: Question[];
}

interface TestData {
  id: string;
  title: string;
  category?: string;
  description?: string;
  sections: TestSection[];
}

export function FreeTestPage() {
  const [searchParams] = useSearchParams();
  const requestedExam = (searchParams.get('exam') || 'SAT').toUpperCase() as ExamType;

  // Flow stages: 'register' -> 'test' -> 'report'
  const [stage, setStage] = useState<'register' | 'test' | 'report'>('register');

  // Lead registration form
  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    exam: requestedExam || 'SAT',
    grade: 'Grade 11',
    school: '',
    targetScore: '',
  });
  const [leadId, setLeadId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Active Test State
  const [testData, setTestData] = useState<TestData | null>(null);
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { answerGiven: any; timeSpentSeconds: number }>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [secondsRemaining, setSecondsRemaining] = useState<number>(32 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [totalTimeSpentSeconds, setTotalTimeSpentSeconds] = useState(0);

  // Section completion & submit modals
  const [showNextSectionModal, setShowNextSectionModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Tools in test engine
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcInput, setCalcInput] = useState('');
  const [calcResult, setCalcResult] = useState<string | null>(null);

  // Final Report State
  const [report, setReport] = useState<any | null>(null);

  // Sort and sanitize test data to strictly respect section orderIndex
  const normalizeTestData = (rawTest: any): TestData => {
    const sortedSections = [...(rawTest.sections || [])].sort(
      (a: TestSection, b: TestSection) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
    );
    return {
      ...rawTest,
      sections: sortedSections,
    };
  };

  // Flattened questions for the active section
  const currentSection = testData?.sections[currentSectionIdx];
  const allFlatQuestions = useMemo(() => {
    if (!currentSection) return [];
    const list: Array<{ q: Question; sectionIdx: number; sectionName: string }> = [];
    for (const q of currentSection.questions) {
      if (q.type === 'PASSAGE' && q.childQuestions && q.childQuestions.length > 0) {
        for (const cq of q.childQuestions) {
          list.push({ q: cq, sectionIdx: currentSectionIdx, sectionName: currentSection.name });
        }
      } else {
        list.push({ q, sectionIdx: currentSectionIdx, sectionName: currentSection.name });
      }
    }
    return list;
  }, [currentSection, currentSectionIdx]);

  const activeQuestion = allFlatQuestions[currentQuestionIdx]?.q;

  // Load Test from platform API or fallback
  const initializeTest = async (examType: string) => {
    try {
      const res = await fetch(`${PLATFORM_API_BASE}/api/free-tests`).then((r) => r.json());
      const activeTestId = res?.config?.examTests?.[examType] || res?.config?.activeTestId;
      if (activeTestId) {
        const testRes = await fetch(`${PLATFORM_API_BASE}/api/free-tests/test/${activeTestId}`).then((r) => r.json());
        if (testRes?.test?.sections?.length) {
          return normalizeTestData(testRes.test);
        }
      }
    } catch {
      // Offline / API unavailable -> use built-in fallback test
    }

    if (examType === 'ACT') {
      return normalizeTestData(FALLBACK_ACT_TEST);
    }
    return normalizeTestData(FALLBACK_SAT_TEST);
  };

  // Handle Lead Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.name || !leadForm.email || !leadForm.phone) {
      setRegisterError('Please fill in your name, email, and phone number to start.');
      return;
    }

    setRegistering(true);
    setRegisterError(null);

    try {
      const loadedTest = await initializeTest(leadForm.exam);
      setTestData(loadedTest);

      // Register lead to backend
      let generatedLeadId = `lead_${Date.now()}`;
      try {
        const regRes = await fetch(`${PLATFORM_API_BASE}/api/free-tests/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...leadForm,
            requestedTestId: loadedTest.id,
          }),
        }).then((r) => r.json());

        if (regRes?.lead?.id) {
          generatedLeadId = regRes.lead.id;
        }
      } catch {
        // also attempt sync to query-server if available
        try {
          await fetch(`${QUERY_API_BASE}/api/queries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: leadForm.name,
              email: leadForm.email,
              phone: leadForm.phone,
              exam: leadForm.exam,
              grade: leadForm.grade,
              type: 'Free Diagnostic Test',
              message: `Registered for Free Diagnostic Test (${loadedTest.title})`,
            }),
          });
        } catch {
          // continue with local session
        }
      }

      setLeadId(generatedLeadId);
      setCurrentSectionIdx(0);
      setCurrentQuestionIdx(0);
      const firstSectionDuration = loadedTest.sections[0]?.durationMinutes || 32;
      setSecondsRemaining(firstSectionDuration * 60);
      setTimerRunning(true);
      setStage('test');
    } catch (err: any) {
      setRegisterError(err.message || 'Failed to start test. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  // Section Timer Effect
  useEffect(() => {
    if (stage !== 'test' || !timerRunning) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Section timer expired!
          if (testData && currentSectionIdx < testData.sections.length - 1) {
            // Auto advance to next section
            const nextSecIdx = currentSectionIdx + 1;
            setCurrentSectionIdx(nextSecIdx);
            setCurrentQuestionIdx(0);
            return (testData.sections[nextSecIdx]?.durationMinutes || 32) * 60;
          } else {
            // Last section timer finished -> auto submit
            handleSubmitTest();
            return 0;
          }
        }
        return prev - 1;
      });
      setTotalTimeSpentSeconds((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [stage, timerRunning, testData, currentSectionIdx]);

  // Answer handler
  const handleSelectAnswer = (qId: string, answerValue: any) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: {
        answerGiven: answerValue,
        timeSpentSeconds: (prev[qId]?.timeSpentSeconds || 0) + 1,
      },
    }));
  };

  const handleToggleFlag = (qId: string) => {
    setFlaggedQuestions((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  // Proceed from one section to the next in flow
  const handleProceedToNextSection = () => {
    if (!testData) return;
    const nextSecIdx = currentSectionIdx + 1;
    if (nextSecIdx < testData.sections.length) {
      setCurrentSectionIdx(nextSecIdx);
      setCurrentQuestionIdx(0);
      setSecondsRemaining((testData.sections[nextSecIdx]?.durationMinutes || 32) * 60);
      setShowNextSectionModal(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Calculator helper
  const handleCalculate = () => {
    try {
      const sanitized = calcInput.replace(/[^0-9+\-*/().^ ]/g, '');
      const evalValue = Function(`'use strict'; return (${sanitized})`)();
      setCalcResult(String(evalValue));
    } catch {
      setCalcResult('Error');
    }
  };

  // Submit Test
  const handleSubmitTest = async () => {
    if (!testData || !leadId) return;
    setSubmitting(true);

    try {
      const payload = {
        leadId,
        testId: testData.id,
        answers,
        timeSpentSeconds: totalTimeSpentSeconds,
      };

      let finalReport = null;

      try {
        const res = await fetch(`${PLATFORM_API_BASE}/api/free-tests/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then((r) => r.json());

        if (res?.report) {
          finalReport = res.report;
        }
      } catch {
        // Fallback local evaluation
      }

      if (!finalReport) {
        // Local evaluation fallback across all sections in order
        let totalQ = 0;
        let correctQ = 0;
        const answersBreakdown: Record<string, any> = {};
        const sectionScores = [];

        for (const sec of testData.sections) {
          let secTotal = 0;
          let secCorrect = 0;

          for (const q of sec.questions) {
            totalQ++;
            secTotal++;
            const userAns = answers[q.id]?.answerGiven;
            const correctKey = q.correctAnswer?.key || q.correctAnswer?.value;
            const isCorrect = userAns !== undefined && userAns !== null && userAns !== '' &&
              String(userAns).toUpperCase().trim() === String(correctKey || '').toUpperCase().trim();
            
            if (isCorrect) {
              correctQ++;
              secCorrect++;
            }

            answersBreakdown[q.id] = {
              questionId: q.id,
              questionText: q.content?.text || '',
              answerGiven: userAns || null,
              correctAnswer: correctKey,
              isCorrect,
              explanation: q.content?.explanation || '',
              topic: q.content?.meta?.domain || 'General',
            };
          }

          sectionScores.push({
            sectionId: sec.id,
            sectionName: sec.name,
            score: secCorrect,
            maxScore: secTotal,
            correct: secCorrect,
            incorrect: secTotal - secCorrect,
            accuracy: secTotal > 0 ? Math.round((secCorrect / secTotal) * 100) : 0,
          });
        }

        const pct = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;
        const isSAT = (testData.category || leadForm.exam).includes('SAT');
        const scaledScore = isSAT ? Math.round(400 + (pct / 100) * 1200) : Math.max(1, Math.round((pct / 100) * 36));

        finalReport = {
          studentName: leadForm.name,
          exam: leadForm.exam,
          testTitle: testData.title,
          scaledScore,
          maxScaledScore: isSAT ? 1600 : 36,
          rawScore: correctQ,
          maxRawScore: totalQ,
          percentage: pct,
          accuracy: pct,
          correctCount: correctQ,
          incorrectCount: totalQ - correctQ,
          totalQuestionsCount: totalQ,
          timeSpentSeconds: totalTimeSpentSeconds,
          sectionScores,
          answers: answersBreakdown,
        };
      }

      setReport(finalReport);
      setTimerRunning(false);
      setShowSubmitModal(false);
      setShowNextSectionModal(false);
      setStage('report');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      alert(err.message || 'Error submitting test. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE 1: LEAD REGISTRATION VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  if (stage === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#06172a] via-[#092244] to-[#040f1d] text-white py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
        <div className="max-w-4xl mx-auto w-full">
          {/* Top Branding & Badge */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-block mb-3">
              <span className="text-2xl font-extrabold tracking-wider bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                ACT • SAT • GO
              </span>
            </Link>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 mb-3">
              <Sparkles size={13} className="text-blue-400" /> Free Official Diagnostic Test
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Official Diagnostic Test Engine
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-300 max-w-2xl mx-auto">
              Follows the authentic Digital SAT & ACT sequential module structure with official section timers and accurate scaled score predictions.
            </p>
          </div>

          {/* Main Card with Form & Feature Highlights */}
          <div className="bg-[#0b1f3a]/90 backdrop-blur-md rounded-2xl border border-blue-500/20 shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
            {/* Left Column: Benefits */}
            <div className="md:col-span-5 p-6 sm:p-8 bg-gradient-to-br from-blue-950/60 to-indigo-950/40 border-b md:border-b-0 md:border-r border-blue-500/20 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Test Structure:</span>
                <ul className="mt-4 space-y-4 text-xs sm:text-sm text-slate-200">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={17} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span><b>Official 4-Module Flow:</b> Reading & Writing (Modules 1 & 2) + Math (Modules 1 & 2)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={17} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span><b>Instant Scaled Score (400–1600 / 1–36)</b> immediately upon completion</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={17} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span><b>Module Timers & Grid-in Tools</b> with scratchpad calculator & flag review</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={17} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span><b>Topic-by-Topic Analysis</b> with step-by-step answer explanations</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-blue-500/20">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <img className="inline-block h-8 w-8 rounded-full ring-2 ring-blue-500" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" alt="Student" />
                    <img className="inline-block h-8 w-8 rounded-full ring-2 ring-blue-500" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" alt="Student" />
                    <img className="inline-block h-8 w-8 rounded-full ring-2 ring-blue-500" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" alt="Student" />
                  </div>
                  <div className="text-xs text-slate-300">
                    <span className="font-bold text-white">1,200+ Students</span> tested
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Lead Form */}
            <div className="md:col-span-7 p-6 sm:p-8">
              <h2 className="text-lg font-bold text-white mb-1">Enter Your Details to Start</h2>
              <p className="text-xs text-slate-400 mb-5">
                We'll save your diagnostic session and generate your personalized score breakdown.
              </p>

              {registerError && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{registerError}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Student Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maya Johnson"
                    value={leadForm.name}
                    onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#06172a] border border-blue-500/30 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="student@example.com"
                      value={leadForm.email}
                      onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#06172a] border border-blue-500/30 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Phone / WhatsApp *</label>
                    <input
                      type="tel"
                      required
                      placeholder="+1 (555) 000-0000"
                      value={leadForm.phone}
                      onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#06172a] border border-blue-500/30 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Exam & Grade */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Target Exam *</label>
                    <select
                      value={leadForm.exam}
                      onChange={(e) => setLeadForm({ ...leadForm, exam: e.target.value as ExamType })}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#06172a] border border-blue-500/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="SAT">Digital SAT (4 Modules, 1600 Scale)</option>
                      <option value="ACT">ACT (4 Sections, 36 Scale)</option>
                      <option value="AP">AP Exam Prep</option>
                      <option value="GENERAL">General Assessment</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Current Grade</label>
                    <select
                      value={leadForm.grade}
                      onChange={(e) => setLeadForm({ ...leadForm, grade: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#06172a] border border-blue-500/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Grade 8">Grade 8</option>
                      <option value="Grade 9">Grade 9 (Freshman)</option>
                      <option value="Grade 10">Grade 10 (Sophomore)</option>
                      <option value="Grade 11">Grade 11 (Junior)</option>
                      <option value="Grade 12">Grade 12 (Senior)</option>
                      <option value="Gap Year / Other">Gap Year / Other</option>
                    </select>
                  </div>
                </div>

                {/* Target Score & School */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Target Score (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 1500+ / 34+"
                      value={leadForm.targetScore}
                      onChange={(e) => setLeadForm({ ...leadForm, targetScore: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#06172a] border border-blue-500/30 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">School Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Lincoln High School"
                      value={leadForm.school}
                      onChange={(e) => setLeadForm({ ...leadForm, school: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#06172a] border border-blue-500/30 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={registering}
                  className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {registering ? (
                    'Preparing Your Diagnostic Test...'
                  ) : (
                    <>
                      <span>Start Free Diagnostic Test</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <p className="text-[11px] text-center text-slate-400 mt-2">
                  🔒 100% Free • No credit card required • Instant score generated
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE 2: LIVE TEST TAKING ENGINE VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  if (stage === 'test' && testData && activeQuestion) {
    const totalQCount = allFlatQuestions.length;
    const isFlagged = !!flaggedQuestions[activeQuestion.id];
    const currentAnswer = answers[activeQuestion.id]?.answerGiven;
    const isLastSection = currentSectionIdx === testData.sections.length - 1;
    const isLastQuestionInSection = currentQuestionIdx === totalQCount - 1;

    // Section answered stats
    const currentSectionAnsweredCount = allFlatQuestions.filter(
      (item) => answers[item.q.id]?.answerGiven !== undefined && answers[item.q.id]?.answerGiven !== null && answers[item.q.id]?.answerGiven !== ''
    ).length;

    // Overall answered stats across all sections
    const totalAllQuestions = testData.sections.reduce((acc, s) => acc + s.questions.length, 0);
    const totalAllAnswered = Object.values(answers).filter((a) => a.answerGiven !== undefined && a.answerGiven !== null && a.answerGiven !== '').length;

    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans select-none">
        {/* Top Navbar */}
        <header className="bg-slate-950 border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent">
              ACT SAT GO
            </span>
            <span className="text-slate-600">|</span>
            <div className="text-xs sm:text-sm font-semibold text-slate-200 truncate max-w-[200px] sm:max-w-md">
              <span className="text-sky-400 font-bold mr-1.5">Module {currentSectionIdx + 1}/{testData.sections.length}:</span>
              {currentSection?.name || testData.title}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Section Timer */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 rounded-lg border border-slate-700 text-xs font-mono font-bold text-amber-300">
              <Clock size={14} className="text-amber-400 animate-pulse" />
              <span>{formatTimer(secondsRemaining)}</span>
            </div>

            {/* Calculator Toggle */}
            <button
              onClick={() => setShowCalculator((v) => !v)}
              className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1 transition ${
                showCalculator
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Toggle Calculator"
            >
              <Calculator size={15} />
              <span className="hidden sm:inline">Calc</span>
            </button>

            {/* Section Advance / Submit Button in Header */}
            {isLastSection ? (
              <button
                onClick={() => setShowSubmitModal(true)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                <Send size={13} />
                <span>Submit Test</span>
              </button>
            ) : (
              <button
                onClick={() => setShowNextSectionModal(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                <span>Next Module</span>
                <ChevronRight size={13} />
              </button>
            )}
          </div>
        </header>

        {/* Section Flow Stepper Breadcrumbs (following Test Builder sequence) */}
        <div className="bg-slate-950/90 border-b border-slate-800/80 px-4 sm:px-6 py-2 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Layers size={13} className="text-sky-400" /> Test Flow:
            </span>
            {testData.sections.map((sec, idx) => {
              const isCurrent = idx === currentSectionIdx;
              const isCompleted = idx < currentSectionIdx;

              return (
                <div key={sec.id || idx} className="flex items-center">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all ${
                      isCurrent
                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20 ring-1 ring-blue-400'
                        : isCompleted
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 font-medium'
                        : 'bg-slate-900 text-slate-400 border border-slate-800 font-medium'
                    }`}
                  >
                    {isCompleted ? (
                      <Check size={12} className="text-emerald-400" />
                    ) : (
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] font-bold ${isCurrent ? 'bg-white text-blue-700' : 'bg-slate-800 text-slate-400'}`}>
                        {idx + 1}
                      </span>
                    )}
                    <span>{sec.name}</span>
                    <span className="text-[10px] opacity-75">({sec.durationMinutes}m)</span>
                  </div>
                  {idx < testData.sections.length - 1 && (
                    <ChevronRight size={14} className="text-slate-600 mx-1 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Subheader: Question Counter & Actions */}
        <div className="bg-slate-900 border-b border-slate-800/80 px-4 sm:px-6 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">
              Question {currentQuestionIdx + 1} of {totalQCount}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">
              Module: <b className="text-slate-200">{currentSection?.name}</b>
            </span>
            {activeQuestion.content?.meta?.domain && (
              <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-medium">
                {activeQuestion.content.meta.domain}
              </span>
            )}
          </div>

          <button
            onClick={() => handleToggleFlag(activeQuestion.id)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
              isFlagged
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'text-slate-400 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Bookmark size={13} className={isFlagged ? 'fill-amber-400 text-amber-400' : ''} />
            <span>{isFlagged ? 'Marked for Review' : 'Mark for Review'}</span>
          </button>
        </div>

        {/* Main Test Area */}
        <div className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 gap-6 relative">
          {/* Question Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col justify-between">
            {/* Question Text */}
            <div className="prose prose-invert max-w-none">
              <div className="text-base sm:text-lg text-slate-100 leading-relaxed font-normal whitespace-pre-line mb-6">
                {activeQuestion.content?.text}
              </div>
            </div>

            {/* Answer Options */}
            <div className="space-y-3 mt-4">
              {activeQuestion.type === 'NUMERIC' ? (
                /* Numeric Grid-in Input */
                <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 max-w-md">
                  <label className="block text-xs font-semibold text-slate-400 mb-2">
                    Enter your numeric answer (integer, decimal, or fraction):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 5, 3/4, 0.75"
                    value={currentAnswer || ''}
                    onChange={(e) => handleSelectAnswer(activeQuestion.id, e.target.value)}
                    className="w-full px-4 py-2.5 text-base font-mono font-bold bg-slate-950 border border-slate-700 rounded-lg text-emerald-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ) : activeQuestion.options ? (
                /* Multiple Choice Options */
                Object.entries(activeQuestion.options).map(([key, text]) => {
                  const isSelected = currentAnswer === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelectAnswer(activeQuestion.id, key)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3.5 group ${
                        isSelected
                          ? 'bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-500/10'
                          : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 border transition ${
                          isSelected
                            ? 'bg-blue-500 text-white border-blue-400'
                            : 'bg-slate-800 text-slate-400 border-slate-700 group-hover:border-slate-600'
                        }`}
                      >
                        {key}
                      </div>
                      <span className="text-sm sm:text-base leading-snug">{text}</span>
                    </button>
                  );
                })
              ) : null}
            </div>
          </div>
        </div>

        {/* Floating Desmos / Scratchpad Calculator */}
        {showCalculator && (
          <div className="fixed bottom-20 right-6 w-80 bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl p-4 z-40 animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Calculator size={14} className="text-blue-400" /> Basic Math Calculator
              </span>
              <button
                onClick={() => setShowCalculator(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={calcInput}
                onChange={(e) => setCalcInput(e.target.value)}
                placeholder="e.g. (17 - 5) / 4"
                className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white font-mono focus:outline-none"
              />
              <div className="flex items-center justify-between">
                <button
                  onClick={handleCalculate}
                  className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-md hover:bg-blue-500"
                >
                  Calculate
                </button>
                {calcResult && (
                  <span className="font-mono text-sm font-bold text-emerald-400">= {calcResult}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Navigation Toolbar */}
        <footer className="bg-slate-950 border-t border-slate-800 px-4 sm:px-6 py-3 sticky bottom-0 z-30 flex items-center justify-between">
          <button
            onClick={() => setCurrentQuestionIdx((i) => Math.max(0, i - 1))}
            disabled={currentQuestionIdx === 0}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 transition flex items-center gap-1.5"
          >
            <ArrowLeft size={14} /> Previous
          </button>

          {/* Question Palette Dots for Current Section */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-[200px] sm:max-w-md py-1 px-2">
            {allFlatQuestions.map((item, idx) => {
              const qAns = answers[item.q.id]?.answerGiven;
              const isFlag = !!flaggedQuestions[item.q.id];
              const isCurrent = idx === currentQuestionIdx;

              return (
                <button
                  key={item.q.id}
                  onClick={() => setCurrentQuestionIdx(idx)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition shrink-0 relative ${
                    isCurrent
                      ? 'ring-2 ring-blue-400 bg-blue-600 text-white'
                      : qAns !== undefined && qAns !== null && qAns !== ''
                      ? 'bg-emerald-600/80 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {idx + 1}
                  {isFlag && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Next Question / Next Section / Submit Button */}
          {isLastQuestionInSection ? (
            isLastSection ? (
              <button
                onClick={() => setShowSubmitModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
              >
                Review & Submit <Send size={14} />
              </button>
            ) : (
              <button
                onClick={() => setShowNextSectionModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
              >
                Complete Module <ChevronRight size={14} />
              </button>
            )
          ) : (
            <button
              onClick={() => setCurrentQuestionIdx((i) => i + 1)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              Next <ArrowRight size={14} />
            </button>
          )}
        </footer>

        {/* Next Section Confirmation Modal */}
        {showNextSectionModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 animate-fadeIn">
              <div className="flex items-center gap-2.5 text-sky-400 mb-2">
                <CheckCircle2 size={20} />
                <h3 className="text-lg font-bold text-white">Complete {currentSection?.name}?</h3>
              </div>
              <p className="text-xs text-slate-300 mb-4">
                You are about to finish <b>{currentSection?.name}</b> and proceed to{' '}
                <b className="text-sky-300">{testData.sections[currentSectionIdx + 1]?.name}</b>.
              </p>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-3 gap-2 text-center text-xs mb-4">
                <div>
                  <div className="text-xl font-bold text-white">{totalQCount}</div>
                  <span className="text-slate-400 text-[10px]">Module Questions</span>
                </div>
                <div>
                  <div className="text-xl font-bold text-emerald-400">{currentSectionAnsweredCount}</div>
                  <span className="text-slate-400 text-[10px]">Answered</span>
                </div>
                <div>
                  <div className="text-xl font-bold text-amber-400">{totalQCount - currentSectionAnsweredCount}</div>
                  <span className="text-slate-400 text-[10px]">Unanswered</span>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs flex items-start gap-2 mb-6">
                <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <b>Note:</b> Once you begin the next module, you will not be able to return to edit answers in this module.
                </span>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNextSectionModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 rounded-lg hover:bg-slate-700"
                >
                  Review Questions
                </button>
                <button
                  type="button"
                  onClick={handleProceedToNextSection}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-500 shadow-md flex items-center gap-1.5"
                >
                  <span>Proceed to Next Module</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Submit Confirmation Modal */}
        {showSubmitModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 animate-fadeIn">
              <h3 className="text-lg font-bold text-white mb-2">Submit Your Free Diagnostic Test?</h3>
              <p className="text-xs text-slate-300 mb-4">
                You will receive your official scaled score prediction and complete module-by-module analytics instantly.
              </p>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-3 gap-2 text-center text-xs mb-4">
                <div>
                  <div className="text-xl font-bold text-white">{totalAllQuestions}</div>
                  <span className="text-slate-400 text-[10px]">Total Questions</span>
                </div>
                <div>
                  <div className="text-xl font-bold text-emerald-400">{totalAllAnswered}</div>
                  <span className="text-slate-400 text-[10px]">Answered</span>
                </div>
                <div>
                  <div className="text-xl font-bold text-amber-400">{totalAllQuestions - totalAllAnswered}</div>
                  <span className="text-slate-400 text-[10px]">Unanswered</span>
                </div>
              </div>

              {/* Section Breakdown Summary in Modal */}
              <div className="space-y-1.5 mb-6 max-h-40 overflow-y-auto pr-1">
                {testData.sections.map((sec, idx) => {
                  const secAnsCount = sec.questions.filter((q) => {
                    const val = answers[q.id]?.answerGiven;
                    return val !== undefined && val !== null && val !== '';
                  }).length;

                  return (
                    <div key={sec.id || idx} className="flex items-center justify-between text-xs px-3 py-1.5 bg-slate-950/60 rounded-lg border border-slate-800">
                      <span className="text-slate-300 truncate max-w-[200px]">{sec.name}</span>
                      <span className={`font-bold ${secAnsCount === sec.questions.length ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {secAnsCount}/{sec.questions.length} answered
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 rounded-lg hover:bg-slate-700"
                >
                  Return to Test
                </button>
                <button
                  type="button"
                  onClick={handleSubmitTest}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Grading & Generating Report...' : 'Yes, Submit Test'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE 3: INSTANT DIAGNOSTIC SCORE REPORT VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  if (stage === 'report' && report) {
    return (
      <div className="min-h-screen bg-[#06172a] text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-3">
              <CheckCircle2 size={13} className="text-emerald-400" /> Diagnostic Test Complete
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Congratulations, {report.studentName || 'Student'}!
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Here is your comprehensive score prediction for <b>{report.testTitle || 'Official Diagnostic'}</b>
            </p>
          </div>

          {/* Hero Score Card */}
          <div className="bg-gradient-to-br from-[#0c2a52] via-[#092040] to-[#06172a] border border-blue-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Scaled Score */}
              <div className="md:col-span-1 text-center md:text-left border-b md:border-b-0 md:border-r border-blue-500/20 pb-6 md:pb-0 md:pr-6">
                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Estimated Score</span>
                <div className="text-5xl sm:text-6xl font-black text-white mt-1 tracking-tight">
                  {report.scaledScore}
                </div>
                <div className="text-xs text-slate-300 mt-1 font-medium">
                  Out of <b>{report.maxScaledScore || 1600}</b> scale
                </div>
              </div>

              {/* Accuracy & Breakdown */}
              <div className="md:col-span-2 grid grid-cols-3 gap-4 text-center">
                <div className="bg-blue-950/60 p-4 rounded-2xl border border-blue-500/20">
                  <div className="text-2xl sm:text-3xl font-bold text-emerald-400">{report.accuracy}%</div>
                  <span className="text-xs text-slate-300 mt-0.5 block">Overall Accuracy</span>
                </div>
                <div className="bg-blue-950/60 p-4 rounded-2xl border border-blue-500/20">
                  <div className="text-2xl sm:text-3xl font-bold text-sky-300">{report.correctCount} / {report.totalQuestionsCount}</div>
                  <span className="text-xs text-slate-300 mt-0.5 block">Correct Answers</span>
                </div>
                <div className="bg-blue-950/60 p-4 rounded-2xl border border-blue-500/20">
                  <div className="text-2xl sm:text-3xl font-bold text-purple-300">
                    {Math.floor(report.timeSpentSeconds / 60)}m {report.timeSpentSeconds % 60}s
                  </div>
                  <span className="text-xs text-slate-300 mt-0.5 block">Time Taken</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section by Section Performance Breakdown */}
          {report.sectionScores && report.sectionScores.length > 0 && (
            <div className="bg-[#0b1f3a]/90 rounded-3xl border border-blue-500/20 p-6 sm:p-8 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers size={18} className="text-sky-400" /> Module Performance Breakdown
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {report.sectionScores.map((sec: any, idx: number) => (
                  <div
                    key={sec.sectionId || idx}
                    className="p-5 rounded-2xl bg-slate-950/70 border border-blue-500/20 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-400 uppercase tracking-wider">
                          Module {idx + 1}
                        </span>
                        <span className="font-bold text-sky-300">
                          {sec.accuracy}% Accuracy
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mb-3">{sec.sectionName}</h4>
                    </div>

                    <div className="space-y-2">
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${sec.accuracy}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                        <span>Score: <b>{sec.score} / {sec.maxScore}</b></span>
                        <span className="text-emerald-400 font-medium">{sec.correct ?? sec.score} Correct</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* High-Converting CTA Banner */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-white flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-left">
              <h3 className="text-xl sm:text-2xl font-black">Want to reach 1500+ on the real exam?</h3>
              <p className="text-xs sm:text-sm text-blue-100 max-w-lg">
                Schedule a <b>Free 1-on-1 Strategy Session</b> with our 99th-percentile mentors to review your test mistakes and build a personalized prep roadmap.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
              <a
                href={WHATSAPP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <MessageSquare size={16} /> WhatsApp Mentor
              </a>
              <a
                href={CALL_HREF}
                className="px-5 py-3 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <Phone size={16} /> Call Admissions
              </a>
            </div>
          </div>

          {/* Detailed Question Review */}
          {report.answers && Object.keys(report.answers).length > 0 && (
            <div className="bg-[#0b1f3a]/90 rounded-3xl border border-blue-500/20 p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-blue-500/20">
                <h3 className="text-lg font-bold text-white">Question-by-Question Review & Explanations</h3>
                <span className="text-xs text-slate-400">{Object.keys(report.answers).length} questions evaluated</span>
              </div>

              <div className="space-y-4">
                {Object.values(report.answers).map((item: any, idx: number) => (
                  <div
                    key={item.questionId || idx}
                    className={`p-5 rounded-2xl border ${
                      item.isCorrect
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
                        : item.answerGiven
                        ? 'bg-red-950/30 border-red-500/40 text-red-100'
                        : 'bg-slate-900/50 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-bold text-white">
                        Question {idx + 1} {item.topic ? `• ${item.topic}` : ''}
                      </span>
                      <span className="font-bold text-xs">
                        {item.isCorrect ? (
                          <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 size={14} /> Correct</span>
                        ) : item.answerGiven ? (
                          <span className="text-red-400 flex items-center gap-1"><X size={14} /> Incorrect</span>
                        ) : (
                          <span className="text-slate-400">Unanswered</span>
                        )}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-200 mb-3 whitespace-pre-line font-medium">
                      {item.questionText}
                    </p>

                    <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-slate-800">
                      <div>
                        <span className="text-slate-400">Your Answer:</span>
                        <div className="font-bold text-white mt-0.5">
                          {item.answerGiven !== null && item.answerGiven !== undefined ? String(item.answerGiven) : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Correct Answer:</span>
                        <div className="font-bold text-emerald-400 mt-0.5">
                          {typeof item.correctAnswer === 'object'
                            ? item.correctAnswer?.key || item.correctAnswer?.value || JSON.stringify(item.correctAnswer)
                            : String(item.correctAnswer || '—')}
                        </div>
                      </div>
                    </div>

                    {item.explanation && (
                      <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
                        <b className="text-sky-300">Explanation:</b> {item.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Back */}
          <div className="text-center pt-4">
            <Link to="/" className="text-xs font-semibold text-slate-400 hover:text-white transition">
              ← Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default FreeTestPage;
