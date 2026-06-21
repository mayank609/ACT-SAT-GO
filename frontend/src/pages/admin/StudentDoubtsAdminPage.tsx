import { useEffect, useState, useRef } from 'react';
import { HelpCircle, Loader2, Search, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { DoubtsView } from '../student/DoubtsPage';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StudentRow {
  studentId: string;
  studentName: string;
  studentEmail: string;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function StudentDoubtsAdminPage() {
  const { user, dbId } = useAuthStore();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const cancelledRef = useRef(false);

  // Selected student whose doubts we're viewing.
  const [viewStudent, setViewStudent] = useState<{ id: string; name: string } | null>(null);

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
          studentId: s.id,
          studentName: s.name,
          studentEmail: s.email,
        }));
        setRows(initialRows);
        setPageLoading(false);
      } catch {
        setPageLoading(false);
      }
    };

    run();
    return () => { cancelledRef.current = true; };
  }, [user, dbId]);

  const handleView = (row: StudentRow) => {
    setViewStudent({ id: row.studentId, name: row.studentName });
  };

  const filtered = rows.filter(r =>
    r.studentName.toLowerCase().includes(search.toLowerCase()) ||
    r.studentEmail.toLowerCase().includes(search.toLowerCase())
  );

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-60 gap-2 text-slate-400 text-sm">
        <Loader2 size={18} className="animate-spin" /> Loading students…
      </div>
    );
  }

  // Viewing one student's doubts — render the same "My Doubts" view the student sees.
  if (viewStudent) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <DoubtsView
          studentId={viewStudent.id}
          title={`${viewStudent.name}'s Doubts`}
          subtitle="Questions this student marked as “still a doubt” while reviewing tests"
          onBack={() => setViewStudent(null)}
        />
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
          </div>
          <p className="text-sm text-slate-500">
            Click View to open the student's question review.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-blue-50 to-blue-100/40 border-b border-blue-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-blue-800 uppercase tracking-wide border-r border-blue-100 whitespace-nowrap">
                    Student
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wide whitespace-nowrap w-28">
                    Review
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-10 text-center text-sm text-slate-400">
                      {rows.length === 0 ? 'No students found.' : 'No matching students.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map(row => {
                    return (
                      <tr
                        key={row.studentId}
                        onClick={() => handleView(row)}
                        className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors cursor-pointer"
                      >
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

                        {/* View button */}
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleView(row); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          >
                            <ExternalLink size={12} />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
