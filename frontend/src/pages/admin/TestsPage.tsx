import { useState, useEffect, useMemo } from 'react';
import { Plus, Eye, Edit, Trash2, Users, Clock, FileText, MoreVertical, BookOpen, Archive, UserPlus, X, Loader2, CheckCircle2, Search, Copy, Boxes, Package, ChevronDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { useAdminStore, type ApiTest } from '../../store/useAdminStore';
import { useAuthStore } from '../../store/useAuthStore';
import { api, type DbUser, type DbTestPackage } from '../../lib/api';
import { toast, Toaster } from 'react-hot-toast';

// Shared scheduling options (attempts + date windows) used by both the
// single-test and package assign modals.
interface AssignOptions {
  dueAt: string;
  availableFrom: string;
  availableUntil: string;
  maxAttempts: number;
}

// ── Assign Modal ──────────────────────────────────────────────────────────────

interface AssignModalProps {
  test: ApiTest;
  onClose: () => void;
}

function AssignModal({ test, onClose }: AssignModalProps) {
  const [students, setStudents] = useState<DbUser[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dueAt, setDueAt] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableUntil, setAvailableUntil] = useState('');
  const [attemptsMode, setAttemptsMode] = useState<'single' | 'multiple'>('single');
  const [multipleCount, setMultipleCount] = useState(3);
  const maxAttempts = attemptsMode === 'single' ? 1 : multipleCount;
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      api.getUsersByRole('STUDENT'),
      api.getTestAssignments(test.id),
    ]).then(([usersRes, assignRes]) => {
      setStudents(usersRes.users);
      setAssigned(new Set(assignRes.assignments.map((a) => a.studentId)));
    }).catch(() => {
      toast.error('Failed to load students');
    }).finally(() => setLoadingStudents(false));
  }, [test.id]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAssign = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const res = await api.createTestAssignments({
        testId: test.id,
        studentIds: [...selected],
        dueAt: dueAt || null,
        availableFrom: availableFrom || null,
        availableUntil: availableUntil || null,
        maxAttempts,
      });
      toast.success(`Assigned to ${res.created} student${res.created !== 1 ? 's' : ''}${res.skipped > 0 ? ` (${res.skipped} already assigned)` : ''}`);
      onClose();
    } catch {
      toast.error('Failed to assign test');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (studentId: string) => {
    try {
      await api.deleteTestAssignment(test.id, studentId);
      setAssigned((prev) => { const next = new Set(prev); next.delete(studentId); return next; });
      toast.success('Assignment removed');
    } catch {
      toast.error('Failed to remove assignment');
    }
  };

  const filtered = students.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal isOpen onClose={onClose} title={`Assign — ${test.title}`} size="lg">
      <div className="space-y-4">
        {/* Already assigned */}
        {assigned.size > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Already Assigned ({assigned.size})</p>
            <div className="flex flex-wrap gap-2">
              {students.filter((s) => assigned.has(s.id)).map((s) => (
                <span key={s.id} className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-2.5 py-1 rounded-full">
                  <CheckCircle2 size={11} />
                  {s.name}
                  <button onClick={() => handleRemove(s.id)} className="text-emerald-400 hover:text-red-500 ml-0.5">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Student picker */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Select Students to Assign</p>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
          />
          {loadingStudents ? (
            <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No students found</p>
          ) : (
            <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-50">
              {filtered.map((s) => (
                <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                    <p className="text-xs text-slate-400 truncate">{s.email}</p>
                  </div>
                  {assigned.has(s.id) && <span className="text-xs text-emerald-600 font-medium">Already assigned</span>}
                </label>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No students found</p>
              )}
            </div>
          )}
        </div>

        {/* Options */}
        {selected.size > 0 && (
          <div className="space-y-3 pt-1">
            {/* Attempts selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Attempts Allowed</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAttemptsMode('single')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    attemptsMode === 'single'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <span className="text-base">1×</span>
                  <span className="text-xs">Single Attempt</span>
                  <span className="text-[10px] text-slate-400 font-normal">Complete once, done</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAttemptsMode('multiple')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    attemptsMode === 'multiple'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <span className="text-base">N×</span>
                  <span className="text-xs">Multiple Attempts</span>
                  <span className="text-[10px] text-slate-400 font-normal">Student can retake</span>
                </button>
              </div>
              {attemptsMode === 'multiple' && (
                <div className="mt-2 flex items-center gap-3">
                  <label className="text-xs text-slate-500 flex-shrink-0">Number of attempts:</label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setMultipleCount(c => Math.max(2, c - 1))}
                      className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold text-sm">−</button>
                    <span className="w-8 text-center text-sm font-semibold text-slate-900">{multipleCount}</span>
                    <button type="button" onClick={() => setMultipleCount(c => Math.min(20, c + 1))}
                      className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold text-sm">+</button>
                  </div>
                  <span className="text-xs text-slate-400">Each attempt must be completed fully</span>
                </div>
              )}
            </div>

            {/* Date fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Due Date (optional)</label>
                <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Available From (optional)</label>
                <input type="datetime-local" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Available Until (optional)</label>
                <input type="datetime-local" value={availableUntil} onChange={(e) => setAvailableUntil(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" icon={<UserPlus size={13} />} onClick={handleAssign}
            disabled={selected.size === 0 || saving} loading={saving}>
            Assign to {selected.size > 0 ? `${selected.size} Student${selected.size !== 1 ? 's' : ''}` : 'Students'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Create / Edit Package Modal ────────────────────────────────────────────────

interface CreatePackageModalProps {
  selectedTests: ApiTest[];
  editing: DbTestPackage | null;
  createdById: string;
  onClose: () => void;
  onSaved: () => void;
}

function CreatePackageModal({ selectedTests, editing, createdById, onClose, onSaved }: CreatePackageModalProps) {
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    if (!title.trim()) { setError('Please name the package'); return; }
    if (selectedTests.length === 0) { setError('Select at least one test'); return; }
    if (!createdById) { setError('Could not determine your user account — try reloading the page.'); return; }
    setSaving(true);
    try {
      const testIds = selectedTests.map((t) => t.id);
      if (editing) {
        await api.updateTestPackage(editing.id, { title: title.trim(), description: description.trim() || null, testIds });
        toast.success('Package updated');
      } else {
        await api.createTestPackage({ title: title.trim(), description: description.trim() || null, testIds, createdById });
        toast.success('Package created');
      }
      onSaved();
    } catch (e) {
      // Surface the real reason inline — the page may not render toasts.
      const msg = (e as Error)?.message || (editing ? 'Failed to update package' : 'Failed to create package');
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={editing ? 'Edit Package' : 'Create Package'} size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" icon={<Package size={13} />} onClick={handleSave} disabled={saving} loading={saving}>
            {editing ? 'Save Changes' : 'Create Package'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            <X size={14} className="mt-0.5 flex-shrink-0" /> {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Package Name</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. SAT Crash Course — Week 1"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What's in this bundle?"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{selectedTests.length} test{selectedTests.length !== 1 ? 's' : ''} in this package</p>
          <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-50">
            {selectedTests.map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2">
                <FileText size={13} className="text-blue-500 flex-shrink-0" />
                <span className="text-sm text-slate-700 truncate">{t.title}</span>
              </div>
            ))}
            {selectedTests.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No tests selected</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Assign Package Modal ───────────────────────────────────────────────────────

function PackageAssignModal({ pkg, onClose }: { pkg: DbTestPackage; onClose: () => void }) {
  const [students, setStudents] = useState<DbUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [attemptsMode, setAttemptsMode] = useState<'single' | 'multiple'>('single');
  const [multipleCount, setMultipleCount] = useState(3);
  const [opts, setOpts] = useState<AssignOptions>({ dueAt: '', availableFrom: '', availableUntil: '', maxAttempts: 1 });

  useEffect(() => {
    api.getUsersByRole('STUDENT')
      .then((r) => setStudents(r.users))
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoadingStudents(false));
  }, []);

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const handleAssign = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const maxAttempts = attemptsMode === 'single' ? 1 : multipleCount;
      const res = await api.assignTestPackage(pkg.id, {
        studentIds: [...selected],
        dueAt: opts.dueAt || null,
        availableFrom: opts.availableFrom || null,
        availableUntil: opts.availableUntil || null,
        maxAttempts,
      });
      toast.success(`Assigned ${res.tests} test${res.tests !== 1 ? 's' : ''} to ${res.students} student${res.students !== 1 ? 's' : ''}${res.skipped > 0 ? ` (${res.skipped} already assigned)` : ''}`);
      onClose();
    } catch {
      toast.error('Failed to assign package');
    } finally {
      setSaving(false);
    }
  };

  const filtered = students.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal isOpen onClose={onClose} title={`Assign Package — ${pkg.title}`} size="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
          <Boxes size={14} /> This will assign all <strong>{pkg.items.length}</strong> test{pkg.items.length !== 1 ? 's' : ''} in this package to each selected student.
        </div>

        {/* Student picker */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Select Students</p>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email…"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2" />
          {loadingStudents ? (
            <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No students found</p>
          ) : (
            <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-50">
              {filtered.map((s) => (
                <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                    <p className="text-xs text-slate-400 truncate">{s.email}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Options */}
        {selected.size > 0 && (
          <div className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Attempts Allowed (per test)</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setAttemptsMode('single')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-sm font-medium transition-all ${attemptsMode === 'single' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  <span className="text-base">1×</span><span className="text-xs">Single Attempt</span>
                </button>
                <button type="button" onClick={() => setAttemptsMode('multiple')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-sm font-medium transition-all ${attemptsMode === 'multiple' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  <span className="text-base">N×</span><span className="text-xs">Multiple Attempts</span>
                </button>
              </div>
              {attemptsMode === 'multiple' && (
                <div className="mt-2 flex items-center gap-3">
                  <label className="text-xs text-slate-500 flex-shrink-0">Number of attempts:</label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setMultipleCount(c => Math.max(2, c - 1))}
                      className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold text-sm">−</button>
                    <span className="w-8 text-center text-sm font-semibold text-slate-900">{multipleCount}</span>
                    <button type="button" onClick={() => setMultipleCount(c => Math.min(20, c + 1))}
                      className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold text-sm">+</button>
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Due Date (optional)</label>
                <input type="datetime-local" value={opts.dueAt} onChange={(e) => setOpts(o => ({ ...o, dueAt: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Available From (optional)</label>
                <input type="datetime-local" value={opts.availableFrom} onChange={(e) => setOpts(o => ({ ...o, availableFrom: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Available Until (optional)</label>
                <input type="datetime-local" value={opts.availableUntil} onChange={(e) => setOpts(o => ({ ...o, availableUntil: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" icon={<UserPlus size={13} />} onClick={handleAssign} disabled={selected.size === 0 || saving} loading={saving}>
            Assign to {selected.size > 0 ? `${selected.size} Student${selected.size !== 1 ? 's' : ''}` : 'Students'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Test category filter helpers ──────────────────────────────────────────────

const isTestMock       = (t: ApiTest) => t.category === 'Mock' || t.category === 'Mock Test' || /\bmock\b/i.test(t.title ?? '');
const isTestDiagnostic = (t: ApiTest) => t.category === 'Diagnostic' || /\bdiagnostic\b/i.test(t.title ?? '');
const isTestSectional  = (t: ApiTest) => t.category === 'Sectional' || /\bsectional\b/i.test(t.title ?? '');
// Test Builder tags homework as subCategory "{Subject}-Homework" (e.g. "Math-Homework"),
// which does NOT contain the substring "hw" — match on "homework" instead.
const isTestHW         = (t: ApiTest) => { const s = (t.subCategory ?? '').toLowerCase(); const ti = (t.title ?? '').toLowerCase(); return s.includes('homework') || ti.includes(' hw') || ti.endsWith('hw') || /\bhw\b/.test(ti) || ti.includes('homework'); };
const isTestPractice   = (t: ApiTest) => { const c = (t.category ?? '').toLowerCase(); const s = (t.subCategory ?? '').toLowerCase(); return c.includes('practice') || s.includes('practice'); };
const isTestMath       = (t: ApiTest) => { const s = (t.subCategory ?? '').toLowerCase(); const ti = (t.title ?? '').toLowerCase(); return s.includes('math') || /\bmath\b/.test(ti); };
const isTestReading    = (t: ApiTest) => { const s = (t.subCategory ?? '').toLowerCase(); const ti = (t.title ?? '').toLowerCase(); return s.includes('reading') || s.includes('rw') || /\breading\b/.test(ti); };
const isTestWriting    = (t: ApiTest) => { const s = (t.subCategory ?? '').toLowerCase(); const ti = (t.title ?? '').toLowerCase(); return s.includes('writing') || /\bwriting\b/.test(ti); };

const TEST_CAT_FILTERS = [
  { key: 'Mock'            , match: isTestMock },
  { key: 'Diagnostic'      , match: isTestDiagnostic },
  { key: 'Sectional'       , match: isTestSectional },
  { key: 'Math HW'         , match: (t: ApiTest) => isTestMath(t) && isTestHW(t) },
  { key: 'Reading HW'      , match: (t: ApiTest) => isTestReading(t) && isTestHW(t) },
  { key: 'Writing HW'      , match: (t: ApiTest) => isTestWriting(t) && isTestHW(t) },
  { key: 'Math Practice'   , match: (t: ApiTest) => isTestMath(t) && isTestPractice(t) },
  { key: 'Reading Practice', match: (t: ApiTest) => isTestReading(t) && isTestPractice(t) },
  { key: 'Writing Practice', match: (t: ApiTest) => isTestWriting(t) && isTestPractice(t) },
] as const;

// ── Main Page ─────────────────────────────────────────────────────────────────

export function TestsPage() {
  const navigate = useNavigate();
  const { tests, loading, fetchTests, deleteTest, updateTestStatus } = useAdminStore();
  const { dbId, user } = useAuthStore();
  const currentUserId = dbId ?? user?.id ?? '';

  useEffect(() => { fetchTests(); }, [fetchTests]);
  const [deleteModal, setDeleteModal] = useState<ApiTest | null>(null);
  const [assignModal, setAssignModal] = useState<ApiTest | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);

  // ── Packages ──────────────────────────────────────────────────────────────
  const [view, setView] = useState<'tests' | 'packages'>('tests');
  const [packages, setPackages] = useState<DbTestPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [bundleMode, setBundleMode] = useState(false);
  const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(new Set());
  const [createPkgOpen, setCreatePkgOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<DbTestPackage | null>(null);
  const [assignPkg, setAssignPkg] = useState<DbTestPackage | null>(null);
  const [deletePkg, setDeletePkg] = useState<DbTestPackage | null>(null);

  const loadPackages = () => {
    setPackagesLoading(true);
    api.getTestPackages()
      .then((r) => setPackages(r.packages))
      .catch(() => toast.error('Failed to load packages'))
      .finally(() => setPackagesLoading(false));
  };
  useEffect(() => { loadPackages(); }, []);

  const toggleTestSelection = (id: string) => setSelectedTestIds((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const exitBundleMode = () => { setBundleMode(false); setSelectedTestIds(new Set()); };

  // Tests backing the current selection (for the create/edit modal).
  const selectedTests = useMemo(
    () => tests.filter((t) => selectedTestIds.has(t.id)),
    [tests, selectedTestIds],
  );

  const openEditPackage = (pkg: DbTestPackage) => {
    setEditingPkg(pkg);
    setSelectedTestIds(new Set(pkg.items.map((i) => i.testId)));
    setCreatePkgOpen(true);
  };

  const handleDeletePackage = async (pkg: DbTestPackage) => {
    try {
      await api.deleteTestPackage(pkg.id);
      toast.success('Package deleted');
      setDeletePkg(null);
      loadPackages();
    } catch {
      toast.error('Failed to delete package');
    }
  };

  const filtered = useMemo(() => {
    return tests.filter((t) => {
      if (filter !== 'all' && t.status.toLowerCase() !== filter) return false;
      if (search.trim() && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (catFilter) {
        const filterDef = TEST_CAT_FILTERS.find(f => f.key === catFilter);
        if (filterDef && !filterDef.match(t)) return false;
      }
      return true;
    });
  }, [tests, filter, search, catFilter]);

  const handleStatusChange = (test: ApiTest, status: string) => {
    updateTestStatus(test.id, status);
    setMenuOpen(null);
  };

  const handleCloneTest = async (test: ApiTest) => {
    setMenuOpen(null);
    setCloningId(test.id);
    try {
      const { test: newTest } = await api.cloneTest(test.id);
      toast.success(`"Copy of ${test.title}" created`);
      fetchTests();
      navigate(`/test-builder?testId=${newTest.id}`);
    } catch {
      toast.error('Failed to clone test');
    } finally {
      setCloningId(null);
    }
  };

  return (
    <div className="space-y-6" onClick={() => menuOpen && setMenuOpen(null)}>
      <Toaster position="top-right" />
      {/* Header: Tests | Packages toggle inline with actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
          <button
            onClick={() => { setView('tests'); }}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${view === 'tests' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <FileText size={14} /> Tests <span className="text-xs text-slate-400">({tests.length})</span>
          </button>
          <button
            onClick={() => { setView('packages'); exitBundleMode(); }}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${view === 'packages' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Boxes size={14} /> Packages <span className="text-xs text-slate-400">({packages.length})</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {view === 'tests' && bundleMode ? (
            <Button variant="secondary" size="sm" icon={<X size={14} />} onClick={exitBundleMode}>Cancel Bundle</Button>
          ) : (
            <Button variant="secondary" size="sm" icon={<Boxes size={14} />} onClick={() => { setView('tests'); setBundleMode(true); }}>New Package</Button>
          )}
          <Link to="/test-builder">
            <Button size="sm" icon={<Plus size={14} />}>Create Test</Button>
          </Link>
        </div>
      </div>

      {/* Bundle-mode hint */}
      {view === 'tests' && bundleMode && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-sm rounded-lg px-3 py-2">
          <Boxes size={15} />
          Select the tests to bundle, then click <strong>Create Package</strong>.
        </div>
      )}

      {view === 'tests' && (<>
      {/* Status dropdown + category pills + search */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Status filter (All / Published / Draft / Archived) as a dropdown */}
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'published' | 'draft' | 'archived')}
            className={`appearance-none cursor-pointer text-xs font-semibold pl-3 pr-7 py-1.5 rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              filter !== 'all'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
            }`}
          >
            <option value="all">All ({tests.length})</option>
            <option value="published">Published ({tests.filter((t) => t.status.toLowerCase() === 'published').length})</option>
            <option value="draft">Draft ({tests.filter((t) => t.status.toLowerCase() === 'draft').length})</option>
            <option value="archived">Archived ({tests.filter((t) => t.status.toLowerCase() === 'archived').length})</option>
          </select>
          <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${filter !== 'all' ? 'text-blue-100' : 'text-slate-400'}`} />
        </div>

        {/* Category pills */}
        {TEST_CAT_FILTERS.map(({ key }) => (
          <button
            key={key}
            onClick={() => setCatFilter(catFilter === key ? null : key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
              catFilter === key
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800'
            }`}
          >
            {key}
          </button>
        ))}

        {/* Search */}
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tests…"
            className="pl-8 pr-7 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-52"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Test rows — loading skeleton */}
      {loading && tests.length === 0 && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-4 animate-pulse">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2"><div className="h-3 bg-slate-100 rounded w-1/3" /><div className="h-2 bg-slate-100 rounded w-1/2" /></div>
              <div className="h-5 bg-slate-100 rounded-full w-16" />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((test) => {
          const totalQ = (test.sections ?? []).reduce((a, s) => a + (s._count?.questions ?? 0), 0);
          const totalTime = (test.sections ?? []).reduce((a, s) => a + s.durationMinutes, 0);
          const attemptsCount = test._count?.attempts ?? 0;
          const statusLower = test.status.toLowerCase();

          const cat = test.category;
          const subParts = test.subCategory?.split('-') ?? [];
          const subject = subParts[0];
          const assignType = subParts[1];
          const typeColors: Record<string, string> = {
            'Mock':           'bg-blue-100 text-blue-800',
            'Sectional':      'bg-emerald-100 text-emerald-800',
            'Practice Sheet': 'bg-purple-100 text-purple-800',
            'Diagnostic':     'bg-amber-100 text-amber-800',
          };

          const isSelectedForBundle = selectedTestIds.has(test.id);

          return (
            <div
              key={test.id}
              onClick={bundleMode ? () => toggleTestSelection(test.id) : undefined}
              className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-4 transition-all ${
                bundleMode
                  ? `cursor-pointer ${isSelectedForBundle ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-50/40' : 'border-slate-100 hover:border-blue-200'}`
                  : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'
              }`}
            >
              {/* Bundle checkbox / Icon */}
              {bundleMode ? (
                <div className="flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={isSelectedForBundle}
                    onChange={() => toggleTestSelection(test.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-blue-600" />
                </div>
              )}

              {/* Title + meta */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-900 text-sm leading-tight truncate">{test.title}</h3>
                  {cat && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeColors[cat] ?? 'bg-slate-100 text-slate-600'}`}>{cat}</span>}
                  {subject && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{subject}</span>}
                  {assignType && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{assignType}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1"><FileText size={11} /> {totalQ} questions</span>
                  <span className="flex items-center gap-1"><Clock size={11} /> {totalTime} min</span>
                  <span className="flex items-center gap-1"><Users size={11} /> {attemptsCount} attempts</span>
                  <span className="hidden sm:inline text-slate-400">· {test.sections.length} section{test.sections.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Status */}
              <Badge variant={statusLower === 'published' ? 'success' : statusLower === 'draft' ? 'warning' : 'default'}>
                {statusLower}
              </Badge>

              {/* Actions (hidden while bundling) */}
              {!bundleMode && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {statusLower === 'published' && (
                  <Button variant="primary" size="sm" icon={<UserPlus size={13} />} onClick={() => setAssignModal(test)}>
                    Assign
                  </Button>
                )}
                <button onClick={() => navigate(`/test-builder?testId=${test.id}`)}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                  <Edit size={15} />
                </button>
                <button onClick={() => navigate(`/test-instructions/${test.id}?preview=true`)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Preview Test">
                  <Eye size={15} />
                </button>
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === test.id ? null : test.id); }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <MoreVertical size={15} />
                  </button>
                  {menuOpen === test.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                      <div className="absolute right-0 top-8 z-20 w-44 bg-white rounded-xl border border-slate-200 shadow-lg py-1" onClick={(e) => e.stopPropagation()}>
                        {statusLower !== 'published' && (
                          <button onClick={() => handleStatusChange(test, 'published')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50">
                            <BookOpen size={13} /> Publish
                          </button>
                        )}
                        {statusLower !== 'draft' && (
                          <button onClick={() => handleStatusChange(test, 'draft')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                            <Edit size={13} /> Move to Draft
                          </button>
                        )}
                        {statusLower !== 'archived' && (
                          <button onClick={() => handleStatusChange(test, 'archived')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                            <Archive size={13} /> Archive
                          </button>
                        )}
                        <div className="border-t border-slate-100 my-1" />
                        <button
                          onClick={() => handleCloneTest(test)}
                          disabled={cloningId === test.id}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                        >
                          {cloningId === test.id ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                          {cloningId === test.id ? 'Cloning…' : 'Clone'}
                        </button>
                        <div className="border-t border-slate-100 my-1" />
                        <button onClick={() => { setDeleteModal(test); setMenuOpen(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50">
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              )}
            </div>
          );
        })}

        {!bundleMode && (
        <Link to="/test-builder">
          <div className="border border-dashed border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Plus size={20} className="text-blue-500" />
            </div>
            <div>
              <p className="font-medium text-slate-700 text-sm">Create New Test</p>
              <p className="text-xs text-slate-400">Build from scratch or use a template</p>
            </div>
          </div>
        </Link>
        )}
      </div>
      </>)}

      {/* ── PACKAGES VIEW ── */}
      {view === 'packages' && (
        <div className="space-y-2">
          {packagesLoading && packages.length === 0 ? (
            <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
          ) : packages.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-xl px-6 py-12 text-center">
              <Boxes size={28} className="text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-700 text-sm">No packages yet</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">Bundle several tests together and assign them to students in one go.</p>
              <Button size="sm" icon={<Boxes size={14} />} onClick={() => { setView('tests'); setBundleMode(true); }}>Create your first package</Button>
            </div>
          ) : (
            packages.map((pkg) => {
              const testCount = pkg.items.length;
              const totalQ = pkg.items.reduce((a, i) => a + (i.test.sections ?? []).reduce((b, s) => b + (s._count?.questions ?? 0), 0), 0);
              const totalTime = pkg.items.reduce((a, i) => a + (i.test.sections ?? []).reduce((b, s) => b + s.durationMinutes, 0), 0);
              return (
                <div key={pkg.id} className="bg-white border border-slate-100 rounded-xl px-4 py-3 flex items-center gap-4 hover:border-slate-200 hover:shadow-sm transition-all">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Boxes size={18} className="text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900 text-sm leading-tight truncate">{pkg.title}</h3>
                    {pkg.description && <p className="text-xs text-slate-400 truncate mt-0.5">{pkg.description}</p>}
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1"><Boxes size={11} /> {testCount} test{testCount !== 1 ? 's' : ''}</span>
                      <span className="flex items-center gap-1"><FileText size={11} /> {totalQ} questions</span>
                      <span className="flex items-center gap-1"><Clock size={11} /> {totalTime} min</span>
                    </div>
                  </div>
                  <Button variant="primary" size="sm" icon={<UserPlus size={13} />} onClick={() => setAssignPkg(pkg)}>Assign</Button>
                  <button onClick={() => openEditPackage(pkg)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit package">
                    <Edit size={15} />
                  </button>
                  <button onClick={() => setDeletePkg(pkg)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete package">
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Floating bundle action bar — always pinned to the viewport bottom */}
      {view === 'tests' && bundleMode && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center pointer-events-none">
          <div className="flex items-center gap-3 bg-slate-900 text-white px-4 py-2.5 rounded-full shadow-2xl pointer-events-auto">
            <span className="text-sm font-medium">{selectedTestIds.size} test{selectedTestIds.size !== 1 ? 's' : ''} selected</span>
            <button onClick={exitBundleMode} className="text-xs text-slate-300 hover:text-white">Cancel</button>
            <Button size="sm" icon={<Package size={13} />} disabled={selectedTestIds.size === 0}
              onClick={() => { setEditingPkg(null); setCreatePkgOpen(true); }}>
              Create Package
            </Button>
          </div>
        </div>
      )}

      {/* Create / Edit Package Modal */}
      {createPkgOpen && (
        <CreatePackageModal
          selectedTests={selectedTests}
          editing={editingPkg}
          createdById={currentUserId}
          onClose={() => { setCreatePkgOpen(false); setEditingPkg(null); }}
          onSaved={() => { setCreatePkgOpen(false); setEditingPkg(null); exitBundleMode(); setView('packages'); loadPackages(); }}
        />
      )}

      {/* Assign Package Modal */}
      {assignPkg && (
        <PackageAssignModal pkg={assignPkg} onClose={() => setAssignPkg(null)} />
      )}

      {/* Delete Package Modal */}
      <Modal isOpen={!!deletePkg} onClose={() => setDeletePkg(null)} title="Delete Package" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeletePkg(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={() => { if (deletePkg) handleDeletePackage(deletePkg); }}>Delete Package</Button>
          </div>
        }>
        <p className="text-sm text-slate-600">
          Delete <strong>"{deletePkg?.title}"</strong>? This only removes the package grouping — the individual tests and any existing assignments are kept.
        </p>
      </Modal>

      {/* Assign Modal */}
      {assignModal && (
        <AssignModal test={assignModal} onClose={() => setAssignModal(null)} />
      )}

      {/* Delete modal */}
      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Test" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteModal(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={() => { if (deleteModal) { deleteTest(deleteModal.id); setDeleteModal(null); } }}>Delete Test</Button>
          </div>
        }>
        <p className="text-sm text-slate-600">
          Are you sure you want to delete <strong>"{deleteModal?.title}"</strong>? This action cannot be undone and will remove all associated data.
        </p>
      </Modal>
    </div>
  );
}
