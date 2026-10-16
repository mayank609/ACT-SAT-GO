import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ClipboardCheck, Clock, FileText, Loader2, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { api, type ArticleDetail, type ArticleSummary, type DbUser, type StudentArticle } from '../../lib/api';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { ArticleEditorModal } from '../../components/articles/ArticleEditorModal';
import { StatusBadge, fmtDate, isOverdue } from '../../components/articles/ArticleBody';
import { AiScoreBadge } from '../../components/articles/AiFeedback';

function PageHeader({ subtitle, action }: { subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600"><FileText size={20} /></span>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Articles</h1>
          <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

const Spinner = () => <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 size={20} className="animate-spin" /></div>;

/** Loads who this user may assign: a tutor's own students, or every student for admins. */
export function useAssignableStudents() {
  const { user, dbId } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [students, setStudents] = useState<DbUser[]>([]);
  useEffect(() => {
    if (!dbId || user?.role === 'student') return;
    const p = isAdmin
      ? api.getUsersByRole('STUDENT').then((r) => r.users ?? [])
      : api.getTutorAssignments({ tutorId: dbId }).then((r) => r.assignments.map((a) => a.student as DbUser));
    p.then((list) => setStudents(list.filter((s) => !s.deletedAt && !s.isDemo))).catch(() => setStudents([]));
  }, [dbId, isAdmin, user?.role]);
  return students;
}

// ─── Student: articles assigned to me ────────────────────────────────────────

function StudentArticles() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<StudentArticle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getArticles()
      .then((r) => setArticles(r.articles as StudentArticle[]))
      .catch((e) => setError(e.message || 'Could not load articles'));
  }, []);

  const todo = (articles ?? []).filter((a) => a.status === 'ASSIGNED' || a.status === 'NEEDS_REVISION').length;

  return (
    <div>
      <PageHeader subtitle={todo ? `${todo} article${todo === 1 ? '' : 's'} to read and summarise` : 'Read each article, then write a summary in your own words'} />
      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!articles && !error ? <Spinner /> : articles && articles.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-slate-200">
          <FileText size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">No articles yet</p>
          <p className="text-slate-400 text-sm mt-1">When your tutor assigns an article, it will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {articles?.map((a) => {
            const overdue = isOverdue(a.dueAt, a.status);
            const cta = a.status === 'APPROVED' ? 'Read again →'
              : a.status === 'SUBMITTED' ? 'View your summary & feedback →'
              : a.status === 'NEEDS_REVISION' ? 'Revise your summary →'
              : a.summaryWordCount ? 'Continue your summary →' : 'Read article →';
            return (
              <button key={a.id} type="button" onClick={() => navigate(`/articles/${a.id}`)}
                className="group text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {a.subject && <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600 mb-1">{a.subject}</p>}
                    <h3 className="font-semibold text-slate-900 leading-snug">{a.title}</h3>
                    {a.topic && <p className="text-sm text-slate-500 mt-0.5">{a.topic}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {!a.openedAt ? <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">New</span> : <StatusBadge status={a.status} />}
                    {a.submittedAt && <AiScoreBadge score={a.aiScore} status={a.aiStatus} />}
                  </div>
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1"><Clock size={12} /> {a.readMinutes} min read</span>
                  <span>· summary {a.minSummaryWords}+ words</span>
                  <span>· from {a.createdByName}</span>
                </p>
                {a.dueAt && (
                  <p className={`mt-1.5 text-xs font-semibold ${overdue ? 'text-red-600' : 'text-slate-500'}`}>
                    {overdue ? 'Overdue — was due' : 'Due'} {fmtDate(a.dueAt)}
                  </p>
                )}
                <p className="mt-3 text-sm font-semibold text-blue-600 group-hover:underline">{cta}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tutor / admin: my articles ──────────────────────────────────────────────

function ManageArticles() {
  const navigate = useNavigate();
  const { user, dbId } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const students = useAssignableStudents();
  const [articles, setArticles] = useState<ArticleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<{ open: boolean; article: ArticleDetail | null }>({ open: false, article: null });
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ArticleSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [view, setView] = useState<'articles' | 'students'>('articles');

  const load = useCallback(() => {
    api.getArticles()
      .then((r) => { setArticles(r.articles as ArticleSummary[]); setError(null); })
      .catch((e) => setError(e.message || 'Could not load articles'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openEditor = async (a?: ArticleSummary) => {
    if (!a) { setEditor({ open: true, article: null }); return; }
    setLoadingId(a.id);
    try {
      const { article } = await api.getArticle(a.id);
      setEditor({ open: true, article });
    } catch (e) {
      toast.error((e as Error).message || 'Could not open the article');
    } finally {
      setLoadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.deleteArticle(toDelete.id);
      toast.success('Article deleted');
      setToDelete(null);
      load();
    } catch (e) {
      toast.error((e as Error).message || 'Could not delete the article');
    } finally {
      setDeleting(false);
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (articles ?? []).filter((a) => !q || `${a.title} ${a.topic ?? ''} ${a.subject ?? ''}`.toLowerCase().includes(q));
  }, [articles, query]);
  const toReview = (articles ?? []).reduce((n, a) => n + a.assignments.filter((s) => s.status === 'SUBMITTED').length, 0);

  return (
    <div>
      <PageHeader
        subtitle={toReview ? `${toReview} summar${toReview === 1 ? 'y' : 'ies'} waiting for your review` : 'Assign reading and check each student’s summary as proof they read it'}
        action={<Button icon={<Plus size={16} />} onClick={() => openEditor()}>New article</Button>}
      />
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {articles && articles.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-bold" role="group" aria-label="Group by">
            <button type="button" onClick={() => setView('articles')} aria-pressed={view === 'articles'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md ${view === 'articles' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              <FileText size={13} /> By article
            </button>
            <button type="button" onClick={() => setView('students')} aria-pressed={view === 'students'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md ${view === 'students' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              <Users size={13} /> By student
            </button>
          </div>
          {articles.length > 3 && (
            <div className="relative w-full sm:w-auto sm:min-w-[260px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" value={query}
                onChange={(e) => setQuery(e.target.value)} placeholder="Search articles" />
            </div>
          )}
        </div>
      )}

      {!articles && !error ? <Spinner /> : articles && articles.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-slate-200">
          <FileText size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">No articles yet</p>
          <p className="text-slate-400 text-sm mt-1 mb-4">Paste an article, assign it to students, and they’ll send back a summary for you to approve.</p>
          <Button icon={<Plus size={16} />} onClick={() => openEditor()}>Add your first article</Button>
        </div>
      ) : view === 'students' ? (
        <StudentTracker articles={visible} onOpen={(id) => navigate(`/articles/${id}`)} />
      ) : (
        <div className="space-y-3">
          {visible.map((a) => {
            const n = a.assignments.length;
            const count = (st: string) => a.assignments.filter((s) => s.status === st).length;
            const review = count('SUBMITTED');
            const approved = count('APPROVED');
            const mine = a.createdById === dbId;
            return (
              <div key={a.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{a.title}</h3>
                    {a.subject && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">{a.subject}</span>}
                    {review > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">{review} to review</span>}
                  </div>
                  {a.topic && <p className="text-sm text-slate-500">{a.topic}</p>}
                  <p className="mt-1 text-xs text-slate-400">
                    {a.readMinutes} min read · summary {a.minSummaryWords}+ words · updated {fmtDate(a.updatedAt)}
                    {isAdmin && !mine && a.createdByName ? ` · by ${a.createdByName}` : ''}
                  </p>
                </div>
                <div className="text-xs font-semibold text-slate-600 rounded-lg bg-slate-50 px-3 py-1.5">
                  {n ? `${approved}/${n} approved · ${a.assignments.filter((s) => s.submittedAt).length} submitted · ${a.assignments.filter((s) => s.openedAt).length} opened` : 'Not assigned yet'}
                  {avgScore(a) != null && <span className="ml-1 text-violet-700">· AI avg {avgScore(a)}/10</span>}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant={review ? 'primary' : 'ghost'} icon={<ClipboardCheck size={14} />} onClick={() => navigate(`/articles/${a.id}`)}>
                    {review ? 'Review' : 'Summaries'}
                  </Button>
                  <Button size="sm" variant="secondary" icon={loadingId === a.id ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
                    onClick={() => openEditor(a)} disabled={loadingId === a.id}>Edit &amp; assign</Button>
                  <button type="button" className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setToDelete(a)} aria-label={`Delete ${a.title}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
          {visible.length === 0 && <p className="text-sm text-slate-500 py-6 text-center">No articles match “{query}”.</p>}
        </div>
      )}

      <ArticleEditorModal isOpen={editor.open} article={editor.article} students={students}
        onClose={() => setEditor((e) => ({ ...e, open: false }))} onSaved={load} />

      <Modal isOpen={!!toDelete} onClose={() => !deleting && setToDelete(null)} title="Delete article?" size="sm">
        <p className="text-sm text-slate-600">
          “{toDelete?.title}” will be removed
          {toDelete?.assignments.length ? ` for the ${toDelete.assignments.length} assigned student${toDelete.assignments.length === 1 ? '' : 's'}, along with their summaries` : ''}. This can't be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setToDelete(null)} disabled={deleting}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete} loading={deleting}>Delete article</Button>
        </div>
      </Modal>
    </div>
  );
}

const avgScore = (a: ArticleSummary) => {
  const scores = a.assignments.map((s) => s.aiScore).filter((n): n is number => typeof n === 'number');
  return scores.length ? Math.round((scores.reduce((x, y) => x + y, 0) / scores.length) * 10) / 10 : null;
};

/** Every assigned student with each article's progress: opened, submitted, AI score. */
function StudentTracker({ articles, onOpen }: { articles: ArticleSummary[]; onOpen: (articleId: string) => void }) {
  const rows = useMemo(() => {
    const byStudent = new Map<string, { name: string; items: Array<{ article: ArticleSummary; s: ArticleSummary['assignments'][number] }> }>();
    for (const article of articles) {
      for (const s of article.assignments) {
        const row = byStudent.get(s.studentId) ?? { name: s.studentName, items: [] };
        row.items.push({ article, s });
        byStudent.set(s.studentId, row);
      }
    }
    return [...byStudent.entries()].map(([id, r]) => ({ id, ...r })).sort((x, y) => x.name.localeCompare(y.name));
  }, [articles]);

  if (rows.length === 0) return <p className="text-sm text-slate-500 py-6 text-center">No students are assigned to these articles yet.</p>;
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const submitted = r.items.filter((i) => i.s.submittedAt).length;
        return (
          <details key={r.id} className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">{r.name}</span>
              <span className="shrink-0 text-xs font-semibold text-slate-500">{submitted}/{r.items.length} submitted</span>
            </summary>
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {r.items.map(({ article, s }) => (
                <li key={article.id}>
                  <button type="button" onClick={() => onOpen(article.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left hover:bg-slate-50">
                    <span className="min-w-0 flex-1 basis-48 text-sm font-medium text-slate-800">{article.title}</span>
                    <span className="text-[11px] text-slate-400">
                      Assigned {fmtDate(s.assignedAt)} · Opened {fmtDate(s.openedAt)} · Submitted {fmtDate(s.submittedAt)}
                    </span>
                    {s.submittedAt && <AiScoreBadge score={s.aiScore} status={s.aiStatus} />}
                    <StatusBadge status={s.status} manager />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

export function ArticlesPage() {
  const { user } = useAuthStore();
  if (!user) return null;
  return user.role === 'student' ? <StudentArticles /> : <ManageArticles />;
}
