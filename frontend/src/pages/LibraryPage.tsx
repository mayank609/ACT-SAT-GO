import { useEffect, useMemo, useState } from 'react';
import { Library, Upload, Users, Trash2, FileText, Search, Loader2, Eye } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { api, type DbUser, type LibraryDocument } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { SecurePdfViewer } from '../components/library/SecurePdfViewer';

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n !== 1 ? 's' : ''}`;
}

function formatDate(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

/**
 * ASG Library. Admins upload PDFs, assign them to students and tutors, and see
 * every document. Students and tutors see only what is assigned to them and
 * read it in the in-app viewer, where printing and saving are blocked.
 */
export function LibraryPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<LibraryDocument | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [assigning, setAssigning] = useState<LibraryDocument | null>(null);

  const load = () => {
    setLoading(true);
    api.getLibrary()
      .then((r) => setDocuments(r.documents))
      .catch((e) => toast.error((e as Error).message || 'Failed to load the library'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) => d.title.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q));
  }, [documents, search]);

  const remove = async (doc: LibraryDocument) => {
    if (!window.confirm(`Delete "${doc.title}"? It will disappear for everyone it is assigned to.`)) return;
    try {
      await api.deleteLibraryDocument(doc.id);
      setDocuments((ds) => ds.filter((d) => d.id !== doc.id));
      toast.success('Document deleted');
    } catch (e) {
      toast.error((e as Error).message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto px-4 py-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Library size={20} className="text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">ASG Library</h1>
          </div>
          <p className="text-sm text-slate-500">
            {isAdmin
              ? 'Upload PDFs and assign them to students and tutors. Admins can see every document.'
              : 'Documents shared with you by ASG. They open here and cannot be printed or downloaded.'}
          </p>
        </div>
        {isAdmin && (
          <Button icon={<Upload size={16} />} onClick={() => setUploadOpen(true)}>Upload PDF</Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40 gap-2 text-slate-400 text-sm">
          <Loader2 size={18} className="animate-spin" /> Loading documents…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 py-16 text-center">
          <FileText size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">
            {documents.length === 0
              ? isAdmin ? 'No documents yet. Upload a PDF to get started.' : 'No documents have been assigned to you yet.'
              : 'No documents match your search.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Document</th>
                <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">{isAdmin ? 'Uploaded' : 'Assigned'}</th>
                {isAdmin && <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Assigned to</th>}
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <button onClick={() => setViewing(doc)} className="flex items-start gap-3 text-left">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                        <FileText size={18} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-slate-900 hover:text-blue-600">{doc.title}</span>
                        <span className="block text-xs text-slate-500">
                          {formatSize(doc.sizeBytes)}{doc.description ? ` · ${doc.description}` : ''}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell whitespace-nowrap">
                    {formatDate(isAdmin ? doc.createdAt : doc.assignedAt)}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 hidden md:table-cell">
                      <AssigneeSummary doc={doc} />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="secondary" icon={<Eye size={14} />} onClick={() => setViewing(doc)}>View</Button>
                      {isAdmin && (
                        <>
                          <Button size="sm" icon={<Users size={14} />} onClick={() => setAssigning(doc)}>Assign</Button>
                          <button onClick={() => remove(doc)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewing && (
        <SecurePdfViewer
          document={viewing}
          canPrint={isAdmin}
          watermark={user ? `${user.name || ''} ${user.email || ''}`.trim() : undefined}
          onClose={() => setViewing(null)}
        />
      )}

      {isAdmin && (
        <UploadModal
          isOpen={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onUploaded={(doc) => { setDocuments((ds) => [doc, ...ds]); setUploadOpen(false); setAssigning(doc); }}
        />
      )}

      {isAdmin && assigning && (
        <AssignModal
          doc={assigning}
          onClose={() => setAssigning(null)}
          onSaved={(assignees) => {
            setDocuments((ds) => ds.map((d) => (d.id === assigning.id ? { ...d, assignees } : d)));
            setAssigning(null);
          }}
        />
      )}
    </div>
  );
}

function AssigneeSummary({ doc }: { doc: LibraryDocument }) {
  const list = doc.assignees ?? [];
  if (list.length === 0) return <span className="text-xs text-slate-400">Not assigned</span>;
  const students = list.filter((a) => a.role === 'STUDENT').length;
  const tutors = list.filter((a) => a.role === 'TUTOR').length;
  const parts = [students && plural(students, 'student'), tutors && plural(tutors, 'tutor')].filter(Boolean);
  return (
    <span className="text-xs text-slate-600" title={list.map((a) => a.name || a.email).join(', ')}>
      {parts.join(', ')}
    </span>
  );
}

function UploadModal({ isOpen, onClose, onUploaded }: { isOpen: boolean; onClose: () => void; onUploaded: (doc: LibraryDocument) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) { setFile(null); setTitle(''); setDescription(''); setSaving(false); }
  }, [isOpen]);

  const pick = (f: File | null) => {
    if (f && f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please choose a PDF file');
      return;
    }
    if (f && f.size > 50 * 1024 * 1024) {
      toast.error('PDFs must be 50 MB or smaller');
      return;
    }
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.pdf$/i, ''));
  };

  const submit = async () => {
    if (!file) return;
    setSaving(true);
    try {
      const { document } = await api.uploadLibraryDocument(file, { title: title.trim(), description: description.trim() || undefined });
      toast.success('Uploaded. Now choose who can see it.');
      onUploaded(document);
    } catch (e) {
      toast.error((e as Error).message || 'Upload failed');
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title="Upload PDF"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button icon={<Upload size={16} />} onClick={submit} loading={saving} disabled={!file || !title.trim()}>Upload</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">PDF file</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
          />
          {file && <span className="mt-1 block text-xs text-slate-500">{file.name} · {formatSize(file.size)}</span>}
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Description <span className="text-slate-400 font-normal">(optional)</span></span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </label>
      </div>
    </Modal>
  );
}

function AssignModal({ doc, onClose, onSaved }: { doc: LibraryDocument; onClose: () => void; onSaved: (assignees: NonNullable<LibraryDocument['assignees']>) => void }) {
  const [tab, setTab] = useState<'STUDENT' | 'TUTOR'>('STUDENT');
  const [people, setPeople] = useState<{ STUDENT: DbUser[]; TUTOR: DbUser[] }>({ STUDENT: [], TUTOR: [] });
  const [selected, setSelected] = useState<Set<string>>(new Set((doc.assignees ?? []).map((a) => a.id)));
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.getUsersByRole('STUDENT'), api.getUsersByRole('TUTOR')])
      .then(([s, t]) => setPeople({ STUDENT: s.users, TUTOR: t.users }))
      .catch(() => toast.error('Failed to load students and tutors'))
      .finally(() => setLoading(false));
  }, []);

  const list = people[tab].filter((u) => {
    const q = query.trim().toLowerCase();
    return !q || (u.name ?? '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });
  const allShownSelected = list.length > 0 && list.every((u) => selected.has(u.id));

  const toggle = (id: string) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllShown = () => setSelected((s) => {
    const next = new Set(s);
    list.forEach((u) => (allShownSelected ? next.delete(u.id) : next.add(u.id)));
    return next;
  });

  const save = async () => {
    setSaving(true);
    try {
      const { assignees } = await api.setLibraryAssignees(doc.id, [...selected]);
      toast.success(`Assigned to ${assignees.length} ${assignees.length === 1 ? 'person' : 'people'}`);
      onSaved(assignees);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to save');
      setSaving(false);
    }
  };

  const countFor = (role: 'STUDENT' | 'TUTOR') => people[role].filter((u) => selected.has(u.id)).length;

  return (
    <Modal
      isOpen
      onClose={saving ? () => {} : onClose}
      title={`Assign "${doc.title}"`}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">{plural(countFor('STUDENT'), 'student')}, {plural(countFor('TUTOR'), 'tutor')} selected</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={save} loading={saving} disabled={loading}>Save</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          {(['STUDENT', 'TUTOR'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTab(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === r ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {r === 'STUDENT' ? 'Students' : 'Tutors'} ({countFor(r)})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${tab === 'STUDENT' ? 'students' : 'tutors'}…`}
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <Button size="sm" variant="secondary" onClick={toggleAllShown} disabled={list.length === 0}>
            {allShownSelected ? 'Clear all' : 'Select all'}
          </Button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-slate-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : list.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No {tab === 'STUDENT' ? 'students' : 'tutors'} found.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {list.map((u) => (
              <li key={u.id}>
                <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">{u.name || u.email}</span>
                    <span className="block text-xs text-slate-500 truncate">{u.email}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
