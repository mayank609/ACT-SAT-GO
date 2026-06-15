import { useEffect, useState, useRef } from 'react';
import { HelpCircle, Loader2, Search, AlertCircle, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { QuestionWiseReport, type TaAttempt } from '../../components/admin/QuestionWiseReport';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SectionStats { doubts: number; unanswered: number }

interface StudentRow {
  studentId: string; studentName: string; studentEmail: string;
  stats: Record<string, SectionStats>;
  loaded: boolean; loading: boolean; error: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SECTION_KEYS = ['RW1', 'RW2', 'M1', 'M2'] as const;

function normalizeSection(name: string): string {
  const l = name.toLowerCase();
  const isRW = /reading|writing|\brw\b/.test(l);
  const isMath = /math|quantitative/.test(l);
  const isMod2 = /2|two/.test(l);
  if (isRW) return isMod2 ? 'RW2' : 'RW1';
  if (isMath) return isMod2 ? 'M2' : 'M1';
  return name;
}

function isUnanswered(ans: { key?: string; keys?: string[]; value?: number } | null): boolean {
  if (!ans) return true;
  if (ans.key) return false;
  if (ans.keys && ans.keys.length > 0) return false;
  if (ans.value !== undefined && ans.value !== null) return false;
  return true;
}

async function loadStudentStats(studentId: string): Promise<Record<string, SectionStats>> {
  const { attempts: rawAttempts } = await api.getStudentAttempts(studentId);
  if (!Array.isArray(rawAttempts)) return {};
  const submitted = (rawAttempts as any[]).filter(a => a?.status === 'SUBMITTED');
  const fullAttempts = await Promise.all(submitted.map(a => api.getAttempt(a.id).catch(() => null)));

  const statsMap: Record<string, SectionStats> = {};

  fullAttempts.forEach((fullData) => {
    if (!fullData) return;
    const attempt = (fullData as any).attempt as TaAttempt;
    const answersMap = new Map((attempt.answers ?? []).map((a: any) => [a.questionId, a]));

    (attempt.sectionAttempts ?? []).forEach((sa: any) => {
      const section = sa.section;
      const secKey = normalizeSection(section.name);
      if (!statsMap[secKey]) statsMap[secKey] = { doubts: 0, unanswered: 0 };

      const leafQuestions: Array<{ questionId: string }> = [];
      (section.questions ?? []).forEach((tq: any) => {
        const q = tq.question;
        if (q.childQuestions?.length) {
          q.childQuestions.forEach((cq: any) => leafQuestions.push({ questionId: cq.id }));
        } else {
          leafQuestions.push({ questionId: tq.questionId });
        }
      });

      leafQuestions.forEach(({ questionId }) => {
        const ans = answersMap.get(questionId);
        if (!ans) { statsMap[secKey].unanswered++; return; }
        if (isUnanswered((ans as any).answerGiven)) statsMap[secKey].unanswered++;
        if ((ans as any).doubtStatus === 'doubt') statsMap[secKey].doubts++;
      });
    });
  });

  return statsMap;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function StudentDoubtsAdminPage() {
  const { user, dbId } = useAuthStore();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const cancelledRef = useRef(false);

  // Fullscreen viewer state
  const [viewAttempt, setViewAttempt] = useState<TaAttempt | null>(null);
  const [viewStudentName, setViewStudentName] = useState('');
  const [loadingViewId, setLoadingViewId] = useState<string | null>(null);

  useEffect(() => {
    cancelledRef.current = false;
    if (!user || !dbId) { setPageLoading(false); return; }

    const run = async () => {
      try {
        let students: Array<{ id: string; name: string; email: string }> = [];

        if (user.role === 'tutor') {
          const { assignments } = await api.getTutorAssignments({ tutorId: dbId });
          students = assignments.map(a => ({ id: a.student.id, name: a.student.name, email: a.student.email ?? '' }));
        } else {
          const { users } = await api.getUsersByRole('STUDENT');
          students = users.map(u => ({ id: u.id, name: u.name, email: u.email ?? '' }));
        }

        if (cancelledRef.current) return;

        const initialRows: StudentRow[] = students.map(s => ({
          studentId: s.id, studentName: s.name, studentEmail: s.email,
          stats: {}, loaded: false, loading: true, error: false,
        }));
        setRows(initialRows);
        setPageLoading(false);

        let idx = 0;
        const worker = async () => {
          while (idx < students.length) {
            const i = idx++;
            const s = students[i];
            try {
              const stats = await loadStudentStats(s.id);
              if (cancelledRef.current) return;
              setRows(prev => prev.map(r => r.studentId === s.id
                ? { ...r, stats, loaded: true, loading: false, error: false }
                : r
              ));
            } catch {
              if (cancelledRef.current) return;
              setRows(prev => prev.map(r => r.studentId === s.id
                ? { ...r, loaded: true, loading: false, error: true }
                : r
              ));
            }
          }
        };
        await Promise.all(Array(4).fill(null).map(() => worker()));
      } catch {
        setPageLoading(false);
      }
    };

    run();
    return () => { cancelledRef.current = true; };
  }, [user, dbId]);

  const handleView = async (row: StudentRow) => {
    setLoadingViewId(row.studentId);
    try {
      const { attempts: raw } = await api.getStudentAttempts(row.studentId);
      const submitted = ((raw as any[]) ?? [])
        .filter((a: any) => a?.status === 'SUBMITTED')
        .sort((a: any, b: any) =>
          new Date(b.completedAt ?? b.startedAt).getTime() - new Date(a.completedAt ?? a.startedAt).getTime()
        );
      if (submitted.length === 0) return;
      const data = await api.getAttempt(submitted[0].id);
      setViewStudentName(row.studentName);
      setViewAttempt((data as any).attempt as TaAttempt);
    } finally {
      setLoadingViewId(null);
    }
  };

  const filtered = rows.filter(r =>
    r.studentName.toLowerCase().includes(search.toLowerCase()) ||
    r.studentEmail.toLowerCase().includes(search.toLowerCase())
  );

  const totals = SECTION_KEYS.reduce((acc, key) => {
    acc[key] = { doubts: 0, unanswered: 0 };
    rows.forEach(r => {
      if (r.stats[key]) { acc[key].doubts += r.stats[key].doubts; acc[key].unanswered += r.stats[key].unanswered; }
    });
    return acc;
  }, {} as Record<string, SectionStats>);

  const totalLoaded = rows.filter(r => r.loaded).length;
  const allDone = rows.length > 0 && rows.every(r => r.loaded);

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-60 gap-2 text-slate-400 text-sm">
        <Loader2 size={18} className="animate-spin" /> Loading students…
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5 max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <HelpCircle size={20} className="text-amber-500" />
            <h1 className="text-xl font-bold text-slate-900">Student Doubts</h1>
            {!allDone && rows.length > 0 && (
              <span className="text-sm text-blue-600 font-medium ml-2">Loading {totalLoaded}/{rows.length}…</span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            Doubt questions and unanswered questions per student, by section. Click View to open the full question review.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded bg-amber-100 border border-amber-200" /> Doubts</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded bg-red-50 border border-red-200" /> Empty (nothing selected)</span>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th rowSpan={2} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide border-r border-slate-200 whitespace-nowrap">
                    Student
                  </th>
                  <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-blue-700 bg-blue-50/60 border-r border-slate-200">RW Module 1</th>
                  <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-blue-700 bg-blue-50/60 border-r border-slate-200">RW Module 2</th>
                  <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-emerald-700 bg-emerald-50/60 border-r border-slate-200">Math Module 1</th>
                  <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-emerald-700 bg-emerald-50/60 border-r border-slate-200">Math Module 2</th>
                  <th rowSpan={2} className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap border-r border-slate-200">Total D / E</th>
                  <th rowSpan={2} className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">Review</th>
                </tr>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {SECTION_KEYS.map((_, i) => (
                    <>
                      <th key={`${i}-d`} className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-amber-600">Doubt</th>
                      <th key={`${i}-e`} className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-red-500 border-r border-slate-200">Empty</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-10 text-center text-sm text-slate-400">{rows.length === 0 ? 'No students found.' : 'No matching students.'}</td></tr>
                ) : (
                  filtered.map(row => {
                    const totalDoubts = Object.values(row.stats).reduce((s, v) => s + v.doubts, 0);
                    const totalUnanswered = Object.values(row.stats).reduce((s, v) => s + v.unanswered, 0);
                    const isLoadingThis = loadingViewId === row.studentId;

                    return (
                      <tr key={row.studentId} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        {/* Student */}
                        <td className="px-4 py-3 border-r border-slate-200">
                          <div className="flex items-center gap-2.5 min-w-[160px]">
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                              {row.studentName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{row.studentName}</p>
                              <p className="text-[11px] text-slate-400 truncate max-w-[140px]">{row.studentEmail}</p>
                            </div>
                          </div>
                        </td>

                        {/* Section stats */}
                        {SECTION_KEYS.map((key, i) => {
                          const s = row.stats[key];
                          const isLast = i === SECTION_KEYS.length - 1;
                          return (
                            <>
                              <td key={`${row.studentId}-${key}-d`} className="px-2 py-3 text-center">
                                {row.error ? <AlertCircle size={12} className="text-red-300 inline" />
                                  : row.loading ? <Loader2 size={11} className="animate-spin text-slate-200 inline" />
                                  : <span className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded text-[11px] font-bold ${(s?.doubts ?? 0) > 0 ? 'bg-amber-100 text-amber-700' : 'text-slate-300'}`}>{s?.doubts ?? 0}</span>}
                              </td>
                              <td key={`${row.studentId}-${key}-e`} className={`px-2 py-3 text-center ${!isLast ? 'border-r border-slate-100' : 'border-r border-slate-200'}`}>
                                {row.loading ? null
                                  : row.error ? null
                                  : <span className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded text-[11px] font-bold ${(s?.unanswered ?? 0) > 0 ? 'bg-red-50 text-red-500' : 'text-slate-300'}`}>{s?.unanswered ?? 0}</span>}
                              </td>
                            </>
                          );
                        })}

                        {/* Total */}
                        <td className="px-3 py-3 text-center text-xs whitespace-nowrap border-r border-slate-200">
                          {row.loading ? <Loader2 size={11} className="animate-spin text-slate-300 inline" />
                            : row.error ? <span className="text-red-300">err</span>
                            : <span className={totalDoubts + totalUnanswered > 0 ? 'text-slate-700 font-semibold' : 'text-slate-300'}>
                                {totalDoubts} / {totalUnanswered}
                              </span>
                          }
                        </td>

                        {/* View button */}
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => handleView(row)}
                            disabled={isLoadingThis || row.loading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            {isLoadingThis
                              ? <Loader2 size={12} className="animate-spin" />
                              : <ExternalLink size={12} />
                            }
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {allDone && rows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="px-4 py-2.5 text-xs font-bold text-slate-600 border-r border-slate-200">Total</td>
                    {SECTION_KEYS.map((key, i) => {
                      const t = totals[key];
                      const isLast = i === SECTION_KEYS.length - 1;
                      return (
                        <>
                          <td key={`total-${key}-d`} className="px-2 py-2.5 text-center">
                            <span className={`text-[11px] font-bold ${t.doubts > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{t.doubts}</span>
                          </td>
                          <td key={`total-${key}-e`} className={`px-2 py-2.5 text-center ${!isLast ? 'border-r border-slate-100' : 'border-r border-slate-200'}`}>
                            <span className={`text-[11px] font-bold ${t.unanswered > 0 ? 'text-red-500' : 'text-slate-400'}`}>{t.unanswered}</span>
                          </td>
                        </>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center text-xs font-bold text-slate-700 border-r border-slate-200">
                      {SECTION_KEYS.reduce((s, k) => s + totals[k].doubts, 0)} / {SECTION_KEYS.reduce((s, k) => s + totals[k].unanswered, 0)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Fullscreen question review — opens when View is clicked */}
      {viewAttempt && (
        <>
          {/* Student name banner injected above the fullscreen via absolute — handled inside via onFullscreenClose */}
          <QuestionWiseReport
            attempt={viewAttempt}
            defaultFilter="doubt"
            defaultFullscreen={true}
            onFullscreenClose={() => { setViewAttempt(null); setViewStudentName(''); }}
          />
          {/* Student name label inside the fullscreen header is not possible without modifying the header;
              instead we show it as a floating chip that overlays at top-left */}
          <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[160] pointer-events-none">
            <div className="mt-4 px-4 py-1.5 bg-slate-900/80 backdrop-blur-sm text-white text-xs font-semibold rounded-full shadow-lg">
              Reviewing: {viewStudentName}
            </div>
          </div>
        </>
      )}
    </>
  );
}
