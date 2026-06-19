import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Loader2, Search, ChevronRight, ArrowLeft, Users, Target, XCircle,
  HelpCircle, ShieldCheck, Clock, CheckCircle2, Layers, Wrench,
} from 'lucide-react';
import { api, type DbUser } from '../../lib/api';
import { SAT_CONTENT } from '../../data/satDomains';
import {
  loadStudentAnalytics, aggregate, buildBreakdown, accuracy, fmtTime,
  type LoadedAttempt, type QRecord, type SubjectKey,
} from '../../lib/analyticsData';
import { BreakdownTable } from '../../components/analytics/BreakdownTable';

// ─── Cumulative view for one student (all attempts except diagnostics) ─────────

function StudentCumulative({ student, onBack }: { student: DbUser; onBack: () => void }) {
  const [attempts, setAttempts] = useState<LoadedAttempt[]>([]);
  const [records, setRecords] = useState<Map<string, QRecord[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState<Exclude<SubjectKey, 'other'>>('rw');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadStudentAnalytics(student.id)
      .then(({ attempts, records }) => {
        if (cancelled) return;
        setAttempts(attempts);
        setRecords(records);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [student.id]);

  // Every question record EXCEPT those from diagnostic tests.
  const nonDiagAttempts = useMemo(() => attempts.filter(a => !a.isDiagnostic), [attempts]);
  const scoped = useMemo(() => {
    const ids = new Set(nonDiagAttempts.map(a => a.id));
    const recs: QRecord[] = [];
    for (const [id, r] of records) if (ids.has(id)) recs.push(...r);
    return recs;
  }, [records, nonDiagAttempts]);

  const summary = useMemo(() => aggregate(scoped), [scoped]);
  const { domainRows, skillRows } = useMemo(() => buildBreakdown(scoped, subject), [scoped, subject]);

  const acc = accuracy(summary);
  const metrics = [
    { label: 'Correct / Total', value: `${summary.correct}/${summary.total}`, cls: 'text-gray-900', icon: <Target size={14} className="text-gray-400" /> },
    { label: 'Mistakes', value: summary.incorrect, cls: 'text-red-600', icon: <XCircle size={14} className="text-red-400" /> },
    { label: 'Doubts', value: summary.doubts, cls: 'text-amber-600', icon: <HelpCircle size={14} className="text-amber-400" /> },
    { label: 'Cleared', value: summary.cleared, cls: 'text-emerald-600', icon: <ShieldCheck size={14} className="text-emerald-400" /> },
    { label: 'Total Time Spent', value: fmtTime(summary.time), cls: 'text-gray-900', icon: <Clock size={14} className="text-gray-400" /> },
    { label: 'Accuracy', value: `${acc}%`, cls: acc >= 80 ? 'text-emerald-600' : acc >= 60 ? 'text-amber-600' : 'text-red-600', icon: <CheckCircle2 size={14} className="text-gray-400" /> },
  ];

  const subjectLabel = subject === 'rw' ? 'Reading & Writing' : 'Math';

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Back to students">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {student.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 truncate">{student.name}</h1>
          <p className="text-gray-500 text-sm truncate">{student.email}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={20} className="animate-spin text-[#1b3d6e]" />
        </div>
      ) : nonDiagAttempts.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl py-16 text-center">
          <Target size={24} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No non-diagnostic tests attempted yet</p>
          <p className="text-gray-400 text-sm mt-1">
            {attempts.length > 0 ? 'This student has only taken diagnostic tests.' : 'This student has not completed any tests.'}
          </p>
        </div>
      ) : (
        <>
          {/* Cumulative summary */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Cumulative · {nonDiagAttempts.length} test{nonDiagAttempts.length !== 1 ? 's' : ''} (diagnostics excluded)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {metrics.map(m => (
                <div key={m.label} className="bg-white border border-gray-100 rounded-xl p-4">
                  <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1">{m.icon}{m.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${m.cls}`}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Subject toggle */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-gray-500 font-medium">Breakdown for:</span>
            {([['rw', 'Reading & Writing'], ['math', 'Math']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSubject(key)}
                className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors ${
                  subject === key ? 'bg-[#1b3d6e] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <BreakdownTable
            title="Domain-wise Analysis"
            subtitle={`${subjectLabel} · ${SAT_CONTENT[subject === 'math' ? 'Math' : 'Reading and Writing'].length} content domains`}
            icon={<Layers size={15} />}
            firstColLabel="Domain"
            rows={domainRows}
          />
          <BreakdownTable
            title="Skill Analysis"
            subtitle={`${subjectLabel} · subdomains, weakest first`}
            icon={<Wrench size={15} />}
            firstColLabel="Skill"
            rows={skillRows}
          />
        </>
      )}
    </div>
  );
}

// ─── Student picker list ───────────────────────────────────────────────────────

export function AdminAnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const studentIdParam = searchParams.get('studentId');

  const [students, setStudents] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DbUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getUsersByRole('STUDENT')
      .then(r => { if (!cancelled) setStudents(r.users ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (students.length > 0) {
      if (studentIdParam) {
        const found = students.find(s => s.id === studentIdParam);
        if (found) {
          setSelected(found);
        } else {
          setSelected(null);
        }
      } else {
        setSelected(null);
      }
    }
  }, [studentIdParam, students]);

  if (selected) {
    return <StudentCumulative student={selected} onBack={() => setSearchParams({})} />;
  }

  const filtered = students.filter(s => {
    const q = search.trim().toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Student Analytics</h1>
        <p className="text-gray-500 text-sm mt-0.5">Pick a student to see cumulative performance across all tests (excluding diagnostics).</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1b3d6e]"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={20} className="animate-spin text-[#1b3d6e]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl py-16 text-center">
          <Users size={24} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{students.length === 0 ? 'No students found' : 'No students match your search'}</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50 overflow-hidden">
          {filtered.map(s => (
            <button
              key={s.id}
              onClick={() => setSearchParams({ studentId: s.id })}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors group"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {s.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-blue-700">{s.name}</p>
                <p className="text-xs text-gray-400 truncate">{s.email}</p>
              </div>
              {typeof s.testsAttempted === 'number' && (
                <span className="text-xs text-gray-400 flex-shrink-0">{s.testsAttempted} test{s.testsAttempted !== 1 ? 's' : ''}</span>
              )}
              <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
