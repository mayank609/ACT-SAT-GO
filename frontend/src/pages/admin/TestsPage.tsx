import { useState } from 'react';
import { Plus, Eye, Edit, Trash2, Users, Clock, FileText, MoreVertical } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { MOCK_TESTS, MOCK_STUDENTS } from '../../data/mockData';
import type { Test } from '../../types';

export function TestsPage() {
  const navigate = useNavigate();
  const [tests, setTests] = useState(MOCK_TESTS);
  const [deleteModal, setDeleteModal] = useState<Test | null>(null);
  const [assignModal, setAssignModal] = useState<Test | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');

  const filtered = tests.filter((t) => filter === 'all' || t.status === filter);

  const handleDelete = (test: Test) => {
    setTests((prev) => prev.filter((t) => t.id !== test.id));
    setDeleteModal(null);
  };

  return (
    <div className="space-y-6">
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
              ({f === 'all' ? tests.length : tests.filter((t) => t.status === f).length})
            </span>
          </button>
        ))}
      </div>

      {/* Test cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((test) => {
          const totalQ = test.sections.reduce((a, s) => a + s.questions.length, 0);
          const totalTime = test.sections.reduce((a, s) => a + s.timeLimit, 0);
          const assignedCount = test.assignedStudentIds?.length ?? 0;

          return (
            <Card key={test.id} hoverable padding="none">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <FileText size={18} className="text-blue-600" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={test.status === 'published' ? 'success' : test.status === 'draft' ? 'warning' : 'default'}>
                      {test.status}
                    </Badge>
                    <button className="p-1 text-slate-400 hover:text-slate-600 rounded">
                      <MoreVertical size={14} />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-slate-900 text-base mb-1 leading-tight">{test.title}</h3>
                {test.description && <p className="text-sm text-slate-500 mb-3 line-clamp-2">{test.description}</p>}

                <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                  <span className="flex items-center gap-1"><FileText size={11} /> {totalQ} questions</span>
                  <span className="flex items-center gap-1"><Clock size={11} /> {totalTime} min</span>
                  <span className="flex items-center gap-1"><Users size={11} /> {assignedCount} students</span>
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
                  <Button variant="ghost" size="sm" icon={<Users size={13} />} onClick={() => setAssignModal(test)} className="flex-1 justify-center">
                    Assign
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
            <Button variant="danger" size="sm" onClick={() => deleteModal && handleDelete(deleteModal)}>Delete Test</Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete <strong>"{deleteModal?.title}"</strong>? This action cannot be undone and will remove all associated data.
        </p>
      </Modal>

      {/* Assign modal */}
      <Modal isOpen={!!assignModal} onClose={() => setAssignModal(null)} title="Assign Test to Students" size="md">
        <div className="space-y-3">
          <p className="text-sm text-slate-600 mb-4">Select students to assign <strong>{assignModal?.title}</strong>:</p>
          {MOCK_STUDENTS.map((s) => (
            <label key={s.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                defaultChecked={assignModal?.assignedStudentIds?.includes(s.id)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold">
                {s.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{s.name}</p>
                <p className="text-xs text-slate-500">{s.email}</p>
              </div>
              {assignModal?.assignedStudentIds?.includes(s.id) && (
                <Badge variant="success" className="ml-auto" size="sm">Assigned</Badge>
              )}
            </label>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setAssignModal(null)}>Cancel</Button>
            <Button size="sm" onClick={() => setAssignModal(null)}>Save Assignments</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
