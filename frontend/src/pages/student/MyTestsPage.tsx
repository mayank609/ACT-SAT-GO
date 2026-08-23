import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, FileSearch, Clock, Target, Loader2, BookOpen, Search, X, CheckCircle, ListTodo } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { loadStudentAnalytics, computeSatScore, type QRecord } from '../../lib/analyticsData';
import { resolveScoreMode } from '../../lib/testCategorize';

interface ApiTest {
  assignmentId: string;
  testId: string;
  title: string;
  description?: string;
  category?: string;
  subCategory?: string;
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Expired';
  remainingAttempts: number;
  maxAttempts: number;
  inProgressAttemptId?: string | null;
  submittedAttemptId?: string | null;
  dueDate?: string;
  sections: Array<{ id: string; name: string; durationMinutes: number; _count?: { questions: number } }>;
}

interface LoadedAttempt { id: string; title: string; completedAt: string | null; totalScore: number | null; isDiagnostic: boolean }

// Test Builder tags homework as subCategory "{Subject}-Homework" (e.g. "Math-Homework"),
// which does NOT contain the substring "hw" — match on "homework" instead.
const isHW = (t: ApiTest): boolean => {
  const title = t.title.toLowerCase();
  const sub = (t.subCategory ?? '').toLowerCase();
  return sub.includes('homework') || /\bhw\b|homework/.test(title);
};
const isMathSubject = (t: ApiTest): boolean => {
  const title = t.title.toLowerCase();
  const sub = (t.subCategory ?? '').toLowerCase();
  return sub.includes('math') || sub.includes('quant') || /math|algebra|geometry|calc/.test(title)
    || (t.sections ?? []).some(s => /math/i.test(s.name));
};
const isReadingSubject = (t: ApiTest): boolean => {
  const title = t.title.toLowerCase();
  const sub = (t.subCategory ?? '').toLowerCase();
  return sub.includes('rw') || sub.includes('english') || sub.includes('reading') || sub.includes('writing')
    || /reading|writing|english|verbal|grammar|\brw\b/.test(title)
    || (t.sections ?? []).some(s => /read|writ|english|verbal/i.test(s.name));
};
const isMock = (t: ApiTest): boolean =>
  t.category?.toLowerCase() === 'mock' || t.category?.toLowerCase() === 'diagnostic' || /mock|diagnostic/i.test(t.title);
const isSectional = (t: ApiTest): boolean =>
  t.category?.toLowerCase() === 'sectional' || /sectional/i.test(t.title);
const isPractice = (t: ApiTest): boolean =>
  !isHW(t) && (t.category === 'Practice Sheet' || /practice/i.test(t.title));

const TEST_FILTERS = [
  { key: 'Mock',             match: isMock },
  { key: 'Sectional',        match: isSectional },
  { key: 'Math HW',          match: (t: ApiTest) => isHW(t) && isMathSubject(t) },
  { key: 'Reading HW',       match: (t: ApiTest) => isHW(t) && isReadingSubject(t) },
  { key: 'Math Practice',    match: (t: ApiTest) => isPractice(t) && isMathSubject(t) },
  { key: 'Reading Practice', match: (t: ApiTest) => isPractice(t) && isReadingSubject(t) },
] as const;
type FilterKey = typeof TEST_FILTERS[number]['key'];

const CAT_COLORS: Record<string, string> = {
  Mock:             'bg-blue-100 text-blue-700',
  Diagnostic:       'bg-amber-100 text-amber-700',
  Sectional:        'bg-emerald-100 text-emerald-700',
  'Practice Sheet': 'bg-purple-100 text-purple-700',
  ACT:              'bg-[#1b3d6e]/10 text-[#1b3d6e]',
  SAT:              'bg-rose-100 text-rose-700',
};

function TestCategoryBadges({ category, subCategory }: { category?: string; subCategory?: string }) {
  const subject = subCategory?.split('-')[0];
  return (
    <>
      {subject && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CAT_COLORS[subject] ?? 'bg-gray-100 text-gray-600'}`}>{subject}</span>}
      {category && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CAT_COLORS[category] ?? 'bg-gray-100 text-gray-600'}`}>{category}</span>}
    </>
  );
}

export function MyTestsPage() {
  const navigate = useNavigate();
  const { dbId } = useAuthStore();
  const [tests, setTests] = useState<ApiTest[]>([]);
  const [attempts, setAttempts] = useState<LoadedAttempt[]>([]);
  const [records, setRecords] = useState<Map<string, QRecord[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'todo' | 'completed'>('todo');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);

  useEffect(() => {
    if (!dbId) { setLoading(false); return; }
    Promise.all([
      api.getAssignedTests(dbId).then(r => setTests((r.assignedTests ?? []) as ApiTest[])).catch(() => {}),
      loadStudentAnalytics(dbId).then(({ attempts, records }) => { setAttempts(attempts); setRecords(records); }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [dbId]);

  const switchTab = (t: 'todo' | 'completed') => {
    setTab(t);
    setActiveFilter(null);
  };

  const pending = useMemo(() => tests.filter(t => t.status === 'Not Started' || t.status === 'In Progress'), [tests]);
  const expired = useMemo(() => tests.filter(t => t.status === 'Expired'), [tests]);
  const completedTests = useMemo(() => tests.filter(t => t.status === 'Completed'), [tests]);
  const todoPool = useMemo(() => [...pending, ...expired], [pending, expired]);
  const pool = tab === 'todo' ? todoPool : completedTests;

  const visiblePool = useMemo(() => {
    let list = pool;
    if (search.trim()) list = list.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));
    if (activeFilter) {
      const filter = TEST_FILTERS.find(f => f.key === activeFilter);
      if (filter) list = list.filter(filter.match);
    }
    return list;
  }, [pool, search, activeFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={20} className="text-[#1b3d6e] animate-spin" />
      </div>
    );
  }

  const pendingVisible = tab === 'todo' ? visiblePool.filter(t => t.status !== 'Expired') : [];
  const expiredVisible = tab === 'todo' ? visiblePool.filter(t => t.status === 'Expired') : [];
  const completedVisible = useMemo(() => {
    if (tab !== 'completed') return [];
    const list = [...visiblePool];
    list.sort((a, b) => {
      const attA = attempts.find(att => att.title === a.title);
      const attB = attempts.find(att => att.title === b.title);
      const dateA = attA?.completedAt ? new Date(attA.completedAt).getTime() : 0;
      const dateB = attB?.completedAt ? new Date(attB.completedAt).getTime() : 0;
      return dateB - dateA;
    });
    return list;
  }, [tab, visiblePool, attempts]);

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">My Assignments</h1>
          <p className="text-gray-500 text-sm mt-0.5">{tests.length} test{tests.length !== 1 ? 's' : ''} assigned</p>
        </div>
        {tests.length > 0 && (
          <div className="relative w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tests…"
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b3d6e]/30 bg-white"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {tests.length > 0 && (
        <div className="inline-flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => switchTab('todo')}
            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg transition-all ${
              tab === 'todo' ? 'bg-white text-[#1b3d6e] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ListTodo size={14} /> To Do
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${tab === 'todo' ? 'bg-[#1b3d6e]/10 text-[#1b3d6e]' : 'bg-gray-200 text-gray-500'}`}>
              {todoPool.length}
            </span>
          </button>
          <button
            onClick={() => switchTab('completed')}
            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg transition-all ${
              tab === 'completed' ? 'bg-white text-[#1b3d6e] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CheckCircle size={14} /> Completed
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${tab === 'completed' ? 'bg-[#1b3d6e]/10 text-[#1b3d6e]' : 'bg-gray-200 text-gray-500'}`}>
              {completedTests.length}
            </span>
          </button>
        </div>
      )}

      {tests.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {TEST_FILTERS.map(f => {
            const count = pool.filter(f.match).length;
            return (
              <button
                key={f.key}
                onClick={() => count > 0 && setActiveFilter(activeFilter === f.key ? null : f.key)}
                disabled={count === 0}
                className={`text-xs font-medium px-3 py-1 rounded-full border transition-all flex items-center gap-1.5 ${
                  activeFilter === f.key
                    ? 'bg-[#1b3d6e] text-white border-[#1b3d6e]'
                    : count === 0
                      ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#1b3d6e]/40 hover:text-[#1b3d6e]'
                }`}
              >
                {f.key}
                <span className={`text-[10px] font-bold px-1.5 rounded-full ${
                  activeFilter === f.key ? 'bg-white/20' : count === 0 ? 'bg-gray-100' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {tests.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl py-16 text-center">
          <BookOpen size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No tests assigned yet</p>
        </div>
      )}

      {tests.length > 0 && visiblePool.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl py-10 text-center">
          <p className="text-gray-400 text-sm">
            {tab === 'todo' ? 'No tests to complete match your filters' : 'No completed tests match your filters'}
          </p>
          <button onClick={() => { setSearch(''); setActiveFilter(null); }} className="text-xs text-[#1b3d6e] mt-1 hover:underline">Clear filters</button>
        </div>
      )}

      {tab === 'todo' && pendingVisible.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">To Complete</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {pendingVisible.map((test) => {
              const totalQ = (test.sections ?? []).reduce((a, s) => a + (s._count?.questions ?? 0), 0);
              const totalMin = (test.sections ?? []).reduce((a, s) => a + s.durationMinutes, 0);
              const isInProgress = test.status === 'In Progress';
              const usedAttempts = Math.max(test.maxAttempts - test.remainingAttempts, 0);
              const isRetake = !isInProgress && usedAttempts > 0;
              const go = () => isInProgress && test.inProgressAttemptId
                ? navigate(`/test/${test.testId}?attemptId=${test.inProgressAttemptId}`)
                : navigate(`/test-instructions/${test.testId}`);
              return (
                <div key={test.assignmentId} onClick={go} className="bg-white border-2 border-[#1b3d6e]/20 rounded-xl p-3 cursor-pointer hover:border-[#1b3d6e]/40 transition-colors flex flex-col gap-1.5">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${isInProgress ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-[#1b3d6e]'}`}>
                      {isInProgress ? 'In Progress' : isRetake ? 'Retake' : 'Not Started'}
                    </span>
                    <TestCategoryBadges category={test.category} subCategory={test.subCategory} />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 flex-1">{test.title}</h3>
                  <p className="text-[11px] text-gray-500">
                    {test.sections.length} section{test.sections.length !== 1 ? 's' : ''} · {totalQ}Q · {totalMin}min
                  </p>
                  {test.maxAttempts > 1 && (
                    <p className="text-[10px] text-slate-500">{test.remainingAttempts}/{test.maxAttempts} attempts left</p>
                  )}
                  {test.dueDate && (
                    <p className="text-[10px] text-red-500 flex items-center gap-1">
                      <Clock size={9} /> Due {new Date(test.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                  {isRetake && test.submittedAttemptId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/test-review/${test.submittedAttemptId}`); }}
                      className="text-[10px] text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <FileSearch size={10} /> Review last attempt
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); go(); }}
                    className="mt-auto w-full flex items-center justify-center gap-1.5 bg-[#1b3d6e] text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-[#15305a] transition-colors"
                  >
                    <Play size={12} />
                    {isInProgress ? 'Continue' : isRetake ? 'Retake' : 'Start Test'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'todo' && expiredVisible.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Expired</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {expiredVisible.map((test) => (
              <div key={test.assignmentId} className="bg-white border border-gray-100 rounded-xl p-3 opacity-60 flex flex-col gap-1.5">
                <div className="flex items-center gap-1 flex-wrap">
                  <Target size={12} className="text-gray-400 flex-shrink-0" />
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide bg-gray-100 text-gray-500">Expired</span>
                </div>
                <p className="text-sm font-medium text-gray-500 line-clamp-2">{test.title}</p>
                <div className="flex gap-1 flex-wrap">
                  <TestCategoryBadges category={test.category} subCategory={test.subCategory} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'completed' && completedVisible.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm border-l-4 border-l-blue-600">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-blue-100/40 border-b-2 border-blue-100 text-blue-800">
                <th className="px-4 py-3.5 text-left font-bold whitespace-nowrap border-r border-slate-200">#</th>
                <th className="px-4 py-3.5 text-left font-bold whitespace-nowrap border-r border-slate-200">Test Name</th>
                <th className="px-4 py-3.5 text-left font-bold whitespace-nowrap border-r border-slate-200">Category</th>
                <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">Completed</th>
                <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">Score</th>
                <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap">Analysis</th>
              </tr>
            </thead>
            <tbody>
              {completedVisible.map((test, i) => {
                const attempt = attempts.find(a => a.title === test.title);
                const review = () => test.submittedAttemptId && navigate(`/test-review/${test.submittedAttemptId}`);
                return (
                  <tr
                    key={test.assignmentId}
                    onClick={review}
                    className={`border-b border-slate-100 hover:bg-blue-50/60 transition-colors ${test.submittedAttemptId ? 'cursor-pointer' : ''} ${i % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}`}
                  >
                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap border-r border-slate-100">{i + 1}</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-900 border-r border-slate-100">{test.title}</td>
                    <td className="px-4 py-3.5 border-r border-slate-100">
                      <div className="flex flex-wrap gap-1"><TestCategoryBadges category={test.category} subCategory={test.subCategory} /></div>
                    </td>
                    <td className="px-4 py-3.5 text-center text-xs text-slate-500 whitespace-nowrap border-r border-slate-100">
                      {attempt?.completedAt ? new Date(attempt.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold text-slate-800 whitespace-nowrap border-r border-slate-100">
                      {(() => {
                        if (!attempt) return '—';
                        const recs = records.get(attempt.id) ?? [];
                        const mode = resolveScoreMode(test);
                        if (mode === 'raw') {
                          if (recs.length === 0) return attempt.totalScore ?? '—';
                          const correct = recs.filter(r => r.status === 'correct').length;
                          return `${correct}/${recs.length}`;
                        }
                        const s = computeSatScore(recs);
                        if (mode === 'sectional-math') return s.mathTotal > 0 ? s.math : (attempt.totalScore ?? '—');
                        if (mode === 'sectional-rw') return s.rwTotal > 0 ? s.rw : (attempt.totalScore ?? '—');
                        // mock — both subjects
                        return attempt.totalScore ?? (s.rwTotal > 0 && s.mathTotal > 0 ? s.total : '—');
                      })()}
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <button
                        onClick={(e) => { e.stopPropagation(); review(); }}
                        disabled={!test.submittedAttemptId}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1b3d6e] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <FileSearch size={12} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
