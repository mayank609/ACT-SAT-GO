import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, FileSearch, CheckCircle, Clock, Target, Loader2, BookOpen, Search, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';

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

// ── Subject / type detection (mirrors admin classification) ──────────────
const isHW = (t: ApiTest): boolean => {
  const title = t.title.toLowerCase();
  const sub = (t.subCategory ?? '').toLowerCase();
  return sub.includes('hw') || /\bhw\b|homework/.test(title);
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
const isPractice = (t: ApiTest): boolean =>
  !isHW(t) && (t.category === 'Practice Sheet' || /practice/i.test(t.title));

const TEST_FILTERS = [
  { key: 'Mock',             match: isMock },
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);

  useEffect(() => {
    if (!dbId) { setLoading(false); return; }
    api.getAssignedTests(dbId)
      .then(r => setTests((r.assignedTests ?? []) as ApiTest[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dbId]);

  const availableFilters = useMemo(
    () => TEST_FILTERS.filter(f => tests.some(f.match)),
    [tests]
  );

  const visible = useMemo(() => {
    let list = tests;
    if (search.trim()) list = list.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));
    if (activeFilter) {
      const filter = TEST_FILTERS.find(f => f.key === activeFilter);
      if (filter) list = list.filter(filter.match);
    }
    return list;
  }, [tests, search, activeFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={20} className="text-[#1b3d6e] animate-spin" />
      </div>
    );
  }

  const pending = visible.filter(t => t.status === 'Not Started' || t.status === 'In Progress');
  const completed = visible.filter(t => t.status === 'Completed');
  const expired = visible.filter(t => t.status === 'Expired');

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">My Tests</h1>
        <p className="text-gray-500 text-sm mt-0.5">{tests.length} test{tests.length !== 1 ? 's' : ''} assigned</p>
      </div>

      {/* Search + filter */}
      {tests.length > 0 && (
        <div className="space-y-2">
          <div className="relative">
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
          {availableFilters.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {availableFilters.map(f => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(activeFilter === f.key ? null : f.key)}
                  className={`text-xs font-medium px-3 py-1 rounded-full border transition-all ${
                    activeFilter === f.key
                      ? 'bg-[#1b3d6e] text-white border-[#1b3d6e]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#1b3d6e]/40 hover:text-[#1b3d6e]'
                  }`}
                >
                  {f.key}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {visible.length === 0 && tests.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl py-10 text-center">
          <p className="text-gray-400 text-sm">No tests match your filters</p>
          <button onClick={() => { setSearch(''); setActiveFilter(null); }} className="text-xs text-[#1b3d6e] mt-1 hover:underline">Clear filters</button>
        </div>
      )}

      {tests.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl py-16 text-center">
          <BookOpen size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No tests assigned yet</p>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">To Complete</h2>
          <div className="space-y-2">
            {pending.map((test) => {
              const totalQ = (test.sections ?? []).reduce((a, s) => a + (s._count?.questions ?? 0), 0);
              const totalMin = (test.sections ?? []).reduce((a, s) => a + s.durationMinutes, 0);
              const isInProgress = test.status === 'In Progress';
              const usedAttempts = Math.max(test.maxAttempts - test.remainingAttempts, 0);
              const isRetake = !isInProgress && usedAttempts > 0;
              const go = () => isInProgress && test.inProgressAttemptId
                ? navigate(`/test/${test.testId}?attemptId=${test.inProgressAttemptId}`)
                : navigate(`/test-instructions/${test.testId}`);
              return (
                <div key={test.assignmentId} onClick={go} className="bg-white border-2 border-[#1b3d6e]/20 rounded-xl p-4 cursor-pointer hover:border-[#1b3d6e]/40 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${isInProgress ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-[#1b3d6e]'}`}>
                          {isInProgress ? 'In Progress' : isRetake ? 'Retake Available' : 'Not Started'}
                        </span>
                        <TestCategoryBadges category={test.category} subCategory={test.subCategory} />
                        {test.maxAttempts > 1 && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {test.remainingAttempts} of {test.maxAttempts} attempts left
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900">{test.title}</h3>
                      {test.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{test.description}</p>}
                      <p className="text-xs text-gray-500 mt-1.5">
                        {test.sections.length} section{test.sections.length !== 1 ? 's' : ''} · {totalQ} questions · {totalMin} min
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {test.sections.map(s => (
                          <span key={s.id} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{s.name}</span>
                        ))}
                      </div>
                      {test.dueDate && (
                        <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                          <Clock size={10} /> Due: {new Date(test.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                      {isRetake && test.submittedAttemptId && (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/test-review/${test.submittedAttemptId}`); }}
                          className="text-xs text-blue-600 hover:underline mt-1.5 flex items-center gap-1"
                        >
                          <FileSearch size={11} /> Review last attempt
                        </button>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); go(); }}
                      className="flex-shrink-0 flex items-center gap-2 bg-[#1b3d6e] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#15305a] transition-colors"
                    >
                      <Play size={13} />
                      {isInProgress ? 'Continue' : isRetake ? 'Retake' : 'Start Test'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Completed</h2>
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="divide-y divide-gray-50">
              {completed.map((test) => {
                const totalQ = (test.sections ?? []).reduce((a, s) => a + (s._count?.questions ?? 0), 0);
                const review = () => test.submittedAttemptId && navigate(`/test-review/${test.submittedAttemptId}`);
                return (
                  <div
                    key={test.assignmentId}
                    onClick={review}
                    className={`flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors ${test.submittedAttemptId ? 'cursor-pointer' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={14} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{test.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <TestCategoryBadges category={test.category} subCategory={test.subCategory} />
                        <span className="text-xs text-gray-400">{test.sections.length} sections · {totalQ} questions</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); review(); }}
                      disabled={!test.submittedAttemptId}
                      className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-[#1b3d6e] bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors disabled:opacity-40"
                    >
                      <FileSearch size={13} /> View Analysis
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Expired */}
      {expired.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Expired</h2>
          <div className="space-y-1.5">
            {expired.map((test) => (
              <div key={test.assignmentId} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 opacity-60">
                <Target size={14} className="text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 truncate">{test.title}</p>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    <TestCategoryBadges category={test.category} subCategory={test.subCategory} />
                  </div>
                </div>
                <span className="text-xs text-gray-400 font-medium flex-shrink-0">Expired</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
