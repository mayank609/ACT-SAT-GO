import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Clock, ExternalLink, ListChecks, Loader2, MessageSquare, Pencil, Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api, type ArticleAssignmentInfo, type ArticleDetail, type ArticleSubmissionRecord } from '../../lib/api';
import { Button } from '../../components/common/Button';
import { ArticleEditorModal } from '../../components/articles/ArticleEditorModal';
import { ArticleBody, StatusBadge, fmtDate, isOverdue, wordCount } from '../../components/articles/ArticleBody';
import { AiFeedbackLoading, AiFeedbackPanel, AiScoreBadge } from '../../components/articles/AiFeedback';
import { useAssignableStudents } from './ArticlesPage';

// Read an article. Students write a summary underneath as proof of reading
// (drafts autosave; submitting sends it to the tutor and gets AI feedback
// right away; they can resubmit until the tutor reviews it). Tutors/admins see
// every student's summary, its AI feedback, and approve it or ask for changes.

const AUTOSAVE_MS = 2500;

// ─── Student: write the summary ──────────────────────────────────────────────

function SummaryPanel({ article, onChanged }: { article: ArticleDetail; onChanged: () => void }) {
  const a = article.assignment!;
  // Until a tutor reviews it, a submitted summary can be edited and resubmitted.
  const [revising, setRevising] = useState(false);
  const editable = a.status === 'ASSIGNED' || a.status === 'NEEDS_REVISION' || (a.status === 'SUBMITTED' && revising);
  const draftable = a.status === 'ASSIGNED' || a.status === 'NEEDS_REVISION';
  const [text, setText] = useState(a.summary ?? '');
  const [saved, setSaved] = useState(a.summary ?? '');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef(text);
  useEffect(() => { textRef.current = text; }, [text]);

  const words = wordCount(text);
  const enough = words >= article.minSummaryWords;
  const dirty = text.trim() !== saved.trim();

  const saveDraft = useCallback(async (quiet: boolean) => {
    const value = textRef.current;
    setSaving(true);
    try {
      await api.saveArticleSummary(article.id, value, false);
      setSaved(value);
      if (!quiet) toast.success('Draft saved');
    } catch (e) {
      if (!quiet) toast.error((e as Error).message || 'Could not save your draft');
    } finally {
      setSaving(false);
    }
  }, [article.id]);

  // Autosave the draft shortly after the student stops typing (not while
  // revising a submitted summary — that one only changes on resubmit).
  useEffect(() => {
    if (!draftable || !dirty || submitting) return;
    const t = setTimeout(() => saveDraft(true), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [text, draftable, dirty, submitting, saveDraft]);

  const submit = async () => {
    setError(null);
    if (!enough) { setError(`Write at least ${article.minSummaryWords} words — you have ${words}.`); return; }
    setSubmitting(true);
    try {
      const r = await api.saveArticleSummary(article.id, text, true);
      setSaved(text);
      toast.success(r.aiFeedback?.status === 'ready' ? 'Summary submitted — your feedback is ready' : 'Summary submitted to your tutor');
      onChanged();
    } catch (e) {
      setError((e as Error).message || 'Could not submit your summary');
      setSubmitting(false);
    }
  };

  const resubmitting = a.status === 'NEEDS_REVISION' || a.status === 'SUBMITTED';
  const history = a.submissions ?? [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm" aria-labelledby="summary-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="summary-heading" className="font-semibold text-slate-900">Your summary</h2>
        <StatusBadge status={a.status} />
      </div>

      {article.instructions && (
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm text-slate-700">
          <p className="flex items-center gap-1.5 font-semibold text-slate-800"><ListChecks size={14} /> Instructions</p>
          <p className="mt-1 whitespace-pre-wrap">{article.instructions}</p>
        </div>
      )}

      {a.status === 'NEEDS_REVISION' && a.feedback && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="flex items-center gap-1.5 font-semibold"><MessageSquare size={14} /> {a.reviewedByName || 'Your tutor'} asked for changes</p>
          <p className="mt-1 whitespace-pre-wrap">{a.feedback}</p>
        </div>
      )}
      {a.status === 'APPROVED' && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="flex items-center gap-1.5 font-semibold"><CheckCircle2 size={15} /> Approved by {a.reviewedByName || 'your tutor'} · {fmtDate(a.reviewedAt)}</p>
          {a.feedback && <p className="mt-1 whitespace-pre-wrap">{a.feedback}</p>}
        </div>
      )}
      {a.status === 'SUBMITTED' && !revising && (
        <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
          Submitted {fmtDate(a.submittedAt)}{a.submissionCount > 1 ? ` (version ${a.submissionCount})` : ''}. Your tutor will review it — you’ll get a notification.
          You can still improve it and resubmit until then.
        </p>
      )}

      {editable ? (
        <>
          <p className="mt-3 text-sm text-slate-500">
            In your own words, explain the main idea and the key points. At least <strong className="text-slate-700">{article.minSummaryWords} words</strong>.
          </p>
          <textarea
            className="mt-3 w-full min-h-[220px] rounded-xl border border-slate-200 px-3 py-2.5 text-base sm:text-sm leading-relaxed text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:bg-slate-50"
            value={text} maxLength={10_000} onChange={(e) => { setText(e.target.value); setError(null); }}
            placeholder="This article is about…" aria-label="Write your summary" disabled={submitting}
          />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className={enough ? 'font-semibold text-emerald-700' : 'text-slate-500'} aria-live="polite">
              {words} / {article.minSummaryWords} words{enough ? ' ✓' : ''}
            </span>
            {draftable && <span className="text-slate-400">{saving ? 'Saving…' : dirty ? 'Unsaved changes' : saved ? 'Draft saved' : ''}</span>}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Summaries that copy long passages word-for-word from the article are not accepted.</p>
          {error && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" /> {error}
            </p>
          )}
          {submitting && <div className="mt-3"><AiFeedbackLoading /></div>}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {draftable ? (
              <Button variant="secondary" onClick={() => saveDraft(false)} disabled={!dirty || submitting} loading={saving && !submitting}>Save draft</Button>
            ) : (
              <Button variant="secondary" onClick={() => { setRevising(false); setText(saved); setError(null); }} disabled={submitting}>Cancel</Button>
            )}
            <Button icon={<Send size={15} />} onClick={submit} loading={submitting} disabled={!text.trim() || (a.status === 'SUBMITTED' && !dirty)}>
              {resubmitting ? 'Resubmit summary' : 'Submit summary'}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">{a.summary}</p>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-400">{a.summaryWordCount} words</p>
            {a.status === 'SUBMITTED' && (
              <Button size="sm" variant="secondary" icon={<Pencil size={13} />} onClick={() => setRevising(true)}>Edit &amp; resubmit</Button>
            )}
          </div>
        </>
      )}

      {a.submittedAt && !editable && (
        <div className="mt-4">
          <AiFeedbackPanel articleId={article.id} feedback={a.aiFeedback} />
        </div>
      )}
      {a.submittedAt && editable && a.aiFeedback?.status === 'ready' && !submitting && (
        <details className="mt-4 rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-700">Feedback on your last version</summary>
          <div className="mt-2"><AiFeedbackPanel articleId={article.id} feedback={a.aiFeedback} /></div>
        </details>
      )}
      {history.length > 1 && <SubmissionHistory articleId={article.id} items={history.slice(1)} />}
    </section>
  );
}

/** Earlier versions of a summary with the AI score each one got. */
function SubmissionHistory({ articleId, items, studentId, manager }: {
  articleId: string; items: ArticleSubmissionRecord[]; studentId?: string; manager?: boolean;
}) {
  return (
    <details className="mt-4 rounded-xl border border-slate-200 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-semibold text-slate-700">Earlier versions ({items.length})</summary>
      <ul className="mt-2 space-y-3">
        {items.map((s) => (
          <li key={s.n} className="border-t border-slate-100 pt-2">
            <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Version {s.n}</span>
              <span>{fmtDate(s.submittedAt)} · {s.wordCount} words</span>
              <AiScoreBadge score={s.ai?.score} status={s.ai?.status} />
            </p>
            <p className="mt-1 whitespace-pre-wrap text-slate-700">{s.summary}</p>
            {s.ai?.status === 'ready' && (
              <div className="mt-2"><AiFeedbackPanel articleId={articleId} feedback={s.ai} studentId={studentId} manager={manager} /></div>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

// ─── Tutor / admin: review summaries ─────────────────────────────────────────

function SubmissionCard({ articleId, s, onChanged }: { articleId: string; s: ArticleAssignmentInfo; onChanged: () => void }) {
  const [open, setOpen] = useState(s.status === 'SUBMITTED');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState<'approve' | 'revise' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const overdue = isOverdue(s.dueAt, s.status);

  const decide = async (decision: 'approve' | 'revise') => {
    setError(null);
    if (decision === 'revise' && !feedback.trim()) { setError('Tell the student what to improve.'); return; }
    setBusy(decision);
    try {
      await api.reviewArticleSummary(articleId, s.studentId, decision, feedback.trim() || undefined);
      toast.success(decision === 'approve' ? `Approved ${s.studentName}’s summary` : `Sent back to ${s.studentName}`);
      setFeedback('');
      onChanged();
    } catch (e) {
      setError((e as Error).message || 'Could not save the review');
    } finally {
      setBusy(null);
    }
  };

  const pct = s.copiedRatio != null ? Math.round(s.copiedRatio * 100) : null;
  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <button type="button" className="flex w-full items-center gap-3 px-3 py-2.5 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">{s.studentName}</p>
          <p className={`text-[11px] ${overdue ? 'font-semibold text-red-600' : 'text-slate-400'}`}>
            {s.submittedAt ? `Submitted ${fmtDate(s.submittedAt)}${(s.submissionCount ?? 0) > 1 ? ` · attempt ${s.submissionCount}` : ''}`
              : s.openedAt ? `Opened ${fmtDate(s.openedAt)}` : 'Not opened yet'}
            {overdue ? ` · overdue (due ${fmtDate(s.dueAt)})` : s.dueAt && !s.submittedAt ? ` · due ${fmtDate(s.dueAt)}` : ''}
          </p>
        </div>
        <AiScoreBadge score={s.aiFeedback?.score} status={s.submittedAt ? s.aiFeedback?.status ?? 'pending' : null} />
        <StatusBadge status={s.status} manager />
        {s.summary ? (open ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />) : null}
      </button>
      {open && s.summary && (
        <div className="border-t border-slate-100 px-3 py-3">
          <p className="mb-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
            <span>Assigned {fmtDate(s.assignedAt)}</span>
            <span>Opened {fmtDate(s.openedAt)}</span>
            <span>Submitted {fmtDate(s.submittedAt)}{(s.submissionCount ?? 0) > 1 ? ` (${s.submissionCount} versions)` : ''}</span>
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{s.summary}</p>
          <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-slate-500">
            <span>{s.summaryWordCount} words</span>
            {pct != null && (
              <span className={pct >= 25 ? 'font-semibold text-amber-700' : ''}>
                {pct === 0 ? 'No copied passages' : `${pct}% copied from the article`}
              </span>
            )}
          </p>
          <div className="mt-3">
            <AiFeedbackPanel key={`${s.submissionCount}-${s.aiFeedback?.status}`} articleId={articleId} feedback={s.aiFeedback}
              studentId={s.studentId} manager />
          </div>
          {(s.submissions?.length ?? 0) > 1 && (
            <SubmissionHistory articleId={articleId} items={s.submissions!.slice(1)} studentId={s.studentId} manager />
          )}
          {s.status === 'SUBMITTED' ? (
            <div className="mt-3">
              <textarea className="w-full min-h-[70px] rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                value={feedback} maxLength={2000} onChange={(e) => { setFeedback(e.target.value); setError(null); }}
                placeholder="Feedback for the student (required to ask for changes)" aria-label={`Feedback for ${s.studentName}`} />
              {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => decide('revise')} loading={busy === 'revise'} disabled={!!busy}>Ask for changes</Button>
                <Button size="sm" variant="success" icon={<CheckCircle2 size={14} />} onClick={() => decide('approve')} loading={busy === 'approve'} disabled={!!busy}>Approve</Button>
              </div>
            </div>
          ) : s.feedback ? (
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span className="font-semibold">{s.reviewedByName || 'Feedback'}:</span> {s.feedback}
            </p>
          ) : null}
        </div>
      )}
    </li>
  );
}

function ReviewPanel({ article, onChanged, onEdit }: { article: ArticleDetail; onChanged: () => void; onEdit: () => void }) {
  const list = article.assignments ?? [];
  const order = { SUBMITTED: 0, NEEDS_REVISION: 1, ASSIGNED: 2, APPROVED: 3 } as const;
  const sorted = [...list].sort((x, y) => order[x.status] - order[y.status] || x.studentName.localeCompare(y.studentName));
  const approved = list.filter((s) => s.status === 'APPROVED').length;
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4" aria-labelledby="review-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="review-heading" className="font-semibold text-slate-900">Student summaries</h2>
        <span className="text-xs font-semibold text-slate-500">{approved}/{list.length} approved</span>
      </div>
      {article.instructions && (
        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-slate-600 border border-slate-200">
          <span className="font-semibold">Instructions:</span> <span className="whitespace-pre-wrap">{article.instructions}</span>
        </p>
      )}
      {list.length === 0 ? (
        <div className="mt-3 text-sm text-slate-500">
          <p>No students are assigned yet.</p>
          <Button className="mt-3" size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={onEdit}>Assign students</Button>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {sorted.map((s) => <SubmissionCard key={s.studentId} articleId={article.id} s={s} onChanged={onChanged} />)}
        </ul>
      )}
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function ArticleReadPage() {
  const { articleId } = useParams<{ articleId: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const students = useAssignableStudents();

  const load = useCallback(() => {
    if (!articleId) return;
    api.getArticle(articleId)
      .then((r) => { setArticle(r.article); setError(null); })
      .catch((e) => setError(e.message || 'Could not load the article'));
  }, [articleId]);
  useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <p className="text-slate-700 font-medium">{error}</p>
        <Button className="mt-4" variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => navigate('/articles')}>Back to articles</Button>
      </div>
    );
  }
  if (!article) return <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>;

  const due = article.assignment?.dueAt;
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-start gap-3 mb-5">
        <button onClick={() => navigate('/articles')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Back to articles" aria-label="Back to articles">
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div className="min-w-0 flex-1">
          {article.subject && <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">{article.subject}</p>}
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">{article.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            {article.topic && <span className="font-medium text-slate-600">{article.topic}</span>}
            <span className="inline-flex items-center gap-1"><Clock size={12} /> {article.readMinutes} min read</span>
            {article.createdByName && <span>· by {article.createdByName}</span>}
            {due && article.assignment && (
              <span className={isOverdue(due, article.assignment.status) ? 'font-semibold text-red-600' : ''}>· due {fmtDate(due)}</span>
            )}
          </p>
        </div>
        {article.canEdit && <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => setEditing(true)}>Edit &amp; assign</Button>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <article className="rounded-2xl border border-slate-200 bg-white px-5 py-2 sm:px-8 sm:py-4 shadow-sm">
          <ArticleBody text={article.body} />
          {article.sourceUrl && (
            <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer nofollow"
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline">
              Read the original <ExternalLink size={14} />
            </a>
          )}
        </article>
        <div className="lg:sticky lg:top-4">
          {article.assignment
            ? <SummaryPanel key={`${article.assignment.status}-${article.assignment.submissionCount}-${article.assignment.aiFeedback?.status}`} article={article} onChanged={load} />
            : <ReviewPanel article={article} onChanged={load} onEdit={() => setEditing(true)} />}
        </div>
      </div>

      {article.canEdit && (
        <ArticleEditorModal isOpen={editing} article={article} students={students} onClose={() => setEditing(false)} onSaved={load} />
      )}
    </div>
  );
}
