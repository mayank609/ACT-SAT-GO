import { useState, useEffect } from 'react';
import { BookCheck, Clock, CheckCircle, AlertTriangle, Users, Search, RefreshCw } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Card, StatCard } from '../../components/common/Card';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';

type Attempt = Awaited<ReturnType<typeof api.getAttempts>>['attempts'][0];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return formatDateTime(iso);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AssignmentsPage() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'completed' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.getAttempts();
      setAttempts(res.attempts);
    } catch {
      setAttempts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = attempts.filter((a) => {
    const matchTab =
      tab === 'active' ? a.status === 'in_progress' :
      tab === 'completed' ? a.status === 'submitted' : true;
    const matchSearch = !search ||
      a.studentName.toLowerCase().includes(search.toLowerCase()) ||
      a.testTitle.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const active = attempts.filter((a) => a.status === 'in_progress');
  const completed = attempts.filter((a) => a.status === 'submitted');
  const flagged = active.filter((a) => a.tabSwitches >= 3);
  // Practice Sheet/HW attempts are raw "X correct" counts, not scaled scores — averaging
  // one in with Mock/Sectional scores would be meaningless.
  const scoredCompleted = completed.filter((a) => !a.isRawScored && a.totalScore !== null);
  const avgScore = scoredCompleted.length
    ? Math.round(scoredCompleted.reduce((s, a) => s + (a.totalScore ?? 0), 0) / scoredCompleted.length * 10) / 10
    : null;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Assignments</h1>
          <p className="text-slate-500 text-sm mt-0.5">All test sessions — active and completed</p>
        </div>
        <button onClick={() => load(true)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors self-start sm:self-auto">
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Active Sessions" value={active.length} subtitle="currently taking tests" icon={<Clock size={20} />} color="blue" />
        <StatCard title="Completed" value={completed.length} subtitle="all time" icon={<CheckCircle size={20} />} color="emerald" />
        <StatCard title="Flagged" value={flagged.length} subtitle="tab switches ≥ 3" icon={<AlertTriangle size={20} />} color="amber" />
        <StatCard title="Avg Score" value={avgScore !== null ? `${avgScore}` : '—'} subtitle="submitted attempts" icon={<Users size={20} />} color="purple" />
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1 border border-slate-200 rounded-lg p-1 bg-white">
          {([
            { key: 'active', label: `Active (${active.length})` },
            { key: 'completed', label: `Completed (${completed.length})` },
            { key: 'all', label: `All (${attempts.length})` },
          ] as const).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                tab === t.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student or test..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-blue-100/40 border-b border-blue-100">
                {['Student', 'Test', tab !== 'completed' ? 'Section / Progress' : 'Score', 'Tab Switches', tab === 'active' ? 'Time Left' : 'Completed', 'Started', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-blue-800 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <BookCheck size={28} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm text-slate-400">No {tab === 'active' ? 'active sessions' : tab === 'completed' ? 'completed attempts' : 'attempts'} found</p>
                  </td>
                </tr>
              ) : filtered.map((a) => (
                <tr key={a.id} className={`hover:bg-slate-50 transition-colors ${a.tabSwitches >= 3 ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                        {a.studentName.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-900 truncate max-w-28">{a.studentName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 truncate max-w-40">{a.testTitle}</td>
                  <td className="px-4 py-3">
                    {a.status === 'submitted' ? (
                      <span className="font-semibold text-slate-900">{a.totalScore !== null ? `${a.totalScore}` : '—'}</span>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-600 truncate max-w-32">{a.sectionName}</p>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${a.progress}%` }} />
                          </div>
                          <span className="text-xs text-slate-500">{a.progress}%</span>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${a.tabSwitches >= 3 ? 'text-red-600' : a.tabSwitches > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                      {a.tabSwitches}
                      {a.tabSwitches >= 3 && <AlertTriangle size={11} className="inline ml-1" />}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {a.status === 'submitted'
                      ? <span className="text-xs text-slate-500">{formatDate(a.completedAt)}</span>
                      : <span className={`font-mono text-sm ${a.timeRemaining < 300 ? 'text-red-600' : 'text-slate-700'}`}>{formatTime(a.timeRemaining)}</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{timeAgo(a.startedAt)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={a.status === 'submitted' ? 'success' : 'info'} size="sm">
                      {a.status === 'submitted' ? 'Completed' : 'Active'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
