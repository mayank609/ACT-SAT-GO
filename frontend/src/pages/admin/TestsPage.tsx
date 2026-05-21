import { useState, useEffect } from 'react';
import { Plus, Eye, Edit, Trash2, Users, Clock, FileText, MoreVertical, BookOpen, Archive, UserPlus, X, Loader2, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { useAdminStore, type ApiTest } from '../../store/useAdminStore';
import { api, type DbUser } from '../../lib/api';
import { toast } from 'react-hot-toast';

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
  const [maxAttempts, setMaxAttempts] = useState(1);
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
              {filtered.filter((s) => !assigned.has(s.id)).map((s) => (
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
                </label>
              ))}
              {filtered.filter((s) => !assigned.has(s.id)).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">All matching students are already assigned</p>
              )}
            </div>
          )}
        </div>

        {/* Options */}
        {selected.size > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Due Date (optional)</label>
              <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Max Attempts</label>
              <input type="number" min={1} max={10} value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))}
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export function TestsPage() {
  const navigate = useNavigate();
  const { tests, loading, fetchTests, deleteTest, updateTestStatus } = useAdminStore();

  useEffect(() => { fetchTests(); }, [fetchTests]);
  const [deleteModal, setDeleteModal] = useState<ApiTest | null>(null);
  const [assignModal, setAssignModal] = useState<ApiTest | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');

  const filtered = tests.filter(
    (t) => filter === 'all' || t.status.toLowerCase() === filter
  );

  const handleStatusChange = (test: ApiTest, status: string) => {
    updateTestStatus(test.id, status);
    setMenuOpen(null);
  };

  return (
    <div className="space-y-6" onClick={() => menuOpen && setMenuOpen(null)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tests</h1>
          <p className="text-slate-500 text-sm mt-0.5">Create and manage all tests</p>
        </div>
        <Link to="/test-builder">
          <Button size="sm" icon={<Plus size={14} />}>Create Test</Button>
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {(['all', 'published', 'draft', 'archived'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all capitalize ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}>
            {f}
            <span className={`ml-1.5 text-xs ${filter === f ? 'text-blue-200' : 'text-slate-400'}`}>
              ({f === 'all' ? tests.length : tests.filter((t) => t.status.toLowerCase() === f).length})
            </span>
          </button>
        ))}
      </div>

      {/* Test cards */}
      {loading && tests.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse">
              <div className="flex gap-3 mb-4"><div className="w-10 h-10 bg-slate-100 rounded-xl" /><div className="flex-1 space-y-2"><div className="h-3 bg-slate-100 rounded w-3/4" /><div className="h-2 bg-slate-100 rounded w-1/2" /></div></div>
              <div className="h-4 bg-slate-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-full mb-4" />
              <div className="flex gap-2">{[1,2,3].map((j) => <div key={j} className="h-5 bg-slate-100 rounded-full w-16" />)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((test) => {
          const totalQ = test.sections.reduce((a, s) => a + (s._count?.questions ?? 0), 0);
          const totalTime = test.sections.reduce((a, s) => a + s.durationMinutes, 0);
          const attemptsCount = test._count?.attempts ?? 0;
          const statusLower = test.status.toLowerCase();

          return (
            <Card key={test.id} hoverable padding="none">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <FileText size={18} className="text-blue-600" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={statusLower === 'published' ? 'success' : statusLower === 'draft' ? 'warning' : 'default'}>
                      {statusLower}
                    </Badge>
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === test.id ? null : test.id); }}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                      >
                        <MoreVertical size={14} />
                      </button>
                      {menuOpen === test.id && (
                        <div className="absolute right-0 top-6 z-20 w-44 bg-white rounded-xl border border-slate-200 shadow-lg py-1" onClick={(e) => e.stopPropagation()}>
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
                          <button onClick={() => { setDeleteModal(test); setMenuOpen(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50">
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <h3 className="font-semibold text-slate-900 text-base mb-1 leading-tight">{test.title}</h3>
                {test.description && <p className="text-sm text-slate-500 mb-3 line-clamp-2">{test.description}</p>}

                <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                  <span className="flex items-center gap-1"><FileText size={11} /> {totalQ} questions</span>
                  <span className="flex items-center gap-1"><Clock size={11} /> {totalTime} min</span>
                  <span className="flex items-center gap-1"><Users size={11} /> {attemptsCount} attempts</span>
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {test.sections.map((sec) => (
                    <span key={sec.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {sec.name}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  {/* Assign button — only for published tests */}
                  {statusLower === 'published' && (
                    <Button variant="primary" size="sm" icon={<UserPlus size={13} />}
                      className="flex-1 justify-center"
                      onClick={() => setAssignModal(test)}>
                      Assign
                    </Button>
                  )}

                  {statusLower === 'draft' ? (
                    <Button variant="ghost" size="sm" icon={<Edit size={13} />}
                      className={statusLower === 'draft' ? 'flex-1 justify-center' : ''}
                      onClick={() => navigate(`/test-builder?testId=${test.id}`)}>
                      Edit
                    </Button>
                  ) : (
                    <button onClick={() => navigate(`/test-builder?testId=${test.id}`)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit size={14} />
                    </button>
                  )}

                  <button onClick={() => navigate(`/test-instructions/${test.id}`)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    <Eye size={14} />
                  </button>
                  <button onClick={() => setDeleteModal(test)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}

        <Link to="/test-builder">
          <Card padding="none" className="border-dashed hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer h-full min-h-[200px]">
            <div className="p-5 flex flex-col items-center justify-center h-full text-center">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
                <Plus size={24} className="text-blue-500" />
              </div>
              <p className="font-medium text-slate-700 text-sm">Create New Test</p>
              <p className="text-xs text-slate-400 mt-1">Build from scratch or use a template</p>
            </div>
          </Card>
        </Link>
      </div>

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
