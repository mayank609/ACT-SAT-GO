import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Clock, Target, BookOpen } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { StatCard } from '../../components/common/Card';
import { MOCK_STUDENTS, MOCK_ANALYTICS, MOCK_TRENDS } from '../../data/mockData';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar, Legend
} from 'recharts';

const topicRadarData = [
  { topic: 'Algebra', score: 87 },
  { topic: 'Grammar', score: 82 },
  { topic: 'Reading', score: 77 },
  { topic: 'Science', score: 73 },
  { topic: 'Geometry', score: 65 },
  { topic: 'Trig', score: 60 },
];

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const student = MOCK_STUDENTS.find((s) => s.id === id) ?? MOCK_STUDENTS[0];

  const gap = (student.targetScore || 36) - (student.avgScore || 0);
  const pct = Math.min(100, ((student.avgScore || 0) / (student.targetScore || 36)) * 100);

  const sectionData = MOCK_ANALYTICS.sections.map((s) => ({
    name: s.sectionName,
    accuracy: s.accuracy,
    timeEfficiency: Math.round((s.timeUsed / s.timeAllocated) * 100),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{student.name}</h1>
          <p className="text-slate-500 text-sm">{student.email} · {student.grade ? `Grade ${student.grade}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">Send Message</Button>
          <Button size="sm" icon={<BookOpen size={14} />}>Assign Test</Button>
        </div>
      </div>

      {/* Student profile card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700 text-2xl font-bold flex-shrink-0">
            {student.name.charAt(0)}
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Current Score</p>
              <p className="text-2xl font-bold text-slate-900">{student.avgScore ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Target Score</p>
              <p className="text-2xl font-bold text-blue-600">{student.targetScore ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Gap to Target</p>
              <p className={`text-2xl font-bold ${gap > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {gap > 0 ? `+${gap}` : gap}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Tests Done</p>
              <p className="text-2xl font-bold text-slate-900">{student.testsAttempted ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Progress</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pct >= 85 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-slate-700">{pct.toFixed(0)}%</span>
              </div>
              <Badge variant={pct >= 85 ? 'success' : pct >= 70 ? 'warning' : 'danger'} className="mt-1" size="sm">
                {pct >= 85 ? 'On Track' : pct >= 70 ? 'Progressing' : 'Needs Help'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Overall Accuracy" value={`${MOCK_ANALYTICS.overallAccuracy}%`} icon={<TrendingUp size={18} />} color="blue" trend={{ value: 5, positive: true }} />
        <StatCard title="Time Management" value="93%" subtitle="Time used vs allocated" icon={<Clock size={18} />} color="emerald" />
        <StatCard title="Percentile" value={`${MOCK_ANALYTICS.percentile}th`} subtitle="compared to all students" icon={<Target size={18} />} color="purple" />
        <StatCard title="Last Test Score" value="28" subtitle="ACT composite" icon={<BookOpen size={18} />} color="amber" trend={{ value: 4, positive: true }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Score Progress</h3>
          <p className="text-sm text-slate-500 mb-4">Test-by-test improvement</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={MOCK_TRENDS}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[20, 36]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                labelFormatter={(l) => `Date: ${l}`} />
              <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 5 }} name="Score" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Radar */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Skill Profile</h3>
          <p className="text-sm text-slate-500 mb-4">Strength by topic area</p>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={topicRadarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="topic" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Section breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-1">Section Analysis</h3>
        <p className="text-sm text-slate-500 mb-4">Accuracy and time efficiency per section</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={sectionData} barGap={6}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="accuracy" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Accuracy %" barSize={28} />
            <Bar dataKey="timeEfficiency" fill="#10b981" radius={[4, 4, 0, 0]} name="Time Used %" barSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Test history */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Test History</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {MOCK_TRENDS.map((trend, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <BookOpen size={16} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">{trend.testTitle}</p>
                <p className="text-xs text-slate-500">{trend.date}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-900">{trend.score}</p>
                <p className="text-xs text-slate-500">composite</p>
              </div>
              <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(trend.score / 36) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weak topics */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
          <span>⚠️</span> Focus Areas for Tutoring
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {MOCK_ANALYTICS.sections.flatMap((s) =>
            s.topicBreakdown.filter((t) => t.accuracy < 75).map((t) => (
              <div key={t.topic} className="bg-white rounded-xl p-4 border border-amber-200">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{t.topic}</p>
                    <p className="text-xs text-slate-500">{s.sectionName}</p>
                  </div>
                  <Badge variant="danger" size="sm">{t.accuracy.toFixed(0)}%</Badge>
                </div>
                <div className="w-full h-1.5 bg-red-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full" style={{ width: `${t.accuracy}%` }} />
                </div>
                <p className="text-xs text-slate-500 mt-1.5">{t.correct}/{t.total} correct · avg {t.avgTimeSpent}s/question</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
