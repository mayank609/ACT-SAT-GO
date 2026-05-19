import { useState, useEffect } from 'react';
import { TrendingUp, Target, Clock, Award, Zap, AlertCircle } from 'lucide-react';
import { StatCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, ScatterChart, Scatter, ReferenceLine, Label
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

export function MyProgressPage() {
  const { dbId } = useAuthStore();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [sectionFilter, setSectionFilter] = useState('All');
  const [paceFilter, setPaceFilter] = useState('All');

  useEffect(() => {
    if (!dbId) { setLoading(false); return; }
    api.getStudentAnalytics(dbId)
      .then((r) => setAnalytics(r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dbId]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-slate-400 text-sm">Loading...</div></div>;
  }

  if (!analytics || analytics.totalAttempts === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">My Progress</h1>
          <p className="text-slate-500 text-sm mt-0.5">Detailed analytics of your performance</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
          <Target size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No tests completed yet</p>
          <p className="text-slate-400 text-sm mt-1">Complete a test to see your progress analytics here.</p>
        </div>
      </div>
    );
  }

  const sectionData = analytics.sectionStats.map((s) => ({
    name: s.sectionName,
    accuracy: s.accuracy,
    timeEfficiency: s.timeAllocated > 0 ? Math.round((s.timeUsed / s.timeAllocated) * 100) : 0,
    correct: s.correct,
    total: s.totalQuestions,
  }));

  const improvement = analytics.trend.length > 1
    ? analytics.trend[analytics.trend.length - 1].score - analytics.trend[0].score
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My Progress</h1>
        <p className="text-slate-500 text-sm mt-0.5">Detailed analytics of your performance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Latest Score" value={analytics.latestScore || '—'} subtitle="ACT composite" icon={<TrendingUp size={18} />} color="blue"
          trend={improvement > 0 ? { value: improvement, positive: true } : undefined} />
        <StatCard title="Avg Score" value={analytics.avgScore || '—'} subtitle={`${analytics.totalAttempts} tests`} icon={<Target size={18} />} color="emerald" />
        <StatCard title="Overall Accuracy" value={`${analytics.overallAccuracy}%`} subtitle="last test" icon={<Award size={18} />} color="purple" />
        <StatCard title="Tests Done" value={analytics.totalAttempts} subtitle="submitted" icon={<Clock size={18} />} color="amber" />
      </div>

      {analytics.trend.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Score History</h3>
              <p className="text-sm text-slate-500">ACT composite score over time</p>
            </div>
            {improvement !== 0 && (
              <div className="text-right">
                <p className={`text-3xl font-bold ${improvement > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {improvement > 0 ? '+' : ''}{improvement}
                </p>
                <p className="text-xs text-slate-500">improvement</p>
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={analytics.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 36]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                formatter={(v, n, p) => [v, p.payload?.testTitle ?? n]} />
              <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3}
                dot={{ fill: '#3b82f6', r: 5, strokeWidth: 2, stroke: '#fff' }} name="Score" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {sectionData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Section Performance</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sectionData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="accuracy" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Accuracy %" barSize={28} />
              <Bar dataKey="timeEfficiency" fill="#10b981" radius={[4, 4, 0, 0]} name="Time Used %" barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {sectionData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Section Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Section', 'Correct/Total', 'Skipped', 'Accuracy', 'Time Used', 'Strength'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {analytics.sectionStats.map((s) => (
                  <tr key={s.sectionId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.sectionName}</td>
                    <td className="px-4 py-3 text-slate-700">{s.correct}/{s.totalQuestions}</td>
                    <td className="px-4 py-3 text-slate-500">{s.skipped}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${s.accuracy >= 80 ? 'bg-emerald-500' : s.accuracy >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${s.accuracy}%` }} />
                        </div>
                        <span className="font-medium text-slate-700">{s.accuracy.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.timeUsed > 0 ? `${Math.round(s.timeUsed / 60)}m` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={s.accuracy >= 80 ? 'success' : s.accuracy >= 60 ? 'warning' : 'danger'} size="sm">
                        {s.accuracy >= 80 ? 'Strong' : s.accuracy >= 60 ? 'Average' : 'Weak'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Time Spent Per Question Pacing Section */}
      {analytics.questionPacingStats && analytics.questionPacingStats.length > 0 && (() => {
        const rawPacing = analytics.questionPacingStats;
        
        // Calculations
        const totalQ = rawPacing.length;
        const totalSeconds = rawPacing.reduce((a, q) => a + q.timeSpentSeconds, 0);
        const avgTime = totalQ > 0 ? Math.round(totalSeconds / totalQ) : 0;
        
        const stuckCount = rawPacing.filter(q => q.timeSpentSeconds >= 90).length;
        const rushedCount = rawPacing.filter(q => q.timeSpentSeconds < 20 && q.status !== 'skipped').length;
        const optimalCount = totalQ - stuckCount - rushedCount;
        
        const pacingScore = totalQ > 0 ? Math.round((optimalCount / totalQ) * 100) : 100;
        
        // Distinct sections list
        const sectionsList = ['All', ...Array.from(new Set(rawPacing.map(q => q.sectionName)))];
        
        // Filtered pacing
        const filteredPacing = rawPacing.filter(q => {
          const matchSection = sectionFilter === 'All' || q.sectionName === sectionFilter;
          const matchPace = paceFilter === 'All' || 
            (paceFilter === 'Stuck' && q.timeSpentSeconds >= 90) ||
            (paceFilter === 'Rushed' && q.timeSpentSeconds < 20 && q.status !== 'skipped') ||
            (paceFilter === 'Optimal' && q.timeSpentSeconds >= 20 && q.timeSpentSeconds < 90);
          return matchSection && matchPace;
        });

        // Scatter dot custom renderer (crashes Recharts in some builds if standard <Cell> is used inside <Scatter>)
        const renderDot = (props: any) => {
          const { cx, cy, payload } = props;
          if (!cx || !cy) return null;
          let color = '#3b82f6'; // Optimal (Blue)
          if (payload.timeSpentSeconds >= 90) color = '#ef4444'; // Stuck (Red)
          else if (payload.timeSpentSeconds < 20 && payload.status !== 'skipped') color = '#f59e0b'; // Rushed (Amber)
          else if (payload.status === 'skipped') color = '#94a3b8'; // Skipped (Gray)
          return (
            <circle 
              key={`dot-${payload.questionIndex}`} 
              cx={cx} 
              cy={cy} 
              r={5} 
              fill={color} 
              stroke="#fff" 
              strokeWidth={1.5} 
            />
          );
        };

        return (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-100 p-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-semibold text-slate-900 text-lg flex items-center gap-2">
                    <Clock className="text-blue-600" size={20} />
                    Time Spent Per Question (Pacing Analysis)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Diagnose stuck times, rushed solving patterns, and question time-traps on your latest test</p>
                </div>

                {/* Section & Pacing filters */}
                <div className="flex flex-wrap gap-2">
                  <select 
                    value={sectionFilter} 
                    onChange={(e) => setSectionFilter(e.target.value)}
                    className="text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                  >
                    {sectionsList.map(s => <option key={s} value={s}>{s} Section</option>)}
                  </select>
                  
                  <select 
                    value={paceFilter} 
                    onChange={(e) => setPaceFilter(e.target.value)}
                    className="text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                  >
                    <option value="All">All Paces</option>
                    <option value="Optimal">Optimal (20s - 90s)</option>
                    <option value="Stuck">Stuck (≥ 90s)</option>
                    <option value="Rushed">Rushed (&lt; 20s)</option>
                  </select>
                </div>
              </div>

              {/* Dynamic pacing metrics grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-50/50 rounded-xl p-3.5 border border-slate-100">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-450">Pacing Speed</p>
                  <p className="text-xl font-extrabold text-slate-800 mt-1">{avgTime}s <span className="text-xs font-medium text-slate-500">/ ques</span></p>
                  <p className="text-[10px] text-slate-450 mt-0.5">Average overall speed</p>
                </div>
                
                <div className="bg-slate-50/50 rounded-xl p-3.5 border border-slate-100">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-450">Pacing Efficiency</p>
                  <p className="text-xl font-extrabold text-blue-600 mt-1">{pacingScore}%</p>
                  <p className="text-[10px] text-slate-450 mt-0.5">Optimal pace ratio</p>
                </div>

                <div className="bg-red-50/20 rounded-xl p-3.5 border border-red-100/40">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-red-700">Time Traps (Stuck)</p>
                    <AlertCircle size={12} className="text-red-500" />
                  </div>
                  <p className="text-xl font-extrabold text-red-600 mt-1">{stuckCount} <span className="text-xs font-medium text-red-400">questions</span></p>
                  <p className="text-[10px] text-red-400 mt-0.5">Spent ≥ 90 seconds</p>
                </div>

                <div className="bg-amber-50/20 rounded-xl p-3.5 border border-amber-100/40">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-amber-700">Rushed Questions</p>
                    <Zap size={12} className="text-amber-500" />
                  </div>
                  <p className="text-xl font-extrabold text-amber-600 mt-1">{rushedCount} <span className="text-xs font-medium text-amber-400">questions</span></p>
                  <p className="text-[10px] text-amber-400 mt-0.5">Solved in &lt; 20 seconds</p>
                </div>
              </div>

              {/* Scatter Plot Chart */}
              <div className="mb-6 bg-slate-50/30 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-bold text-slate-700 mb-3">Pacing Distribution Map</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis 
                        type="number" 
                        dataKey="questionIndex" 
                        name="Question Index" 
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        label={{ value: 'Question Number', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="timeSpentSeconds" 
                        name="Seconds" 
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        label={{ value: 'Seconds Spent', angle: -90, position: 'insideLeft', offset: 0, fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                      />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3', stroke: '#cbd5e1' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            let paceClass = 'Optimal';
                            let classColor = 'text-blue-600';
                            if (data.timeSpentSeconds >= 90) { paceClass = 'Stuck (Time Trap)'; classColor = 'text-red-500'; }
                            else if (data.timeSpentSeconds < 20 && data.status !== 'skipped') { paceClass = 'Rushed'; classColor = 'text-amber-500'; }
                            else if (data.status === 'skipped') { paceClass = 'Skipped'; classColor = 'text-slate-400'; }
                            
                            return (
                              <div className="bg-white p-3 border border-slate-200 rounded-xl shadow-md text-xs space-y-1">
                                <p className="font-bold text-slate-800">Q{data.questionIndex} ({data.sectionName})</p>
                                <p className="text-slate-500">Topic: <span className="font-semibold text-slate-700">{data.topicName}</span></p>
                                <p className="text-slate-500">Difficulty: <span className="font-semibold text-slate-700 capitalize">{data.difficulty}</span></p>
                                <p className="text-slate-500">Time Spent: <span className="font-bold text-slate-800">{data.timeSpentSeconds} seconds</span></p>
                                <p className="text-slate-500">Pace Status: <span className={`font-black ${classColor}`}>{paceClass}</span></p>
                                <p className="text-slate-500">Result: <span className={`font-bold capitalize ${data.status === 'correct' ? 'text-emerald-600' : data.status === 'incorrect' ? 'text-red-500' : 'text-slate-400'}`}>{data.status}</span></p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <ReferenceLine y={60} stroke="#cbd5e1" strokeDasharray="3 3">
                        <Label value="Target Pace (60s)" offset={10} position="insideRight" fill="#94a3b8" fontSize={9} fontWeight={600} />
                      </ReferenceLine>
                      <ReferenceLine y={90} stroke="#fecaca" strokeWidth={1.5}>
                        <Label value="Stuck Warning (90s)" offset={10} position="insideRight" fill="#ef4444" fontSize={9} fontWeight={600} />
                      </ReferenceLine>
                      <Scatter name="Pacing" data={filteredPacing} shape={renderDot} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-[10px] text-slate-500 font-bold border-t border-slate-100/50 pt-2.5">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block border border-white" /> Optimal (20s - 90s)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block border border-white" /> Stuck / Trap (≥ 90s)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block border border-white" /> Rushed (&lt; 20s)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block border border-white" /> Skipped</span>
                </div>
              </div>

              {/* Timing log details table */}
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-700">Question Timeline Log ({filteredPacing.length} of {totalQ} questions)</p>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50/30 border-b border-slate-100">
                        {['Q#', 'Section', 'Skill Topic', 'Difficulty', 'Time Spent', 'Pacing Status', 'Outcome'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredPacing.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-400">No questions match the current filters</td>
                        </tr>
                      ) : (
                        filteredPacing.map(q => {
                          let paceBadge = <Badge variant="success" size="sm">Optimal</Badge>;
                          if (q.timeSpentSeconds >= 90) {
                            paceBadge = <Badge variant="danger" size="sm" className="bg-red-50 text-red-700 border-red-200">Stuck (Trap)</Badge>;
                          } else if (q.timeSpentSeconds < 20 && q.status !== 'skipped') {
                            paceBadge = <Badge variant="warning" size="sm" className="bg-amber-50 text-amber-700 border-amber-200">Rushed</Badge>;
                          } else if (q.status === 'skipped') {
                            paceBadge = <Badge variant="default" size="sm">Skipped</Badge>;
                          }
                          
                          return (
                            <tr key={`row-${q.questionIndex}`} className="hover:bg-blue-50/10 transition-colors">
                              <td className="px-4 py-2.5 font-bold text-slate-800">Q{q.questionIndex}</td>
                              <td className="px-4 py-2.5 text-slate-500 font-medium">{q.sectionName}</td>
                              <td className="px-4 py-2.5 text-slate-700 font-bold">{q.topicName}</td>
                              <td className="px-4 py-2.5 font-semibold text-slate-500 capitalize">{q.difficulty}</td>
                              <td className="px-4 py-2.5 font-extrabold text-slate-800">{q.timeSpentSeconds}s</td>
                              <td className="px-4 py-2.5">{paceBadge}</td>
                              <td className="px-4 py-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                  q.status === 'correct' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  q.status === 'incorrect' ? 'bg-red-50 text-red-700 border border-red-200' :
                                  'bg-slate-100 text-slate-500'
                                }`}>
                                  {q.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
