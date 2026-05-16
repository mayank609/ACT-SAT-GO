import { useState, useEffect } from 'react';
import { Activity, AlertTriangle, Clock, Eye, RefreshCw, Users, Wifi } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Card, StatCard } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { MOCK_STUDENTS, MOCK_TESTS } from '../../data/mockData';

interface ActiveAttempt {
  id: string;
  studentName: string;
  studentId: string;
  testTitle: string;
  sectionName: string;
  sectionIndex: number;
  totalSections: number;
  questionIndex: number;
  totalQuestions: number;
  timeRemaining: number;
  tabSwitches: number;
  startedAt: string;
  status: 'in_progress' | 'paused' | 'idle';
  progress: number;
}

function generateActiveAttempts(): ActiveAttempt[] {
  const test = MOCK_TESTS[0];
  return MOCK_STUDENTS.slice(0, 5).map((s, i) => ({
    id: `attempt-live-${i}`,
    studentName: s.name,
    studentId: s.id,
    testTitle: test.title,
    sectionName: test.sections[i % test.sections.length].name,
    sectionIndex: i % test.sections.length,
    totalSections: test.sections.length,
    questionIndex: Math.floor(Math.random() * 20) + 1,
    totalQuestions: test.sections[i % test.sections.length].questions.length,
    timeRemaining: Math.floor(Math.random() * 2400) + 300,
    tabSwitches: i === 2 ? 4 : i === 4 ? 2 : 0,
    startedAt: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    status: i === 3 ? 'idle' : 'in_progress',
    progress: Math.floor(Math.random() * 70) + 10,
  }));
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatElapsed(isoString: string) {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function MonitoringPage() {
  const [attempts, setAttempts] = useState<ActiveAttempt[]>(generateActiveAttempts);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState<ActiveAttempt | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setAttempts((prev) =>
        prev.map((a) => ({
          ...a,
          timeRemaining: Math.max(0, a.timeRemaining - 30),
          questionIndex: Math.min(a.totalQuestions, a.questionIndex + (Math.random() > 0.7 ? 1 : 0)),
          progress: Math.min(100, a.progress + (Math.random() > 0.6 ? 2 : 0)),
        }))
      );
      setLastRefresh(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setAttempts(generateActiveAttempts());
      setLastRefresh(new Date());
      setRefreshing(false);
    }, 800);
  };

  const flagged = attempts.filter((a) => a.tabSwitches >= 3);
  const idle = attempts.filter((a) => a.status === 'idle');

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Live Monitoring</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Real-time test session oversight
            <span className="ml-2 text-xs text-slate-400">· Last updated: {lastRefresh.toLocaleTimeString()}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoRefresh((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              autoRefresh ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
            <Wifi size={12} className={autoRefresh ? 'text-emerald-500' : 'text-slate-400'} />
            {autoRefresh ? 'Auto' : 'Manual'}
          </button>
          <Button variant="secondary" size="sm" icon={<RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />} onClick={handleRefresh}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Active Now" value={attempts.filter((a) => a.status === 'in_progress').length} subtitle="taking tests" icon={<Activity size={20} />} color="blue" />
        <StatCard title="Flagged" value={flagged.length} subtitle="tab switches ≥3" icon={<AlertTriangle size={20} />} color="amber" />
        <StatCard title="Idle" value={idle.length} subtitle="no activity" icon={<Clock size={20} />} color="purple" />
        <StatCard title="Total Active" value={attempts.length} subtitle="sessions open" icon={<Users size={20} />} color="emerald" />
      </div>

      {/* Flagged alerts */}
      {flagged.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={15} className="text-red-600" />
            <p className="text-sm font-semibold text-red-800">{flagged.length} student(s) flagged for excessive tab switching</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {flagged.map((a) => (
              <span key={a.id} className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-medium">
                {a.studentName} — {a.tabSwitches} switches
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Active attempts table */}
      <Card padding="none">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 text-sm">Active Sessions</h3>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-slate-500">Live</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Student', 'Test / Section', 'Progress', 'Time Left', 'Tab Switches', 'Started', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {attempts.map((a) => {
                const isUrgent = a.tabSwitches >= 3;
                const isLow = a.timeRemaining < 300;
                return (
                  <tr key={a.id} className={`hover:bg-slate-50 transition-colors ${isUrgent ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                          {a.studentName.charAt(0)}
                        </div>
                        <span className="font-medium text-slate-900 truncate max-w-28">{a.studentName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700 truncate max-w-36">{a.testTitle}</p>
                      <p className="text-xs text-slate-400">{a.sectionName} · Q{a.questionIndex}/{a.totalQuestions}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${a.progress}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{a.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-sm font-medium ${isLow ? 'text-red-600' : 'text-slate-700'}`}>
                        {formatTime(a.timeRemaining)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium text-sm ${a.tabSwitches >= 3 ? 'text-red-600' : a.tabSwitches > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                        {a.tabSwitches}
                        {a.tabSwitches >= 3 && <AlertTriangle size={12} className="inline ml-1 text-red-500" />}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatElapsed(a.startedAt)}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={a.status === 'idle' ? 'warning' : 'success'}
                        size="sm">
                        {a.status === 'idle' ? 'Idle' : 'Active'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelectedAttempt(a)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {attempts.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Activity size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No active test sessions right now</p>
            </div>
          )}
        </div>
      </Card>

      {/* Detail panel */}
      {selectedAttempt && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedAttempt(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Session Detail</h3>
              <button onClick={() => setSelectedAttempt(null)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                  {selectedAttempt.studentName.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{selectedAttempt.studentName}</p>
                  <p className="text-xs text-slate-500">{selectedAttempt.testTitle}</p>
                </div>
              </div>
              {[
                { label: 'Current Section', value: `${selectedAttempt.sectionName} (${selectedAttempt.sectionIndex + 1}/${selectedAttempt.totalSections})` },
                { label: 'Current Question', value: `${selectedAttempt.questionIndex} of ${selectedAttempt.totalQuestions}` },
                { label: 'Time Remaining', value: formatTime(selectedAttempt.timeRemaining) },
                { label: 'Overall Progress', value: `${selectedAttempt.progress}%` },
                { label: 'Tab Switches', value: `${selectedAttempt.tabSwitches}` },
                { label: 'Started', value: formatElapsed(selectedAttempt.startedAt) },
              ].map((row) => (
                <div key={row.label} className="flex justify-between py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-slate-500">{row.label}</span>
                  <span className="font-medium text-slate-900">{row.value}</span>
                </div>
              ))}
              {selectedAttempt.tabSwitches >= 3 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 font-medium">Flagged: {selectedAttempt.tabSwitches} tab switches detected. Consider reviewing this attempt.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
