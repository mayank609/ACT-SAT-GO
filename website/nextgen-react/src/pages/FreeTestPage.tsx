import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Sparkles, CheckCircle2, Clock, AlertCircle, ArrowRight, ArrowLeft,
  Bookmark, Calculator, Send, Phone, MessageSquare, X, ChevronRight,
  Layers, Check
} from 'lucide-react';
import { Header } from '../components/Header';
import { Brand } from '../components/Brand';
import { PLATFORM_API_BASE, QUERY_API_BASE } from '../config';
import { FALLBACK_SAT_TEST, FALLBACK_ACT_TEST } from '../data/mockDiagnosticTest';
import { WHATSAPP_HREF, CALL_HREF } from '../components/WhatsAppButton';
import { trackLead } from '../lib/metaPixel';
import avatar1 from '../assets/avatar1.png';
import avatar2 from '../assets/avatar2.png';
import avatar3 from '../assets/avatar3.png';
import avatar4 from '../assets/avatar4.png';

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
  const rawExamParam = (searchParams.get('exam') || 'SAT').toUpperCase();
  const requestedExam: ExamType = (['SAT', 'ACT', 'AP', 'GENERAL'].includes(rawExamParam) ? rawExamParam : 'SAT') as ExamType;

  // Flow stages: 'register' -> 'test' -> 'report'
  const [stage, setStage] = useState<'register' | 'test' | 'report'>('register');

  // Lead registration form
  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    phoneCountryCode: '+1',
    phoneLocalNumber: '',
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
    if (!leadForm.name.trim() || !leadForm.email.trim() || !leadForm.phoneLocalNumber.trim()) {
      setRegisterError('Please fill in your full name, email, and phone number to start.');
      return;
    }

    setRegistering(true);
    setRegisterError(null);

    try {
      const fullPhone = `${leadForm.phoneCountryCode} ${leadForm.phoneLocalNumber}`.trim();
      let generatedLeadId = `lead_${Date.now()}`;

      try {
        const res = await fetch(`${PLATFORM_API_BASE}/api/free-tests/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: leadForm.name.trim(),
            email: leadForm.email.trim(),
            phone: fullPhone,
            exam: leadForm.exam,
            grade: leadForm.grade,
            school: leadForm.school.trim(),
            targetScore: leadForm.targetScore.trim(),
          }),
        }).then((r) => r.json());

        const serverLeadId = res?.leadId || res?.lead?.id || res?.id;
        if (serverLeadId) {
          generatedLeadId = serverLeadId;
        }
      } catch {
        // Continue with local ID if API call fails
      }

      setLeadId(generatedLeadId);
      trackLead();

      // Dual-save lead to website query-server / MongoDB
      try {
        fetch(`${QUERY_API_BASE}/api/queries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: leadForm.name.trim(),
            email: leadForm.email.trim(),
            phone: fullPhone,
            exam: leadForm.exam,
            grade: leadForm.grade,
            message: `Free Diagnostic Test Registered (${leadForm.exam}) | School: ${leadForm.school.trim() || 'N/A'} | Target: ${leadForm.targetScore.trim() || 'N/A'}`,
            type: 'Free Diagnostic Test',
            status: 'Active',
            stage: 'New Lead',
            source: 'Website Free Test',
          }),
        }).catch(() => {});
      } catch {
        // ignore
      }

      // Load diagnostic test for the selected exam
      const loadedTest = await initializeTest(leadForm.exam);
      setTestData(loadedTest);
      setCurrentSectionIdx(0);
      setCurrentQuestionIdx(0);
      setSecondsRemaining((loadedTest.sections[0]?.durationMinutes || 32) * 60);
      setStage('test');
      setTimerRunning(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setRegisterError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  // Section Countdown Timer Hook
  useEffect(() => {
    if (!timerRunning || stage !== 'test') return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Time expired for current section -> trigger transition
          handleSectionTimeExpired();
          return 0;
        }
        return prev - 1;
      });
      setTotalTimeSpentSeconds((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning, stage, currentSectionIdx, testData]);

  const handleSectionTimeExpired = () => {
    if (!testData) return;
    const isLastSec = currentSectionIdx >= testData.sections.length - 1;
    if (isLastSec) {
      handleSubmitTest();
    } else {
      setShowNextSectionModal(true);
    }
  };

  // Answer selection handler
  const handleSelectAnswer = (qId: string, answerVal: any) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: {
        answerGiven: answerVal,
        timeSpentSeconds: (prev[qId]?.timeSpentSeconds || 0) + 1,
      },
    }));
  };

  // Flag/Bookmark question handler
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
        studentName: leadForm.name.trim(),
        name: leadForm.name.trim(),
        email: leadForm.email.trim(),
        phone: `${leadForm.phoneCountryCode} ${leadForm.phoneLocalNumber}`.trim(),
        exam: leadForm.exam,
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

      // Dual-save test completion to query-server / MongoDB
      try {
        fetch(`${QUERY_API_BASE}/api/queries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: leadForm.name.trim(),
            email: leadForm.email.trim(),
            phone: `${leadForm.phoneCountryCode} ${leadForm.phoneLocalNumber}`.trim(),
            exam: leadForm.exam,
            grade: leadForm.grade,
            message: `Completed Free Diagnostic Test (${leadForm.exam}) | Score: ${finalReport.scaledScore}/${finalReport.maxScaledScore} (${finalReport.percentage}%) | Accuracy: ${finalReport.accuracy}% | Time: ${Math.round(totalTimeSpentSeconds / 60)} mins`,
            type: 'Free Diagnostic Test',
            status: 'Active',
            stage: 'New Lead',
            leadScore: Math.max(50, finalReport.percentage || 50),
            source: 'Website Free Test Attempt',
          }),
        }).catch(() => {});
      } catch {
        // ignore
      }
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
  // STAGE 1: LEAD REGISTRATION VIEW (MATCHES WEBSITE UI)
  // ═══════════════════════════════════════════════════════════════════════════
  if (stage === 'register') {
    return (
      <>
        <Header />

        <main>
          <section className="ft-register-section">
            <span className="orb orb-gold" aria-hidden="true" />
            <div className="ft-container">
              {/* Header Badge & Title */}
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <div className="ft-badge">
                  <Sparkles size={14} /> Free Official Diagnostic Test
                </div>
                <h1 className="ft-title">
                  Digital SAT & ACT <span>Diagnostic Test Engine</span>
                </h1>
                <p className="ft-subtitle">
                  Experience official-format adaptive modules, realistic section timers, and get your estimated scaled score breakdown instantly.
                </p>
              </div>

              {/* 2-Column Benefits & Registration Form */}
              <div className="ft-grid">
                {/* Left Card: Benefits & Test Structure */}
                <div className="ft-benefits-card">
                  <div>
                    <div className="ft-benefits-header">
                      <h3>Test Architecture & Format</h3>
                    </div>

                    <ul className="ft-benefits-list">
                      <li className="ft-benefit-item">
                        <div className="ft-benefit-icon">
                          <CheckCircle2 size={16} />
                        </div>
                        <div className="ft-benefit-text">
                          <strong>Official 4-Module Structure</strong>
                          <p>Reading & Writing (Modules 1 & 2) + Math (Modules 1 & 2) with precise section pacing.</p>
                        </div>
                      </li>

                      <li className="ft-benefit-item">
                        <div className="ft-benefit-icon">
                          <CheckCircle2 size={16} />
                        </div>
                        <div className="ft-benefit-text">
                          <strong>Instant Scaled Score (400–1600 / 1–36)</strong>
                          <p>Get predicted scaled scores and accuracy metrics immediately upon test submission.</p>
                        </div>
                      </li>

                      <li className="ft-benefit-item">
                        <div className="ft-benefit-icon">
                          <CheckCircle2 size={16} />
                        </div>
                        <div className="ft-benefit-text">
                          <strong>Built-in Tools & Review Flags</strong>
                          <p>Includes digital calculator scratchpad, question palette navigation, and flag-for-review tools.</p>
                        </div>
                      </li>

                      <li className="ft-benefit-item">
                        <div className="ft-benefit-icon">
                          <CheckCircle2 size={16} />
                        </div>
                        <div className="ft-benefit-text">
                          <strong>Topic-by-Topic Explanations</strong>
                          <p>Detailed step-by-step solutions for every question to identify weak areas fast.</p>
                        </div>
                      </li>
                    </ul>
                  </div>

                  {/* Trust Avatars Strip */}
                  <div className="ft-trust-box">
                    <div className="ft-avatars">
                      <img src={avatar1} alt="Student avatar 1" />
                      <img src={avatar2} alt="Student avatar 2" />
                      <img src={avatar3} alt="Student avatar 3" />
                      <img src={avatar4} alt="Student avatar 4" />
                    </div>
                    <div className="ft-trust-stats">
                      <div className="ft-stars">★★★★★</div>
                      <span>4.9/5 • 1,200+ Students Tested</span>
                    </div>
                  </div>
                </div>

                {/* Right Card: Registration Form */}
                <div className="ft-form-card">
                  <h2>Enter Your Details to Start</h2>
                  <p className="ft-form-desc">
                    We'll save your diagnostic session and generate your personalized score breakdown.
                  </p>

                  {registerError && (
                    <div className="ft-error-banner">
                      <AlertCircle size={16} />
                      <span>{registerError}</span>
                    </div>
                  )}

                  <form onSubmit={handleRegister}>
                    {/* Full Name */}
                    <div className="ft-form-group">
                      <label htmlFor="ft-name">Student Full Name *</label>
                      <input
                        id="ft-name"
                        type="text"
                        required
                        className="ft-input"
                        placeholder="e.g. Maya Johnson"
                        value={leadForm.name}
                        onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                      />
                    </div>

                    {/* Email & Phone */}
                    <div className="ft-form-row">
                      <div className="ft-form-group">
                        <label htmlFor="ft-email">Email Address *</label>
                        <input
                          id="ft-email"
                          type="email"
                          required
                          className="ft-input"
                          placeholder="student@example.com"
                          value={leadForm.email}
                          onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                        />
                      </div>

                      <div className="ft-form-group">
                        <label htmlFor="ft-phone">Phone / WhatsApp *</label>
                        <div className="ft-phone-wrap">
                          <select
                            className="ft-select"
                            value={leadForm.phoneCountryCode}
                            onChange={(e) => setLeadForm({ ...leadForm, phoneCountryCode: e.target.value })}
                          >
                            <option value="+1">+1 (US)</option>
                            <option value="+91">+91 (IN)</option>
                            <option value="+44">+44 (UK)</option>
                            <option value="+971">+971 (AE)</option>
                            <option value="+65">+65 (SG)</option>
                            <option value="+61">+61 (AU)</option>
                            <option value="+966">+966 (SA)</option>
                            <option value="+974">+974 (QA)</option>
                            <option value="+968">+968 (OM)</option>
                            <option value="+965">+965 (KW)</option>
                            <option value="+973">+973 (BH)</option>
                            <option value="+852">+852 (HK)</option>
                          </select>
                          <input
                            id="ft-phone"
                            type="tel"
                            required
                            className="ft-input"
                            placeholder="555 123 4567"
                            value={leadForm.phoneLocalNumber}
                            onChange={(e) => setLeadForm({ ...leadForm, phoneLocalNumber: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Exam & Grade */}
                    <div className="ft-form-row">
                      <div className="ft-form-group">
                        <label htmlFor="ft-exam">Target Exam *</label>
                        <select
                          id="ft-exam"
                          className="ft-select"
                          value={leadForm.exam}
                          onChange={(e) => setLeadForm({ ...leadForm, exam: e.target.value as ExamType })}
                        >
                          <option value="SAT">Digital SAT (4 Modules, 1600 Scale)</option>
                          <option value="ACT">ACT (4 Sections, 36 Scale)</option>
                          <option value="AP">AP Exam Prep</option>
                          <option value="GENERAL">General Assessment</option>
                        </select>
                      </div>

                      <div className="ft-form-group">
                        <label htmlFor="ft-grade">Current Grade</label>
                        <select
                          id="ft-grade"
                          className="ft-select"
                          value={leadForm.grade}
                          onChange={(e) => setLeadForm({ ...leadForm, grade: e.target.value })}
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
                    <div className="ft-form-row">
                      <div className="ft-form-group">
                        <label htmlFor="ft-target-score">Target Score (Optional)</label>
                        <input
                          id="ft-target-score"
                          type="text"
                          className="ft-input"
                          placeholder="e.g. 1500+ / 34+"
                          value={leadForm.targetScore}
                          onChange={(e) => setLeadForm({ ...leadForm, targetScore: e.target.value })}
                        />
                      </div>

                      <div className="ft-form-group">
                        <label htmlFor="ft-school">School Name (Optional)</label>
                        <input
                          id="ft-school"
                          type="text"
                          className="ft-input"
                          placeholder="e.g. Lincoln High School"
                          value={leadForm.school}
                          onChange={(e) => setLeadForm({ ...leadForm, school: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Submit CTA */}
                    <button
                      type="submit"
                      disabled={registering}
                      className="ft-submit-btn"
                    >
                      {registering ? (
                        'Preparing Your Diagnostic Test...'
                      ) : (
                        <>
                          <span>Start Free Diagnostic Test</span>
                          <ArrowRight size={17} />
                        </>
                      )}
                    </button>

                    <p className="ft-guarantee">
                      🔒 100% Free • No credit card required • Instant score generated
                    </p>
                  </form>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="footer">
          <div className="footer-top shell">
            <div className="footer-brand-col">
              <Brand />
              <p className="footer-desc">
                ACT SAT GO offers expert guidance and resources to help students excel in their ACT | SAT | AP | and other academic courses. Join our community and unlock your potential with tailored learning strategies and comprehensive support.
              </p>
            </div>

            <div className="footer-col">
              <h4 className="footer-heading">Programs</h4>
              <ul className="footer-links">
                <li><a href="/sat">SAT</a></li>
                <li><a href="/act">ACT</a></li>
                <li><a href="/ap">AP</a></li>
                <li><a href="/k-12-tutoring">K-12 Tutoring</a></li>
                <li><a href="/future-programs">Future Programs</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4 className="footer-heading">Company</h4>
              <ul className="footer-links">
                <li><a href="/about-us">About Us</a></li>
                <li><a href="/">Home</a></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom shell">
            <p>&copy; {new Date().getFullYear()} ACT SAT GO. All rights reserved.</p>
            <p>Designed for students who aim higher.</p>
          </div>
        </footer>
      </>
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
      <div className="ft-test-view">
        {/* Top Navbar */}
        <header className="ft-test-topbar">
          <div className="ft-topbar-brand">
            <strong>ACT SAT GO</strong>
            <span className="sep">|</span>
            <div className="ft-topbar-module-badge">
              <b>Module {currentSectionIdx + 1}/{testData.sections.length}:</b>
              {currentSection?.name || testData.title}
            </div>
          </div>

          <div className="ft-topbar-actions">
            {/* Section Timer */}
            <div className="ft-timer-pill">
              <Clock size={15} />
              <span>{formatTimer(secondsRemaining)}</span>
            </div>

            {/* Calculator Toggle */}
            <button
              onClick={() => setShowCalculator((v) => !v)}
              className={`ft-calc-btn${showCalculator ? ' is-active' : ''}`}
              title="Toggle Calculator"
            >
              <Calculator size={15} />
              <span>Calc</span>
            </button>

            {/* Section Advance / Submit Button */}
            {isLastSection ? (
              <button
                onClick={() => setShowSubmitModal(true)}
                className="ft-submit-test-btn"
              >
                <Send size={13} />
                <span>Submit Test</span>
              </button>
            ) : (
              <button
                onClick={() => setShowNextSectionModal(true)}
                className="ft-next-module-btn"
              >
                <span>Next Module</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </header>

        {/* Stepper Breadcrumbs */}
        <div className="ft-module-stepper">
          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginRight: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Layers size={13} color="#38bdf8" /> Flow:
          </span>
          {testData.sections.map((sec, idx) => {
            const isCurrent = idx === currentSectionIdx;
            const isCompleted = idx < currentSectionIdx;

            return (
              <div key={sec.id || idx} style={{ display: 'flex', alignItems: 'center' }}>
                <div
                  className={`ft-step-item ${
                    isCurrent
                      ? 'is-current'
                      : isCompleted
                      ? 'is-completed'
                      : 'is-upcoming'
                  }`}
                >
                  {isCompleted ? (
                    <Check size={12} />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                  <span>{sec.name}</span>
                  <span style={{ opacity: 0.7 }}>({sec.durationMinutes}m)</span>
                </div>
                {idx < testData.sections.length - 1 && (
                  <ChevronRight size={13} style={{ margin: '0 4px', color: 'rgba(255,255,255,0.2)' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Question Counter Sub-bar */}
        <div className="ft-subbar">
          <div className="ft-subbar-info">
            <strong>Question {currentQuestionIdx + 1} of {totalQCount}</strong>
            <span style={{ color: 'rgba(255,255,255,0.25)' }}>•</span>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>Module: <b style={{ color: '#ffffff' }}>{currentSection?.name}</b></span>
            {activeQuestion.content?.meta?.domain && (
              <span className="ft-domain-tag">
                {activeQuestion.content.meta.domain}
              </span>
            )}
          </div>

          <button
            onClick={() => handleToggleFlag(activeQuestion.id)}
            className={`ft-flag-btn${isFlagged ? ' is-flagged' : ''}`}
          >
            <Bookmark size={13} fill={isFlagged ? 'currentColor' : 'none'} />
            <span>{isFlagged ? 'Marked for Review' : 'Mark for Review'}</span>
          </button>
        </div>

        {/* Main Workspace */}
        <div className="ft-test-workspace">
          <div className="ft-question-card">
            {/* Question Text */}
            <div className="ft-question-text">
              {activeQuestion.content?.text}
            </div>

            {/* Answer Options */}
            <div className="ft-options-list">
              {activeQuestion.type === 'NUMERIC' ? (
                <div className="ft-numeric-box">
                  <label>Enter numeric answer (integer, decimal, or fraction):</label>
                  <input
                    type="text"
                    placeholder="e.g. 5, 3/4, 0.75"
                    value={currentAnswer || ''}
                    onChange={(e) => handleSelectAnswer(activeQuestion.id, e.target.value)}
                  />
                </div>
              ) : activeQuestion.options ? (
                Object.entries(activeQuestion.options).map(([key, text]) => {
                  const isSelected = currentAnswer === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelectAnswer(activeQuestion.id, key)}
                      className={`ft-option-item${isSelected ? ' is-selected' : ''}`}
                    >
                      <div className="ft-option-badge">{key}</div>
                      <span style={{ fontSize: '15px', lineHeight: 1.5 }}>{text}</span>
                    </button>
                  );
                })
              ) : null}
            </div>
          </div>
        </div>

        {/* Floating Desmos/Basic Calculator */}
        {showCalculator && (
          <div className="ft-floating-calc">
            <div className="ft-calc-header">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Calculator size={14} color="#ffb400" /> Calculator Scratchpad
              </span>
              <button
                onClick={() => setShowCalculator(false)}
                style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}
              >
                <X size={15} />
              </button>
            </div>
            <input
              type="text"
              value={calcInput}
              onChange={(e) => setCalcInput(e.target.value)}
              placeholder="e.g. (17 - 5) / 4"
              className="ft-calc-input"
            />
            <div className="ft-calc-actions">
              <button onClick={handleCalculate} className="ft-calc-do-btn">
                Calculate
              </button>
              {calcResult && (
                <span className="ft-calc-result">= {calcResult}</span>
              )}
            </div>
          </div>
        )}

        {/* Bottom Navigation Toolbar */}
        <footer className="ft-test-footer">
          <button
            onClick={() => setCurrentQuestionIdx((i) => Math.max(0, i - 1))}
            disabled={currentQuestionIdx === 0}
            className="ft-nav-btn prev-btn"
          >
            <ArrowLeft size={14} /> Previous
          </button>

          {/* Palette Dots */}
          <div className="ft-palette-strip">
            {allFlatQuestions.map((item, idx) => {
              const qAns = answers[item.q.id]?.answerGiven;
              const isFlag = !!flaggedQuestions[item.q.id];
              const isCurrent = idx === currentQuestionIdx;
              const isAnswered = qAns !== undefined && qAns !== null && qAns !== '';

              return (
                <button
                  key={item.q.id}
                  onClick={() => setCurrentQuestionIdx(idx)}
                  className={`ft-palette-btn${isCurrent ? ' is-current' : isAnswered ? ' is-answered' : ''}`}
                >
                  {idx + 1}
                  {isFlag && <span className="ft-flag-dot" />}
                </button>
              );
            })}
          </div>

          {/* Next / Submit CTA */}
          {isLastQuestionInSection ? (
            isLastSection ? (
              <button
                onClick={() => setShowSubmitModal(true)}
                className="ft-submit-test-btn"
                style={{ padding: '8px 18px', fontSize: '13px' }}
              >
                Review & Submit <Send size={14} />
              </button>
            ) : (
              <button
                onClick={() => setShowNextSectionModal(true)}
                className="ft-next-module-btn"
                style={{ padding: '8px 18px', fontSize: '13px' }}
              >
                Complete Module <ChevronRight size={14} />
              </button>
            )
          ) : (
            <button
              onClick={() => setCurrentQuestionIdx((i) => i + 1)}
              className="ft-nav-btn next-btn"
            >
              Next <ArrowRight size={14} />
            </button>
          )}
        </footer>

        {/* Next Section Confirmation Modal */}
        {showNextSectionModal && (
          <div className="c-modal-overlay is-active" style={{ zIndex: 100 }}>
            <div className="c-modal" style={{ maxWidth: '460px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffb400', marginBottom: '8px' }}>
                <CheckCircle2 size={20} />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'white' }}>
                  Complete {currentSection?.name}?
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '16px' }}>
                You are about to finish <b>{currentSection?.name}</b> and move to{' '}
                <b style={{ color: '#ffb400' }}>{testData.sections[currentSectionIdx + 1]?.name}</b>.
              </p>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center', gap: '8px', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff' }}>{totalQCount}</div>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Total</span>
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#34d399' }}>{currentSectionAnsweredCount}</div>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Answered</span>
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#f59e0b' }}>{totalQCount - currentSectionAnsweredCount}</div>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Unanswered</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowNextSectionModal(false)}
                  className="btn btn-outline"
                  style={{ minHeight: '38px', padding: '0 14px', fontSize: '13px' }}
                >
                  Review Questions
                </button>
                <button
                  type="button"
                  onClick={handleProceedToNextSection}
                  className="btn btn-primary"
                  style={{ minHeight: '38px', padding: '0 16px', fontSize: '13px' }}
                >
                  Proceed to Next Module →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Submit Confirmation Modal */}
        {showSubmitModal && (
          <div className="c-modal-overlay is-active" style={{ zIndex: 100 }}>
            <div className="c-modal" style={{ maxWidth: '460px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '19px', fontWeight: 800, color: 'white' }}>
                Submit Your Free Diagnostic Test?
              </h3>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '16px' }}>
                You will receive your estimated scaled score prediction and detailed module analytics instantly.
              </p>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center', gap: '8px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff' }}>{totalAllQuestions}</div>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Total Questions</span>
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#34d399' }}>{totalAllAnswered}</div>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Answered</span>
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#f59e0b' }}>{totalAllQuestions - totalAllAnswered}</div>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Unanswered</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="btn btn-outline"
                  style={{ minHeight: '38px', padding: '0 14px', fontSize: '13px' }}
                >
                  Return to Test
                </button>
                <button
                  type="button"
                  onClick={handleSubmitTest}
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ minHeight: '38px', padding: '0 16px', fontSize: '13px' }}
                >
                  {submitting ? 'Grading Test...' : 'Yes, Submit Test'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE 3: INSTANT DIAGNOSTIC SCORE REPORT VIEW (MATCHES WEBSITE UI)
  // ═══════════════════════════════════════════════════════════════════════════
  if (stage === 'report' && report) {
    return (
      <>
        <Header />

        <main>
          <section className="ft-report-section">
            <span className="orb orb-gold" aria-hidden="true" />
            <div className="ft-container" style={{ maxWidth: '960px' }}>
              {/* Header Title */}
              <div style={{ textAlign: 'center', marginBottom: '36px' }}>
                <div className="ft-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.35)', color: '#34d399' }}>
                  <CheckCircle2 size={14} /> Diagnostic Complete
                </div>
                <h1 className="ft-title">
                  Congratulations, <span>{report.studentName || 'Student'}</span>!
                </h1>
                <p className="ft-subtitle" style={{ marginBottom: 0 }}>
                  Here is your official estimated score analysis for <b>{report.testTitle || 'Diagnostic Test'}</b>.
                </p>
              </div>

              {/* Score Hero Card */}
              <div className="ft-score-hero-card">
                <div className="ft-score-left">
                  <span className="ft-score-label">Estimated Scaled Score</span>
                  <div className="ft-score-big">{report.scaledScore}</div>
                  <div className="ft-score-scale">
                    Out of <b>{report.maxScaledScore || 1600}</b> Score Scale
                  </div>
                </div>

                <div className="ft-score-metrics-grid">
                  <div className="ft-metric-cell green">
                    <div className="ft-metric-val">{report.accuracy}%</div>
                    <div className="ft-metric-label">Overall Accuracy</div>
                  </div>
                  <div className="ft-metric-cell blue">
                    <div className="ft-metric-val">{report.correctCount} / {report.totalQuestionsCount}</div>
                    <div className="ft-metric-label">Correct Answers</div>
                  </div>
                  <div className="ft-metric-cell gold">
                    <div className="ft-metric-val">
                      {Math.floor(report.timeSpentSeconds / 60)}m {report.timeSpentSeconds % 60}s
                    </div>
                    <div className="ft-metric-label">Time Spent</div>
                  </div>
                </div>
              </div>

              {/* Module Performance Breakdown */}
              {report.sectionScores && report.sectionScores.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={18} color="#ffb400" /> Module Performance Breakdown
                  </h3>
                  <div className="ft-modules-grid">
                    {report.sectionScores.map((sec: any, idx: number) => (
                      <div key={sec.sectionId || idx} className="ft-module-card">
                        <div className="ft-module-card-header">
                          <span>Module {idx + 1}</span>
                          <strong>{sec.accuracy}% Accuracy</strong>
                        </div>
                        <h4>{sec.sectionName}</h4>
                        <div className="ft-progress-bar-wrap">
                          <div
                            className="ft-progress-bar-fill"
                            style={{ width: `${sec.accuracy}%` }}
                          />
                        </div>
                        <div className="ft-module-stats">
                          <span>Raw Score: <b>{sec.score} / {sec.maxScore}</b></span>
                          <span style={{ color: '#34d399', fontWeight: 700 }}>{sec.correct ?? sec.score} Correct</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strategy Session Consultation CTA */}
              <div className="ft-strategy-cta">
                <div>
                  <h3>Want to reach 1500+ / 34+ on the real exam?</h3>
                  <p>
                    Book a <b>Free 1-on-1 Strategy Session</b> with our 99th-percentile mentors to review your mistakes and build a personalized prep plan.
                  </p>
                </div>
                <div className="ft-strategy-buttons">
                  <a
                    href={WHATSAPP_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ft-cta-wa"
                  >
                    <MessageSquare size={16} /> WhatsApp Mentor
                  </a>
                  <a
                    href={CALL_HREF}
                    className="ft-cta-call"
                  >
                    <Phone size={16} /> Call Admissions
                  </a>
                </div>
              </div>

              {/* Question Review Section */}
              {report.answers && Object.keys(report.answers).length > 0 && (
                <div className="ft-review-card">
                  <div className="ft-review-header">
                    <h3>Question-by-Question Review & Explanations</h3>
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                      {Object.keys(report.answers).length} Questions
                    </span>
                  </div>

                  <div>
                    {Object.values(report.answers).map((item: any, idx: number) => (
                      <div
                        key={item.questionId || idx}
                        className={`ft-review-item ${item.isCorrect ? 'is-correct' : item.answerGiven ? 'is-incorrect' : ''}`}
                      >
                        <div className="ft-review-top">
                          <span style={{ fontWeight: 800, color: '#ffffff' }}>
                            Question {idx + 1} {item.topic ? `• ${item.topic}` : ''}
                          </span>
                          <div>
                            {item.isCorrect ? (
                              <span style={{ color: '#34d399', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={14} /> Correct
                              </span>
                            ) : item.answerGiven ? (
                              <span style={{ color: '#f87171', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <X size={14} /> Incorrect
                              </span>
                            ) : (
                              <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>Unanswered</span>
                            )}
                          </div>
                        </div>

                        <p className="ft-review-qtext">{item.questionText}</p>

                        <div className="ft-review-answers-grid">
                          <div>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Your Answer:</span>
                            <div style={{ fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                              {item.answerGiven !== null && item.answerGiven !== undefined ? String(item.answerGiven) : '—'}
                            </div>
                          </div>
                          <div>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Correct Answer:</span>
                            <div style={{ fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
                              {typeof item.correctAnswer === 'object'
                                ? item.correctAnswer?.key || item.correctAnswer?.value || JSON.stringify(item.correctAnswer)
                                : String(item.correctAnswer || '—')}
                            </div>
                          </div>
                        </div>

                        {item.explanation && (
                          <div className="ft-review-explanation">
                            <b>Explanation:</b> {item.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Return to Home Link */}
              <div style={{ textAlign: 'center', marginTop: '32px' }}>
                <Link to="/" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
                  ← Return to Home
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="footer">
          <div className="footer-top shell">
            <div className="footer-brand-col">
              <Brand />
              <p className="footer-desc">
                ACT SAT GO offers expert guidance and resources to help students excel in their ACT | SAT | AP | and other academic courses. Join our community and unlock your potential with tailored learning strategies and comprehensive support.
              </p>
            </div>

            <div className="footer-col">
              <h4 className="footer-heading">Programs</h4>
              <ul className="footer-links">
                <li><a href="/sat">SAT</a></li>
                <li><a href="/act">ACT</a></li>
                <li><a href="/ap">AP</a></li>
                <li><a href="/k-12-tutoring">K-12 Tutoring</a></li>
                <li><a href="/future-programs">Future Programs</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4 className="footer-heading">Company</h4>
              <ul className="footer-links">
                <li><a href="/about-us">About Us</a></li>
                <li><a href="/">Home</a></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom shell">
            <p>&copy; {new Date().getFullYear()} ACT SAT GO. All rights reserved.</p>
            <p>Designed for students who aim higher.</p>
          </div>
        </footer>
      </>
    );
  }

  return null;
}

export default FreeTestPage;
