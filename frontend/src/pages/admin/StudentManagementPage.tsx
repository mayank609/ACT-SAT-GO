import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, UserPlus, CheckCircle, AlertCircle, FileText, Download, Pencil, Trash2, Copy, KeyRound, Phone, School, User2, Info, BarChart2, LayoutList, ChevronDown, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { api, type DbUser } from '../../lib/api';
import { parseCSV, exportToCsv } from '../../utils/exportCsv';

type TabKey = 'all' | 'active' | 'inactive';
type AnalyticsTab = 'mistake' | 'strength' | 'parallel' | 'skill';

type AnalyticsData = {
  trend: Array<{ date: string; score: number; testTitle: string; attemptId: string }>;
  sectionStats: Array<{ sectionId: string; sectionName: string; totalQuestions: number; correct: number; incorrect: number; skipped: number; accuracy: number; timeAllocated: number; timeUsed: number }>;
  questionPacingStats: Array<{ questionIndex: number; sectionName: string; timeSpentSeconds: number; status: 'correct' | 'incorrect' | 'skipped'; difficulty: string; topicName: string }>;
  overallAccuracy: number;
  totalAttempts: number;
  latestScore: number;
  avgScore: number;
};

function getStageBadge(grade: string | null | undefined) {
  const g = parseInt(grade || '0');
  if (g === 9)  return { label: 'STAGE 1', cls: 'bg-emerald-100 text-emerald-800' };
  if (g === 10) return { label: 'STAGE 2', cls: 'bg-teal-100 text-teal-700' };
  if (g === 11) return { label: 'STAGE 3', cls: 'bg-orange-100 text-orange-800' };
  if (g === 12) return { label: 'STAGE 4', cls: 'bg-purple-100 text-purple-800' };
  return null;
}

export function StudentManagementPage() {
  const navigate = useNavigate();

  // ── Existing state ────────────────────────────────────────────────────────
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

  // ── New state ─────────────────────────────────────────────────────────────
  const [primaryFilter, setPrimaryFilter] = useState<'all' | 'primary' | 'secondary'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('strength');
  const [analyticsStudentId, setAnalyticsStudentId] = useState('');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsView, setAnalyticsView] = useState<'table' | 'chart'>('table');
  const [analyticsSubject, setAnalyticsSubject] = useState('');

  // ── Data fetching ─────────────────────────────────────────────────────────
  const reload = () => {
    setLoading(true);
    Promise.all([
      api.getUsersByRole('STUDENT').then((r) => setStudents(r.users ?? [])),
      api.getUsersByRole('TUTOR').then((r) => setTutors(r.users ?? [])),
    ]).finally(() => setLoading(false));
  };
  useEffect(() => { reload(); }, []);

  useEffect(() => {
    if (!analyticsStudentId) { setAnalyticsData(null); return; }
    setAnalyticsLoading(true);
    api.getStudentAnalytics(analyticsStudentId)
      .then((r) => setAnalyticsData(r as AnalyticsData))
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, [analyticsStudentId]);

  // ── Handlers ──────────────────────────────────────────────────────────────
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
        setShowAddModal(false); setIsEditing(false); setEditingStudentId(null);
        setAddForm({ firstName: '', lastName: '', email: '', grade: '', targetScore: '', tutorId: '', phone: '', parentPhone: '', dob: '', schoolName: '' });
        reload();
      } else {
        const res = await api.createUser({
          name: fullName, email: addForm.email, role: 'STUDENT',
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
        if (res.tempPassword) setCreatedPassword({ name: fullName, email: addForm.email, password: res.tempPassword });
      }
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAddLoading(false);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const primaryStudents = students.filter(s => ['9', '10'].includes(s.grade || ''));
  const secondaryStudents = students.filter(s => ['11', '12'].includes(s.grade || ''));
  const displayStudents = primaryFilter === 'primary' ? primaryStudents : primaryFilter === 'secondary' ? secondaryStudents : students;

  const activeStudents = displayStudents.filter((s) => (s.testsAttempted ?? 0) > 0);
  const inactiveStudents = displayStudents.filter((s) => !s.testsAttempted || s.testsAttempted === 0);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: displayStudents.length },
    { key: 'active', label: 'Active', count: activeStudents.length },
    { key: 'inactive', label: 'Inactive', count: inactiveStudents.length },
  ];

  const tabData = tab === 'active' ? activeStudents : tab === 'inactive' ? inactiveStudents : displayStudents;
  const filteredData = searchTerm
    ? tabData.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.email.toLowerCase().includes(searchTerm.toLowerCase()))
    : tabData;

  // ── Analytics computed data ───────────────────────────────────────────────
  const qStats = analyticsData?.questionPacingStats ?? [];
  const filteredQStats = analyticsSubject
    ? qStats.filter(q => q.sectionName.toLowerCase().includes(analyticsSubject.toLowerCase()))
    : qStats;

  const topicMap: Record<string, { total: number; correct: number }> = {};
  filteredQStats.forEach(q => {
    const key = q.topicName || 'Unknown';
    if (!topicMap[key]) topicMap[key] = { total: 0, correct: 0 };
    topicMap[key].total++;
    if (q.status === 'correct') topicMap[key].correct++;
  });
  const rawTopicStats = Object.entries(topicMap).map(([topic, { total, correct }]) => ({
    topic, total, correct, accuracy: total > 0 ? (correct / total) * 100 : 0,
  }));

  const topicStats = analyticsTab === 'mistake'
    ? rawTopicStats.filter(t => t.accuracy < 70).sort((a, b) => a.accuracy - b.accuracy)
    : analyticsTab === 'strength'
    ? rawTopicStats.filter(t => t.accuracy >= 70).sort((a, b) => b.accuracy - a.accuracy)
    : analyticsTab === 'parallel'
    ? (analyticsData?.sectionStats ?? []).map(s => ({ topic: s.sectionName, total: s.totalQuestions, correct: s.correct, accuracy: s.accuracy }))
    : rawTopicStats.sort((a, b) => a.topic.localeCompare(b.topic));

  const totalQ = filteredQStats.length;
  const correctQ = filteredQStats.filter(q => q.status === 'correct').length;
  const accuracyPct = totalQ > 0 ? (correctQ / totalQ) * 100 : 0;

  const analyticsSubjects = [...new Set(qStats.map(q => q.sectionName).filter(Boolean))];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-sm text-slate-500 mt-0.5">Total Students: <span className="font-semibold text-slate-700">{students.length}</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Primary / Secondary toggle */}
          <div className="flex items-center gap-2 text-sm select-none">
            <span className={`font-medium transition-colors ${primaryFilter !== 'secondary' ? 'text-emerald-600' : 'text-slate-400'}`}>Primary</span>
            <button
              onClick={() => setPrimaryFilter(f => f === 'all' ? 'secondary' : f === 'secondary' ? 'primary' : 'all')}
              className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${primaryFilter === 'secondary' ? 'bg-blue-500' : primaryFilter === 'primary' ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${primaryFilter === 'secondary' ? 'left-6' : primaryFilter === 'primary' ? 'left-1' : 'left-3.5'}`} />
            </button>
            <span className={`font-medium transition-colors ${primaryFilter === 'secondary' ? 'text-blue-600' : 'text-slate-400'}`}>Secondary</span>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1 bg-blue-50 border border-blue-100 rounded-lg p-1">
              <span className="text-xs text-blue-700 font-medium px-2">{selectedIds.length} selected</span>
              <Button variant="ghost" size="sm" className="text-blue-700 hover:bg-blue-100"
                onClick={() => { const emails = students.filter(s => selectedIds.includes(s.id)).map(s => s.email).join(','); window.location.href = `mailto:${emails}`; }}>Email</Button>
              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-100"
                onClick={async () => { if (confirm(`Delete ${selectedIds.length} selected students?`)) { await Promise.all(selectedIds.map(id => api.deleteUser(id).catch(() => {}))); setSelectedIds([]); reload(); } }}>Delete</Button>
            </div>
          )}
          <Button variant="secondary" size="sm" icon={<Upload size={13} />} onClick={() => setShowBulkModal(true)}>Bulk Upload</Button>
          <Button size="sm" icon={<Plus size={13} />} onClick={() => { setIsEditing(false); setEditingStudentId(null); setAddForm({ firstName: '', lastName: '', email: '', grade: '', targetScore: '', tutorId: '', phone: '', parentPhone: '', dob: '', schoolName: '' }); setShowAddModal(true); }}>Add Student</Button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Students', value: students.length, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'With Tutors', value: students.filter(s => s.tutorId).length, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Avg Score', value: students.filter(s => s.avgScore != null).length ? (students.reduce((a, s) => a + (s.avgScore ?? 0), 0) / students.filter(s => s.avgScore != null).length).toFixed(1) : '—', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
          { label: 'Tests Done', value: students.reduce((a, s) => a + (s.testsAttempted || 0), 0), color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} px-4 py-3 flex items-center gap-3`}>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-600 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs + Search ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-0">
        <div className="flex gap-0">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <input
          type="text" placeholder="Search students…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="w-full sm:w-56 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
        />
      </div>

      {/* ── Student Table ── */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-3 text-left">
                  <input type="checkbox" className="rounded text-blue-600"
                    checked={selectedIds.length === filteredData.length && filteredData.length > 0}
                    onChange={e => setSelectedIds(e.target.checked ? filteredData.map(s => s.id) : [])} />
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Name</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Joined On</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">Attempts</th>
                <th colSpan={2} className="px-3 py-3 text-center text-xs font-semibold text-slate-600 whitespace-nowrap border-l border-slate-200">
                  Baseline Scores
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">Pending Classes</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">Last Mock Test</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">Last PRP</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">Test Report</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">Performance</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">Assessments</th>
              </tr>
              <tr className="bg-slate-50/60 border-b border-slate-200 text-[11px] text-slate-500 font-medium">
                <th colSpan={4} />
                <th className="px-3 py-1.5 text-center border-l border-slate-200">English</th>
                <th className="px-3 py-1.5 text-center">Math</th>
                <th colSpan={6} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="py-12 text-center text-slate-400">Loading…</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={12} className="py-12 text-center text-slate-400">No students found</td></tr>
              ) : filteredData.map((row, idx) => {
                const stage = getStageBadge(row.grade);
                const joinedDate = row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—';
                const lastMock = row.lastActive ? new Date(row.lastActive).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                return (
                  <tr key={row.id} className={`border-b border-slate-100 hover:bg-blue-50/20 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                    <td className="px-3 py-3">
                      <input type="checkbox" className="rounded text-blue-600"
                        checked={selectedIds.includes(row.id)}
                        onChange={e => setSelectedIds(e.target.checked ? [...selectedIds, row.id] : selectedIds.filter(id => id !== row.id))} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {row.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900 text-sm">{row.name}</span>
                            <button onClick={() => navigate(`/students/${row.id}`)} className="text-slate-400 hover:text-blue-500 transition-colors flex-shrink-0" title="View profile">
                              <Info size={11} />
                            </button>
                            {stage && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${stage.cls}`}>{stage.label}</span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">{row.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{joinedDate}</td>
                    <td className="px-3 py-3 text-sm text-slate-700 text-center font-medium">{row.testsAttempted ?? 0}</td>
                    <td className="px-3 py-3 text-sm text-slate-700 text-center border-l border-slate-100 font-medium">
                      {row.avgScore ? Math.round(row.avgScore) : '—'}
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-700 text-center font-medium">
                      {row.avgScore ? Math.round(row.avgScore) : '—'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => navigate(`/students/${row.id}`)} className="text-xs text-blue-500 hover:text-blue-700 font-semibold">View</button>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500 text-center whitespace-nowrap">{lastMock}</td>
                    <td className="px-3 py-3 text-center text-xs text-slate-400">—</td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => navigate(`/students/${row.id}`)} className="text-xs text-blue-500 hover:text-blue-700 font-semibold">View</button>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => navigate(`/students/${row.id}`)} className="text-xs text-blue-500 hover:text-blue-700 font-semibold">View</button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => navigate(`/students/${row.id}`)}
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                        >
                          Assign
                        </button>
                        <button
                          onClick={() => {
                            const parts = row.name.split(' ');
                            setAddForm({ firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '', email: row.email, grade: row.grade || '', targetScore: row.targetScore ? String(row.targetScore) : '', tutorId: row.tutorId || '', phone: row.phone || '', parentPhone: row.parentPhone || '', dob: row.dob || '', schoolName: row.schoolName || '' });
                            setIsEditing(true); setEditingStudentId(row.id); setShowAddModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={async () => { if (confirm(`Delete ${row.name}?`)) { await api.deleteUser(row.id).catch(() => {}); reload(); } }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Analytics Section ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-800">Select Analytics</h2>
        </div>

        {/* Analytics Tabs */}
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'mistake',  label: 'Mistake Analytics' },
            { key: 'strength', label: 'Strength Analytics' },
            { key: 'parallel', label: 'Parallel Analysis' },
            { key: 'skill',    label: 'Skill Analysis' },
          ] as { key: AnalyticsTab; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setAnalyticsTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${analyticsTab === t.key ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Selected Filters</span>

          {/* Student selector */}
          <div className="relative">
            <select
              value={analyticsStudentId}
              onChange={e => { setAnalyticsStudentId(e.target.value); setAnalyticsSubject(''); }}
              className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
            >
              <option value="">Select student</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Subject filter */}
          {analyticsData && analyticsSubjects.length > 0 && (
            <div className="relative">
              <select
                value={analyticsSubject}
                onChange={e => setAnalyticsSubject(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
              >
                <option value="">All Subjects</option>
                {analyticsSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}

          {analyticsSubject && (
            <button onClick={() => setAnalyticsSubject('')} className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-medium hover:bg-blue-100">
              {analyticsSubject} <X size={11} />
            </button>
          )}
        </div>

        {/* No student selected state */}
        {!analyticsStudentId && (
          <Card padding="md">
            <div className="py-8 text-center">
              <BarChart2 size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm font-medium">Select a student above to view their analytics</p>
              <p className="text-slate-400 text-xs mt-1">Mistake, Strength, Parallel, and Skill analysis will appear here</p>
            </div>
          </Card>
        )}

        {/* Analytics content */}
        {analyticsStudentId && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-100 mb-2">Total Questions</p>
                <p className="text-4xl font-bold">{analyticsLoading ? '—' : totalQ}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100 mb-2">Correct Questions</p>
                <p className="text-4xl font-bold">{analyticsLoading ? '—' : correctQ}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 p-5 text-white shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-100 mb-2">Accuracy</p>
                <p className="text-4xl font-bold">{analyticsLoading ? '—' : `${accuracyPct.toFixed(2)}%`}</p>
              </div>
            </div>

            {/* Table / Chart toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAnalyticsView('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${analyticsView === 'table' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
              >
                <LayoutList size={13} /> Table View
              </button>
              <button
                onClick={() => setAnalyticsView('chart')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${analyticsView === 'chart' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
              >
                <BarChart2 size={13} /> Chart View
              </button>
            </div>

            {analyticsLoading ? (
              <Card padding="md"><div className="py-8 text-center text-slate-400 text-sm">Loading analytics…</div></Card>
            ) : topicStats.length === 0 ? (
              <Card padding="md"><div className="py-8 text-center text-slate-400 text-sm">No data for this filter</div></Card>
            ) : analyticsView === 'table' ? (
              <Card padding="none">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-10">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Topic</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">Total Questions</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">Correct Questions</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topicStats.map((t, i) => (
                      <tr key={t.topic} className={`border-b border-slate-100 hover:bg-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{t.topic}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{t.total}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{t.correct}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold ${t.accuracy >= 80 ? 'text-emerald-600' : t.accuracy >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                            {t.accuracy.toFixed(2)} %
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ) : (
              <Card padding="md">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={topicStats} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
                    <XAxis dataKey="topic" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Accuracy']} />
                    <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                      {topicStats.map((t, i) => (
                        <Cell key={i} fill={t.accuracy >= 80 ? '#10b981' : t.accuracy >= 60 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </>
        )}
      </div>

      {/* ── Add / Edit Student Modal ── */}
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

      {/* ── Temp Password Modal ── */}
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

      {/* ── Bulk Upload Modal ── */}
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
