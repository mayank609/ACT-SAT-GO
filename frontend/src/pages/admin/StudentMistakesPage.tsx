import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ArrowLeft, ExternalLink, Loader2, User, Calendar, Target } from 'lucide-react';
import { api, type DbUser } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { formatDate } from '../../lib/utils';
import { MistakesView } from '../../components/mistakes/MistakesView';

// ─── Main page ────────────────────────────────────────────────────────────────

export function StudentMistakesPage() {
  const { dbId, user } = useAuthStore();

  const [searchParams] = useSearchParams();

  const [students, setStudents] = useState<DbUser[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<DbUser | null>(null);
  const [studentSearch, setStudentSearch] = useState('');

  // Open a specific student directly when navigated here with ?studentId=… (e.g. from Analytics).
  useEffect(() => {
    const sid = searchParams.get('studentId');
    if (sid && !selectedStudent && students.length > 0) {
      const found = students.find(s => s.id === sid);
      if (found) setSelectedStudent(found);
    }
  }, [searchParams, students, selectedStudent]);

  // Fetch Student List based on Role
  useEffect(() => {
    if (!dbId || !user) return;
    setLoadingStudents(true);

    if (user.role === 'super_admin' || user.role === 'admin') {
      api.getUsersByRole('STUDENT')
        .then(({ users }) => {
          setStudents(users || []);
        })
        .catch((err) => console.error('Failed to load students', err))
        .finally(() => setLoadingStudents(false));
    } else if (user.role === 'tutor') {
      api.getTutorAssignments({ tutorId: dbId })
        .then(({ assignments }) => {
          const tutorStudents = assignments.map(a => a.student).filter(Boolean);
          setStudents(tutorStudents);
        })
        .catch((err) => console.error('Failed to load tutor students', err))
        .finally(() => setLoadingStudents(false));
    } else {
      setLoadingStudents(false);
    }
  }, [dbId, user]);

  // Filter students based on search term
  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const formatTargetDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return formatDate(dateStr.replace(/-/g, '/'));
  };

  return (
    <div className="w-full pb-10">
      {!selectedStudent ? (
        /* STUDENT LIST */
        <div className="space-y-5">
          {/* Header */}
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Student Mistakes</h1>
            <p className="text-sm text-slate-500">Click a student to review their incorrect and unattempted questions.</p>
          </div>

          {/* Search */}
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              placeholder="Search students…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
                  {loadingStudents ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-10 text-center text-sm text-slate-400">
                        <Loader2 size={18} className="animate-spin inline mr-2" /> Loading students…
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-10 text-center text-sm text-slate-400">
                        {students.length === 0 ? 'No students found.' : 'No matching students.'}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(student => (
                      <tr
                        key={student.id}
                        onClick={() => setSelectedStudent(student)}
                        className="border-b border-slate-100 hover:bg-blue-50/40 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 border-r border-slate-200">
                          <div className="flex items-center gap-2.5 min-w-[160px]">
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{student.name}</p>
                              <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedStudent(student); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          >
                            <ExternalLink size={12} />
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ACTIVE STATE — mistakes for selected student */
        <div className="space-y-6 w-full">
          {/* Back button + student header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectedStudent(null); setStudentSearch(''); }}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft size={16} /> Back to Students
            </button>
          </div>

          {/* Student Profile Overview Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-lg font-extrabold flex-shrink-0">
                {selectedStudent.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900">{selectedStudent.name}</h1>
                <p className="text-sm text-slate-500 flex items-center gap-1"><User size={12} /> {selectedStudent.email}</p>
              </div>
            </div>

            {/* Student target stats */}
            <div className="flex flex-wrap gap-2 md:gap-3 border-t border-slate-50 sm:border-0 pt-3 sm:pt-0">
              {selectedStudent.targetScore && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-800 rounded-xl text-xs font-bold border border-blue-100">
                  <Target size={12} className="text-blue-600" />
                  Target: {selectedStudent.targetScore}
                </span>
              )}
              {selectedStudent.targetDate && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-800 rounded-xl text-xs font-bold border border-indigo-100">
                  <Calendar size={12} className="text-indigo-600" />
                  Test Date: {formatTargetDate(selectedStudent.targetDate)}
                </span>
              )}
              {selectedStudent.grade && (
                <span className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold">
                  Grade {selectedStudent.grade}
                </span>
              )}
            </div>
          </div>

          <MistakesView studentId={selectedStudent.id} canEditDoubt={user?.role !== 'tutor'} />
        </div>
      )}
    </div>
  );
}
