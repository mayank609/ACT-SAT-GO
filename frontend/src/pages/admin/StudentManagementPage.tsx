import { useState, useRef } from 'react';
import { Plus, Upload, UserPlus, MoreVertical, Mail, BookOpen, TrendingUp, CheckCircle, AlertCircle, FileText, Download } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { DataTable } from '../../components/common/DataTable';
import { MOCK_STUDENTS, MOCK_TUTORS } from '../../data/mockData';
import { parseCSV, exportToCsv } from '../../utils/exportCsv';
import type { Student } from '../../types';

type TabKey = 'all' | 'active' | 'inactive';

export function StudentManagementPage() {
  const [tab, setTab] = useState<TabKey>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([]);
  const [csvError, setCsvError] = useState('');
  const [csvSuccess, setCsvSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = (file: File) => {
    setCsvError('');
    setCsvSuccess(false);
    if (!file.name.match(/\.(csv|txt)$/i)) {
      setCsvError('Please upload a .csv file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (!rows.length) { setCsvError('File is empty or invalid'); return; }
      const requiredCols = ['name', 'email'];
      const headers = Object.keys(rows[0]).map((h) => h.toLowerCase());
      const missing = requiredCols.filter((c) => !headers.includes(c));
      if (missing.length) { setCsvError(`Missing columns: ${missing.join(', ')}`); return; }
      setCsvPreview(rows.slice(0, 5));
    };
    reader.readAsText(file);
  };

  const handleCsvUpload = () => {
    setCsvSuccess(true);
    setTimeout(() => { setCsvSuccess(false); setShowBulkModal(false); setCsvPreview([]); }, 1500);
  };

  const downloadTemplate = () => {
    exportToCsv([{ name: 'John Doe', email: 'john@school.edu', grade: '11', targetScore: '32', tutorId: '' }], 'student_upload_template.csv');
  };

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: MOCK_STUDENTS.length },
    { key: 'active', label: 'Active', count: MOCK_STUDENTS.filter((s) => s.testsAttempted && s.testsAttempted > 0).length },
    { key: 'inactive', label: 'Inactive', count: MOCK_STUDENTS.filter((s) => !s.testsAttempted || s.testsAttempted === 0).length },
  ];

  const columns = [
    {
      key: 'name',
      header: 'Student',
      sortable: true,
      render: (row: Student) => (
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
            {row.name.charAt(0)}
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
      render: (row: Student) => <Badge variant="default">{row.grade ? `Gr.${row.grade}` : 'N/A'}</Badge>,
    },
    {
      key: 'tutorId',
      header: 'Tutor',
      render: (row: Student) => {
        const tutor = MOCK_TUTORS.find((t) => t.id === row.tutorId);
        return tutor ? (
          <span className="text-sm text-slate-700 truncate max-w-24 block">{tutor.name.split(' ').slice(-1)[0]}</span>
        ) : <span className="text-slate-400 text-sm">—</span>;
      },
    },
    {
      key: 'testsAttempted',
      header: 'Tests',
      sortable: true,
      render: (row: Student) => <span className="text-sm text-slate-700">{row.testsAttempted ?? 0}</span>,
    },
    {
      key: 'avgScore',
      header: 'Score',
      sortable: true,
      render: (row: Student) => {
        const score = row.avgScore ?? 0;
        const target = row.targetScore ?? 36;
        const pct = Math.min(100, (score / target) * 100);
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-slate-900">{score}</span>
            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
              <div className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: 'lastActive',
      header: 'Last Active',
      sortable: true,
      render: (row: Student) => <span className="text-xs text-slate-500 whitespace-nowrap">{row.lastActive ?? '—'}</span>,
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage profiles, assignments, and progress</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<Upload size={13} />} onClick={() => setShowBulkModal(true)}>Bulk Upload</Button>
          <Button size="sm" icon={<Plus size={13} />} onClick={() => setShowAddModal(true)}>Add Student</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'Total', value: MOCK_STUDENTS.length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'With Tutors', value: MOCK_STUDENTS.filter((s) => s.tutorId).length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Avg Score', value: (MOCK_STUDENTS.reduce((a, s) => a + (s.avgScore || 0), 0) / MOCK_STUDENTS.length).toFixed(1), color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Tests Done', value: MOCK_STUDENTS.reduce((a, s) => a + (s.testsAttempted || 0), 0), color: 'text-amber-600', bg: 'bg-amber-50' },
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

      {/* Tabs */}
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

      {/* Table */}
      <Card padding="none">
        <div className="p-3 md:p-4">
          <DataTable<Student & Record<string, unknown>>
            data={MOCK_STUDENTS as (Student & Record<string, unknown>)[]}
            columns={columns as unknown as Parameters<typeof DataTable<Student & Record<string, unknown>>>[0]['columns']}
            searchable
            searchPlaceholder="Search students..."
            actions={(row) => (
              <div className="flex items-center gap-0.5 md:gap-1 justify-end">
                <button onClick={() => setSelectedStudent(row as unknown as Student)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                  <TrendingUp size={14} />
                </button>
                <button className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors hidden sm:block">
                  <Mail size={14} />
                </button>
                <button className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors hidden sm:block">
                  <BookOpen size={14} />
                </button>
                <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <MoreVertical size={14} />
                </button>
              </div>
            )}
          />
        </div>
      </Card>

      {/* Add Student Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Student"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button size="sm" icon={<UserPlus size={13} />}>Create</Button>
          </div>
        }>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
              <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="First name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
              <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Last name" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input type="email" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="student@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Grade</label>
              <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Grade</option>
                {['9', '10', '11', '12'].map((g) => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Target Score</label>
              <input type="number" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 32" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assign Tutor</label>
            <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">No tutor</option>
              {MOCK_TUTORS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
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
              <>
                <AlertCircle size={28} className="text-red-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-red-700">{csvError}</p>
                <p className="text-xs text-red-500 mt-1">Click to try again</p>
              </>
            ) : csvPreview.length ? (
              <>
                <CheckCircle size={28} className="text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-emerald-700">{csvPreview.length}+ rows detected</p>
                <p className="text-xs text-emerald-600 mt-1">Click to replace file</p>
              </>
            ) : (
              <>
                <Upload size={28} className="text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Drop CSV file here</p>
                <p className="text-xs text-slate-500 mt-1">or <span className="text-blue-600">browse files</span></p>
              </>
            )}
          </div>

          {csvPreview.length > 0 && !csvError && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Preview (first {csvPreview.length} rows)</p>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>{Object.keys(csvPreview[0]).map((h) => <th key={h} className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csvPreview.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((v, j) => <td key={j} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-28 truncate">{v}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <FileText size={12} />
            <span>Required columns: <code className="bg-slate-100 px-1 rounded">name</code>, <code className="bg-slate-100 px-1 rounded">email</code>. Optional: grade, targetScore, tutorId</span>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={downloadTemplate} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
              <Download size={12} /> Download template CSV
            </button>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setShowBulkModal(false); setCsvPreview([]); setCsvError(''); }}>Cancel</Button>
              <Button size="sm" icon={csvSuccess ? <CheckCircle size={13} /> : <Upload size={13} />}
                disabled={!csvPreview.length || !!csvError} onClick={handleCsvUpload}
                variant={csvSuccess ? 'success' : 'primary'}>
                {csvSuccess ? 'Uploaded!' : `Upload ${csvPreview.length ? `(${csvPreview.length}+ rows)` : ''}`}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Student detail modal */}
      {selectedStudent && (
        <Modal isOpen={!!selectedStudent} onClose={() => setSelectedStudent(null)} title="Student Profile" size="md">
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl flex-shrink-0">
                {selectedStudent.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900 truncate">{selectedStudent.name}</h3>
                <p className="text-sm text-slate-500 truncate">{selectedStudent.email}</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {selectedStudent.grade && <Badge variant="default" size="sm">Grade {selectedStudent.grade}</Badge>}
                  <Badge variant="info" size="sm">Target: {selectedStudent.targetScore}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              {[
                { label: 'Tests Attempted', value: selectedStudent.testsAttempted ?? 0 },
                { label: 'Average Score', value: selectedStudent.avgScore ?? '—' },
                { label: 'Target Score', value: selectedStudent.targetScore ?? '—' },
              ].map((s) => (
                <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Assigned Tutor</h4>
              {selectedStudent.tutorId ? (
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold flex-shrink-0">
                    {MOCK_TUTORS.find((t) => t.id === selectedStudent.tutorId)?.name.charAt(0)}
                  </div>
                  <span className="text-sm text-slate-700 truncate">{MOCK_TUTORS.find((t) => t.id === selectedStudent.tutorId)?.name}</span>
                </div>
              ) : <p className="text-sm text-slate-400">No tutor assigned</p>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
