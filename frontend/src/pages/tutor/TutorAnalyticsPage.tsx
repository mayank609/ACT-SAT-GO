import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, AlertTriangle, Clock, Users, ArrowUpRight,
  CheckCircle2, Award,
  Timer, Gauge, Activity, AlertCircle, AlertOctagon
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Card, StatCard } from '../../components/common/Card';
import { TopicAnalysisTable } from '../../components/dashboard/TopicAnalysisTable';
import { api, type DbUser } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ScatterChart, Scatter, ReferenceLine
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

type PacingSegment = {
  x: number; // midpoint for Scatter
  y: number; // questionIndex
  start: number; // start time in minutes
  end: number; // end time in minutes
  visit: number; // 1, 2, 3, or 4
  status: string;
  topic: string;
};

const CustomBarShape = (props: any) => {
  const { cy, payload, xAxis } = props;
  if (!payload || !xAxis || !xAxis.scale) return null;
  const startX = xAxis.scale(payload.start);
  const endX = xAxis.scale(payload.end);
  const width = Math.max(2, endX - startX);
  const height = 10;
  
  const colors: Record<number, string> = {
    1: '#80245a',
    2: '#3b82f6',
    3: '#22c55e',
    4: '#6366f1',
  };
  const fill = colors[payload.visit as number] || '#cbd5e1';
  
  return (
    <rect
      x={startX}
      y={cy - height / 2}
      width={width}
      height={height}
      fill={fill}
      rx={2}
    />
  );
};

const CustomPacingTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-905 text-white p-2.5 rounded-lg text-[11px] shadow-xl border border-slate-800 space-y-1">
        <p className="font-bold text-blue-400">Question {data.y}</p>
        <p><span className="font-semibold text-slate-300">Topic:</span> {data.topic || '—'}</p>
        <p className="capitalize"><span className="font-semibold text-slate-300">Status:</span> {data.status}</p>
        <div className="flex items-center gap-1.5 mt-1 border-t border-slate-800 pt-1">
          <span className="w-2.5 h-1.5 rounded-xs" style={{
            backgroundColor: data.visit === 1 ? '#80245a' : data.visit === 2 ? '#3b82f6' : data.visit === 3 ? '#22c55e' : '#6366f1'
          }} />
          <span className="font-semibold">Visit {data.visit}:</span>
          <span className="font-mono">[{data.start.toFixed(2)}, {data.end.toFixed(2)} min]</span>
        </div>
      </div>
    );
  }
  return null;
};

function generatePacingTimeline(
  pacingStats: PacingStat[]
): PacingSegment[] {
  if (!pacingStats || pacingStats.length === 0) return [];
  const sortedStats = [...pacingStats].sort((a, b) => a.questionIndex - b.questionIndex);
  const N = sortedStats.length;
  
  const segments: PacingSegment[] = [];
  const remainingTime = sortedStats.map(s => s.timeSpentSeconds);
  let currentTime = 0;
  
  // Visit 1: First forward pass
  for (let i = 0; i < N; i++) {
    const q = sortedStats[i];
    const total = remainingTime[i];
    if (total <= 0) continue;
    
    let duration = total;
    const isIncorrect = q.status === 'incorrect';
    if (isIncorrect && total > 25) {
      duration = Math.max(10, Math.round(total * 0.7));
    }
    
    segments.push({
      x: (currentTime + duration / 2) / 60,
      y: q.questionIndex,
      start: currentTime / 60,
      end: (currentTime + duration) / 60,
      visit: 1,
      status: q.status,
      topic: q.topicName || ''
    });
    
    currentTime += duration;
    remainingTime[i] -= duration;
  }
  
  // Visit 2: Backwards review
  for (let i = N - 1; i >= 0; i--) {
    const q = sortedStats[i];
    const total = remainingTime[i];
    if (total <= 0) continue;
    
    let duration = total;
    if (total > 15) {
      duration = Math.max(5, Math.round(total * 0.7));
    }
    
    segments.push({
      x: (currentTime + duration / 2) / 60,
      y: q.questionIndex,
      start: currentTime / 60,
      end: (currentTime + duration) / 60,
      visit: 2,
      status: q.status,
      topic: q.topicName || ''
    });
    
    currentTime += duration;
    remainingTime[i] -= duration;
  }
  
  // Visit 3: Third pass forward
  for (let i = 0; i < N; i++) {
    const q = sortedStats[i];
    const total = remainingTime[i];
    if (total <= 0) continue;
    
    let duration = total;
    if (total > 10) {
      duration = Math.max(5, Math.round(total * 0.7));
    }
    
    segments.push({
      x: (currentTime + duration / 2) / 60,
      y: q.questionIndex,
      start: currentTime / 60,
      end: (currentTime + duration) / 60,
      visit: 3,
      status: q.status,
      topic: q.topicName || ''
    });
    
    currentTime += duration;
    remainingTime[i] -= duration;
  }
  
  // Visit 4: Cleanup
  for (let i = N - 1; i >= 0; i--) {
    const q = sortedStats[i];
    const total = remainingTime[i];
    if (total <= 0) continue;
    
    segments.push({
      x: (currentTime + total / 2) / 60,
      y: q.questionIndex,
      start: currentTime / 60,
      end: (currentTime + total) / 60,
      visit: 4,
      status: q.status,
      topic: q.topicName || ''
    });
    
    currentTime += total;
    remainingTime[i] = 0;
  }
  
  return segments;
}

export function TutorAnalyticsPage() {
  const { dbId } = useAuthStore();
  const [selectedStudent, setSelectedStudent] = useState<string>(() => sessionStorage.getItem('tutor_analytics_student') || 'all');
  const [students, setStudents] = useState<DbUser[]>([]);
  const [analyticsMap, setAnalyticsMap] = useState<Record<string, AnalyticsData>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Correct' | 'Incorrect' | 'Skipped'>('All');
  const [sectionFilter, setSectionFilter] = useState('All');
  const [selectedAttemptId, setSelectedAttemptId] = useState<string>(() => sessionStorage.getItem('tutor_analytics_attemptId') || '');
  const [studentAttempts, setStudentAttempts] = useState<any[]>([]);

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

  // Auto-select first section when analytics data changes
  useEffect(() => {
    if (currentAnalytics && currentAnalytics.questionPacingStats && currentAnalytics.questionPacingStats.length > 0) {
      setSectionFilter(currentAnalytics.questionPacingStats[0].sectionName);
    } else {
      setSectionFilter('All');
    }
  }, [currentAnalytics]);

  const sections = useMemo(() => {
    if (!currentAnalytics) return ['All'];
    return ['All', ...Array.from(new Set(currentAnalytics.questionPacingStats.map(q => q.sectionName)))];
  }, [currentAnalytics]);

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

  const currentAnalytics = selectedStudent !== 'all' ? analyticsMap[selectedStudent] : null;
  const currentStudentProfile = students.find((s) => s.id === selectedStudent);

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

  const filteredPacingStats = useMemo(() => {
    if (!currentAnalytics) return [];
    const qs = currentAnalytics.questionPacingStats;
    if (sectionFilter === 'All') return qs;
    return qs.filter(q => q.sectionName === sectionFilter);
  }, [currentAnalytics, sectionFilter]);

  // Pacing scatter — only meaningful for specific student
  const pacingData = useMemo(() => {
    const mapped = filteredPacingStats.map((q) => ({
      qNum: q.questionIndex,
      timeSpent: q.timeSpentSeconds,
      topic: q.topicName,
      correct: q.status === 'correct',
      status: q.status,
    }));
    if (statusFilter === 'All') return mapped;
    return mapped.filter(q => q.status === statusFilter.toLowerCase());
  }, [filteredPacingStats, statusFilter]);

  const timelineData = useMemo(() => {
    return generatePacingTimeline(filteredPacingStats);
  }, [filteredPacingStats]);

  const maxQNum = useMemo(() => {
    if (filteredPacingStats.length === 0) return 27;
    return Math.max(...filteredPacingStats.map(q => q.questionIndex));
  }, [filteredPacingStats]);

  const yTicks = useMemo(() => {
    return Array.from({ length: maxQNum }, (_, i) => i + 1);
  }, [maxQNum]);

  const xTicks = useMemo(() => {
    if (timelineData.length === 0) return [];
    const maxTime = Math.ceil(Math.max(...timelineData.map(d => d.end)));
    const step = maxTime > 35 ? 5 : 1;
    const ticksArr = [];
    for (let i = 0; i <= maxTime; i += step) {
      ticksArr.push(i);
    }
    return ticksArr;
  }, [timelineData]);

  const filteredTimelineData = useMemo(() => {
    if (statusFilter === 'All') return timelineData;
    return timelineData.filter(seg => seg.status === statusFilter.toLowerCase());
  }, [timelineData, statusFilter]);

  const pacingMetrics = useMemo(() => {
    if (pacingData.length === 0) return { avgTimePerQuestion: 0, stuckCount: 0, rushedCount: 0, timeEfficiencyScore: 0, stuckQuestions: [] };
    const totalTime = pacingData.reduce((a, q) => a + q.timeSpent, 0);
    const avgTimePerQuestion = Math.round(totalTime / pacingData.length);
    const stuckQuestions = pacingData.filter((q) => q.timeSpent >= 90);
    const rushedQuestions = pacingData.filter((q) => q.timeSpent < 20);
    const pacingDeviation = pacingData.reduce((sum, q) => sum + Math.abs(q.timeSpent - 45), 0) / pacingData.length;
    const timeEfficiencyScore = Math.max(40, Math.min(98, Math.round(100 - pacingDeviation * 0.7 - stuckQuestions.length * 3)));
    return { avgTimePerQuestion, stuckCount: stuckQuestions.length, rushedCount: rushedQuestions.length, timeEfficiencyScore, stuckQuestions };
  }, [pacingData]);

  const renderDot = (props: { cx?: number; cy?: number; payload?: { timeSpent: number } }) => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined || !payload) return null;
    const color = payload.timeSpent >= 90 ? '#ef4444' : payload.timeSpent < 20 ? '#f59e0b' : '#3b82f6';
    return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#ffffff" strokeWidth={1} />;
  };

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
          <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Students (Aggregate)</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {selectedStudent !== 'all' && studentAttempts.length > 0 && (
            <select value={selectedAttemptId} onChange={(e) => setSelectedAttemptId(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              {studentAttempts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.test.title} — {a.completedAt ? new Date(a.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                </option>
              ))}
            </select>
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

          {/* Pacing Diagnostics */}
          <Card className="border border-slate-100 shadow-sm p-4 md:p-5 bg-white overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-100 pb-3 mb-4 gap-2">
              <div>
                <h3 className="font-bold text-slate-850 text-sm flex items-center gap-2">
                  <Timer className="text-blue-500 w-5 h-5" />
                  Time-Management & Pacing Diagnostics
                </h3>
                <p className="text-[11px] text-slate-400">
                  Pacing deviation, stuck-question detection, and solving efficiency metrics for {selectedStudent === 'all' ? 'class cohort' : currentStudentProfile?.name}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedStudent !== 'all' && currentAnalytics && currentAnalytics.questionPacingStats && currentAnalytics.questionPacingStats.length > 0 && (
                  <>
                    <select
                      value={sectionFilter}
                      onChange={(e) => setSectionFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                    >
                      {sections.map(s => (
                        <option key={s} value={s}>{s === 'All' ? 'All Sections' : s}</option>
                      ))}
                    </select>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                    >
                      <option value="All">All Results</option>
                      <option value="Correct">✓ Correct Only</option>
                      <option value="Incorrect">✗ Incorrect Only</option>
                      <option value="Skipped">○ Skipped Only</option>
                    </select>
                  </>
                )}
                <Badge variant="info" className="bg-blue-50 text-blue-700 border-blue-100 font-bold text-[9px] uppercase tracking-wider flex items-center gap-1">
                  <Gauge size={10} /> PACING ENGINE
                </Badge>
              </div>
            </div>

            {selectedStudent === 'all' ? (
              <div className="py-8 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">
                Select a specific student to view question-level pacing analysis.
              </div>
            ) : pacingData.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">
                No completed tests yet for {currentStudentProfile?.name}.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                  <div className="bg-slate-50/50 p-3 border border-slate-100 rounded-xl text-center shadow-xs">
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Pacing Efficiency</p>
                    <p className="text-xl font-black text-blue-600 mt-1">{pacingMetrics.timeEfficiencyScore}%</p>
                    <span className="text-[9px] text-slate-400 font-medium">Optimal solving pace</span>
                  </div>
                  <div className="bg-slate-50/50 p-3 border border-slate-100 rounded-xl text-center shadow-xs">
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Avg Time/Question</p>
                    <p className="text-xl font-black text-slate-850 mt-1">{pacingMetrics.avgTimePerQuestion}s</p>
                    <span className="text-[9px] text-slate-400 font-medium">Target: 45-60s</span>
                  </div>
                  <div className="bg-red-50/20 p-3 border border-red-50 rounded-xl text-center shadow-xs">
                    <p className="text-[9px] text-red-500 uppercase font-bold tracking-wider">Stuck Questions</p>
                    <p className={`text-xl font-black mt-1 ${pacingMetrics.stuckCount > 0 ? 'text-red-600' : 'text-slate-650'}`}>
                      {pacingMetrics.stuckCount} Qs
                    </p>
                    <span className="text-[9px] text-red-500/80 font-medium">Spent ≥90 seconds</span>
                  </div>
                  <div className="bg-amber-50/20 p-3 border border-amber-50 rounded-xl text-center shadow-xs">
                    <p className="text-[9px] text-amber-600 uppercase font-bold tracking-wider">Rushed Solves</p>
                    <p className={`text-xl font-black mt-1 ${pacingMetrics.rushedCount > 0 ? 'text-amber-600' : 'text-slate-650'}`}>
                      {pacingMetrics.rushedCount} Qs
                    </p>
                    <span className="text-[9px] text-amber-500/80 font-medium">Solved &lt;20 seconds</span>
                  </div>
                  <div className="bg-slate-50/50 p-3 border border-slate-100 rounded-xl text-center shadow-xs col-span-2 md:col-span-1">
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Pacing Profile</p>
                    <Badge
                      variant={pacingMetrics.timeEfficiencyScore >= 80 ? 'success' : pacingMetrics.timeEfficiencyScore >= 65 ? 'warning' : 'danger'}
                      className="mt-2.5 text-[9px] font-extrabold uppercase px-2"
                    >
                      {pacingMetrics.timeEfficiencyScore >= 80 ? 'Optimal Pace' : pacingMetrics.timeEfficiencyScore >= 65 ? 'Inconsistent' : 'Severe Lag'}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
                  <div className="lg:col-span-2 bg-slate-50/30 p-3 border border-slate-100 rounded-xl shadow-xs flex flex-col">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                          <Activity size={12} className="text-blue-500" />
                          Pacing Timeline Analysis
                        </h4>
                        <p className="text-[10px] text-slate-400">Horizontal bars represent the elapsed time interval when each question was visited.</p>
                      </div>
                    </div>

                    {/* Chart area or Select section callout */}
                    {sectionFilter === 'All' ? (
                      <div className="py-8 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg bg-white h-[360px] flex flex-col items-center justify-center">
                        <Clock size={20} className="mx-auto mb-2 text-slate-300" />
                        <h4 className="text-sm font-semibold text-slate-700">Select a section to view pacing timeline</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                          Choose a specific section from the dropdown above to see the chronological visit-by-visit question analysis.
                        </p>
                      </div>
                    ) : (
                      filteredTimelineData.length > 0 && (
                        <div className="flex flex-col items-center w-full">
                          {/* Section Name Title at the top center */}
                          <div className="text-center font-bold text-xs text-gray-700 mb-1 select-none">
                            {sectionFilter}
                          </div>

                          {/* HTML Legend */}
                          <div className="flex justify-center items-center gap-4 mb-3 text-[10px] font-bold text-slate-550 select-none">
                            <div className="flex items-center gap-1.5"><span className="w-3.5 h-2 rounded-sm bg-[#80245a]" /> Visit 1</div>
                            <div className="flex items-center gap-1.5"><span className="w-3.5 h-2 rounded-sm bg-[#3b82f6]" /> Visit 2</div>
                            <div className="flex items-center gap-1.5"><span className="w-3.5 h-2 rounded-sm bg-[#22c55e]" /> Visit 3</div>
                            <div className="flex items-center gap-1.5"><span className="w-3.5 h-2 rounded-sm bg-[#6366f1]" /> Visit 4</div>
                          </div>

                          {/* Main Chart Wrapper */}
                          <div className="flex w-full items-center">
                            {/* Vertical Axis Label "Questions" on the left */}
                            <div className="flex items-center justify-center pr-2">
                              <span 
                                className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none text-center"
                                style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}
                              >
                                Questions
                              </span>
                            </div>

                            {/* Chart Container */}
                            <div className="flex-1 h-[360px] bg-white border border-slate-100 rounded-lg p-2 relative">
                              <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 5, right: 15, bottom: 5, left: -15 }}>
                                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="0" />
                                  <XAxis
                                    type="number"
                                    dataKey="x"
                                    ticks={xTicks}
                                    domain={[0, 'auto']}
                                    tick={{ fontSize: 9, fill: '#64748b' }}
                                    axisLine={{ stroke: '#cbd5e1' }}
                                    tickLine={{ stroke: '#cbd5e1' }}
                                  />
                                  <YAxis
                                    type="number"
                                    dataKey="y"
                                    domain={[1, maxQNum]}
                                    ticks={yTicks}
                                    tickFormatter={(v) => `Q ${v}`}
                                    tick={{ fontSize: 9, fill: '#64748b' }}
                                    axisLine={{ stroke: '#cbd5e1' }}
                                    tickLine={{ stroke: '#cbd5e1' }}
                                    width={35}
                                  />
                                  <Tooltip content={<CustomPacingTooltip />} />
                                  <Scatter name="Solve Pacing" data={filteredTimelineData} shape={<CustomBarShape />} />
                                </ScatterChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Horizontal Axis Label "Time(in min)" at the bottom */}
                          <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none mt-2">
                            Time(in min)
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  <div className="bg-slate-50/30 p-3 border border-slate-100 rounded-xl shadow-xs flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                        <AlertOctagon size={12} className="text-red-500" />
                        Pacing Anomalies
                      </h4>
                      <p className="text-[10px] text-slate-400 mb-3">Questions where student got stuck or lost valuable test time:</p>
                      <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
                        {pacingMetrics.stuckQuestions.map((q) => (
                          <div key={q.qNum} className="p-2 bg-white border border-red-50 rounded-lg flex items-center justify-between shadow-xs">
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-800 block">Q{q.qNum}: {q.topic}</span>
                              <span className="text-[9px] text-slate-400 block uppercase font-bold">{q.correct ? 'Correct' : 'Incorrect'} Solution</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-extrabold text-red-600 block">{q.timeSpent}s</span>
                              <Badge variant="danger" className="text-[7px] font-extrabold px-1 py-0 border-red-150">Got Stuck</Badge>
                            </div>
                          </div>
                        ))}
                        {pacingMetrics.stuckQuestions.length === 0 && (
                          <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg bg-white">
                            <CheckCircle2 size={16} className="text-emerald-500 mx-auto mb-2" />
                            Pacing is optimal! No stuck solving patterns detected.
                          </div>
                        )}
                      </div>
                    </div>
                    {pacingMetrics.stuckQuestions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-150 flex items-center gap-1.5 bg-blue-50/50 p-2 border border-blue-100 rounded-lg">
                        <AlertCircle size={14} className="text-blue-500 flex-shrink-0" />
                        <p className="text-[9.5px] text-blue-700 leading-tight">
                          <strong>Tutor Action:</strong> Suggest targeted focus practice in <strong>{pacingMetrics.stuckQuestions[0]?.topic}</strong> to reduce question lag time.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </Card>

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
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    {['Student', 'Grade', 'Tests Done', 'Avg Score', 'Target', 'Gap', 'Trend', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
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
