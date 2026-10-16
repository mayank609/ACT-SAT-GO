import { useEffect, useMemo, useState } from 'react';
import { FileBarChart2, Loader2, RotateCcw } from 'lucide-react';
import { api, type DbUser } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { useUrlString } from '../lib/urlState';
import { formatDate } from '../lib/utils';
import { AttemptAnalysis } from '../components/report/AttemptAnalysis';

/**
 * Test Report: one place to open any submitted test's full report, modelled on
 * Zuperscore's "User Assessment Report" page. Pick an assessment type, a student
 * (admins see all, tutors their own, students only themselves) and a test, and
 * the shared AttemptAnalysis report opens underneath. Choices live in the URL so
 * Back and links work.
 */

type AssessmentType = 'all' | 'Mock' | 'Sectional' | 'Practice Sheet' | 'Diagnostic';
const TYPES: { key: AssessmentType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'Mock', label: 'Mock' },
  { key: 'Sectional', label: 'Sectional' },
  { key: 'Practice Sheet', label: 'Practice Sheet' },
  { key: 'Diagnostic', label: 'Diagnostic' },
];

interface AttemptRow {
  id: string;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  test: { title: string; category?: string | null };
}

function typeOf(a: AttemptRow): AssessmentType {
  const c = (a.test.category ?? '').trim();
  if (c === 'Mock' || c === 'Sectional' || c === 'Practice Sheet' || c === 'Diagnostic') return c;
  return /mock/i.test(a.test.title) ? 'Mock' : 'Practice Sheet';
}

const selectCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400';

export function TestReportPage() {
  const { user, dbId } = useAuthStore();
  const isStudent = user?.role === 'student';

  const [type, setType] = useUrlString('type', 'all');
  const [studentId, setStudentId] = useUrlString('student');
  const [attemptId, setAttemptId] = useUrlString('attempt');
  const [from, setFrom] = useUrlString('from');
  const [to, setTo] = useUrlString('to');

  const [students, setStudents] = useState<DbUser[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(!isStudent);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

  const effectiveStudentId = isStudent ? (dbId ?? '') : studentId;

  // Students this account may report on.
  useEffect(() => {
    if (!user || !dbId || isStudent) return;
    setStudentsLoading(true);
    const load = user.role === 'tutor'
      ? api.getTutorAssignments({ tutorId: dbId }).then(({ assignments }) => assignments.map((a) => a.student).filter(Boolean) as DbUser[])
      : api.getUsersByRole('STUDENT').then(({ users }) => users ?? []);
    load
      .then((list) => setStudents([...list].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setStudents([]))
      .finally(() => setStudentsLoading(false));
  }, [user, dbId, isStudent]);

  // Submitted attempts of the chosen student.
  useEffect(() => {
    if (!effectiveStudentId) { setAttempts([]); return; }
    let cancelled = false;
    setAttemptsLoading(true);
    api.getStudentAttempts(effectiveStudentId)
      .then(({ attempts: raw }) => {
        if (cancelled) return;
        const rows = (raw as AttemptRow[]).filter((a) => a.status !== 'IN_PROGRESS' && a.test);
        setAttempts(rows);
      })
      .catch(() => { if (!cancelled) setAttempts([]); })
      .finally(() => { if (!cancelled) setAttemptsLoading(false); });
    return () => { cancelled = true; };
  }, [effectiveStudentId]);

  const filtered = useMemo(() => attempts.filter((a) => {
    if (type !== 'all' && typeOf(a) !== type) return false;
    const day = (a.submittedAt ?? a.startedAt).slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  }), [attempts, type, from, to]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: attempts.length };
    for (const a of attempts) c[typeOf(a)] = (c[typeOf(a)] ?? 0) + 1;
    return c;
  }, [attempts]);

  const clear = () => {
    setType('all');
    if (!isStudent) setStudentId('');
    setAttemptId('');
    setFrom('');
    setTo('');
  };

  const showReport = !!attemptId && !!effectiveStudentId;

  return (
    <div className="w-full pb-10 space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Test Report</h1>
        <p className="text-sm text-slate-500">
          {isStudent ? 'Choose one of your tests to open its full report.' : 'Choose a student and a test to open its full report.'}
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Report Filters</h2>
          <button onClick={clear} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            <RotateCcw size={13} /> Clear
          </button>
        </div>

        <div>
          <p className="block text-sm font-medium text-slate-700 mb-1.5">Assessment type</p>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => { setType(t.key); setAttemptId(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  type === t.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                }`}
              >
                {t.label}{effectiveStudentId && !attemptsLoading ? ` (${counts[t.key] ?? 0})` : ''}
              </button>
            ))}
          </div>
        </div>

        <div className={`grid grid-cols-1 gap-4 ${isStudent ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
          {!isStudent && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Student</label>
              <select
                className={selectCls}
                value={studentId}
                disabled={studentsLoading}
                onChange={(e) => { setStudentId(e.target.value); setAttemptId(''); }}
              >
                <option value="">{studentsLoading ? 'Loading students…' : 'Select student'}</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">From</label>
            <input type="date" className={selectCls} value={from} onChange={(e) => { setFrom(e.target.value); setAttemptId(''); }} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
            <input type="date" className={selectCls} value={to} onChange={(e) => { setTo(e.target.value); setAttemptId(''); }} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Test</label>
            <select
              className={selectCls}
              value={attemptId}
              disabled={!effectiveStudentId || attemptsLoading || filtered.length === 0}
              onChange={(e) => setAttemptId(e.target.value)}
            >
              <option value="">
                {!effectiveStudentId ? 'Select a student first' : attemptsLoading ? 'Loading tests…' : filtered.length === 0 ? 'No submitted tests' : 'Select test'}
              </option>
              {filtered.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.test.title} — {formatDate(a.submittedAt ?? a.startedAt)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {showReport ? (
        <AttemptAnalysis key={attemptId} attemptId={attemptId} />
      ) : (
        <div className="bg-white border border-dashed border-slate-200 rounded-xl py-14 flex flex-col items-center text-center gap-2">
          {attemptsLoading ? <Loader2 size={22} className="animate-spin text-slate-400" /> : <FileBarChart2 size={26} className="text-slate-300" />}
          <p className="text-sm text-slate-500">Apply the filters and pick a test to see its report.</p>
        </div>
      )}
    </div>
  );
}
