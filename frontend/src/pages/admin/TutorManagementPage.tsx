import { useState, useEffect } from 'react';
import { Plus, Mail, Users, TrendingUp, UserPlus, Star, AlertTriangle, ArrowUpRight, UserMinus, ShieldAlert, CheckCircle2, KeyRound, Copy, CheckCircle, Trash2, Pencil, Save, Trash } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { DataTable } from '../../components/common/DataTable';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { TrashModal } from '../../components/common/TrashModal';
import { api, type DbUser } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';

const SPECIALIZATIONS = ['Math', 'English', 'Reading', 'Science', 'Writing', 'ACT Prep', 'SAT Prep'];

type TabKey = 'all' | 'active' | 'inactive';

interface TutorStats {
  weakAlertsCount: number;
  avgImprovement: string;
  weakStudents: DbUser[];
  assignedStudentsList: DbUser[];
}

export function TutorManagementPage() {
  const { user } = useAuthStore();
  const [tutors, setTutors] = useState<DbUser[]>([]);
  const [students, setStudents] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('all');
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>('All');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<DbUser | null>(null);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState<DbUser | null>(null);
  const [showEditModal, setShowEditModal] = useState<DbUser | null>(null);
  const [showTrashModal, setShowTrashModal] = useState(false);

  // Forms & Loading states
  const [assignedStudentIds, setAssignedStudentIds] = useState<string[]>([]);
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', email: '', specializations: [] as string[], hourlyRate: '' });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', specializations: [] as string[], hourlyRate: '' });
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<DbUser | null>(null);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [newPasswordResult, setNewPasswordResult] = useState<{ name: string; email: string; password: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DbUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [messageTutor, setMessageTutor] = useState<DbUser | null>(null);
  const [messageSubject, setMessageSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState('');
  const [messageSuccess, setMessageSuccess] = useState(false);

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

  const toggleEditSpec = (spec: string) =>
    setEditForm((f) => ({
      ...f,
      specializations: f.specializations.includes(spec)
        ? f.specializations.filter((s) => s !== spec)
        : [...f.specializations, spec],
    }));

  const openEditModal = (tutor: DbUser) => {
    const parts = tutor.name.split(' ');
    setEditForm({
      firstName: parts[0] ?? '',
      lastName: parts.slice(1).join(' '),
      specializations: (tutor.specialization as string[]) ?? [],
      hourlyRate: tutor.hourlyRate != null ? String(tutor.hourlyRate) : '',
    });
    setEditError('');
    setShowEditModal(tutor);
  };

  const handleSaveEditTutor = async () => {
    if (!showEditModal) return;
    setEditError(''); setEditLoading(true);
    try {
      const fullName = `${editForm.firstName} ${editForm.lastName}`.trim() || showEditModal.name;
      await api.updateUser(showEditModal.id, {
        name: fullName,
        specialization: editForm.specializations,
        hourlyRate: editForm.hourlyRate ? Number(editForm.hourlyRate) : null,
      });
      setShowEditModal(null);
      reload();
    } catch (e) {
      setEditError((e as Error).message || 'Failed to update tutor');
    } finally {
      setEditLoading(false);
    }
  };

  const openAssignModal = (tutor: DbUser) => {
    setAssignedStudentIds(tutor.studentIds ?? []);
    setShowAssignModal(tutor);
  };

  const handleSaveAssignments = async (tutorId: string, customStudentIds: string[]) => {
    setSaveLoading(true);
    try {
      const tutor = tutors.find(t => t.id === tutorId);
      const current = tutor?.studentIds ?? [];
      const toAdd = customStudentIds.filter((id) => !current.includes(id));
      const toRemove = current.filter((id) => !customStudentIds.includes(id));
      
      await Promise.all([
        ...toAdd.map((sid) => api.createTutorAssignment(tutorId, sid)),
        ...toRemove.map((sid) => api.deleteTutorAssignment(tutorId, sid)),
      ]);
      
      setShowAssignModal(null);
      
      // Update analytics modal if currently open
      if (showAnalyticsModal && showAnalyticsModal.id === tutorId) {
        const updatedTutor = { ...showAnalyticsModal, studentIds: customStudentIds };
        setShowAnalyticsModal(updatedTutor);
      }
      
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
      const fullName = `${addForm.firstName} ${addForm.lastName}`.trim() || addForm.email.split('@')[0];
      const res = await api.createUser({
        name: fullName,
        email: addForm.email,
        role: 'TUTOR',
        specialization: addForm.specializations.length ? addForm.specializations : undefined,
        hourlyRate: addForm.hourlyRate ? Number(addForm.hourlyRate) : undefined,
      });
      setShowAddModal(false);
      setAddForm({ firstName: '', lastName: '', email: '', specializations: [], hourlyRate: '' });
      if (res.tempPassword) setCreatedPassword({ name: fullName, email: addForm.email, password: res.tempPassword });
      reload();
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteTutor = async () => {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    try {
      await api.deleteUser(confirmDelete.id);
      setConfirmDelete(null);
      reload();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordTarget) return;
    setResetPasswordLoading(true);
    try {
      const r = await api.resetUserPassword(resetPasswordTarget.id);
      setNewPasswordResult({ name: resetPasswordTarget.name, email: resetPasswordTarget.email, password: r.tempPassword });
      setResetPasswordTarget(null);
    } catch (e) {
      console.error(e);
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageTutor || !messageSubject.trim() || !messageBody.trim()) return;
    setMessageSending(true);
    setMessageError('');
    try {
      await api.createNotification({
        userId: messageTutor.id,
        type: 'feedback',
        title: messageSubject.trim(),
        body: messageBody.trim(),
      });
      setMessageSuccess(true);
      setTimeout(() => {
        setMessageTutor(null);
        setMessageSubject('');
        setMessageBody('');
        setMessageSuccess(false);
      }, 1500);
    } catch (e) {
      setMessageError((e as Error).message || 'Failed to send message');
    } finally {
      setMessageSending(false);
    }
  };

  // Helper to calculate analytics for a specific tutor
  const getTutorStats = (tutor: DbUser): TutorStats => {
    const assignedIds = tutor.studentIds ?? [];
    const assignedStudentsList = students.filter(s => assignedIds.includes(s.id));
    
    // Alert definition: student average score is critically low (< 22) or average accuracy < 60%
    const weakStudents = assignedStudentsList.filter(s => {
      const score = s.avgScore ?? 0;
      return score > 0 && score < 24;
    });

    return {
      weakAlertsCount: weakStudents.length,
      avgImprovement: '—',
      weakStudents,
      assignedStudentsList
    };
  };

  // Status definition: Active if studentCount > 0, otherwise Inactive
  const getTutorStatus = (tutor: DbUser): 'Active' | 'Inactive' => {
    return (tutor.studentCount ?? 0) > 0 ? 'Active' : 'Inactive';
  };

  // Filtering Logic
  const filteredTutors = tutors.filter((tutor) => {
    const status = getTutorStatus(tutor);
    const matchesTab = tab === 'all' || 
      (tab === 'active' && status === 'Active') || 
      (tab === 'inactive' && status === 'Inactive');
      
    const specs = (tutor.specialization as string[]) ?? [];
    const matchesSpec = selectedSpecialization === 'All' || specs.includes(selectedSpecialization);
    
    return matchesTab && matchesSpec;
  });

  const totalStudents = tutors.reduce((a, t) => a + (t.studentCount ?? 0), 0);
  
  const tutorsWithScores = tutors.filter(t => t.avgScore != null);
  const avgScore = tutorsWithScores.length
    ? Math.round(tutorsWithScores.reduce((a, t) => a + (t.avgScore ?? 0), 0) / tutorsWithScores.length)
    : 0;

  const totalWeakAlerts = tutors.reduce((sum, t) => sum + getTutorStats(t).weakAlertsCount, 0);

  const columns = [
    {
      key: 'name',
      header: 'Tutor',
      sortable: true,
      render: (row: DbUser) => (
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700 text-xs font-bold flex-shrink-0 border border-emerald-100">
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
      key: 'status',
      header: 'Status',
      render: (row: DbUser) => {
        const active = getTutorStatus(row) === 'Active';
        return (
          <Badge variant={active ? 'success' : 'default'} className={active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'}>
            {active ? 'Active' : 'Inactive'}
          </Badge>
        );
      }
    },
    {
      key: 'specialization',
      header: 'Specialization',
      render: (row: DbUser) => {
        const specs = (row.specialization as string[]) ?? [];
        return (
          <div className="flex flex-wrap gap-1">
            {specs.slice(0, 2).map((s: string) => {
              const hue = s.charCodeAt(0) % 4;
              const badgeStyle = 
                hue === 0 ? 'bg-blue-50 text-blue-700 border-blue-100' :
                hue === 1 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                hue === 2 ? 'bg-purple-50 text-purple-700 border-purple-100' :
                'bg-emerald-50 text-emerald-700 border-emerald-100';
              return <Badge key={s} variant="default" className={`${badgeStyle} font-normal text-xs`}>{s}</Badge>;
            })}
            {specs.length > 2 && (
              <Badge variant="default" className="bg-slate-100 text-slate-600 border-slate-200 text-xs font-normal">+{specs.length - 2}</Badge>
            )}
            {specs.length === 0 && <span className="text-slate-400 text-xs">—</span>}
          </div>
        );
      },
    },
    {
      key: 'studentCount',
      header: 'Students',
      sortable: true,
      render: (row: DbUser) => (
        <div className="flex items-center gap-1.5">
          <Users size={12} className="text-slate-400" />
          <span className="text-sm text-slate-700 font-medium">{row.studentCount ?? 0}</span>
        </div>
      ),
    },
    {
      key: 'avgScore',
      header: 'Avg Score',
      sortable: true,
      render: (row: DbUser) => {
        const score = row.avgScore ?? 0;
        const pct = Math.min(100, (score / 36) * 100);
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-900">{score || '—'}</span>
            {score > 0 && (
              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                <div className={`h-full rounded-full ${pct >= 75 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'alerts',
      header: 'Alerts',
      render: (row: DbUser) => {
        const { weakAlertsCount } = getTutorStats(row);
        return weakAlertsCount > 0 ? (
          <Badge variant="danger" className="bg-red-50 text-red-700 border-red-100 font-medium text-xs flex items-center gap-1 w-fit">
            <AlertTriangle size={10} />
            {weakAlertsCount} critical
          </Badge>
        ) : (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <CheckCircle2 size={11} className="text-emerald-500" /> Clear
          </span>
        );
      }
    },
    {
      key: 'trends',
      header: 'Trend',
      render: (row: DbUser) => {
        const { avgImprovement } = getTutorStats(row);
        return (
          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5">
            <ArrowUpRight size={12} />
            {avgImprovement}
          </span>
        );
      }
    }
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header and Add Modal button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Tutors</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage tutor assignments, student improvement plans, and tracking</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={<Trash size={13} />} onClick={() => setShowTrashModal(true)}>Trash</Button>
          <Button size="sm" icon={<Plus size={13} />} onClick={() => { setAddForm({ firstName: '', lastName: '', email: '', specializations: [], hourlyRate: '' }); setShowAddModal(true); }}>Add Tutor</Button>
        </div>
      </div>

      {/* Analytics Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'Total Tutors', value: tutors.length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Students', value: totalStudents, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Weak Student Alerts', value: totalWeakAlerts, color: totalWeakAlerts > 0 ? 'text-red-600' : 'text-slate-500', bg: totalWeakAlerts > 0 ? 'bg-red-50' : 'bg-slate-50', isAlert: totalWeakAlerts > 0 },
          { label: 'Avg Student Score', value: avgScore || '—', color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((s) => (
          <Card key={s.label} padding="sm">
            <div className="flex items-center gap-2 md:gap-3">
              <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                {s.isAlert ? (
                  <AlertTriangle className={`w-5 h-5 ${s.color}`} />
                ) : (
                  <span className={`text-base md:text-lg font-bold ${s.color}`}>{s.value}</span>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-sm font-semibold text-slate-800">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs and Filters Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 border border-slate-100 rounded-xl shadow-sm">
        {/* Status Tabs */}
        <div className="flex bg-slate-50 p-1 rounded-lg w-fit">
          {(['all', 'active', 'inactive'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                tab === t
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t} Tutors ({t === 'all' ? tutors.length : tutors.filter(x => getTutorStatus(x).toLowerCase() === t).length})
            </button>
          ))}
        </div>

        {/* Specialization Filter Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Filter Specialization:</span>
          <SearchableSelect
            options={[
              { id: 'All', label: 'All Specializations', searchText: 'all' },
              ...SPECIALIZATIONS.map(s => ({ id: s, label: s, searchText: s }))
            ]}
            value={selectedSpecialization}
            onChange={setSelectedSpecialization}
            placeholder="Select specialization"
            minWidth="min-w-[180px]"
          />
        </div>
      </div>

      {/* Tutor cards grid */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          Loading tutors database...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {filteredTutors.map((tutor) => {
            const { weakAlertsCount, avgImprovement } = getTutorStats(tutor);
            const status = getTutorStatus(tutor);
            
            return (
              <Card key={tutor.id} padding="none" hoverable className="border border-slate-100 shadow-sm relative overflow-hidden">
                {status === 'Inactive' && (
                  <div className="absolute top-0 right-0 w-24 h-4 bg-slate-100 text-slate-500 text-[10px] uppercase font-bold flex items-center justify-center rotate-45 translate-x-7 translate-y-3">
                    Inactive
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-lg border border-emerald-100">
                      {tutor.name.charAt(0).toUpperCase()}
                    </div>
                    {weakAlertsCount > 0 ? (
                      <Badge variant="danger" className="bg-red-50 text-red-600 border-red-100 flex items-center gap-1 animate-pulse">
                        <AlertTriangle size={11} /> {weakAlertsCount} Alert
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md">
                        <ArrowUpRight size={10} /> {avgImprovement}
                      </span>
                    )}
                  </div>
                  
                  <p className="font-bold text-slate-800 text-sm">{tutor.name}</p>
                  <p className="text-xs text-slate-400 truncate mb-3">{tutor.email}</p>
                  
                  <div className="flex flex-wrap gap-1 mb-4 h-6 overflow-hidden">
                    {((tutor.specialization as string[]) ?? []).slice(0, 2).map((s: string) => (
                      <span key={s} className="text-[10px] bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-medium">{s}</span>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-3 border-t border-slate-50 pt-3">
                    <span className="flex items-center gap-1 text-slate-600"><Users size={11} className="text-slate-400" /> {tutor.studentCount ?? 0} students</span>
                    <span className="flex items-center gap-1 text-slate-900 font-semibold"><Star size={11} className="text-amber-400 fill-amber-400" /> {tutor.avgScore ?? '—'} Avg</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <button onClick={() => openAssignModal(tutor)}
                      className="flex-1 text-xs py-1.5 px-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1 transition-colors">
                      <Users size={11} /> Assign
                    </button>
                    <button onClick={() => setShowAnalyticsModal(tutor)}
                      className="flex-1 text-xs py-1.5 px-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1 transition-colors">
                      <TrendingUp size={11} /> Stats
                    </button>
                    <button onClick={() => openEditModal(tutor)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200" title="Edit Tutor">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setResetPasswordTarget(tutor)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200" title="Reset Password">
                      <KeyRound size={13} />
                    </button>
                    <button onClick={() => { setMessageTutor(tutor); setMessageSubject('Message from Admin'); setMessageBody(''); }} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200" title="Send Notification Message">
                      <Mail size={13} />
                    </button>
                    <button onClick={() => setConfirmDelete(tutor)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
          {filteredTutors.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 text-sm bg-white border border-slate-100 rounded-2xl">No tutors match the selected filters.</div>
          )}
        </div>
      )}

      {/* Table view */}
      <Card padding="none" className="border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-bold text-slate-900 text-sm">All Tutors Detail Table</h3>
        </div>
        <div className="p-3 md:p-4">
          <DataTable<DbUser & Record<string, unknown>>
            data={filteredTutors as (DbUser & Record<string, unknown>)[]}
            columns={columns as unknown as Parameters<typeof DataTable<DbUser & Record<string, unknown>>>[0]['columns']}
            searchable
            searchPlaceholder="Search tutors..."
            actions={(row) => (
              <div className="flex items-center gap-0.5 justify-end">
                <button onClick={() => openAssignModal(row as unknown as DbUser)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Manage Assignments">
                  <Users size={14} />
                </button>
                <button onClick={() => setShowAnalyticsModal(row as unknown as DbUser)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View Analytics">
                  <TrendingUp size={14} />
                </button>
                <button onClick={() => openEditModal(row as unknown as DbUser)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit Tutor">
                  <Pencil size={14} />
                </button>
                <button onClick={() => setResetPasswordTarget(row as unknown as DbUser)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Reset Password">
                  <KeyRound size={14} />
                </button>
                <button onClick={() => { setMessageTutor(row as unknown as DbUser); setMessageSubject('Message from Admin'); setMessageBody(''); }} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors hidden sm:block" title="Send Notification Message">
                  <Mail size={14} />
                </button>
                <button onClick={() => setConfirmDelete(row as unknown as DbUser)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete Tutor">
                  <Trash2 size={14} />
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
          {user?.role === 'super_admin' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hourly Rate</label>
              <input type="number" min={0} step="0.01" value={addForm.hourlyRate} onChange={(e) => setAddForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 500" />
              <p className="text-xs text-slate-400 mt-1">Used to calculate payable amounts in Session Logs. Only visible to Super Admins.</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Specializations</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALIZATIONS.map((s) => (
                <button key={s} type="button" onClick={() => toggleSpec(s)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    addForm.specializations.includes(s)
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Edit Tutor Modal */}
      {showEditModal && (
        <Modal isOpen={!!showEditModal} onClose={() => setShowEditModal(null)} title={`Edit Tutor — ${showEditModal.name}`}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowEditModal(null)}>Cancel</Button>
              <Button size="sm" icon={<Save size={13} />} onClick={handleSaveEditTutor} disabled={editLoading}>
                {editLoading ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          }>
          <div className="space-y-3">
            {editError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                <input value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="First name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                <input value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Last name" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input value={showEditModal.email} disabled
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed" />
              <p className="text-xs text-slate-400 mt-1">Email can't be changed — it's tied to the tutor's login.</p>
            </div>
            {user?.role === 'super_admin' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hourly Rate</label>
                <input type="number" min={0} step="0.01" value={editForm.hourlyRate} onChange={(e) => setEditForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 500" />
                <p className="text-xs text-slate-400 mt-1">Used to calculate payable amounts in Session Logs. Only visible to Super Admins.</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Specializations</label>
              <div className="flex flex-wrap gap-2">
                {SPECIALIZATIONS.map((s) => (
                  <button key={s} type="button" onClick={() => toggleEditSpec(s)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      editForm.specializations.includes(s)
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Assign Students Modal */}
      {showAssignModal && (
        <Modal isOpen={!!showAssignModal} onClose={() => setShowAssignModal(null)} title={`Assign Students to ${showAssignModal.name}`} size="md">
          <div className="space-y-3">
            <p className="text-sm text-slate-500 mb-2">Select students to assign to this tutor:</p>
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {students.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No students available.</p>
              ) : (
                students.map((s) => {
                  const checked = assignedStudentIds.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                      <input type="checkbox" checked={checked}
                        onChange={() => setAssignedStudentIds((prev) => prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id])}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 flex-shrink-0" />
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 text-sm font-bold flex-shrink-0">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                        <p className="text-xs text-slate-400">{s.grade ? `Grade ${s.grade}` : s.email}</p>
                      </div>
                      {checked && <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-100" size="sm">Assigned</Badge>}
                    </label>
                  );
                })
              )}
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-400">{assignedStudentIds.length} student{assignedStudentIds.length !== 1 ? 's' : ''} selected</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowAssignModal(null)}>Cancel</Button>
                <Button size="sm" onClick={() => handleSaveAssignments(showAssignModal.id, assignedStudentIds)} disabled={saveLoading}>{saveLoading ? 'Saving…' : 'Save'}</Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Tutor Detailed Analytics Modal */}
      {showAnalyticsModal && (() => {
        const stats = getTutorStats(showAnalyticsModal);
        const specs = (showAnalyticsModal.specialization as string[]) ?? [];
        return (
          <Modal isOpen={!!showAnalyticsModal} onClose={() => setShowAnalyticsModal(null)} title={`Tutor Dashboard: ${showAnalyticsModal.name}`} size="lg">
            <div className="space-y-5">
              {/* Tutor Header Info */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-2xl border border-emerald-100 flex-shrink-0 shadow-sm">
                  {showAnalyticsModal.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-800">{showAnalyticsModal.name}</h3>
                  <p className="text-xs text-slate-400 font-medium mb-2">{showAnalyticsModal.email}</p>
                  <div className="flex flex-wrap gap-1">
                    {specs.map(s => (
                      <span key={s} className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">{s}</span>
                    ))}
                    {specs.length === 0 && <span className="text-xs text-slate-400">No specialization set</span>}
                  </div>
                </div>
                <Badge variant={getTutorStatus(showAnalyticsModal) === 'Active' ? 'success' : 'default'} className="bg-emerald-50 text-emerald-700 border-emerald-100 font-medium">
                  {getTutorStatus(showAnalyticsModal)}
                </Badge>
              </div>

              {/* Tutor Analytics Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3 border border-slate-100 rounded-xl text-center shadow-sm">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Students</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">{showAnalyticsModal.studentCount ?? 0}</p>
                </div>
                <div className="bg-white p-3 border border-slate-100 rounded-xl text-center shadow-sm">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Avg score</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">{showAnalyticsModal.avgScore ?? '—'}</p>
                </div>
                <div className="bg-white p-3 border border-slate-100 rounded-xl text-center shadow-sm">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Improvement</p>
                  <p className="text-xl font-bold text-emerald-600 mt-1 flex items-center justify-center gap-0.5">
                    <ArrowUpRight size={14} /> {stats.avgImprovement}
                  </p>
                </div>
                <div className="bg-white p-3 border border-slate-100 rounded-xl text-center shadow-sm">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Alerts</p>
                  <p className={`text-xl font-bold mt-1 ${stats.weakAlertsCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                    {stats.weakAlertsCount}
                  </p>
                </div>
              </div>

              {/* Weak Student Alerts Section */}
              {stats.weakAlertsCount > 0 && (
                <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 flex gap-3 items-start animate-pulse">
                  <ShieldAlert className="text-red-500 w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-red-800">Critical Alerts: {stats.weakAlertsCount} Weak Student(s)</p>
                    <p className="text-[11px] text-red-600/95 mt-0.5">The following students have an average score below 24 ACT point standard and need urgent syllabus revision:</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {stats.weakStudents.map(ws => (
                        <span key={ws.id} className="text-[10px] font-bold bg-white text-red-600 border border-red-200 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                          <Star size={10} className="fill-red-500 text-red-500" />
                          {ws.name} ({ws.avgScore} Avg)
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Assigned Students List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1"><Users size={12} /> Assigned Student Profiles ({stats.assignedStudentsList.length})</h4>
                  <button 
                    onClick={() => { setAssignedStudentIds(showAnalyticsModal.studentIds ?? []); setShowAssignModal(showAnalyticsModal); }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 rounded-lg px-2 py-1 transition-all"
                  >
                    Edit Assignments
                  </button>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {stats.assignedStudentsList.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">No students assigned to this tutor currently.</div>
                  ) : (
                    stats.assignedStudentsList.map((st) => {
                      const stScore = st.avgScore ?? 0;
                      const isWeak = stScore > 0 && stScore < 24;
                      return (
                        <div key={st.id} className="flex items-center justify-between p-2.5 border border-slate-100 rounded-xl hover:bg-slate-50/50 transition-colors bg-white">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 text-xs font-bold border border-blue-100">
                              {st.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-800">{st.name}</p>
                              <p className="text-[10px] text-slate-400">{st.grade ? `Grade ${st.grade}` : st.email}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {isWeak ? (
                              <Badge variant="danger" className="bg-red-50 text-red-600 border-red-100 text-[10px] font-bold">Needs Revision</Badge>
                            ) : (
                              <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px]">Good Progress</Badge>
                            )}
                            <div className="text-right">
                              <span className="text-xs font-bold text-slate-800 block">{st.avgScore ?? '—'} Avg</span>
                              <span className="text-[10px] text-slate-400 block">{st.testsAttempted ?? 0} tests</span>
                            </div>
                            <button 
                              onClick={async () => {
                                if (confirm(`Remove ${st.name} from ${showAnalyticsModal.name}?`)) {
                                  const filtered = showAnalyticsModal.studentIds?.filter(id => id !== st.id) ?? [];
                                  await handleSaveAssignments(showAnalyticsModal.id, filtered);
                                }
                              }}
                              className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors border border-transparent hover:border-red-100" 
                              title="Remove Assignment"
                            >
                              <UserMinus size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <Button variant="secondary" size="sm" onClick={() => setShowAnalyticsModal(null)}>Close Dashboard</Button>
              </div>
            </div>
          </Modal>
        );
      })()}
      {/* Temp Password Modal — backdrop click disabled so a stray click can't lose
          a password that's never shown again (it's never stored in plaintext). */}
      <Modal isOpen={!!createdPassword} onClose={() => { setCreatedPassword(null); setCopiedPassword(false); }} title="Tutor Created" size="sm"
        closeOnBackdrop={false}
        footer={<Button size="sm" onClick={() => { setCreatedPassword(null); setCopiedPassword(false); }}>Done, I've saved this</Button>}>
        {createdPassword && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <p className="text-sm font-semibold text-emerald-900">{createdPassword.name}</p>
              <p className="text-xs text-emerald-700 truncate">{createdPassword.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1"><KeyRound size={12} /> Temporary Password</p>
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <code className="flex-1 text-base font-mono font-bold text-amber-900 tracking-widest select-all">{createdPassword.password}</code>
                <button onClick={() => { navigator.clipboard.writeText(createdPassword!.password); setCopiedPassword(true); setTimeout(() => setCopiedPassword(false), 2000); }}
                  className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 transition-colors flex-shrink-0" title="Copy password">
                  {copiedPassword ? <CheckCircle size={15} className="text-emerald-600" /> : <Copy size={15} />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Copy this now — it won't be shown again. If it's lost, use "Reset Password" on this tutor later to generate a new one.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Reset Password confirm */}
      <Modal isOpen={!!resetPasswordTarget} onClose={() => setResetPasswordTarget(null)} title="Reset Password" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setResetPasswordTarget(null)}>Cancel</Button>
            <Button size="sm" onClick={handleResetPassword} disabled={resetPasswordLoading}>
              {resetPasswordLoading ? 'Generating…' : 'Generate New Password'}
            </Button>
          </div>
        }>
        {resetPasswordTarget && (
          <p className="text-sm text-slate-600">
            This immediately replaces <span className="font-semibold text-slate-900">{resetPasswordTarget.name}</span>'s current
            password with a new one-time password — their old password stops working right away.
          </p>
        )}
      </Modal>

      {/* New Password result — same "can't lose it" treatment as the creation popup */}
      <Modal isOpen={!!newPasswordResult} onClose={() => { setNewPasswordResult(null); setCopiedPassword(false); }} title="New Password Generated" size="sm"
        closeOnBackdrop={false}
        footer={<Button size="sm" onClick={() => { setNewPasswordResult(null); setCopiedPassword(false); }}>Done, I've saved this</Button>}>
        {newPasswordResult && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <p className="text-sm font-semibold text-emerald-900">{newPasswordResult.name}</p>
              <p className="text-xs text-emerald-700 truncate">{newPasswordResult.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1"><KeyRound size={12} /> New Temporary Password</p>
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <code className="flex-1 text-base font-mono font-bold text-amber-900 tracking-widest select-all">{newPasswordResult.password}</code>
                <button onClick={() => { navigator.clipboard.writeText(newPasswordResult!.password); setCopiedPassword(true); setTimeout(() => setCopiedPassword(false), 2000); }}
                  className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 transition-colors flex-shrink-0" title="Copy password">
                  {copiedPassword ? <CheckCircle size={15} className="text-emerald-600" /> : <Copy size={15} />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">Copy this now — it won't be shown again. Share it with the tutor.</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal — moves to Trash, not a permanent delete. */}
      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Move Tutor to Trash" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button size="sm" onClick={handleDeleteTutor} disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 text-white border-red-600">
              {deleteLoading ? 'Moving…' : 'Move to Trash'}
            </Button>
          </div>
        }>
        {confirmDelete && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{confirmDelete.name}</span> will be moved to Trash and hidden from active
              lists. Nothing is erased — you can restore them or delete them permanently from the Trash at any time.
            </p>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-sm flex-shrink-0">
                {confirmDelete.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-red-900">{confirmDelete.name}</p>
                <p className="text-xs text-red-650">{confirmDelete.email}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <TrashModal isOpen={showTrashModal} onClose={() => setShowTrashModal(false)} role="TUTOR" entityLabel="Tutor" onChanged={reload} />

      {/* Send Message Modal */}
      {messageTutor && (
        <Modal
          isOpen={!!messageTutor}
          onClose={() => { setMessageTutor(null); setMessageSubject(''); setMessageBody(''); setMessageError(''); setMessageSuccess(false); }}
          title={`Send Message to ${messageTutor.name}`}
          size="sm"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setMessageTutor(null); setMessageSubject(''); setMessageBody(''); setMessageError(''); setMessageSuccess(false); }}>Cancel</Button>
              <Button size="sm" onClick={handleSendMessage} disabled={messageSending || !messageBody.trim() || !messageSubject.trim()}>
                {messageSending ? 'Sending…' : 'Send Message'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {messageError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg font-medium">{messageError}</p>}
            {messageSuccess && <p className="text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg font-medium">Message sent successfully!</p>}
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Subject</label>
              <input
                type="text"
                value={messageSubject}
                onChange={(e) => { setMessageError(''); setMessageSubject(e.target.value); }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                placeholder="Enter subject"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Message Content</label>
              <textarea
                value={messageBody}
                onChange={(e) => { setMessageError(''); setMessageBody(e.target.value); }}
                rows={4}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-normal text-slate-700"
                placeholder="Type your message here..."
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
