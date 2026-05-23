import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, AlertTriangle, Clock, Users, ArrowUpRight,
  CheckCircle2, Award,
  Timer, Gauge, Activity, AlertCircle, AlertOctagon
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Card, StatCard } from '../../components/common/Card';
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

export function TutorAnalyticsPage() {
  const { dbId } = useAuthStore();
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [students, setStudents] = useState<DbUser[]>([]);
  const [analyticsMap, setAnalyticsMap] = useState<Record<string, AnalyticsData>>({});
  const [loading, setLoading] = useState(true);

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

  // Pacing scatter — only meaningful for specific student
  const pacingData = useMemo(() => {
    if (!currentAnalytics) return [];
    return currentAnalytics.questionPacingStats.map((q) => ({
      qNum: q.questionIndex,
      timeSpent: q.timeSpentSeconds,
      topic: q.topicName,
      correct: q.status === 'correct',
    }));
  }, [currentAnalytics]);

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
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-semibold hidden md:inline">Focus Student:</span>
          <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Students (Aggregate)</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
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
              <Badge variant="info" className="bg-blue-50 text-blue-700 border-blue-100 font-bold text-[9px] uppercase tracking-wider flex items-center gap-1">
                <Gauge size={10} /> PACING ENGINE
              </Badge>
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
                  <div className="lg:col-span-2 bg-slate-50/30 p-3 border border-slate-100 rounded-xl shadow-xs">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                          <Activity size={12} className="text-blue-500" />
                          Pacing Analysis Scatter Plot
                        </h4>
                        <p className="text-[10px] text-slate-400">Time spent on individual questions. Hover points for diagnostic details.</p>
                      </div>
                    </div>
                    <div className="h-[200px] w-full bg-white border border-slate-100 rounded-lg p-2 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 10, right: 10, bottom: -5, left: -15 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                          <XAxis type="number" dataKey="qNum" name="Question #" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                          <YAxis type="number" dataKey="timeSpent" name="TimeSpent" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} unit="s" />
                          <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '11px' }}
                            formatter={(value: number | string, name: string) => {
                              if (name === 'TimeSpent') return [`${value} seconds`, 'Time Spent'] as [string, string];
                              if (name === 'Question #') return [`Question ${value}`, 'Question'] as [string, string];
                              return [`${value}`, name] as [string, string];
                            }}
                          />
                          <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Target Max Pace (60s)', fill: '#d97706', fontSize: 8, position: 'top' }} />
                          <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Stuck Threshold (90s)', fill: '#dc2626', fontSize: 8, position: 'top' }} />
                          <Scatter name="Solve Pacing" data={pacingData} fill="#3b82f6" shape={renderDot} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
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
    </div>
  );
}
