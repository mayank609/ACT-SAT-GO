import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, AlertTriangle, Clock, Users, ArrowUpRight,
  CheckCircle2, Award
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Card, StatCard } from '../../components/common/Card';
import { TopicAnalysisTable } from '../../components/dashboard/TopicAnalysisTable';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { api, type DbUser } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

type SectionStat = {
  sectionId: string; sectionName: string; totalQuestions: number;
  correct: number; incorrect: number; skipped: number;
  accuracy: number; timeAllocated: number; timeUsed: number;
}

type PacingStat = {
  questionIndex: number; sectionName: string; timeSpentSeconds: number;
  status: 'correct' | 'incorrect' | 'skipped'; difficulty: string; topicName: string;
}

type AnalyticsData = {
  trend: Array<{ date: string; score: number; testTitle: string; attemptId: string }>
  sectionStats: SectionStat[]
  questionPacingStats: PacingStat[]
  overallAccuracy: number
  totalAttempts: number
  latestScore: number
  avgScore: number
}

interface SectionAnalysis {
  name: string;
  category: string;
  correct: number;
  incorrect: number;
  omitted: number;
  total: number;
  unvisited: number;
  accuracy: number;
  timeTaken: string;
}

interface TaAttempt {
  id: string;
  testId: string;
  status: string;
  totalScore: number | null;
  startedAt: string;
  completedAt: string | null;
  test: { id: string; title: string; category?: string };
  sectionAttempts: Array<{
    id: string;
    sectionId: string;
    startedAt: string;
    completedAt: string | null;
    section: {
      id: string;
      name: string;
      durationMinutes: number;
      orderIndex: number;
      questions: Array<{
        id: string;
        questionId: string;
        orderIndex: number;
        question: {
          id: string;
          type: string;
          content: { text: string; meta?: { isPassage?: boolean } };
          correctAnswer: { key?: string; keys?: string[]; value?: number };
          difficultyLevel?: string;
          childQuestions?: Array<{
            id: string;
            type: string;
            content: { text: string };
            correctAnswer: { key?: string; keys?: string[]; value?: number };
            difficultyLevel?: string;
            topic?: { name: string };
          }>;
          topic?: { name: string };
        };
      }>;
    };
  }>;
  answers: Array<{
    id: string;
    questionId: string;
    answerGiven: { key?: string; keys?: string[]; value?: number } | null;
    timeSpentSeconds: number;
    isFlagged: boolean;
  }>;
}

// Helper function to check if an answer is correct
function isAnswerCorrect(given: unknown, correct: unknown): boolean {
  if (!given || !correct) return false;
  const g = given as { key?: string; keys?: string[]; value?: number };
  const c = correct as { key?: string; keys?: string[]; value?: number };

  // Numeric answers
  if (c.value !== undefined) {
    if (g.value === undefined) return false;
    return Number(g.value) === Number(c.value) || String(g.value).trim() === String(c.value).trim();
  }

  // Multiple Select Questions (MSQ)
  if (Array.isArray(c.keys)) {
    if (!Array.isArray(g.keys)) return false;
    const gKeys = g.keys.map((k) => String(k).toUpperCase().trim()).sort();
    const cKeys = c.keys.map((k) => String(k).toUpperCase().trim()).sort();
    return JSON.stringify(gKeys) === JSON.stringify(cKeys);
  }

  // Multiple Choice Questions (MCQ)
  if (c.key !== undefined) {
    if (g.key === undefined) return false;
    return String(g.key).toUpperCase().trim() === String(c.key).toUpperCase().trim();
  }

  return false;
}

function deriveTopicPerformance(pacingStats: PacingStat[]) {
  const map: Record<string, { correct: number; total: number; category: string }> = {};
  for (const q of pacingStats) {
    if (!map[q.topicName]) map[q.topicName] = { correct: 0, total: 0, category: q.sectionName };
    map[q.topicName].total++;
    if (q.status === 'correct') map[q.topicName].correct++;
  }
  return Object.entries(map).map(([topic, v]) => ({
    topic,
    accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
    category: v.category,
  }));
}

function aggregateSections(analyticsMap: Record<string, AnalyticsData>): SectionStat[] {
  const grouped: Record<string, { accuracySum: number; count: number; totalQ: number; timeAlloc: number; timeUsed: number }> = {};
  for (const a of Object.values(analyticsMap)) {
    for (const s of a.sectionStats) {
      if (!grouped[s.sectionName]) grouped[s.sectionName] = { accuracySum: 0, count: 0, totalQ: 0, timeAlloc: 0, timeUsed: 0 };
      grouped[s.sectionName].accuracySum += s.accuracy;
      grouped[s.sectionName].count++;
      grouped[s.sectionName].totalQ += s.totalQuestions;
      grouped[s.sectionName].timeAlloc += s.timeAllocated;
      grouped[s.sectionName].timeUsed += s.timeUsed;
    }
  }
  const n = Math.max(Object.keys(analyticsMap).length, 1);
  return Object.entries(grouped).map(([name, v]) => ({
    sectionId: name,
    sectionName: name,
    totalQuestions: Math.round(v.totalQ / n),
    correct: 0, incorrect: 0, skipped: 0,
    accuracy: Math.round(v.accuracySum / v.count),
    timeAllocated: Math.round(v.timeAlloc / n),
    timeUsed: Math.round(v.timeUsed / n),
  }));
}

function computeTestAnalysis(attempt: TaAttempt): {
  sections: SectionAnalysis[];
  totalCorrect: number;
  totalQuestions: number;
  rwCorrect: number;
  rwTotal: number;
  mathCorrect: number;
  mathTotal: number;
  finalScaledScore: number;
  hasRealScaledScore: boolean;
} {
  console.log('[TutorAnalytics] computeTestAnalysis called for attempt:', attempt.id);
  console.log('[TutorAnalytics] Total answers in attempt:', attempt.answers.length);
  
  const answersMap = new Map(attempt.answers.map(a => [a.questionId, a]));
  console.log('[TutorAnalytics] AnswersMap size:', answersMap.size);

  const sortedSections = [...attempt.sectionAttempts].sort((a, b) => a.section.orderIndex - b.section.orderIndex);
  console.log('[TutorAnalytics] Sections count:', sortedSections.length);

  const testTitle = (attempt.test.title ?? '').toLowerCase();
  const testCat   = (attempt.test.category ?? '').toLowerCase();
  const testIsMath = /\bmhw\b|math[\s-]hw|math\s*homework|\bmath\b|algebra|geometry|calc/.test(testTitle) || /math/i.test(testCat);
  const testIsRW   = /\brhw\b|reading[\s-]hw|writing[\s-]hw|english[\s-]hw|\breading\b|\bwriting\b|\benglish\b|verbal|grammar|\brw\b/.test(testTitle) || /rw|english/i.test(testCat);

  let totalCorrect = 0, totalQuestions = 0;
  let rwCorrect = 0, rwTotal = 0, mathCorrect = 0, mathTotal = 0;

  const sections: SectionAnalysis[] = sortedSections.map((sa, sectionIdx) => {
    console.log(`[TutorAnalytics] Processing section ${sectionIdx}: "${sa.section.name}" with ${sa.section.questions?.length || 0} questions`);
    
    // Flatten questions to handle PASSAGE questions
    const flatQs: any[] = [];
    for (const tq of (sa.section.questions || [])) {
      const q = tq.question;
      const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
      if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
        for (const cq of q.childQuestions) {
          flatQs.push({
            id: cq.id,
            questionId: cq.id,
            question: cq,
            correctAnswer: cq.correctAnswer,
          });
        }
      } else {
        flatQs.push({
          id: q.id,
          questionId: q.id,
          question: q,
          correctAnswer: q.correctAnswer,
        });
      }
    }

    console.log(`[TutorAnalytics]   Flattened to ${flatQs.length} questions`);

    let correct = 0, incorrect = 0, omitted = 0, unvisited = 0;
    flatQs.forEach((tq) => {
      const ans = answersMap.get(tq.questionId);
      if (!ans) { 
        unvisited++; 
        omitted++; 
        return; 
      }
      if (!ans.answerGiven) { 
        omitted++; 
        return; 
      }
      // Check if answer is actually correct
      if (isAnswerCorrect(ans.answerGiven, tq.correctAnswer)) {
        correct++;
      } else {
        incorrect++;
      }
    });

    const total = flatQs.length;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;
    console.log(`[TutorAnalytics]   Result: ${correct}/${total} correct (${Math.round(accuracy)}%)`);

    let timeTaken = '—';
    if (sa.startedAt && sa.completedAt) {
      const mins = Math.round((new Date(sa.completedAt).getTime() - new Date(sa.startedAt).getTime()) / 60000);
      const secs = Math.round(((new Date(sa.completedAt).getTime() - new Date(sa.startedAt).getTime()) % 60000) / 1000);
      timeTaken = `${mins}:${secs.toString().padStart(2, '0')} Minutes Taken`;
    }

    const sectionIsMath = /math/i.test(sa.section.name);
    const sectionIsRW   = /reading|writing|rw/i.test(sa.section.name);
    const isMath = sectionIsMath || (!sectionIsRW && testIsMath);
    const isRW   = sectionIsRW   || (!sectionIsMath && testIsRW);
    const category = isMath ? 'Math' : isRW ? 'Reading and Writing' : sa.section.name;

    if (isMath) { mathCorrect += correct; mathTotal += total; }
    else if (isRW) { rwCorrect += correct; rwTotal += total; }

    totalCorrect += correct;
    totalQuestions += total;

    return { name: sa.section.name, category, correct, incorrect, omitted, total, unvisited, accuracy, timeTaken };
  });

  // The server always sets totalScore (200-1600 scaled) on submission for a Mock/Sectional
  // attempt. If it's somehow missing, fall back to the raw correct count rather than a
  // percentage — a 0-100 accuracy percentage is not a scaled score and must never be shown
  // as one under a "Scaled Score" label.
  const finalScaledScore = attempt.totalScore ?? totalCorrect;
  const hasRealScaledScore = attempt.totalScore != null;
  console.log('[TutorAnalytics] Final: totalCorrect=' + totalCorrect + ', totalQuestions=' + totalQuestions + ', finalScaledScore=' + finalScaledScore + ', savedTotalScore=' + attempt.totalScore);

  return { sections, totalCorrect, totalQuestions, rwCorrect, rwTotal, mathCorrect, mathTotal, finalScaledScore, hasRealScaledScore };
}

export function TutorAnalyticsPage() {
  const { dbId } = useAuthStore();
  const [selectedStudent, setSelectedStudent] = useState<string>(() => sessionStorage.getItem('tutor_analytics_student') || 'all');
  const [students, setStudents] = useState<DbUser[]>([]);
  const [analyticsMap, setAnalyticsMap] = useState<Record<string, AnalyticsData>>({});
  const [loading, setLoading] = useState(true);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string>(() => sessionStorage.getItem('tutor_analytics_attemptId') || '');
  const [studentAttempts, setStudentAttempts] = useState<any[]>([]);
  const [expandedAttempt, setExpandedAttempt] = useState<TaAttempt | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);

  const currentAnalytics = selectedStudent !== 'all' ? analyticsMap[selectedStudent] : null;
  const currentStudentProfile = students.find((s) => s.id === selectedStudent);

  // Sync selection to sessionStorage
  useEffect(() => {
    if (selectedStudent) {
      sessionStorage.setItem('tutor_analytics_student', selectedStudent);
    } else {
      sessionStorage.removeItem('tutor_analytics_student');
    }
  }, [selectedStudent]);

  useEffect(() => {
    if (selectedAttemptId) {
      sessionStorage.setItem('tutor_analytics_attemptId', selectedAttemptId);
    } else {
      sessionStorage.removeItem('tutor_analytics_attemptId');
    }
  }, [selectedAttemptId]);

  // Load students on mount
  useEffect(() => {
    if (!dbId) return;
    api.getTutorAssignments({ tutorId: dbId })
      .then(async (r) => {
        const studs = r.assignments.map((a) => a.student as DbUser);
        setStudents(studs);
        if (studs.length > 0) {
          const results = await Promise.allSettled(
            studs.map((s) => api.getStudentAnalytics(s.id).then((d) => ({ id: s.id, data: d })))
          );
          const map: Record<string, AnalyticsData> = {};
          for (const r of results) {
            if (r.status === 'fulfilled') map[r.value.id] = r.value.data as AnalyticsData;
          }
          setAnalyticsMap(map);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dbId]);

  // Load attempts for selected student
  useEffect(() => {
    if (selectedStudent === 'all') {
      setStudentAttempts([]);
      setSelectedAttemptId('');
      return;
    }
    api.getStudentAttempts(selectedStudent)
      .then((r) => {
        const submitted = ((r.attempts as any[]) ?? []).filter(a => a.status === 'SUBMITTED');
        setStudentAttempts(submitted);
        if (submitted.length > 0) {
          const storedAttemptId = sessionStorage.getItem('tutor_analytics_attemptId');
          const hasStored = submitted.some(a => a.id === storedAttemptId);
          if (hasStored && storedAttemptId) {
            setSelectedAttemptId(storedAttemptId);
          } else {
            setSelectedAttemptId(submitted[0].id);
          }
        } else {
          setSelectedAttemptId('');
        }
      })
      .catch(() => {});
  }, [selectedStudent]);

  // Load specific analytics for selected student & attempt
  useEffect(() => {
    if (selectedStudent === 'all') return;
    if (studentAttempts.length > 0 && !selectedAttemptId) return;

    api.getStudentAnalytics(selectedStudent, selectedAttemptId || undefined)
      .then((data) => {
        setAnalyticsMap((prev) => ({
          ...prev,
          [selectedStudent]: data as AnalyticsData,
        }));
      })
      .catch(() => {});
  }, [selectedStudent, selectedAttemptId]);

  // Load full attempt details for test analysis
  useEffect(() => {
    if (!selectedAttemptId || selectedStudent === 'all') {
      setExpandedAttempt(null);
      return;
    }
    setExpandedLoading(true);
    api.getAttempt(selectedAttemptId)
      .then((data) => {
        const attempt = (data as any).attempt as TaAttempt;
        console.log('[DEBUG] Fetched attempt data:', {
          id: attempt.id,
          testTitle: attempt.test.title,
          sectionCount: attempt.sectionAttempts.length,
          answerCount: attempt.answers.length,
          firstSectionQuestions: attempt.sectionAttempts[0]?.section.questions?.length || 0,
        });
        setExpandedAttempt(attempt);
      })
      .catch((err) => {
        console.error('[DEBUG] Failed to fetch attempt:', err);
        setExpandedAttempt(null);
      })
      .finally(() => setExpandedLoading(false));
  }, [selectedAttemptId, selectedStudent]);

  // Aggregate metrics
  const avgScore = useMemo(() => {
    const withScore = students.filter((s) => s.avgScore != null);
    return withScore.length
      ? Math.round(withScore.reduce((a, s) => a + (s.avgScore ?? 0), 0) / withScore.length)
      : 0;
  }, [students]);

  const totalTests = useMemo(() =>
    students.reduce((a, s) => a + (s.testsAttempted ?? 0), 0), [students]);

  const onTrackCount = useMemo(() =>
    students.filter((s) => (s.avgScore ?? 0) >= ((s.targetScore as number | null) ?? 36) * 0.85).length,
  [students]);

  // Topic performance derived from pacing stats
  const topicPerformance = useMemo(() => {
    if (currentAnalytics) return deriveTopicPerformance(currentAnalytics.questionPacingStats);
    const allPacing = Object.values(analyticsMap).flatMap((a) => a.questionPacingStats);
    return deriveTopicPerformance(allPacing);
  }, [currentAnalytics, analyticsMap]);

  const strongTopics = topicPerformance.filter((t) => t.accuracy >= 75);
  const weakTopics = topicPerformance.filter((t) => t.accuracy < 65);

  // Aggregate topic stats for table
  const allPacingStats = useMemo(() => {
    const allPacing = Object.values(analyticsMap).flatMap((a) => a.questionPacingStats);
    const map: Record<string, { count: number; correct: number; topicName: string }> = {};
    allPacing.forEach((q) => {
      const topic = q.topicName || 'Uncategorized';
      if (!map[topic]) {
        map[topic] = { count: 0, correct: 0, topicName: topic };
      }
      map[topic].count++;
      if (q.status === 'correct') {
        map[topic].correct++;
      }
    });
    return Object.values(map).sort((a, b) => (b.correct / b.count) - (a.correct / a.count));
  }, [analyticsMap]);

  // Section stats for heatmap
  const activeSectionStats: SectionStat[] = useMemo(() => {
    if (currentAnalytics) return currentAnalytics.sectionStats;
    return aggregateSections(analyticsMap);
  }, [currentAnalytics, analyticsMap]);

  const sectionsList = activeSectionStats.map((s) => ({
    name: s.sectionName,
    accuracy: s.accuracy,
    questions: s.totalQuestions,
    time: `${Math.round(s.timeAllocated / 60)}m`,
  }));

  const sectionTimingData = activeSectionStats.map((s) => ({
    section: s.sectionName,
    'Target (s/q)': s.totalQuestions > 0 ? Math.round(s.timeAllocated / s.totalQuestions) : 0,
    'Actual (s/q)': s.totalQuestions > 0 ? Math.round(s.timeUsed / s.totalQuestions) : 0,
  }));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-slate-400 text-sm">Loading analytics...</div></div>;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Student Performance Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {selectedStudent === 'all'
              ? `Aggregated insights across all ${students.length} assigned students`
              : `Performance breakdown for ${currentStudentProfile?.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 font-semibold hidden md:inline">Focus Student:</span>
          <SearchableSelect
            options={[
              { id: 'all', label: 'All Students (Aggregate)', searchText: 'all' },
              ...students.map(s => ({ id: s.id, label: s.name, searchText: s.name }))
            ]}
            value={selectedStudent}
            onChange={setSelectedStudent}
            placeholder="Select student…"
            minWidth="min-w-[200px]"
          />
          {selectedStudent !== 'all' && studentAttempts.length > 0 && (
            <SearchableSelect
              options={studentAttempts.map(a => ({
                id: a.id,
                label: `${a.test.title} — ${a.completedAt ? new Date(a.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}`,
                searchText: a.test.title,
              }))}
              value={selectedAttemptId}
              onChange={setSelectedAttemptId}
              placeholder="Select attempt…"
              minWidth="min-w-[240px]"
            />
          )}
        </div>
      </div>

      {students.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl bg-white">
          No students assigned to you yet.
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <StatCard title="Focus Group" value={selectedStudent === 'all' ? students.length : 1} subtitle="Active Cohort size" icon={<Users size={20} />} color="blue" />
            <StatCard title="Avg ACT Score" value={selectedStudent === 'all' ? avgScore : (currentStudentProfile?.avgScore ?? '—')} subtitle="Standard Scale Score" icon={<TrendingUp size={20} />} color="emerald" trend={{ value: 2.4, positive: true }} />
            <StatCard title="Practice Tests" value={selectedStudent === 'all' ? totalTests : (currentStudentProfile?.testsAttempted ?? 0)} subtitle="Attempts completed" icon={<Clock size={20} />} color="purple" />
            <StatCard title="Target Score Status" value={selectedStudent === 'all' ? `${onTrackCount}/${students.length}` : `${currentStudentProfile?.avgScore ?? 0}/${(currentStudentProfile?.targetScore as number | null) ?? 36}`} subtitle={selectedStudent === 'all' ? 'On track for target' : 'Current vs Target Score'} icon={<Award size={20} />} color="amber" />
          </div>

          {/* Test Analysis Panel - Only show when specific student & attempt selected */}
          {selectedStudent !== 'all' && selectedAttemptId && expandedAttempt && !expandedLoading && (() => {
            const analysis = computeTestAnalysis(expandedAttempt);
            // Scaled score applies to Diagnostic/Mock/Sectional — only Practice Sheet shows a raw count.
            const isMockTest = !(['Practice Sheet'].includes(expandedAttempt.test.category ?? '') || /practice\s*sheet/i.test(expandedAttempt.test.title ?? ''));
            const completedDate = expandedAttempt.completedAt
              ? new Date(expandedAttempt.completedAt).toLocaleDateString('en-US', {
                day: '2-digit', month: '2-digit', year: 'numeric'
              }) + ', ' + new Date(expandedAttempt.completedAt).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit'
              })
              : '—';

            return (
              <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white shadow-lg space-y-4">
                {/* Header Section */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-semibold uppercase tracking-wide">{currentStudentProfile?.name}</p>
                    <h2 className="text-2xl md:text-3xl font-bold mt-1">{expandedAttempt.test.title}</h2>
                    <p className="text-blue-100 text-xs mt-1">Completed on {completedDate}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-6xl font-bold">
                      {isMockTest && analysis.hasRealScaledScore ? analysis.finalScaledScore : `${analysis.totalCorrect}/${analysis.totalQuestions}`}
                    </p>
                    <p className="text-blue-100 text-sm mt-1">{isMockTest && analysis.hasRealScaledScore ? 'Scaled Score' : 'Correct'}</p>
                  </div>
                </div>

                {/* Section Breakdown Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {analysis.sections.map((sec, idx) => {
                    const accuracy = sec.total > 0 ? Math.round((sec.correct / sec.total) * 100) : 0;
                    return (
                      <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                        <p className="text-xs font-semibold text-blue-100 uppercase tracking-wider">{sec.category}</p>
                        <p className="text-2xl font-bold mt-2 text-white">{accuracy}%</p>
                        <p className="text-xs text-blue-100 mt-1">{sec.correct}/{sec.total} correct</p>
                      </div>
                    );
                  })}
                </div>

                {/* Overall Stats */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/20">
                  <div>
                    <p className="text-blue-100 text-xs font-semibold uppercase">Total Correct</p>
                    <p className="text-xl font-bold text-white mt-1">{analysis.totalCorrect} / {analysis.totalQuestions}</p>
                  </div>
                  <div>
                    <p className="text-blue-100 text-xs font-semibold uppercase">Reading & Writing</p>
                    <p className="text-xl font-bold text-white mt-1">{analysis.rwCorrect} / {analysis.rwTotal}</p>
                  </div>
                  <div>
                    <p className="text-blue-100 text-xs font-semibold uppercase">Math</p>
                    <p className="text-xl font-bold text-white mt-1">{analysis.mathCorrect} / {analysis.mathTotal}</p>
                  </div>
                </div>
              </div>
            );
          })()}



          {/* Heatmaps & Weak Topics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="lg:col-span-2 space-y-4">
              {sectionsList.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-100 p-4 md:p-5 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">Section-wise Performance Heatmaps</h3>
                      <p className="text-[11px] text-slate-400">Score accuracy by ACT subject section</p>
                    </div>
                    <Badge variant="info" className="bg-blue-50 text-blue-700 border-blue-100 font-semibold text-[10px]">HEATMAP</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sectionsList.map((sec) => {
                      const isExcellent = sec.accuracy >= 80;
                      const isWarning = sec.accuracy < 65;
                      const categoryLabel = isExcellent ? 'Excellent' : isWarning ? 'Needs Work' : 'Proficient';
                      const progressColor = isExcellent ? 'bg-emerald-500' : isWarning ? 'bg-red-400' : 'bg-blue-500';
                      const cardStyle = isExcellent
                        ? 'border-emerald-100 bg-emerald-50/10'
                        : isWarning
                          ? 'border-red-100 bg-red-50/10 animate-pulse'
                          : 'border-blue-50 bg-blue-50/5';
                      return (
                        <div key={sec.name} className={`p-3 border rounded-xl shadow-xs transition-all ${cardStyle}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="text-xs font-bold text-slate-700 block">{sec.name}</span>
                              <span className="text-[10px] text-slate-400 block">{sec.questions} Qs • {sec.time} Allocated</span>
                            </div>
                            <Badge variant={isExcellent ? 'success' : isWarning ? 'danger' : 'warning'} className="text-[9px] font-bold">
                              {categoryLabel}
                            </Badge>
                          </div>
                          <div className="flex items-end justify-between mt-3 mb-1">
                            <span className="text-xs text-slate-500">Accuracy</span>
                            <span className="text-base font-extrabold text-slate-800">{sec.accuracy}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${sec.accuracy}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {sectionTimingData.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-100 p-4 md:p-5 shadow-sm">
                  <h3 className="font-bold text-slate-800 text-sm">Section Timing Comparison</h3>
                  <p className="text-[11px] text-slate-400 mb-4">Target vs actual avg time per question (seconds)</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={sectionTimingData} barSize={12} barGap={4} margin={{ left: -10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                      <XAxis dataKey="section" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} unit="s" />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '11px' }} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Bar dataKey="Target (s/q)" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Actual (s/q)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-0.5">
                  <CheckCircle2 className="text-emerald-500 w-4 h-4" /> Strong Topics
                </h3>
                <p className="text-[10px] text-slate-400 mb-3">Concepts mastered with high proficiency</p>
                <div className="space-y-2">
                  {strongTopics.map((t) => (
                    <div key={t.topic} className="flex items-center justify-between p-2 border border-emerald-50/50 bg-emerald-50/10 rounded-lg">
                      <div>
                        <span className="text-xs font-semibold text-slate-700 block">{t.topic}</span>
                        <span className="text-[9px] text-slate-400 uppercase font-semibold">{t.category}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-700 block">{t.accuracy}%</span>
                        <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">Mastered</span>
                      </div>
                    </div>
                  ))}
                  {strongTopics.length === 0 && (
                    <p className="text-xs text-slate-400 py-4 text-center">No mastered topics yet.</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-400" />
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-0.5">
                  <AlertTriangle className="text-red-500 w-4 h-4 animate-pulse" /> Critical Focus Areas
                </h3>
                <p className="text-[10px] text-slate-400 mb-3">Key weak areas needing immediate revision</p>
                <div className="space-y-2">
                  {weakTopics.map((t) => (
                    <div key={t.topic} className="flex items-center justify-between p-2 border border-red-50 bg-red-50/10 rounded-lg">
                      <div>
                        <span className="text-xs font-semibold text-slate-700 block">{t.topic}</span>
                        <span className="text-[9px] text-slate-400 uppercase font-semibold">{t.category}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-red-600 block">{t.accuracy}%</span>
                        <span className="text-[8px] font-bold text-red-500 bg-red-50 px-1 py-0.5 rounded border border-red-100">Needs Work</span>
                      </div>
                    </div>
                  ))}
                  {weakTopics.length === 0 && (
                    <p className="text-xs text-slate-400 py-4 text-center">No weak topics identified!</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Class Performance Table */}
          <Card padding="none" className="border border-slate-100 shadow-sm overflow-hidden bg-white">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">Class Performance Overview</h3>
              <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 font-bold uppercase">Syllabus Tracking</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-50 to-blue-100/40 border-b border-blue-100">
                    {['Student', 'Grade', 'Tests Done', 'Avg Score', 'Target', 'Gap', 'Trend', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-blue-800 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s) => {
                    const gap = ((s.targetScore as number | null) ?? 36) - (s.avgScore ?? 0);
                    const onTrack = gap <= 3;
                    const studentAnalytics = analyticsMap[s.id];
                    const trend = studentAnalytics && studentAnalytics.trend.length >= 2
                      ? studentAnalytics.trend[studentAnalytics.trend.length - 1].score - studentAnalytics.trend[studentAnalytics.trend.length - 2].score
                      : null;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 text-xs font-bold border border-blue-100 flex-shrink-0">
                              {s.name.charAt(0)}
                            </div>
                            <div>
                              <span className="font-bold text-slate-800 block text-xs">{s.name}</span>
                              <span className="text-[10px] text-slate-400 block">{s.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs font-medium">{s.grade ? `Grade ${s.grade}` : '—'}</td>
                        <td className="px-4 py-3 text-slate-700 text-xs font-semibold">{s.testsAttempted ?? 0}</td>
                        <td className="px-4 py-3 font-extrabold text-slate-850 text-xs">{s.avgScore ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{(s.targetScore as number | null) ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold ${gap > 5 ? 'text-red-500' : gap > 2 ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {gap > 0 ? `−${gap} pts` : `+${Math.abs(gap)} pts`}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold flex items-center gap-0.5 ${trend === null ? 'text-slate-400' : trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            <ArrowUpRight size={12} />
                            {trend === null ? 'No data' : trend >= 0 ? `+${trend} pts` : `${trend} pts`}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={onTrack ? 'success' : gap > 5 ? 'danger' : 'warning'} className="text-[10px] font-bold">
                            {onTrack ? 'On Track' : gap > 5 ? 'At Risk' : 'Needs Help'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Topic-wise Analysis for aggregated data */}
      {allPacingStats.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Topic-Wise Performance</h2>
          <TopicAnalysisTable data={allPacingStats.map((stat, idx) => ({
            sno: idx + 1,
            topic: stat.topicName || 'Uncategorized',
            totalQuestions: stat.count,
            correctQuestions: stat.correct,
            accuracy: stat.count > 0 ? (stat.correct / stat.count) * 100 : 0,
            avgMistakes: stat.count > 0 ? (stat.count - stat.correct) / stat.count : 0,
          }))} loading={loading} />
        </div>
      )}
    </div>
  );
}
