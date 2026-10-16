import { useEffect, useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { api, type ArticleDetail, type DbUser } from '../../lib/api';
import { wordCount } from './ArticleBody';

// Create / edit an article and choose which students must read and summarise it.

const SUBJECTS = ['SAT Math', 'SAT Reading & Writing', 'ACT English', 'ACT Math', 'ACT Reading', 'ACT Science', 'AP', 'General'];
const LIMITS = { title: 160, topic: 120, subject: 60, body: 60_000, sourceUrl: 500, instructions: 2_000, minWords: { min: 10, max: 500 } };

/** yyyy-mm-dd (local) for an <input type="date">. */
const toDateInput = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** End of the chosen local day, so "due Nov 1" means the student has all of Nov 1. */
const fromDateInput = (v: string) => (v ? new Date(`${v}T23:59:59`).toISOString() : null);

export function ArticleEditorModal({
  isOpen,
  onClose,
  onSaved,
  article,
  students,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Article to edit (manager detail view); omit to create a new one. */
  article?: ArticleDetail | null;
  /** Students this user may assign (a tutor's own students, or all for admins). */
  students: DbUser[];
}) {
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [minWords, setMinWords] = useState('50');
  const [due, setDue] = useState('');
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [studentQuery, setStudentQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(article?.title ?? '');
    setTopic(article?.topic ?? '');
    setSubject(article?.subject ?? '');
    setBody(article?.body ?? '');
    setSourceUrl(article?.sourceUrl ?? '');
    setInstructions(article?.instructions ?? '');
    setMinWords(String(article?.minSummaryWords ?? 50));
    setDue(toDateInput(article?.assignments?.find((a) => a.dueAt)?.dueAt));
    setAssigned(new Set((article?.assignments ?? []).map((a) => a.studentId)));
    setStudentQuery('');
    setError(null);
  }, [isOpen, article]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    const list = [...students].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    return q ? list.filter((s) => `${s.name} ${s.email}`.toLowerCase().includes(q)) : list;
  }, [students, studentQuery]);

  const words = wordCount(body);

  const validate = (): string | null => {
    if (!title.trim()) return 'Give the article a title.';
    if (!body.trim()) return 'Paste or write the article text.';
    if (body.length > LIMITS.body) return `The article must be under ${LIMITS.body.toLocaleString()} characters.`;
    const url = sourceUrl.trim();
    if (url && !/^https?:\/\/\S+$/i.test(url)) return 'The source link must start with https://';
    const n = Number(minWords);
    if (!Number.isInteger(n) || n < LIMITS.minWords.min || n > LIMITS.minWords.max) {
      return `Minimum summary length must be ${LIMITS.minWords.min}–${LIMITS.minWords.max} words.`;
    }
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError(null);
    const input = {
      title: title.trim(),
      topic: topic.trim() || undefined,
      subject: subject.trim() || undefined,
      body,
      sourceUrl: sourceUrl.trim() || undefined,
      instructions: instructions.trim(),
      minSummaryWords: Number(minWords),
    };
    const dueAt = fromDateInput(due);
    try {
      if (article) {
        await api.updateArticle(article.id, input);
        const r = await api.setArticleAssignments(article.id, [...assigned], dueAt);
        toast.success(r.added ? `Article saved and sent to ${r.added} more student${r.added === 1 ? '' : 's'}` : 'Article saved');
      } else {
        const r = await api.createArticle({ ...input, dueAt, studentIds: [...assigned] });
        toast.success(r.assignedTo ? `Article assigned to ${r.assignedTo} student${r.assignedTo === 1 ? '' : 's'}` : 'Article saved');
      }
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Could not save the article.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500';

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title={article ? 'Edit article' : 'New article'} size="xl" closeOnBackdrop={false}>
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Title</span>
            <input className={`${inputCls} mt-1`} value={title} maxLength={LIMITS.title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. How the Federal Reserve sets interest rates" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Topic <span className="font-normal text-slate-400">(optional)</span></span>
            <input className={`${inputCls} mt-1`} value={topic} maxLength={LIMITS.topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Economics" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Subject <span className="font-normal text-slate-400">(optional)</span></span>
            <input className={`${inputCls} mt-1`} value={subject} maxLength={LIMITS.subject} list="article-subjects" onChange={(e) => setSubject(e.target.value)} placeholder="Choose or type" />
            <datalist id="article-subjects">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
          <label className="block sm:col-span-2">
            <span className="flex items-baseline justify-between text-xs font-semibold text-slate-600">
              <span>Article text</span>
              <span className="font-normal text-slate-400">{words.toLocaleString()} words · ~{Math.max(1, Math.round(words / 200))} min read</span>
            </span>
            <textarea className={`${inputCls} mt-1 min-h-[220px] leading-relaxed`} value={body} maxLength={LIMITS.body} onChange={(e) => setBody(e.target.value)}
              placeholder={'Paste the article here.\n\nLeave a blank line between paragraphs.\n## Lines starting with ## become headings\n- Lines starting with - become bullet points'} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Source link <span className="font-normal text-slate-400">(optional — shown to students as “Read the original”)</span></span>
            <input className={`${inputCls} mt-1`} value={sourceUrl} maxLength={LIMITS.sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" inputMode="url" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Instructions for students <span className="font-normal text-slate-400">(optional — shown above the summary box)</span></span>
            <textarea className={`${inputCls} mt-1 min-h-[70px]`} value={instructions} maxLength={LIMITS.instructions} onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Focus on the author's main argument and the two pieces of evidence they use." />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Minimum summary length (words)</span>
            <input className={`${inputCls} mt-1`} type="number" min={LIMITS.minWords.min} max={LIMITS.minWords.max} value={minWords} onChange={(e) => setMinWords(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Due date <span className="font-normal text-slate-400">(optional)</span></span>
            <input className={`${inputCls} mt-1`} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><Users size={15} /> Assign to students <span className="font-medium text-slate-400">({assigned.size} selected)</span></h4>
            {students.length > 0 && (
              <div className="flex gap-2 text-xs font-semibold">
                <button type="button" className="text-blue-600 hover:underline" onClick={() => setAssigned(new Set(students.map((s) => s.id)))}>Select all</button>
                <button type="button" className="text-slate-500 hover:underline" onClick={() => setAssigned(new Set())}>Clear</button>
              </div>
            )}
          </div>
          {students.length === 0 ? (
            <p className="text-xs text-slate-500 rounded-lg bg-slate-50 px-3 py-2">No students to assign yet. You can save the article now and assign it later.</p>
          ) : (
            <>
              {students.length > 8 && (
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className={`${inputCls} pl-8`} value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder="Search students" />
                </div>
              )}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {filteredStudents.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" className="accent-blue-600" checked={assigned.has(s.id)}
                      onChange={(e) => setAssigned((prev) => { const n = new Set(prev); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n; })} />
                    <span className="font-medium text-slate-800">{s.name || s.email}</span>
                    {s.name && <span className="text-xs text-slate-400 truncate">{s.email}</span>}
                  </label>
                ))}
                {filteredStudents.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">No students match “{studentQuery}”.</p>}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">Newly selected students get a notification. Unselecting a student removes the article and their summary.</p>
            </>
          )}
        </section>

        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving}>{article ? 'Save changes' : assigned.size ? 'Save & assign' : 'Save article'}</Button>
        </div>
      </div>
    </Modal>
  );
}
