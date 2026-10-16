import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, Lock, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { api, type DbUser, type ManagedMaterial } from '../../lib/api';

// Upload a PDF as protected study material, or edit an existing one's details
// and who it is shared with.

const SUBJECTS = ['SAT Math', 'SAT Reading & Writing', 'ACT English', 'ACT Math', 'ACT Reading', 'ACT Science', 'AP', 'General'];
const MAX_BYTES = 20 * 1024 * 1024;
const LIMITS = { title: 160, description: 2000, subject: 60 };

export const fmtBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function PeopleList({ label, people, selected, onToggle, onSet }: {
  label: string;
  people: DbUser[];
  selected: Set<string>;
  onToggle: (id: string, on: boolean) => void;
  onSet: (ids: string[], on: boolean) => void;
}) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const sorted = [...people].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    const t = q.trim().toLowerCase();
    return t ? sorted.filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(t)) : sorted;
  }, [people, q]);
  const count = people.filter((p) => selected.has(p.id)).length;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <p className="text-xs font-bold text-slate-600">{label} <span className="font-medium text-slate-400">({count} selected)</span></p>
        {people.length > 0 && (
          <div className="flex gap-2 text-xs font-semibold">
            <button type="button" className="text-blue-600 hover:underline" onClick={() => onSet(people.map((p) => p.id), true)}>Select all</button>
            <button type="button" className="text-slate-500 hover:underline" onClick={() => onSet(people.map((p) => p.id), false)}>Clear</button>
          </div>
        )}
      </div>
      {people.length === 0 ? (
        <p className="text-xs text-slate-500 rounded-lg bg-slate-50 px-3 py-2">No {label.toLowerCase()} to share with yet.</p>
      ) : (
        <>
          {people.length > 8 && (
            <div className="relative mb-1.5">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" value={q}
                onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label.toLowerCase()}`} />
            </div>
          )}
          <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
            {list.map((p) => (
              <label key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" className="accent-blue-600" checked={selected.has(p.id)} onChange={(e) => onToggle(p.id, e.target.checked)} />
                <span className="font-medium text-slate-800">{p.name || p.email}</span>
                {p.name && <span className="text-xs text-slate-400 truncate">{p.email}</span>}
              </label>
            ))}
            {list.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">No one matches “{q}”.</p>}
          </div>
        </>
      )}
    </div>
  );
}

export function MaterialUploadModal({
  isOpen, onClose, onSaved, material, students, tutors, isAdmin,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Material to edit; omit to upload a new one. */
  material?: ManagedMaterial | null;
  students: DbUser[];
  /** Admins can also share with tutors (view-only for them). */
  tutors: DbUser[];
  isAdmin: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFile(null);
    setTitle(material?.title ?? '');
    setDescription(material?.description ?? '');
    setSubject(material?.subject ?? '');
    setSelected(new Set((material?.shares ?? []).map((s) => s.userId)));
    setProgress(null);
    setError(null);
  }, [isOpen, material]);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setError('Choose a PDF file.'); return; }
    if (f.size > MAX_BYTES) { setError(`That PDF is ${fmtBytes(f.size)} — the limit is 20 MB.`); return; }
    setError(null);
    setFile(f);
    setTitle((t) => t || f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim());
  };

  const toggle = (id: string, on: boolean) => setSelected((prev) => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n; });
  const setMany = (ids: string[], on: boolean) => setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });

  const save = async () => {
    if (!material && !file) { setError('Choose a PDF to upload.'); return; }
    if (!title.trim()) { setError('Give the material a title.'); return; }
    setSaving(true);
    setError(null);
    try {
      const meta = { title: title.trim(), description: description.trim() || undefined, subject: subject.trim() || undefined };
      if (material) {
        await api.updateMaterial(material.id, meta);
        const r = await api.setMaterialShares(material.id, [...selected]);
        toast.success(r.added ? `Saved and shared with ${r.added} more` : 'Saved');
      } else {
        setProgress(0);
        const r = await api.uploadMaterial({ file: file!, ...meta, recipientIds: [...selected] }, setProgress);
        toast.success(r.sharedWith ? `Uploaded ${r.pageCount} pages and shared with ${r.sharedWith}` : `Uploaded ${r.pageCount} pages`);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Could not save.');
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500';

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title={material ? 'Edit study material' : 'Upload study material'} size="lg" closeOnBackdrop={false}>
      <div className="space-y-5">
        {!material && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files?.[0]); }}
            className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50/60'}`}
          >
            <FileUp size={26} className="mx-auto text-slate-400" />
            {file ? (
              <p className="mt-2 text-sm font-semibold text-slate-800">{file.name} <span className="font-normal text-slate-500">· {fmtBytes(file.size)}</span></p>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Drag a PDF here, or</p>
            )}
            <Button className="mt-2" size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>{file ? 'Choose another PDF' : 'Choose PDF'}</Button>
            <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="PDF file"
              onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
            <p className="mt-2 text-[11px] text-slate-400">PDF up to 20 MB</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Title</span>
            <input className={`${inputCls} mt-1`} value={title} maxLength={LIMITS.title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Quadratics — chapter notes" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Subject <span className="font-normal text-slate-400">(optional)</span></span>
            <input className={`${inputCls} mt-1`} value={subject} maxLength={LIMITS.subject} list="material-subjects" onChange={(e) => setSubject(e.target.value)} placeholder="Choose or type" />
            <datalist id="material-subjects">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Description <span className="font-normal text-slate-400">(optional)</span></span>
            <textarea className={`${inputCls} mt-1 min-h-[70px]`} value={description} maxLength={LIMITS.description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What it covers and how to use it" />
          </label>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5 text-xs text-slate-700">
          <Lock size={14} className="mt-0.5 shrink-0 text-blue-600" />
          <p>
            Students can only view it: pages are shown as images with their name watermarked, and copying, saving and printing are blocked.
            {isAdmin ? ' Tutors you share it with can view it too, but cannot download it.' : ''}
          </p>
        </div>

        <section className="space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><Users size={15} /> Share with</h4>
          <PeopleList label="Students" people={students} selected={selected} onToggle={toggle} onSet={setMany} />
          {isAdmin && <PeopleList label="Tutors" people={tutors} selected={selected} onToggle={toggle} onSet={setMany} />}
        </section>

        {progress !== null && (
          <div aria-live="polite">
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <p className="mt-1 text-xs text-slate-500">{progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : 'Checking the PDF…'}</p>
          </div>
        )}
        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving}>{material ? 'Save changes' : selected.size ? 'Upload & share' : 'Upload'}</Button>
        </div>
      </div>
    </Modal>
  );
}
