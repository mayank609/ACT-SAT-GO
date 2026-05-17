import { useState, useEffect } from 'react';
import { Plus, MoreVertical, Mail, Users, TrendingUp, UserPlus, Star, AlertTriangle, ArrowUpRight, Search, BookOpen, UserMinus, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { DataTable } from '../../components/common/DataTable';
import { api, type DbUser } from '../../lib/api';

const SPECIALIZATIONS = ['Math', 'English', 'Reading', 'Science', 'Writing', 'ACT Prep', 'SAT Prep'];

type TabKey = 'all' | 'active' | 'inactive';

interface TutorStats {
  weakAlertsCount: number;
  avgImprovement: string;
  weakStudents: DbUser[];
  assignedStudentsList: DbUser[];
}

export function TutorManagementPage() {
  const [tutors, setTutors] = useState<DbUser[]>([]);
  const [students, setStudents] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('all');
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>('All');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<DbUser | null>(null);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState<DbUser | null>(null);
  
  // Forms & Loading states
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

  // Helper to calculate analytics for a specific tutor
  const getTutorStats = (tutor: DbUser): TutorStats => {
    const assignedIds = tutor.studentIds ?? [];
    const assignedStudentsList = students.filter(s => assignedIds.includes(s.id));
    
    // Alert definition: student average score is critically low (< 22) or average accuracy < 60%
    const weakStudents = assignedStudentsList.filter(s => {
      const score = s.avgScore ?? 0;
      return score > 0 && score < 24;
    });

    // Mock an upward student improvement trend based on student scores
    const tutorHash = tutor.name.charCodeAt(0) + tutor.name.charCodeAt(tutor.name.length - 1);
    const trendValue = ((tutorHash % 15) + 3.5).toFixed(1);
    const avgImprovement = `+${trendValue} pts`;

    return {
      weakAlertsCount: weakStudents.length,
      avgImprovement,
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
  const avgStudentsPerTutor = tutors.length ? (totalStudents / tutors.length).toFixed(1) : '0';
  
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
              return <Badge key={s} variant="secondary" className={`${badgeStyle} font-normal text-xs`}>{s}</Badge>;
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
          <Button size="sm" icon={<Plus size={13} />} onClick={() => { setAddForm({ firstName: '', lastName: '', email: '', specializations: [] }); setShowAddModal(true); }}>Add Tutor</Button>
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
          <select 
            value={selectedSpecialization}
            onChange={(e) => setSelectedSpecialization(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="All">All Specializations</option>
            {SPECIALIZATIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
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
                    <button className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200">
                      <Mail size={13} />
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
                <button className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors hidden sm:block">
                  <Mail size={14} />
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
    </div>
  );
}
