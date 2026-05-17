import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, Target, BookOpen, Clock, TrendingUp, Filter } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { api, type DbUser } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';

type FilterStatus = 'all' | 'on_track' | 'progress' | 'needs_help';
type SortKey = 'name' | 'score' | 'gap' | 'last_active';

function getStatus(pct: number): FilterStatus {
  if (pct >= 85) return 'on_track';
  if (pct >= 70) return 'progress';
  return 'needs_help';
}

export function MyStudentsPage() {
  const navigate = useNavigate();
  const { user, dbId } = useAuthStore();
  const [myStudents, setMyStudents] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [addMsg, setAddMsg] = useState('');

  useEffect(() => {
    if (!dbId) return;
    api.getTutorAssignments({ tutorId: dbId })
      .then((r) => setMyStudents(r.assignments.map((a) => a.student as DbUser)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dbId]);

  const filtered = myStudents
    .filter((s) => {
      const target = (s.targetScore as number | null) ?? 32;
      const pct = Math.min(100, ((s.avgScore ?? 0) / target) * 100);
      const status = getStatus(pct);
      const matchSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'all' || status === filter;
      return matchSearch && matchFilter;
    })
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'score') return (b.avgScore ?? 0) - (a.avgScore ?? 0);
      if (sort === 'gap') {
        const gapA = ((a.targetScore as number | null) ?? 32) - (a.avgScore ?? 0);
        const gapB = ((b.targetScore as number | null) ?? 32) - (b.avgScore ?? 0);
        return gapB - gapA;
      }
      if (sort === 'last_active')
        return (b.lastActive ?? '').localeCompare(a.lastActive ?? '');
      return 0;
    });

  const counts = {
    all: myStudents.length,
    on_track: myStudents.filter((s) => {
      const pct = Math.min(100, ((s.avgScore ?? 0) / ((s.targetScore as number | null) ?? 32)) * 100);
      return getStatus(pct) === 'on_track';
    }).length,
    progress: myStudents.filter((s) => {
      const pct = Math.min(100, ((s.avgScore ?? 0) / ((s.targetScore as number | null) ?? 32)) * 100);
      return getStatus(pct) === 'progress';
    }).length,
    needs_help: myStudents.filter((s) => {
      const pct = Math.min(100, ((s.avgScore ?? 0) / ((s.targetScore as number | null) ?? 32)) * 100);
      return getStatus(pct) === 'needs_help';
    }).length,
  };

  const avgScore = myStudents.filter(s => s.avgScore != null).length
    ? (myStudents.reduce((a, s) => a + (s.avgScore ?? 0), 0) / myStudents.filter(s => s.avgScore != null).length).toFixed(1)
    : '—';
  const totalTests = myStudents.reduce((a, s) => a + (s.testsAttempted ?? 0), 0);

  const FILTERS: { key: FilterStatus; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: 'bg-slate-100 text-slate-700' },
    { key: 'on_track', label: 'On Track', color: 'bg-emerald-50 text-emerald-700' },
    { key: 'progress', label: 'Progressing', color: 'bg-amber-50 text-amber-700' },
    { key: 'needs_help', label: 'Needs Help', color: 'bg-red-50 text-red-700' },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-slate-400 text-sm">Loading...</div></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">My Students</h1>
          <p className="text-slate-400 text-sm mt-0.5">{myStudents.length} students assigned to {user?.name?.split(' ')[0] ?? 'you'}</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>Add Student</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Students', value: myStudents.length, icon: <Target size={14} />, color: 'text-blue-600' },
          { label: 'Avg Score', value: avgScore, icon: <TrendingUp size={14} />, color: 'text-emerald-600' },
          { label: 'Tests Completed', value: totalTests, icon: <BookOpen size={14} />, color: 'text-purple-600' },
          { label: 'Need Attention', value: counts.needs_help, icon: <Clock size={14} />, color: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-slate-100 rounded-xl p-4">
            <div className={`flex items-center gap-1.5 ${s.color} mb-1`}>
              {s.icon}
              <span className="text-xs font-medium">{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" placeholder="Search by name or email..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
          <Filter size={12} className="text-slate-400" />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
            className="text-xs text-slate-600 bg-transparent focus:outline-none">
            <option value="name">Sort: Name</option>
            <option value="score">Sort: Score</option>
            <option value="gap">Sort: Gap</option>
            <option value="last_active">Sort: Last Active</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.key ? f.color + ' ring-1 ring-inset ring-current' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}>
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          {myStudents.length === 0 ? 'No students assigned to you yet.' : 'No students match your search.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((student) => {
            const target = (student.targetScore as number | null) ?? 32;
            const gap = target - (student.avgScore ?? 0);
            const pct = Math.min(100, ((student.avgScore ?? 0) / target) * 100);
            const status = getStatus(pct);

            return (
              <div key={student.id} onClick={() => navigate(`/student/${student.id}`)}
                className="bg-white border border-slate-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm cursor-pointer transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{student.name}</p>
                      <p className="text-xs text-slate-400 truncate">{student.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={status === 'on_track' ? 'success' : status === 'needs_help' ? 'danger' : 'warning'} size="sm">
                      {status === 'on_track' ? 'On Track' : status === 'needs_help' ? 'Help' : 'Progress'}
                    </Badge>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: 'Score', value: student.avgScore ?? '—' },
                    { label: 'Target', value: target },
                    { label: 'Gap', value: gap > 0 ? `+${gap}` : gap, red: gap > 2 },
                  ].map((s) => (
                    <div key={s.label} className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className={`text-sm font-bold ${s.red ? 'text-amber-600' : 'text-slate-800'}`}>{s.value}</p>
                      <p className="text-xs text-slate-400">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Progress to target</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        status === 'on_track' ? 'bg-emerald-500' : status === 'needs_help' ? 'bg-red-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{student.testsAttempted ?? 0} tests taken</span>
                  <span>
                    {student.lastActive
                      ? `Active ${new Date(student.lastActive).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`
                      : 'No activity'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={addOpen} onClose={() => { setAddOpen(false); setAddEmail(''); setAddName(''); setAddMsg(''); }}
        title="Add Student" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => { setAddMsg('Invite sent!'); setTimeout(() => { setAddOpen(false); setAddMsg(''); }, 1500); }}>
              Send Invite
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Send an invite to a student to join your class.</p>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
            <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Student name"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
            <input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="student@email.com"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          {addMsg && <p className="text-sm text-emerald-600 font-medium">{addMsg}</p>}
        </div>
      </Modal>
    </div>
  );
}
