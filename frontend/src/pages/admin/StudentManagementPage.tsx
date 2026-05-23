import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, UserPlus, TrendingUp, CheckCircle, AlertCircle, FileText, Download, Pencil, Trash2, Copy, KeyRound, Phone, School, User2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { DataTable } from '../../components/common/DataTable';
import { api, type DbUser } from '../../lib/api';
import { parseCSV, exportToCsv } from '../../utils/exportCsv';

type TabKey = 'all' | 'active' | 'inactive';

export function StudentManagementPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<DbUser[]>([]);
  const [tutors, setTutors] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([]);
  const [csvError, setCsvError] = useState('');
  const [csvSuccess, setCsvSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', email: '', grade: '', targetScore: '', tutorId: '', phone: '', parentPhone: '', dob: '', schoolName: '' });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    Promise.all([
      api.getUsersByRole('STUDENT').then((r) => setStudents(r.users ?? [])),
      api.getUsersByRole('TUTOR').then((r) => setTutors(r.users ?? [])),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const handleFileDrop = (file: File) => {
    setCsvError(''); setCsvSuccess(false);
    if (!file.name.match(/\.(csv|txt)$/i)) { setCsvError('Please upload a .csv file'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (!rows.length) { setCsvError('File is empty or invalid'); return; }
      const headers = Object.keys(rows[0]).map((h) => h.toLowerCase());
      const missing = ['name', 'email'].filter((c) => !headers.includes(c));
      if (missing.length) { setCsvError(`Missing columns: ${missing.join(', ')}`); return; }
      setCsvPreview(rows.slice(0, 5));
    };
    reader.readAsText(file);
  };

  const handleCsvUpload = async () => {
    if (!csvPreview.length) return;
    setAddLoading(true);
    let created = 0;
    for (const row of csvPreview) {
      try {
        await api.createUser({
          name: row.name ?? row.Name ?? '',
          email: row.email ?? row.Email ?? '',
          role: 'STUDENT',
          grade: row.grade ?? row.Grade ?? undefined,
          targetScore: (row.targetScore ?? row['Target Score']) ? Number(row.targetScore ?? row['Target Score']) : undefined,
          tutorId: row.tutorId ?? undefined,
          phone: row.phone ?? row.Phone ?? undefined,
          parentPhone: row.parentPhone ?? row['Parent Phone'] ?? undefined,
          dob: row.dob ?? row.DOB ?? row['Date of Birth'] ?? undefined,
          schoolName: row.schoolName ?? row['School Name'] ?? row.school ?? undefined,
        });
        created++;
      } catch { /* skip invalid rows */ }
    }
    setAddLoading(false);
    if (created > 0) {
      setCsvSuccess(true);
      setTimeout(() => { setCsvSuccess(false); setShowBulkModal(false); setCsvPreview([]); reload(); }, 1500);
    }
  };

  const downloadTemplate = () => {
    exportToCsv([
      { name: 'John Doe', email: 'john@school.edu', grade: '11', targetScore: '32', tutorId: '', phone: '555-0100', parentPhone: '555-0101', dob: '2008-03-15', schoolName: 'Lincoln High School' },
      { name: 'Jane Smith', email: 'jane@school.edu', grade: '10', targetScore: '30', tutorId: '', phone: '555-0200', parentPhone: '555-0201', dob: '2009-07-22', schoolName: 'Washington Academy' },
    ], 'student_upload_template.csv');
  };

  const handleAddStudent = async () => {
    if (!addForm.email) return;
    setAddError(''); setAddLoading(true);
    const fullName = `${addForm.firstName} ${addForm.lastName}`.trim() || addForm.email.split('@')[0];
    try {
      if (isEditing && editingStudentId) {
        await api.updateUser(editingStudentId, {
          name: fullName,
          grade: addForm.grade || undefined,
          targetScore: addForm.targetScore ? Number(addForm.targetScore) : undefined,
          tutorId: addForm.tutorId || undefined,
          phone: addForm.phone || undefined,
          parentPhone: addForm.parentPhone || undefined,
          dob: addForm.dob || undefined,
          schoolName: addForm.schoolName || undefined,
        });
        setShowAddModal(false);
        setIsEditing(false);
        setEditingStudentId(null);
        setAddForm({ firstName: '', lastName: '', email: '', grade: '', targetScore: '', tutorId: '', phone: '', parentPhone: '', dob: '', schoolName: '' });
        reload();
      } else {
        const res = await api.createUser({
          name: fullName,
          email: addForm.email,
          role: 'STUDENT',
          grade: addForm.grade || undefined,
          targetScore: addForm.targetScore ? Number(addForm.targetScore) : undefined,
          tutorId: addForm.tutorId || undefined,
          phone: addForm.phone || undefined,
          parentPhone: addForm.parentPhone || undefined,
          dob: addForm.dob || undefined,
          schoolName: addForm.schoolName || undefined,
        });
        setShowAddModal(false);
        setAddForm({ firstName: '', lastName: '', email: '', grade: '', targetScore: '', tutorId: '', phone: '', parentPhone: '', dob: '', schoolName: '' });
        reload();
        if (res.tempPassword) {
          setCreatedPassword({ name: fullName, email: addForm.email, password: res.tempPassword });
        }
      }
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAddLoading(false);
    }
  };

  const activeStudents = students.filter((s) => (s.testsAttempted ?? 0) > 0);
  const inactiveStudents = students.filter((s) => !s.testsAttempted || s.testsAttempted === 0);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: students.length },
    { key: 'active', label: 'Active', count: activeStudents.length },
    { key: 'inactive', label: 'Inactive', count: inactiveStudents.length },
  ];

  const tabData = tab === 'active' ? activeStudents : tab === 'inactive' ? inactiveStudents : students;

  const columns = [
    {
      key: 'name',
      header: 'Student',
      sortable: true,
      render: (row: DbUser) => (
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
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
      key: 'grade',
      header: 'Grade',
      render: (row: DbUser) => <Badge variant="default">{row.grade ? `Gr.${row.grade}` : 'N/A'}</Badge>,
    },
    {
      key: 'tutorName',
      header: 'Tutor',
      render: (row: DbUser) =>
        row.tutorName
          ? <span className="text-sm text-slate-700 truncate max-w-24 block">{row.tutorName.split(' ').slice(-1)[0]}</span>
          : <span className="text-slate-400 text-sm">—</span>,
    },
    {
      key: 'testsAttempted',
      header: 'Tests',
      sortable: true,
      render: (row: DbUser) => <span className="text-sm text-slate-700">{row.testsAttempted ?? 0}</span>,
    },
    {
      key: 'avgScore',
      header: 'Score',
      sortable: true,
      render: (row: DbUser) => {
        const score = row.avgScore ?? 0;
        const target = (row.targetScore as number | null) ?? 36;
        const pct = Math.min(100, (score / target) * 100);
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-slate-900">{score || '—'}</span>
            {score > 0 && (
              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                <div className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'accuracy',
      header: 'Accuracy',
      render: (row: DbUser) => {
        const score = row.avgScore ?? 0;
        const target = (row.targetScore as number | null) ?? 36;
        const pct = Math.min(100, Math.round((score / target) * 100));
        return <span className="text-sm text-slate-700">{score > 0 ? `${pct}%` : '—'}</span>;
      }
    },
    {
      key: 'createdAt',
      header: 'Joined',
      sortable: true,
      render: (row: DbUser) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'lastActive',
      header: 'Last Active',
      sortable: true,
      render: (row: DbUser) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {row.lastActive ? new Date(row.lastActive).toLocaleDateString() : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage profiles, assignments, and progress</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1 bg-blue-50 border border-blue-100 rounded-lg p-1 animate-fade-in">
              <span className="text-xs text-blue-700 font-medium px-2">{selectedIds.length} selected</span>
              <Button variant="ghost" size="sm" className="text-blue-700 hover:bg-blue-100" onClick={() => {
                const emails = students.filter(s => selectedIds.includes(s.id)).map(s => s.email).join(',');
                window.location.href = `mailto:${emails}`;
              }}>Email</Button>
              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-100" onClick={async () => {
                if (confirm(`Delete ${selectedIds.length} selected students? This cannot be undone.`)) {
                  await Promise.all(selectedIds.map(id => api.deleteUser(id).catch(() => {})));
                  setSelectedIds([]);
                  reload();
                }
              }}>Delete</Button>
            </div>
          )}
          <Button variant="secondary" size="sm" icon={<Upload size={13} />} onClick={() => setShowBulkModal(true)}>Bulk Upload</Button>
          <Button size="sm" icon={<Plus size={13} />} onClick={() => { setIsEditing(false); setEditingStudentId(null); setAddForm({ firstName: '', lastName: '', email: '', grade: '', targetScore: '', tutorId: '', phone: '', parentPhone: '', dob: '', schoolName: '' }); setShowAddModal(true); }}>Add Student</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'Total', value: students.length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'With Tutors', value: students.filter((s) => s.tutorId).length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Avg Score', value: students.filter(s => s.avgScore != null).length
              ? (students.reduce((a, s) => a + (s.avgScore ?? 0), 0) / students.filter(s => s.avgScore != null).length).toFixed(1)
              : '—', color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Tests Done', value: students.reduce((a, s) => a + (s.testsAttempted || 0), 0), color: 'text-amber-600', bg: 'bg-amber-50' },
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

      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 md:px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      <Card padding="none">
        <div className="p-3 md:p-4">
          {loading ? (
            <div className="py-8 text-center text-slate-400 text-sm">Loading...</div>
          ) : (
            <DataTable<DbUser & Record<string, unknown>>
              data={tabData as (DbUser & Record<string, unknown>)[]}
              columns={columns as unknown as Parameters<typeof DataTable<DbUser & Record<string, unknown>>>[0]['columns']}
              searchable
              searchPlaceholder="Search students..."
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              actions={(row) => (
                <div className="flex items-center gap-0.5 md:gap-1 justify-end">
                  <button onClick={() => navigate(`/students/${row.id}`)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View Profile">
                    <TrendingUp size={14} />
                  </button>
                  <button onClick={() => {
                    const parts = row.name.split(' ');
                    const first = parts[0] || '';
                    const last = parts.slice(1).join(' ') || '';
                    setAddForm({
                      firstName: first,
                      lastName: last,
                      email: row.email,
                      grade: row.grade || '',
                      targetScore: row.targetScore ? String(row.targetScore) : '',
                      tutorId: row.tutorId || '',
                      phone: (row as unknown as DbUser).phone || '',
                      parentPhone: (row as unknown as DbUser).parentPhone || '',
                      dob: (row as unknown as DbUser).dob || '',
                      schoolName: (row as unknown as DbUser).schoolName || '',
                    });
                    setIsEditing(true);
                    setEditingStudentId(row.id);
                    setShowAddModal(true);
                  }} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Edit Profile">
                    <Pencil size={14} />
                  </button>
                  <button onClick={async () => {
                    if (confirm(`Are you sure you want to delete ${row.name}? This cannot be undone.`)) {
                      await api.deleteUser(row.id).catch(() => {});
                      reload();
                    }
                  }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete Student">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            />
          )}
        </div>
      </Card>

      {/* Add / Edit Student Modal */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setAddError(''); setIsEditing(false); setEditingStudentId(null); }} title={isEditing ? 'Edit Student Details' : 'Add New Student'} size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowAddModal(false); setIsEditing(false); setEditingStudentId(null); }}>Cancel</Button>
            <Button size="sm" icon={isEditing ? <Pencil size={13} /> : <UserPlus size={13} />} onClick={handleAddStudent} disabled={addLoading}>
              {addLoading ? 'Saving…' : (isEditing ? 'Save Changes' : 'Create Student')}
            </Button>
          </div>
        }>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {addError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{addError}</p>}

          {/* Personal Info */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              <User2 size={12} /> Personal Information
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
                  <input value={addForm.firstName} onChange={(e) => setAddForm(f => ({ ...f, firstName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="First name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Last Name</label>
                  <input value={addForm.lastName} onChange={(e) => setAddForm(f => ({ ...f, lastName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Last name" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email Address *</label>
                <input type="email" value={addForm.email} onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))} disabled={isEditing}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400" placeholder="student@example.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth</label>
                  <input type="date" value={addForm.dob} onChange={(e) => setAddForm(f => ({ ...f, dob: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">School Name</label>
                  <input value={addForm.schoolName} onChange={(e) => setAddForm(f => ({ ...f, schoolName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Lincoln High School" />
                </div>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              <Phone size={12} /> Contact Details
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Student Phone</label>
                <input type="tel" value={addForm.phone} onChange={(e) => setAddForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="555-0100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Parent / Guardian Phone</label>
                <input type="tel" value={addForm.parentPhone} onChange={(e) => setAddForm(f => ({ ...f, parentPhone: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="555-0101" />
              </div>
            </div>
          </div>

          {/* Academic */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              <School size={12} /> Academic Info
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Grade</label>
                <select value={addForm.grade} onChange={(e) => setAddForm(f => ({ ...f, grade: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">—</option>
                  {['9', '10', '11', '12'].map((g) => <option key={g} value={g}>Grade {g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Target ACT Score</label>
                <input type="number" min={1} max={36} value={addForm.targetScore} onChange={(e) => setAddForm(f => ({ ...f, targetScore: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 32" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Assign Tutor</label>
                <select value={addForm.tutorId} onChange={(e) => setAddForm(f => ({ ...f, tutorId: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">No tutor</option>
                  {tutors.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {!isEditing && (
            <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
              A temporary password will be generated and shown to you after creation. Share it with the student for first login.
            </p>
          )}
        </div>
      </Modal>

      {/* Temp Password Modal */}
      <Modal isOpen={!!createdPassword} onClose={() => { setCreatedPassword(null); setCopiedPassword(false); }} title="Student Created" size="sm"
        footer={<Button size="sm" onClick={() => { setCreatedPassword(null); setCopiedPassword(false); }}>Done</Button>}>
        {createdPassword && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-900">{createdPassword.name}</p>
                <p className="text-xs text-emerald-700 truncate">{createdPassword.email}</p>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                <KeyRound size={12} /> Temporary Password
              </div>
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <code className="flex-1 text-base font-mono font-bold text-amber-900 tracking-widest select-all">{createdPassword.password}</code>
                <button onClick={() => { navigator.clipboard.writeText(createdPassword.password); setCopiedPassword(true); setTimeout(() => setCopiedPassword(false), 2000); }}
                  className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 transition-colors flex-shrink-0" title="Copy password">
                  {copiedPassword ? <CheckCircle size={15} className="text-emerald-600" /> : <Copy size={15} />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">Share this with the student. They should change it after first login.</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal isOpen={showBulkModal} onClose={() => { setShowBulkModal(false); setCsvPreview([]); setCsvError(''); }} title="Bulk Upload Students" size="md">
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${csvError ? 'border-red-300 bg-red-50' : csvPreview.length ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-blue-400'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileDrop(f); }}>
            <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileDrop(f); }} />
            {csvError ? (
              <><AlertCircle size={28} className="text-red-400 mx-auto mb-2" /><p className="text-sm font-medium text-red-700">{csvError}</p></>
            ) : csvPreview.length ? (
              <><CheckCircle size={28} className="text-emerald-500 mx-auto mb-2" /><p className="text-sm font-medium text-emerald-700">{csvPreview.length}+ rows detected</p></>
            ) : (
              <><Upload size={28} className="text-slate-400 mx-auto mb-2" /><p className="text-sm font-medium text-slate-700">Drop CSV file here</p></>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <FileText size={12} />
            <span>Required columns: <code className="bg-slate-100 px-1 rounded">name</code>, <code className="bg-slate-100 px-1 rounded">email</code></span>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={downloadTemplate} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
              <Download size={12} /> Download template
            </button>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setShowBulkModal(false); setCsvPreview([]); setCsvError(''); }}>Cancel</Button>
              <Button size="sm" icon={csvSuccess ? <CheckCircle size={13} /> : <Upload size={13} />}
                disabled={!csvPreview.length || !!csvError} onClick={handleCsvUpload}
                variant={csvSuccess ? 'success' : 'primary'}>
                {csvSuccess ? 'Uploaded!' : `Upload${csvPreview.length ? ` (${csvPreview.length}+ rows)` : ''}`}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

    </div>
  );
}
