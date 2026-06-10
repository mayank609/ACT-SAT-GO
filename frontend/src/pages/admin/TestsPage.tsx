import { useState, useEffect, useMemo } from 'react';
import { Plus, Eye, Edit, Trash2, Users, Clock, FileText, MoreVertical, BookOpen, Archive, UserPlus, X, Loader2, CheckCircle2, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export function TestsPage() {
  const navigate = useNavigate();
  const { tests, loading, fetchTests, deleteTest, updateTestStatus } = useAdminStore();

  useEffect(() => { fetchTests(); }, [fetchTests]);
  const [deleteModal, setDeleteModal] = useState<ApiTest | null>(null);
  const [assignModal, setAssignModal] = useState<ApiTest | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);

  const availableCats = useMemo(() => {
    const cats = new Set<string>();
    for (const t of tests) {
      if (t.category) cats.add(t.category);
      const subj = t.subCategory?.split('-')[0];
      if (subj) cats.add(subj);
    }
    return [...cats];
  }, [tests]);

  const filtered = useMemo(() => {
    return tests.filter((t) => {
      if (filter !== 'all' && t.status.toLowerCase() !== filter) return false;
      if (search.trim() && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (catFilter) {
        const subj = t.subCategory?.split('-')[0];
        const matchesCat = t.category === catFilter;
        const matchesSubj = subj === catFilter;
        if (!matchesCat && !matchesSubj) return false;
      }
      return true;
    });
  }, [tests, filter, search, catFilter]);

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

      {/* Filter tabs + search */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="relative ml-auto">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tests…"
              className="pl-8 pr-7 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-52"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {availableCats.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {availableCats.map(cat => (
              <button
                key={cat}
                onClick={() => setCatFilter(catFilter === cat ? null : cat)}
                className={`text-xs font-medium px-3 py-1 rounded-full border transition-all ${
                  catFilter === cat
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
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

          return (
            <div key={test.id} className="bg-white border border-slate-100 rounded-xl px-4 py-3 flex items-center gap-4 hover:border-slate-200 hover:shadow-sm transition-all">
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-blue-600" />
              </div>

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

              {/* Actions */}
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
                        <button onClick={() => { setDeleteModal(test); setMenuOpen(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50">
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

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
