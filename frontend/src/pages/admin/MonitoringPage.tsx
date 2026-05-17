import { useState, useEffect, useCallback } from 'react';
import { Activity, AlertTriangle, Clock, Eye, RefreshCw, Users, Wifi } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Card, StatCard } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { api } from '../../lib/api';

type LiveAttempt = Awaited<ReturnType<typeof api.getAttempts>>['attempts'][0];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function MonitoringPage() {
  const [attempts, setAttempts] = useState<LiveAttempt[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState<LiveAttempt | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAttempts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.getAttempts({ status: 'IN_PROGRESS' });
      setAttempts(res.attempts);
      setLastRefresh(new Date());
    } catch {
      setAttempts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAttempts(); }, [fetchAttempts]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchAttempts(true), 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAttempts]);

  const flagged = attempts.filter((a) => a.tabSwitches >= 3);
  const idle = attempts.filter((a) => a.progress === 0 && a.answersCount === 0);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Live Monitoring</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Real-time test session oversight
            <span className="ml-2 text-xs text-slate-400">· Updated: {lastRefresh.toLocaleTimeString()}</span>
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
          <Button variant="secondary" size="sm" icon={<RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />} onClick={() => fetchAttempts(true)}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Active Now" value={attempts.length} subtitle="taking tests" icon={<Activity size={20} />} color="blue" />
        <StatCard title="Flagged" value={flagged.length} subtitle="tab switches ≥3" icon={<AlertTriangle size={20} />} color="amber" />
        <StatCard title="Not Started" value={idle.length} subtitle="no answers yet" icon={<Clock size={20} />} color="purple" />
        <StatCard title="Total Sessions" value={attempts.length} subtitle="in progress" icon={<Users size={20} />} color="emerald" />
      </div>

      {/* Flagged alerts */}
      {flagged.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={15} className="text-red-600" />
            <p className="text-sm font-semibold text-red-800">{flagged.length} student{flagged.length > 1 ? 's' : ''} flagged for excessive tab switching</p>
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

      {/* Active sessions table */}
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
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">Loading sessions…</td></tr>
              ) : attempts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Activity size={32} className="mx-auto mb-2 text-slate-200" />
                    <p className="text-sm text-slate-400">No active test sessions right now</p>
                  </td>
                </tr>
              ) : attempts.map((a) => {
                const isUrgent = a.tabSwitches >= 3;
                const isLow = a.timeRemaining > 0 && a.timeRemaining < 300;
                return (
                  <tr key={a.id} className={`hover:bg-slate-50 transition-colors ${isUrgent ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                          {a.studentName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900 truncate max-w-28">{a.studentName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700 truncate max-w-36">{a.testTitle}</p>
                      <p className="text-xs text-slate-400">{a.sectionName} · Section {a.sectionIndex + 1}/{a.totalSections}</p>
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
                        {a.timeRemaining > 0 ? formatTime(a.timeRemaining) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium text-sm ${a.tabSwitches >= 3 ? 'text-red-600' : a.tabSwitches > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                        {a.tabSwitches}
                        {a.tabSwitches >= 3 && <AlertTriangle size={12} className="inline ml-1 text-red-500" />}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{timeAgo(a.startedAt)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={a.answersCount === 0 ? 'warning' : 'success'} size="sm">
                        {a.answersCount === 0 ? 'Idle' : 'Active'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelectedAttempt(a)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail modal */}
      {selectedAttempt && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedAttempt(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Session Detail</h3>
              <button onClick={() => setSelectedAttempt(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                  {selectedAttempt.studentName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{selectedAttempt.studentName}</p>
                  <p className="text-xs text-slate-500">{selectedAttempt.testTitle}</p>
                </div>
              </div>
              {[
                { label: 'Current Section', value: `${selectedAttempt.sectionName} (${selectedAttempt.sectionIndex + 1}/${selectedAttempt.totalSections})` },
                { label: 'Progress', value: `${selectedAttempt.progress}%` },
                { label: 'Answers Saved', value: selectedAttempt.answersCount },
                { label: 'Time Remaining', value: selectedAttempt.timeRemaining > 0 ? formatTime(selectedAttempt.timeRemaining) : 'N/A' },
                { label: 'Tab Switches', value: selectedAttempt.tabSwitches },
                { label: 'Started', value: timeAgo(selectedAttempt.startedAt) },
              ].map((row) => (
                <div key={row.label} className="flex justify-between py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-slate-500">{row.label}</span>
                  <span className="font-medium text-slate-900">{row.value}</span>
                </div>
              ))}
              {selectedAttempt.tabSwitches >= 3 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 font-medium">Flagged: {selectedAttempt.tabSwitches} tab switches detected.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
