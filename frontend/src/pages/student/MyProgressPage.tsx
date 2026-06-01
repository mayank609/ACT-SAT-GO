import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Target, Clock, CheckCircle, XCircle, Minus, AlertCircle, Zap, FileSearch } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { TopicAnalysisTable } from '../../components/dashboard/TopicAnalysisTable';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter,
} from 'recharts';

interface Analytics {
  trend: Array<{ date: string; score: number; testTitle: string; attemptId: string }>;
  sectionStats: Array<{
    sectionId: string;
    sectionName: string;
    totalQuestions: number;
    correct: number;
    incorrect: number;
    skipped: number;
    accuracy: number;
    timeAllocated: number;
    timeUsed: number;
  }>;
  questionPacingStats?: Array<{
    questionIndex: number;
    sectionName: string;
    timeSpentSeconds: number;
    status: 'correct' | 'incorrect' | 'skipped';
    difficulty: string;
    topicName: string;
  }>;
  overallAccuracy: number;
  totalAttempts: number;
  latestScore: number;
  avgScore: number;
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
      <div className="bg-slate-900 text-white p-2.5 rounded-lg text-[11px] shadow-xl border border-slate-800 space-y-1">
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
  pacingStats: Array<{ questionIndex: number; timeSpentSeconds: number; status: string; topicName?: string }>
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

function generateTopicAnalysis(pacingStats: Array<{ topicName?: string; status: string }>) {
  const topicMap: Record<string, { total: number; correct: number }> = {};
  
  pacingStats.forEach((q) => {
    const topic = q.topicName || 'Uncategorized';
    if (!topicMap[topic]) {
      topicMap[topic] = { total: 0, correct: 0 };
    }
    topicMap[topic].total++;
    if (q.status === 'correct') {
      topicMap[topic].correct++;
    }
  });

  return Object.entries(topicMap)
    .map(([topic, data], idx) => ({
      sno: idx + 1,
      topic,
      totalQuestions: data.total,
      correctQuestions: data.correct,
      accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
      avgMistakes: data.total > 0 ? (data.total - data.correct) / data.total : 0,
    }))
    .sort((a, b) => b.accuracy - a.accuracy);
}

export function MyProgressPage() {
  const { dbId } = useAuthStore();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('all');
  const [attempts, setAttempts] = useState<Array<{ id: string; status: string; totalScore: number | null; startedAt: string; completedAt: string | null; test: { title: string; sections: Array<{ _count: { questions: number } }> } }>>([]);

  // Auto-select first section when analytics data changes
  useEffect(() => {
    if (analytics && analytics.questionPacingStats && analytics.questionPacingStats.length > 0) {
      setActiveSection(analytics.questionPacingStats[0].sectionName);
    } else {
      setActiveSection('all');
    }
  }, [analytics]);

  const pacing = analytics?.questionPacingStats ?? [];
  const filteredPacing = activeSection === 'all' ? pacing : pacing.filter(q => q.sectionName === activeSection);

  const timelineData = useMemo(() => {
    return generatePacingTimeline(filteredPacing);
  }, [filteredPacing]);

  const maxQNum = useMemo(() => {
    if (filteredPacing.length === 0) return 27;
    return Math.max(...filteredPacing.map(q => q.questionIndex));
  }, [filteredPacing]);

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

  // Topic analysis - must be called before early returns
  const topicAnalysis = useMemo(() => {
    return generateTopicAnalysis(pacing);
  }, [pacing]);

  useEffect(() => {
    if (!dbId) { setLoading(false); return; }
    Promise.all([
      api.getStudentAnalytics(dbId).then((r) => setAnalytics(r)).catch(() => {}),
      api.getStudentAttempts(dbId).then((r) => setAttempts((r.attempts as any[]).filter(a => a.status === 'SUBMITTED'))).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [dbId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-[#1b3d6e] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!analytics || analytics.totalAttempts === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Target size={24} className="text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">No tests completed yet</h2>
        <p className="text-gray-500 text-sm mb-6">Complete a test to see your performance analytics here.</p>
        <button
          onClick={() => navigate('/my-tests')}
          className="px-5 py-2.5 bg-[#1b3d6e] text-white rounded-lg text-sm font-medium hover:bg-[#15305a] transition-colors"
        >
          Go to My Tests
        </button>
      </div>
    );
  }

  const improvement = analytics.trend.length > 1
    ? analytics.trend[analytics.trend.length - 1].score - analytics.trend[0].score
    : 0;

  const sectionNames = Array.from(new Set(pacing.map(q => q.sectionName)));

  const stuckCount = pacing.filter(q => q.timeSpentSeconds >= 90).length;
  const rushedCount = pacing.filter(q => q.timeSpentSeconds < 20 && q.status !== 'skipped').length;
  const avgTime = pacing.length > 0 ? Math.round(pacing.reduce((a, q) => a + q.timeSpentSeconds, 0) / pacing.length) : 0;

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Page title */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">My Progress</h1>
        <p className="text-gray-500 text-sm mt-0.5">{analytics.totalAttempts} test{analytics.totalAttempts !== 1 ? 's' : ''} completed</p>
      </div>

      {/* ── SCORE SUMMARY ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Latest Score', value: analytics.latestScore || '—',
            sub: improvement !== 0 ? `${improvement > 0 ? '+' : ''}${improvement} from first` : 'first attempt',
            color: 'text-[#1b3d6e]', icon: <TrendingUp size={16} />,
          },
          {
            label: 'Average Score', value: analytics.avgScore || '—',
            sub: `over ${analytics.totalAttempts} tests`, color: 'text-emerald-700', icon: <Target size={16} />,
          },
          {
            label: 'Accuracy', value: `${analytics.overallAccuracy}%`,
            sub: 'overall correct', color: 'text-purple-700', icon: <CheckCircle size={16} />,
          },
          {
            label: 'Tests Done', value: analytics.totalAttempts,
            sub: 'submitted', color: 'text-amber-700', icon: <Clock size={16} />,
          },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4">
            <div className={`flex items-center gap-1.5 text-xs font-medium mb-2 ${s.color}`}>
              {s.icon} {s.label}
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── SCORE TREND ────────────────────────────────────────────────── */}
      {analytics.trend.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Score Trend</h2>
              <p className="text-xs text-gray-400 mt-0.5">Composite score across all attempts</p>
            </div>
            {improvement !== 0 && (
              <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${improvement > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {improvement > 0 ? '+' : ''}{improvement} pts
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={analytics.trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 36]} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                formatter={(v, _n, p) => [v, p.payload?.testTitle ?? 'Score']}
              />
              <Line type="monotone" dataKey="score" stroke="#1b3d6e" strokeWidth={2.5}
                dot={{ fill: '#1b3d6e', r: 4, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, fill: '#1b3d6e', stroke: '#fff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── SECTION PERFORMANCE ────────────────────────────────────────── */}
      {analytics.sectionStats.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Section Performance</h2>
          <div className="space-y-4">
            {analytics.sectionStats.map((s) => (
              <div key={s.sectionId}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{s.sectionName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      s.accuracy >= 80 ? 'bg-emerald-50 text-emerald-700' :
                      s.accuracy >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
                    }`}>
                      {s.accuracy >= 80 ? 'Strong' : s.accuracy >= 60 ? 'Average' : 'Needs Work'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><CheckCircle size={11} className="text-emerald-500" /> {s.correct}</span>
                    <span className="flex items-center gap-1"><XCircle size={11} className="text-red-400" /> {s.incorrect}</span>
                    <span className="flex items-center gap-1"><Minus size={11} className="text-gray-400" /> {s.skipped}</span>
                    <span className={`font-semibold ${s.accuracy >= 80 ? 'text-emerald-700' : s.accuracy >= 60 ? 'text-amber-700' : 'text-red-600'}`}>
                      {s.accuracy.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${s.accuracy >= 80 ? 'bg-emerald-500' : s.accuracy >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${s.accuracy}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PACING ANALYSIS ────────────────────────────────────────────── */}
      {pacing.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Pacing Analysis</h2>
              <p className="text-xs text-gray-400 mt-0.5">Time spent per question on your latest test</p>
            </div>
            {/* Section filter */}
            <div className="flex gap-1">
              {['all', ...sectionNames].map((s) => (
                <button key={s} onClick={() => setActiveSection(s)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${activeSection === s ? 'bg-[#1b3d6e] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>

          {/* Pacing stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{avgTime}s</p>
              <p className="text-xs text-gray-500 mt-0.5">avg / question</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-red-600 flex items-center justify-center gap-1">
                <AlertCircle size={16} /> {stuckCount}
              </p>
              <p className="text-xs text-red-500 mt-0.5">stuck ≥ 90s</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-amber-600 flex items-center justify-center gap-1">
                <Zap size={16} /> {rushedCount}
              </p>
              <p className="text-xs text-amber-500 mt-0.5">rushed &lt; 20s</p>
            </div>
          </div>

          {/* Pacing Timeline Chart */}
          {activeSection === 'all' ? (
            <div className="p-8 text-center border border-gray-100 rounded-xl bg-gray-50/30 mb-6">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 text-blue-600 mb-2">
                <Clock size={20} />
              </div>
              <h4 className="text-sm font-semibold text-gray-900">Select a section to view pacing timeline</h4>
              <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                Pacing is tracked individually per section. Choose a section above to see the chronological visit-by-visit question analysis.
              </p>
            </div>
          ) : (
            <div className="mb-6 flex flex-col items-center">
              {/* Section Name Title at the top center */}
              <div className="text-center font-bold text-xs text-gray-700 mb-1 select-none">
                {activeSection === 'all' ? 'All Sections' : activeSection}
              </div>

              {/* Legend at the top, below section title */}
              <div className="flex justify-center items-center gap-4 mb-3 text-[10px] font-bold text-gray-500 select-none">
                <div className="flex items-center gap-1.5"><span className="w-3.5 h-2 rounded-sm bg-[#80245a]" /> Visit 1</div>
                <div className="flex items-center gap-1.5"><span className="w-3.5 h-2 rounded-sm bg-[#3b82f6]" /> Visit 2</div>
                <div className="flex items-center gap-1.5"><span className="w-3.5 h-2 rounded-sm bg-[#22c55e]" /> Visit 3</div>
                <div className="flex items-center gap-1.5"><span className="w-3.5 h-2 rounded-sm bg-[#6366f1]" /> Visit 4</div>
              </div>

              {/* Main Chart with Y-axis label */}
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

                {/* Scatter Chart */}
                <div className="flex-1 h-[360px] bg-white border border-gray-100 rounded-xl p-2 relative">
                  {timelineData.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                      <Clock size={24} className="text-gray-300 mb-2" />
                      <p className="text-sm font-semibold text-gray-500">No timing data recorded</p>
                      <p className="text-xs text-gray-400 mt-1 max-w-xs text-center">
                        This section has no time-per-question data. Complete a timed test to see the pacing timeline here.
                      </p>
                    </div>
                  ) : (
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
                        <Scatter name="Solve Pacing" data={timelineData} shape={<CustomBarShape />} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Horizontal Axis Label "Time(in min)" at the bottom */}
              <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none mt-2">
                Time(in min)
              </div>
            </div>
          )}

          {/* Question log table */}
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['#', 'Section', 'Topic', 'Time', 'Result'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredPacing.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">No data</td></tr>
                ) : filteredPacing.map((q) => {
                  const isStuck = q.timeSpentSeconds >= 90;
                  const isRushed = q.timeSpentSeconds < 20 && q.status !== 'skipped';
                  return (
                    <tr key={q.questionIndex} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 font-semibold text-gray-700">Q{q.questionIndex}</td>
                      <td className="px-3 py-2.5 text-gray-500">{q.sectionName}</td>
                      <td className="px-3 py-2.5 text-gray-700">{q.topicName || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={`font-bold ${isStuck ? 'text-red-600' : isRushed ? 'text-amber-600' : 'text-gray-700'}`}>
                          {q.timeSpentSeconds}s
                        </span>
                        {isStuck && <span className="ml-1 text-red-400 text-[10px]">stuck</span>}
                        {isRushed && <span className="ml-1 text-amber-400 text-[10px]">rushed</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 font-medium capitalize ${
                          q.status === 'correct' ? 'text-emerald-600' :
                          q.status === 'incorrect' ? 'text-red-500' : 'text-gray-400'
                        }`}>
                          {q.status === 'correct' ? <CheckCircle size={11} /> : q.status === 'incorrect' ? <XCircle size={11} /> : <Minus size={11} />}
                          {q.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TEST ATTEMPTS ──────────────────────────────────────────────── */}
      {attempts.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Your Test Attempts</h2>
            <p className="text-xs text-gray-400 mt-0.5">Click "Review Questions" to see every question — correct, wrong, and skipped</p>
          </div>
          <div className="divide-y divide-gray-50">
            {attempts.map((attempt) => {
              const totalQ = attempt.test.sections.reduce((a, s) => a + s._count.questions, 0);
              return (
                <div key={attempt.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{attempt.test.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {attempt.completedAt
                        ? new Date(attempt.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : new Date(attempt.startedAt).toLocaleDateString()}
                      {' · '}{totalQ} questions
                    </p>
                  </div>
                  {attempt.totalScore !== null && (
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-bold text-[#1b3d6e]">{attempt.totalScore}</p>
                      <p className="text-[10px] text-gray-400">score</p>
                    </div>
                  )}
                  <button
                    onClick={() => navigate(`/test-review/${attempt.id}`)}
                    className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-[#1b3d6e] bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
                  >
                    <FileSearch size={13} /> Review Questions
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Topic-wise Analysis */}
      {topicAnalysis.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Topic-Wise Performance</h2>
          <TopicAnalysisTable data={topicAnalysis} loading={loading} />
        </div>
      )}
    </div>
  );
}
