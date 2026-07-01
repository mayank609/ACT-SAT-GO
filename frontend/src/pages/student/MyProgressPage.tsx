import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Target, Search, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { computeTestAnalysis, type TaAttempt } from '../../components/admin/QuestionWiseReport';

interface ReportRow {
  id: string; title: string; startedAt: string; completedAt: string | null;
  rwM1: number; rwM2: number; mathM1: number; mathM2: number;
  rwM1T: number; rwM2T: number; mathM1T: number; mathM2T: number;
  totalRaw: number; rwSS: number; mathSS: number; totalSS: number;
  isSAT: boolean; isMockTest: boolean;
}

const FILTERS = [
  { key: 'mock',             label: 'Mock',             match: (t: string) => /\bmock\b/i.test(t) && !/diagnostic/i.test(t) },
  { key: 'diagnostic',       label: 'Diag',             match: (t: string) => /\bdiagnostic\b/i.test(t) },
  { key: 'math_hw',          label: 'Math HW',          match: (t: string) => /\bmhw\b/i.test(t) || (/math/i.test(t) && /\bhw\b|homework/i.test(t)) },
  { key: 'reading_hw',       label: 'Reading HW',       match: (t: string) => /reading/i.test(t) && /\bhw\b|homework/i.test(t) },
  { key: 'writing_hw',       label: 'Writing HW',       match: (t: string) => /writing/i.test(t) && /\bhw\b|homework/i.test(t) },
  { key: 'math_practice',    label: 'Math Practice',    match: (t: string) => /math/i.test(t) && /practice/i.test(t) },
  { key: 'reading_practice', label: 'Reading Prac',     match: (t: string) => /reading/i.test(t) && /practice/i.test(t) },
  { key: 'writing_practice', label: 'Writing Practice', match: (t: string) => /writing/i.test(t) && /practice/i.test(t) },
] as const;
type FilterKey = typeof FILTERS[number]['key'] | 'all';

export function MyProgressPage() {
  const navigate = useNavigate();
  const { dbId } = useAuthStore();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  useEffect(() => {
    if (!dbId) { setLoading(false); return; }
    let cancelled = false;
    api.getStudentAttempts(dbId)
      .then(({ attempts }) => {
        const submitted = (Array.isArray(attempts) ? attempts : []).filter((a: any) => a?.status === 'SUBMITTED');
        return Promise.all(
          submitted.map((a: any) => api.getAttempt(a.id).then(r => r.attempt as TaAttempt).catch(() => null))
        );
      })
      .then((atts) => {
        if (cancelled || !atts) return;
        const built: ReportRow[] = (atts.filter(Boolean) as TaAttempt[]).map((att) => {
          try {
            const an = computeTestAnalysis(att);
            return {
              id: att.id, title: att.test.title, startedAt: att.startedAt, completedAt: att.completedAt,
              rwM1: an.rw1Correct, rwM2: an.rw2Correct, mathM1: an.math1Correct, mathM2: an.math2Correct,
              rwM1T: an.rw1Total, rwM2T: an.rw2Total, mathM1T: an.math1Total, mathM2T: an.math2Total,
              totalRaw: an.totalCorrect, rwSS: an.rwScaled, mathSS: an.mathScaled, totalSS: an.finalScaledScore,
              isSAT: an.isSAT,
              // Scaled score applies to Diagnostic/Mock/Sectional — only Practice Sheet shows a raw count.
              isMockTest: !(['Practice Sheet'].includes(att.test.category ?? '') || /practice\s*sheet/i.test(att.test.title ?? '')),
            };
          } catch {
            return {
              id: att.id, title: att.test.title, startedAt: att.startedAt, completedAt: att.completedAt,
              rwM1: 0, rwM2: 0, mathM1: 0, mathM2: 0, rwM1T: 0, rwM2T: 0, mathM1T: 0, mathM2T: 0,
              totalRaw: att.totalScore ?? 0, rwSS: 0, mathSS: 0, totalSS: att.totalScore ?? 0, isSAT: false, isMockTest: false,
            };
          }
        });
        built.sort((a, b) => new Date(b.completedAt ?? b.startedAt).getTime() - new Date(a.completedAt ?? a.startedAt).getTime());
        if (!cancelled) setRows(built);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dbId]);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rows.length };
    for (const f of FILTERS) counts[f.key] = rows.filter(r => f.match(r.title)).length;
    return counts;
  }, [rows]);

  const visible = useMemo(() => {
    let list = rows;
    if (search.trim()) list = list.filter(r => r.title.toLowerCase().includes(search.toLowerCase()));
    if (activeFilter !== 'all') {
      const f = FILTERS.find(f => f.key === activeFilter);
      if (f) list = list.filter(r => f.match(r.title));
    }
    return list;
  }, [rows, search, activeFilter]);

  const den = useMemo(() => {
    const d = rows.reduce((acc, r) => ({
      rwM1: Math.max(acc.rwM1, r.rwM1T), rwM2: Math.max(acc.rwM2, r.rwM2T),
      mathM1: Math.max(acc.mathM1, r.mathM1T), mathM2: Math.max(acc.mathM2, r.mathM2T),
    }), { rwM1: 0, rwM2: 0, mathM1: 0, mathM2: 0 });
    return {
      rwM1: d.rwM1 || 27, rwM2: d.rwM2 || 27, mathM1: d.mathM1 || 22, mathM2: d.mathM2 || 22,
      total: (d.rwM1 + d.rwM2 + d.mathM1 + d.mathM2) || 98,
    };
  }, [rows]);

  const fmt = (iso: string | null) => iso
    ? new Date(iso).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit' })
    : '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-[#1b3d6e]" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Target size={24} className="text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">No tests completed yet</h2>
        <p className="text-gray-500 text-sm mb-6">Complete a test to see your progress here.</p>
        <button
          onClick={() => navigate('/my-tests')}
          className="px-5 py-2.5 bg-[#1b3d6e] text-white rounded-lg text-sm font-medium hover:bg-[#15305a] transition-colors"
        >
          Go to My Tests
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">My Progress</h1>
          <p className="text-gray-500 text-sm mt-0.5">{rows.length} completed test{rows.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="relative w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search attempt…"
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b3d6e]/30 bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveFilter('all')}
          className={`flex items-center gap-2 text-sm font-semibold px-4 py-1.5 rounded-full transition-all ${
            activeFilter === 'all'
              ? 'bg-[#1b3d6e] text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-[#1b3d6e]/40'
          }`}
        >
          All
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
            activeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
          }`}>
            {filterCounts.all}
          </span>
        </button>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(activeFilter === f.key ? 'all' : f.key)}
            className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full border transition-all ${
              activeFilter === f.key
                ? 'bg-[#1b3d6e] text-white border-[#1b3d6e]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#1b3d6e]/40 hover:text-[#1b3d6e]'
            }`}
          >
            {f.label}
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
              activeFilter === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {filterCounts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Assessment Summary table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {visible.length === 0 ? (
          <p className="py-16 text-center text-slate-400 text-sm">No completed tests match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-l-4 border-l-[#1b3d6e]">
              <thead>
                <tr className="bg-gradient-to-r from-blue-50 to-blue-100/40 border-b-2 border-blue-100 text-blue-800">
                  <th className="px-4 py-3.5 text-left font-bold whitespace-nowrap border-r border-slate-200">#</th>
                  <th className="px-4 py-3.5 text-left font-bold whitespace-nowrap border-r border-slate-200">Test Name</th>
                  <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">Started At</th>
                  <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">Completed At</th>
                  <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">RW1<span className="text-slate-400 font-normal">/{den.rwM1}</span></th>
                  <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">RW2<span className="text-slate-400 font-normal">/{den.rwM2}</span></th>
                  <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">M1<span className="text-slate-400 font-normal">/{den.mathM1}</span></th>
                  <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">M2<span className="text-slate-400 font-normal">/{den.mathM2}</span></th>
                  <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">Total<span className="text-slate-400 font-normal">/{den.total}</span></th>
                  <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">RW SS</th>
                  <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">Math SS</th>
                  <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap">Total SS</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/test-review/${r.id}`)}
                    className={`border-b border-slate-200 hover:bg-blue-50/60 cursor-pointer transition-colors ${i % 2 === 1 ? 'bg-slate-50/70' : ''}`}
                  >
                    <td className="px-4 py-4 text-slate-500 whitespace-nowrap border-r border-slate-100">{i + 1}</td>
                    <td className="px-4 py-4 font-semibold text-[#1b3d6e] hover:underline whitespace-nowrap border-r border-slate-100 max-w-[240px] truncate">{r.title}</td>
                    <td className="px-4 py-4 text-center text-xs text-slate-500 whitespace-nowrap border-r border-slate-100">{fmt(r.startedAt)}</td>
                    <td className="px-4 py-4 text-center text-xs text-slate-500 whitespace-nowrap border-r border-slate-100">{fmt(r.completedAt)}</td>
                    <td className="px-4 py-4 text-center text-[#1b3d6e] font-medium whitespace-nowrap border-r border-slate-100">{r.rwM1}</td>
                    <td className="px-4 py-4 text-center text-[#1b3d6e] font-medium whitespace-nowrap border-r border-slate-100">{r.rwM2}</td>
                    <td className="px-4 py-4 text-center text-[#1b3d6e] font-medium whitespace-nowrap border-r border-slate-100">{r.mathM1}</td>
                    <td className="px-4 py-4 text-center text-[#1b3d6e] font-medium whitespace-nowrap border-r border-slate-100">{r.mathM2}</td>
                    <td className="px-4 py-4 text-center font-bold text-slate-900 whitespace-nowrap border-r border-slate-100">{r.totalRaw}</td>
                    <td className="px-4 py-4 text-center text-slate-600 whitespace-nowrap border-r border-slate-100">{(r.isSAT && r.isMockTest) ? r.rwSS : '—'}</td>
                    <td className="px-4 py-4 text-center text-slate-600 whitespace-nowrap border-r border-slate-100">{(r.isSAT && r.isMockTest) ? r.mathSS : '—'}</td>
                    <td className="px-4 py-4 text-center font-semibold text-slate-800 whitespace-nowrap">{(r.isSAT && r.isMockTest) ? r.totalSS : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
