import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronDown, ChevronUp, Download, Eye, FileLock2, Loader2, Lock, Pencil, Search, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { api, type DbUser, type ManagedMaterial, type SharedMaterial } from '../../lib/api';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { MaterialUploadModal, fmtBytes } from '../../components/materials/MaterialUploadModal';

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

function PageHeader({ subtitle, action }: { subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600"><FileLock2 size={20} /></span>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Study Materials</h1>
          <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function SharedGrid({ items }: { items: SharedMaterial[] }) {
  const navigate = useNavigate();
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((m) => (
        <button key={m.id} type="button" onClick={() => navigate(`/materials/${m.id}`)}
          className="group text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {m.subject && <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600 mb-1">{m.subject}</p>}
              <h3 className="font-semibold text-slate-900 leading-snug">{m.title}</h3>
            </div>
            {!m.viewedAt
              ? <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">New</span>
              : !m.canDownload && <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600"><Lock size={10} /> View only</span>}
          </div>
          {m.description && <p className="mt-1 text-sm text-slate-500 line-clamp-2">{m.description}</p>}
          <p className="mt-3 text-xs text-slate-400">{m.pageCount} page{m.pageCount === 1 ? '' : 's'} · from {m.createdByName || 'your tutor'} · {fmtDate(m.sharedAt)}</p>
          <p className="mt-3 text-sm font-semibold text-blue-600 group-hover:underline">
            {m.lastPage && m.lastPage > 1 ? `Continue from page ${m.lastPage} →` : 'Open →'}
          </p>
        </button>
      ))}
    </div>
  );
}

const Spinner = () => <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 size={20} className="animate-spin" /></div>;

function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-14 rounded-2xl border border-dashed border-slate-200">
      <FileLock2 size={40} className="mx-auto text-slate-300 mb-3" />
      <p className="text-slate-600 font-medium">{title}</p>
      <p className="text-slate-400 text-sm mt-1 mb-4">{text}</p>
      {action}
    </div>
  );
}

export function MaterialsPage() {
  const navigate = useNavigate();
  const { user, dbId } = useAuthStore();
  const role = user?.role;
  const isAdmin = role === 'admin' || role === 'super_admin';
  const canUpload = isAdmin || role === 'tutor';
  const [data, setData] = useState<{ shared: SharedMaterial[]; mine: ManagedMaterial[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<DbUser[]>([]);
  const [tutors, setTutors] = useState<DbUser[]>([]);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; material: ManagedMaterial | null }>({ open: false, material: null });
  const [toDelete, setToDelete] = useState<ManagedMaterial | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(() => {
    api.getMaterials().then((r) => { setData(r); setError(null); }).catch((e) => setError(e.message || 'Could not load study materials'));
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!dbId || !canUpload) return;
    const live = (list: DbUser[]) => list.filter((s) => !s.deletedAt && !s.isDemo);
    (isAdmin
      ? api.getUsersByRole('STUDENT').then((r) => r.users ?? [])
      : api.getTutorAssignments({ tutorId: dbId }).then((r) => r.assignments.map((a) => a.student as DbUser))
    ).then((l) => setStudents(live(l))).catch(() => setStudents([]));
    if (isAdmin) api.getUsersByRole('TUTOR').then((r) => setTutors(live(r.users ?? []))).catch(() => setTutors([]));
  }, [dbId, isAdmin, canUpload]);

  const mine = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.mine ?? []).filter((m) => !q || `${m.title} ${m.subject ?? ''} ${m.description ?? ''}`.toLowerCase().includes(q));
  }, [data, query]);

  const download = async (m: ManagedMaterial) => {
    setDownloading(m.id);
    try { await api.downloadMaterial(m.id, m.fileName); } catch (e) { toast.error((e as Error).message); } finally { setDownloading(null); }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.deleteMaterial(toDelete.id);
      toast.success('Study material deleted');
      setToDelete(null);
      load();
    } catch (e) {
      toast.error((e as Error).message || 'Could not delete it');
    } finally {
      setDeleting(false);
    }
  };

  if (!user) return null;

  if (!canUpload) {
    return (
      <div>
        <PageHeader subtitle="PDFs your tutor has shared with you — view only" />
        {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {!data && !error ? <Spinner /> : data && data.shared.length === 0
          ? <Empty title="No study materials yet" text="When your tutor shares a PDF, it will appear here." />
          : data && <SharedGrid items={data.shared} />}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        subtitle={isAdmin ? 'Share view-only PDFs with students and tutors' : 'Share view-only PDFs with your students'}
        action={<Button icon={<Upload size={16} />} onClick={() => setEditor({ open: true, material: null })}>Upload PDF</Button>}
      />
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {!data && !error ? <Spinner /> : data && (
        <>
          {data.shared.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-bold text-slate-700">Shared with you <span className="font-medium text-slate-400">· view only</span></h2>
              <SharedGrid items={data.shared} />
            </section>
          )}

          <section>
            {data.shared.length > 0 && <h2 className="mb-3 text-sm font-bold text-slate-700">{isAdmin ? 'All materials' : 'Your uploads'}</h2>}
            {data.mine.length > 3 && (
              <div className="relative mb-4 max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" value={query}
                  onChange={(e) => setQuery(e.target.value)} placeholder="Search materials" />
              </div>
            )}
            {data.mine.length === 0 ? (
              <Empty title="No PDFs uploaded yet" text="Upload a PDF and pick who can read it. They can view it, but not copy, save or print it."
                action={<Button icon={<Upload size={16} />} onClick={() => setEditor({ open: true, material: null })}>Upload your first PDF</Button>} />
            ) : (
              <div className="space-y-3">
                {mine.map((m) => {
                  const viewed = m.shares.filter((s) => s.viewedAt).length;
                  const isOpen = expanded === m.id;
                  const own = m.createdById === dbId;
                  return (
                    <div key={m.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex flex-wrap items-center gap-4 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-slate-900">{m.title}</h3>
                            {m.subject && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">{m.subject}</span>}
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {m.pageCount} page{m.pageCount === 1 ? '' : 's'} · {fmtBytes(m.fileSize)} · updated {fmtDate(m.updatedAt)}
                            {isAdmin && !own && m.createdByName ? ` · by ${m.createdByName}` : ''}
                          </p>
                        </div>
                        <button type="button" onClick={() => setExpanded(isOpen ? null : m.id)}
                          className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                          {m.shares.length ? `Shared with ${m.shares.length} · ${viewed} opened` : 'Not shared yet'}
                          {m.shares.length > 0 && (isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                        </button>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => navigate(`/materials/${m.id}`)}>View</Button>
                          <Button size="sm" variant="ghost" icon={downloading === m.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            onClick={() => download(m)} disabled={downloading === m.id}>Download</Button>
                          <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => setEditor({ open: true, material: m })}>Edit &amp; share</Button>
                          <button type="button" className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setToDelete(m)} aria-label={`Delete ${m.title}`}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      {isOpen && m.shares.length > 0 && (
                        <div className="border-t border-slate-100 px-4 py-3 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="text-xs text-slate-400">
                              <tr><th className="text-left font-semibold pb-2">Name</th><th className="text-left font-semibold pb-2">Shared</th><th className="text-left font-semibold pb-2">Opened</th><th className="text-left font-semibold pb-2">Reached</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {m.shares.map((s) => (
                                <tr key={s.userId}>
                                  <td className="py-2 font-medium text-slate-800">{s.name}{s.role === 'TUTOR' && <span className="ml-1.5 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">Tutor</span>}</td>
                                  <td className="py-2 text-slate-500">{fmtDate(s.sharedAt)}</td>
                                  <td className="py-2">{s.viewedAt ? <span className="text-emerald-700">{fmtDate(s.viewedAt)}</span> : <span className="text-slate-400">Not yet</span>}</td>
                                  <td className="py-2 text-slate-500">{s.lastPage ? `Page ${s.lastPage} of ${m.pageCount}` : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
                {mine.length === 0 && <p className="text-sm text-slate-500 py-6 text-center">No materials match “{query}”.</p>}
              </div>
            )}
          </section>
        </>
      )}

      <MaterialUploadModal isOpen={editor.open} material={editor.material} students={students} tutors={tutors} isAdmin={isAdmin}
        onClose={() => setEditor((e) => ({ ...e, open: false }))} onSaved={load} />

      <Modal isOpen={!!toDelete} onClose={() => !deleting && setToDelete(null)} title="Delete study material?" size="sm">
        <p className="text-sm text-slate-600">
          “{toDelete?.title}” will be removed{toDelete?.shares.length ? ` for the ${toDelete.shares.length} people it is shared with` : ''}. This can't be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setToDelete(null)} disabled={deleting}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete} loading={deleting}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
