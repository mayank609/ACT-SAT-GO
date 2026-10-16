import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronDown, ChevronUp, Eye, Layers, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import {
  api, type DbUser, type FlashcardDeckDetail, type FlashcardDeckSummary, type StudentFlashcardDeck,
} from '../../lib/api';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { DeckEditorModal } from '../../components/flashcards/DeckEditorModal';

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

function ProgressBar({ known, total }: { known: number; total: number }) {
  const pct = total ? Math.round((known / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-semibold text-slate-500 tabular-nums">{known}/{total}</span>
    </div>
  );
}

function PageHeader({ subtitle, action }: { subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600"><Layers size={20} /></span>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Vocab Flashcards</h1>
          <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

// ─── Student: decks shared with me ───────────────────────────────────────────

function StudentFlashcards() {
  const navigate = useNavigate();
  const [decks, setDecks] = useState<StudentFlashcardDeck[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getFlashcardDecks()
      .then((r) => setDecks(r.decks as StudentFlashcardDeck[]))
      .catch((e) => setError(e.message || 'Could not load flashcards'));
  }, []);

  return (
    <div>
      <PageHeader subtitle="Flashcard decks your tutor has shared with you" />
      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!decks && !error ? (
        <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 size={20} className="animate-spin" /></div>
      ) : decks && decks.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-slate-200">
          <Layers size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">No flashcards yet</p>
          <p className="text-slate-400 text-sm mt-1">When your tutor shares a deck, it will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {decks?.map((d) => (
            <button key={d.id} type="button" onClick={() => navigate(`/flashcards/${d.id}`)}
              className="group text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {d.subject && <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600 mb-1">{d.subject}</p>}
                  <h3 className="font-semibold text-slate-900 leading-snug">{d.title}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{d.topic}</p>
                </div>
                {!d.viewedAt && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">New</span>}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                {d.cardCount} card{d.cardCount === 1 ? '' : 's'} · from {d.createdByName} · {fmtDate(d.sharedAt)}
                {d.seenCount ? ` · seen ${d.seenCount}/${d.cardCount}` : ''}
              </p>
              <div className="mt-3"><ProgressBar known={d.knownCount} total={d.cardCount} /></div>
              <p className="mt-3 text-sm font-semibold text-blue-600 group-hover:underline">
                {d.knownCount >= d.cardCount && d.cardCount > 0 ? 'Review again →' : d.lastStudiedAt ? 'Continue studying →' : 'Start studying →'}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tutor / admin: my decks ─────────────────────────────────────────────────

function ManageFlashcards() {
  const navigate = useNavigate();
  const { user, dbId } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [decks, setDecks] = useState<FlashcardDeckSummary[] | null>(null);
  const [students, setStudents] = useState<DbUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; deck: FlashcardDeckDetail | null; sharedIds: string[] }>({ open: false, deck: null, sharedIds: [] });
  const [loadingDeck, setLoadingDeck] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<FlashcardDeckSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    api.getFlashcardDecks()
      .then((r) => { setDecks(r.decks as FlashcardDeckSummary[]); setError(null); })
      .catch((e) => setError(e.message || 'Could not load flashcards'));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Who this user may share with: a tutor's assigned students, or every student for admins.
  useEffect(() => {
    if (!dbId) return;
    const p = isAdmin
      ? api.getUsersByRole('STUDENT').then((r) => r.users ?? [])
      : api.getTutorAssignments({ tutorId: dbId }).then((r) => r.assignments.map((a) => a.student as DbUser));
    p.then((list) => setStudents(list.filter((s) => !s.deletedAt && !s.isDemo))).catch(() => setStudents([]));
  }, [dbId, isAdmin]);

  const openEditor = async (d?: FlashcardDeckSummary) => {
    if (!d) { setEditor({ open: true, deck: null, sharedIds: [] }); return; }
    setLoadingDeck(d.id);
    try {
      const { deck } = await api.getFlashcardDeck(d.id);
      setEditor({ open: true, deck, sharedIds: (deck.shares ?? []).map((s) => s.studentId) });
    } catch (e) {
      toast.error((e as Error).message || 'Could not open the deck');
    } finally {
      setLoadingDeck(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.deleteFlashcardDeck(toDelete.id);
      toast.success('Deck deleted');
      setToDelete(null);
      load();
    } catch (e) {
      toast.error((e as Error).message || 'Could not delete the deck');
    } finally {
      setDeleting(false);
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (decks ?? []).filter((d) => !q || `${d.title} ${d.topic} ${d.subject ?? ''}`.toLowerCase().includes(q));
  }, [decks, query]);

  return (
    <div>
      <PageHeader
        subtitle={isAdmin ? 'Create vocab decks (word, hint, meaning) and share them with any student' : 'Create vocab decks (word, hint, meaning) and share them with your students'}
        action={<Button icon={<Plus size={16} />} onClick={() => openEditor()}>New deck</Button>}
      />

      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {decks && decks.length > 3 && (
        <div className="relative mb-4 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" value={query}
            onChange={(e) => setQuery(e.target.value)} placeholder="Search decks" />
        </div>
      )}

      {!decks && !error ? (
        <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 size={20} className="animate-spin" /></div>
      ) : decks && decks.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-slate-200">
          <Layers size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">No flashcard decks yet</p>
          <p className="text-slate-400 text-sm mt-1 mb-4">Pick a topic, add a short explanation and a few cards, then share it with your students.</p>
          <Button icon={<Plus size={16} />} onClick={() => openEditor()}>Create your first deck</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((d) => {
            const viewed = d.shares.filter((s) => s.viewedAt).length;
            const isOpen = expanded === d.id;
            const mine = d.createdById === dbId;
            return (
              <div key={d.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{d.title}</h3>
                      {d.subject && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">{d.subject}</span>}
                    </div>
                    <p className="text-sm text-slate-500">{d.topic}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {d.cardCount} card{d.cardCount === 1 ? '' : 's'} · updated {fmtDate(d.updatedAt)}
                      {isAdmin && !mine && d.createdByName ? ` · by ${d.createdByName}` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={() => setExpanded(isOpen ? null : d.id)}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                    {d.shares.length ? `Shared with ${d.shares.length} · ${viewed} opened` : 'Not shared yet'}
                    {d.shares.length > 0 && (isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </button>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => navigate(`/flashcards/${d.id}`)}>Preview</Button>
                    <Button size="sm" variant="secondary" icon={loadingDeck === d.id ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
                      onClick={() => openEditor(d)} disabled={loadingDeck === d.id}>Edit &amp; share</Button>
                    <button type="button" className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setToDelete(d)} aria-label={`Delete ${d.title}`}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {isOpen && d.shares.length > 0 && (
                  <div className="border-t border-slate-100 px-4 py-3">
                    <ul className="divide-y divide-slate-50 text-sm">
                      <li className="hidden sm:grid grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.8fr))_minmax(0,1.4fr)] gap-3 pb-2 text-xs font-semibold text-slate-400">
                        <span>Student</span><span>Shared</span><span>Opened</span><span>Cards seen</span><span>Last studied</span><span>Cards known</span>
                      </li>
                      {d.shares.map((s) => (
                        <li key={s.studentId} className="grid grid-cols-2 sm:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.8fr))_minmax(0,1.4fr)] items-center gap-x-3 gap-y-1 py-2">
                          <span className="col-span-2 sm:col-span-1 truncate font-medium text-slate-800">{s.studentName}</span>
                          <span className="text-xs sm:text-sm text-slate-500"><span className="sm:hidden">Shared </span>{fmtDate(s.sharedAt)}</span>
                          <span className="text-xs sm:text-sm">
                            <span className="sm:hidden text-slate-500">Opened </span>
                            {s.viewedAt ? <span className="text-emerald-700">{fmtDate(s.viewedAt)}</span> : <span className="text-slate-400">Not yet</span>}
                          </span>
                          <span className="text-xs sm:text-sm text-slate-600"><span className="sm:hidden text-slate-500">Seen </span>{s.seenCount ?? 0} / {d.cardCount}</span>
                          <span className="text-xs sm:text-sm text-slate-500"><span className="sm:hidden">Last studied </span>{s.lastStudiedAt ? fmtDate(s.lastStudiedAt) : '—'}</span>
                          <span className="col-span-2 sm:col-span-1"><ProgressBar known={s.knownCount} total={d.cardCount} /></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
          {visible.length === 0 && <p className="text-sm text-slate-500 py-6 text-center">No decks match “{query}”.</p>}
        </div>
      )}

      <DeckEditorModal
        isOpen={editor.open}
        deck={editor.deck}
        initialSharedIds={editor.sharedIds}
        students={students}
        onClose={() => setEditor((e) => ({ ...e, open: false }))}
        onSaved={load}
      />

      <Modal isOpen={!!toDelete} onClose={() => !deleting && setToDelete(null)} title="Delete this deck?" size="sm">
        <p className="text-sm text-slate-600">
          “{toDelete?.title}” and its {toDelete?.cardCount} cards will be removed for you
          {toDelete?.shares.length ? ` and the ${toDelete.shares.length} student${toDelete.shares.length === 1 ? '' : 's'} it is shared with` : ''}. This can't be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setToDelete(null)} disabled={deleting}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete} loading={deleting}>Delete deck</Button>
        </div>
      </Modal>
    </div>
  );
}

export function FlashcardsPage() {
  const { user } = useAuthStore();
  if (!user) return null;
  return user.role === 'student' ? <StudentFlashcards /> : <ManageFlashcards />;
}
