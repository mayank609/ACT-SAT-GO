import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Loader2, Search, ChevronRight, ArrowLeft } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { api, type PtmStudent } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/common/Button';
import { PtmReportList, UpdatePtmModal } from '../components/ptm/PtmReports';

/**
 * PTM Reports. Admins and tutors first see the names of the active students
 * (tutors: only their own); clicking a name shows every PTM conducted, and
 * admins add one with "Update PTM report". Students see their own reports.
 */
export function PTMReportsPage() {
  const { user } = useAuthStore();
  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [students, setStudents] = useState<PtmStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PtmStudent | null>(null);

  useEffect(() => {
    api.getPtmReports()
      .then((r) => setStudents(r.students))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? students.filter((s) => s.name.toLowerCase().includes(q)) : students;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [students, query]);

  const selected = students.find((s) => s.id === selectedId) ?? null;

  // Admins can share a report with the parent on WhatsApp; the number comes from the student's profile.
  const [parentPhone, setParentPhone] = useState<string | null>(null);
  useEffect(() => {
    setParentPhone(null);
    if (!isAdmin || !selectedId) return;
    api.getUser(selectedId).then((r) => setParentPhone(r.user.parentPhone ?? null)).catch(() => {});
  }, [isAdmin, selectedId]);

  const onSaved = (studentId: string, reports: PtmStudent['reports']) =>
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, reports } : s)));

  const header = (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <ClipboardCheck size={20} className="text-blue-600" />
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">PTM Reports</h1>
      </div>
      <p className="text-sm text-slate-500">
        {isStudent ? 'Your parent-teacher meeting reports, latest first.' : 'Click a student to see all the PTMs conducted.'}
      </p>
    </div>
  );

  let body: React.ReactNode;
  if (loading) {
    body = (
      <div className="flex items-center justify-center h-32 gap-2 text-slate-400 text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  } else if (failed) {
    body = (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        PTM reports could not be loaded. If this was just released, the server update may still be deploying; try again in a few minutes.
      </div>
    );
  } else if (isStudent) {
    body = <PtmReportList reports={students[0]?.reports ?? []} />;
  } else if (selected) {
    body = (
      <div className="space-y-4">
        <button type="button" onClick={() => setSelectedId(null)}
          className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800">
          <ArrowLeft size={14} /> All students
        </button>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">{selected.name}</p>
            <p className="text-xs text-slate-500">
              {selected.reports.length} PTM{selected.reports.length === 1 ? '' : 's'} conducted · {selected.mocksCompleted} mocks completed
            </p>
          </div>
          {isAdmin && (
            <Button icon={<ClipboardCheck size={16} />} onClick={() => setEditing(selected)}>Update PTM report</Button>
          )}
        </div>
        <PtmReportList reports={selected.reports} empty="No PTM conducted yet."
          share={isAdmin ? { name: selected.name, phone: parentPhone } : undefined} />
      </div>
    );
  } else {
    body = (
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white">
          {shown.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">No active students found.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {shown.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setSelectedId(s.id)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50">
                    <span className="text-sm font-semibold text-slate-900">{s.name}</span>
                    <ChevronRight size={16} className="text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Toaster position="top-right" />
      {header}
      {body}
      {isAdmin && <UpdatePtmModal student={editing} onClose={() => setEditing(null)} onSaved={onSaved} />}
    </div>
  );
}
