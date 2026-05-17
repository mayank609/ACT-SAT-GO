import { useState, useEffect } from 'react';
import { Plus, Eye, Edit, Trash2, Users, Clock, FileText, MoreVertical, BookOpen, Archive } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { useAdminStore, type ApiTest } from '../../store/useAdminStore';

export function TestsPage() {
  const navigate = useNavigate();
  const { tests, loading, fetchTests, deleteTest, updateTestStatus } = useAdminStore();

  useEffect(() => { fetchTests(); }, [fetchTests]);
  const [deleteModal, setDeleteModal] = useState<ApiTest | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');

  // DB status is uppercase; filter is lowercase — normalise for comparison
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
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all capitalize ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
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

                {/* Section pills */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {test.sections.map((sec) => (
                    <span key={sec.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {sec.name}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <Button variant="ghost" size="sm" icon={<Eye size={13} />} className="flex-1 justify-center">
                    Preview
                  </Button>
                  <button
                    onClick={() => navigate('/test-builder')}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteModal(test)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}

        {/* Create new card */}
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

      {/* Delete modal */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete Test"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteModal(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={() => { if (deleteModal) { deleteTest(deleteModal.id); setDeleteModal(null); } }}>Delete Test</Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete <strong>"{deleteModal?.title}"</strong>? This action cannot be undone and will remove all associated data.
        </p>
      </Modal>
    </div>
  );
}
