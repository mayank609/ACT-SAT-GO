import { useState, useEffect } from 'react';
import { Plus, MoreVertical, Mail, Users, TrendingUp, UserPlus, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { DataTable } from '../../components/common/DataTable';
import { api, type DbUser } from '../../lib/api';

const SPECIALIZATIONS = ['Math', 'English', 'Reading', 'Science', 'Writing', 'ACT Prep', 'SAT Prep'];

export function TutorManagementPage() {
  const navigate = useNavigate();
  const [tutors, setTutors] = useState<DbUser[]>([]);
  const [students, setStudents] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<DbUser | null>(null);
  const [assignedStudentIds, setAssignedStudentIds] = useState<string[]>([]);
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', email: '', specializations: [] as string[] });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const reload = () => {
    setLoading(true);
    Promise.all([
      api.getUsersByRole('TUTOR').then((r) => setTutors(r.users ?? [])),
      api.getUsersByRole('STUDENT').then((r) => setStudents(r.users ?? [])),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const toggleSpec = (spec: string) =>
    setAddForm((f) => ({
      ...f,
      specializations: f.specializations.includes(spec)
        ? f.specializations.filter((s) => s !== spec)
        : [...f.specializations, spec],
    }));

  const openAssignModal = (tutor: DbUser) => {
    setAssignedStudentIds(tutor.studentIds ?? []);
    setShowAssignModal(tutor);
  };

  const handleSaveAssignments = async () => {
    if (!showAssignModal) return;
    setSaveLoading(true);
    try {
      const tutorId = showAssignModal.id;
      const current = showAssignModal.studentIds ?? [];
      const toAdd = assignedStudentIds.filter((id) => !current.includes(id));
      const toRemove = current.filter((id) => !assignedStudentIds.includes(id));
      await Promise.all([
        ...toAdd.map((sid) => api.createTutorAssignment(tutorId, sid)),
        ...toRemove.map((sid) => api.deleteTutorAssignment(tutorId, sid)),
      ]);
      setShowAssignModal(null);
      reload();
    } catch (e) {
      console.error(e);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleAddTutor = async () => {
    if (!addForm.email) return;
    setAddError(''); setAddLoading(true);
    try {
      await api.createUser({
        name: `${addForm.firstName} ${addForm.lastName}`.trim() || addForm.email.split('@')[0],
        email: addForm.email,
        role: 'TUTOR',
        specialization: addForm.specializations.length ? addForm.specializations : undefined,
      });
      setShowAddModal(false);
      setAddForm({ firstName: '', lastName: '', email: '', specializations: [] });
      reload();
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAddLoading(false);
    }
  };

  const totalStudents = tutors.reduce((a, t) => a + (t.studentCount ?? 0), 0);
  const avgStudentsPerTutor = tutors.length ? (totalStudents / tutors.length).toFixed(1) : '0';
  const avgScore = tutors.filter(t => t.avgScore != null).length
    ? Math.round(tutors.reduce((a, t) => a + (t.avgScore ?? 0), 0) / tutors.filter(t => t.avgScore != null).length)
    : 0;

  const columns = [
    {
      key: 'name',
      header: 'Tutor',
      sortable: true,
      render: (row: DbUser) => (
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold flex-shrink-0">
            {row.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-900 text-sm truncate">{row.name}</p>
            <p className="text-xs text-slate-500 hidden sm:block truncate">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'specialization',
      header: 'Specialization',
      render: (row: DbUser) => (
        <div className="flex flex-wrap gap-1">
          {((row.specialization as string[]) ?? []).slice(0, 2).map((s: string) => (
            <Badge key={s} variant="info" size="sm">{s}</Badge>
          ))}
          {((row.specialization as string[]) ?? []).length > 2 && (
            <Badge variant="default" size="sm">+{((row.specialization as string[]) ?? []).length - 2}</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'studentCount',
      header: 'Students',
      sortable: true,
      render: (row: DbUser) => (
        <div className="flex items-center gap-1.5">
          <Users size={12} className="text-slate-400" />
          <span className="text-sm text-slate-700">{row.studentCount ?? 0}</span>
        </div>
      ),
    },
    {
      key: 'avgScore',
      header: 'Avg Student Score',
      sortable: true,
      render: (row: DbUser) => {
        const score = row.avgScore ?? 0;
        const pct = Math.min(100, (score / 36) * 100);
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-slate-900">{score || '—'}</span>
            {score > 0 && (
              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                <div className={`h-full rounded-full ${pct >= 75 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Tutors</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage tutor profiles and student assignments</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<Plus size={13} />} onClick={() => setShowAddModal(true)}>Add Tutor</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'Total Tutors', value: tutors.length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total Students', value: totalStudents, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Avg Students/Tutor', value: avgStudentsPerTutor, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Avg Student Score', value: avgScore || '—', color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((s) => (
          <Card key={s.label} padding="sm">
            <div className="flex items-center gap-2 md:gap-3">
              <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                <span className={`text-base md:text-lg font-bold ${s.color}`}>{s.value}</span>
              </div>
              <p className="text-xs md:text-sm text-slate-600">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Tutor cards grid */}
      {loading ? (
        <div className="py-8 text-center text-slate-400 text-sm">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {tutors.map((tutor) => (
            <Card key={tutor.id} padding="none" hoverable>
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg">
                    {tutor.name.charAt(0).toUpperCase()}
                  </div>
                  <button className="p-1 text-slate-400 hover:text-slate-600 rounded">
                    <MoreVertical size={14} />
                  </button>
                </div>
                <p className="font-semibold text-slate-900 text-sm">{tutor.name}</p>
                <p className="text-xs text-slate-500 truncate mb-2">{tutor.email}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {((tutor.specialization as string[]) ?? []).slice(0, 2).map((s: string) => (
                    <span key={s} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-3 border-t border-slate-100 pt-3">
                  <span className="flex items-center gap-1"><Users size={11} /> {tutor.studentCount ?? 0} students</span>
                  <span className="flex items-center gap-1"><Star size={11} /> Avg {tutor.avgScore ?? '—'}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openAssignModal(tutor)}
                    className="flex-1 text-xs py-1.5 px-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1 transition-colors">
                    <Users size={11} /> Assign
                  </button>
                  <button onClick={() => navigate('/analytics')}
                    className="flex-1 text-xs py-1.5 px-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1 transition-colors">
                    <TrendingUp size={11} /> Stats
                  </button>
                  <button className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                    <Mail size={13} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
          {tutors.length === 0 && (
            <div className="col-span-full py-8 text-center text-slate-400 text-sm">No tutors yet. Add one!</div>
          )}
        </div>
      )}

      {/* Table view */}
      <Card padding="none">
        <div className="px-4 pt-4 pb-1 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">All Tutors</h3>
        </div>
        <div className="p-3 md:p-4">
          <DataTable<DbUser & Record<string, unknown>>
            data={tutors as (DbUser & Record<string, unknown>)[]}
            columns={columns as unknown as Parameters<typeof DataTable<DbUser & Record<string, unknown>>>[0]['columns']}
            searchable
            searchPlaceholder="Search tutors..."
            actions={(row) => (
              <div className="flex items-center gap-0.5 justify-end">
                <button onClick={() => openAssignModal(row as unknown as DbUser)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                  <Users size={14} />
                </button>
                <button className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors hidden sm:block">
                  <Mail size={14} />
                </button>
                <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <MoreVertical size={14} />
                </button>
              </div>
            )}
          />
        </div>
      </Card>

      {/* Add Tutor Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Tutor"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button size="sm" icon={<UserPlus size={13} />} onClick={handleAddTutor} disabled={addLoading}>
              {addLoading ? 'Creating…' : 'Create'}
            </Button>
          </div>
        }>
        <div className="space-y-3">
          {addError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{addError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
              <input value={addForm.firstName} onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="First name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
              <input value={addForm.lastName} onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Last name" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address *</label>
            <input type="email" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="tutor@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Specializations</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALIZATIONS.map((s) => (
                <button key={s} type="button" onClick={() => toggleSpec(s)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    addForm.specializations.includes(s)
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Assign Students Modal */}
      {showAssignModal && (
        <Modal isOpen={!!showAssignModal} onClose={() => setShowAssignModal(null)} title={`Assign Students to ${showAssignModal.name}`} size="md">
          <div className="space-y-2">
            <p className="text-sm text-slate-500 mb-3">Select students to assign to this tutor:</p>
            {students.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No students available.</p>
            ) : (
              students.map((s) => {
                const checked = assignedStudentIds.includes(s.id);
                return (
                  <label key={s.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={checked}
                      onChange={() => setAssignedStudentIds((prev) => prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id])}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 flex-shrink-0" />
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold flex-shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.grade ? `Grade ${s.grade}` : s.email}</p>
                    </div>
                    {checked && <Badge variant="success" size="sm">Assigned</Badge>}
                  </label>
                );
              })
            )}
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-400">{assignedStudentIds.length} student{assignedStudentIds.length !== 1 ? 's' : ''} selected</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowAssignModal(null)}>Cancel</Button>
                <Button size="sm" onClick={handleSaveAssignments} disabled={saveLoading}>{saveLoading ? 'Saving…' : 'Save'}</Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
