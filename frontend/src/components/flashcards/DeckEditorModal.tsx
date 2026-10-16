import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ClipboardPaste, Plus, Search, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { api, type DbUser, type FlashcardDeckDetail } from '../../lib/api';

// Create / edit a flashcard deck and choose who it is shared with.

const SUBJECTS = ['SAT Math', 'SAT Reading & Writing', 'ACT English', 'ACT Math', 'ACT Reading', 'ACT Science', 'AP', 'General'];
const LIMITS = { title: 120, topic: 120, description: 5000, cardText: 2000, hint: 500, example: 1000, cards: 200 };

interface EditableCard { key: string; id?: string; front: string; back: string; hint: string; example: string }
type ParsedCard = Omit<EditableCard, 'key' | 'id'>;

let keySeq = 0;
const newKey = () => `c${++keySeq}`;
const blankCard = (): EditableCard => ({ key: newKey(), front: '', back: '', hint: '', example: '' });

/**
 * Turns pasted lines into cards, one card per line.
 * With "|" or tabs:  word | hint | meaning | example   (example optional;
 *                    a 2-field line "word | meaning" has no hint).
 * Otherwise the line is split once on " - ", " – ", " — " or ": " into word and meaning.
 */
export function parseBulkCards(text: string): { cards: ParsedCard[]; skipped: number } {
  const cards: ParsedCard[] = [];
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const multi = line.includes('|') ? '|' : line.includes('\t') ? '\t' : null;
    if (multi) {
      const f = line.split(multi).map((x) => x.trim());
      const card = f.length === 2
        ? { front: f[0], hint: '', back: f[1], example: '' }
        : { front: f[0], hint: f[1] ?? '', back: f[2] ?? '', example: f.slice(3).join(` ${multi} `).trim() };
      if (card.front && card.back) cards.push(card); else skipped++;
      continue;
    }
    const sep = [' - ', ' – ', ' — ', ': '].find((s) => line.includes(s));
    if (!sep) { skipped++; continue; }
    const i = line.indexOf(sep);
    const front = line.slice(0, i).trim();
    const back = line.slice(i + sep.length).trim();
    if (front && back) cards.push({ front, back, hint: '', example: '' }); else skipped++;
  }
  return { cards, skipped };
}

export function DeckEditorModal({
  isOpen,
  onClose,
  onSaved,
  deck,
  students,
  initialSharedIds,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Deck to edit; omit to create a new one. */
  deck?: FlashcardDeckDetail | null;
  /** Students this user may share with (a tutor's own students, or all for admins). */
  students: DbUser[];
  initialSharedIds?: string[];
}) {
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [cards, setCards] = useState<EditableCard[]>([blankCard(), blankCard()]);
  const [shared, setShared] = useState<Set<string>>(new Set());
  const [studentQuery, setStudentQuery] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(deck?.title ?? '');
    setTopic(deck?.topic ?? '');
    setSubject(deck?.subject ?? '');
    setDescription(deck?.description ?? '');
    setCards(deck?.cards.length
      ? deck.cards.map((c) => ({ key: newKey(), id: c.id, front: c.front, back: c.back, hint: c.hint ?? '', example: c.example ?? '' }))
      : [blankCard(), blankCard()]);
    setShared(new Set(initialSharedIds ?? []));
    setStudentQuery('');
    setBulkOpen(false);
    setBulkText('');
    setError(null);
  }, [isOpen, deck, initialSharedIds]);

  const filledCards = cards.filter((c) => c.front.trim() || c.back.trim() || c.hint.trim() || c.example.trim());
  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    const list = [...students].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    return q ? list.filter((s) => `${s.name} ${s.email}`.toLowerCase().includes(q)) : list;
  }, [students, studentQuery]);

  const updateCard = (key: string, patch: Partial<EditableCard>) =>
    setCards((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const moveCard = (idx: number, dir: -1 | 1) =>
    setCards((cs) => {
      const j = idx + dir;
      if (j < 0 || j >= cs.length) return cs;
      const next = [...cs];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  const removeCard = (key: string) => setCards((cs) => (cs.length > 1 ? cs.filter((c) => c.key !== key) : [blankCard()]));

  const importBulk = () => {
    const { cards: parsed, skipped } = parseBulkCards(bulkText);
    if (parsed.length === 0) {
      toast.error('No cards found — put one card per line, e.g. "ubiquitous | think: everywhere | found everywhere"');
      return;
    }
    setCards((cs) => [...cs.filter((c) => c.front.trim() || c.back.trim() || c.hint.trim() || c.example.trim()), ...parsed.map((p) => ({ key: newKey(), ...p }))].slice(0, LIMITS.cards));
    setBulkText('');
    setBulkOpen(false);
    toast.success(`Added ${parsed.length} card${parsed.length === 1 ? '' : 's'}${skipped ? ` (${skipped} line${skipped === 1 ? '' : 's'} skipped)` : ''}`);
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Give the deck a title.';
    if (!topic.trim()) return 'Add the topic these cards cover.';
    if (title.length > LIMITS.title || topic.length > LIMITS.topic) return 'Title and topic must be under 120 characters.';
    if (description.length > LIMITS.description) return `Topic info must be under ${LIMITS.description} characters.`;
    if (filledCards.length === 0) return 'Add at least one card.';
    if (filledCards.length > LIMITS.cards) return `A deck can have at most ${LIMITS.cards} cards.`;
    const bad = filledCards.findIndex((c) => !c.front.trim() || !c.back.trim());
    if (bad >= 0) return `Card ${cards.indexOf(filledCards[bad]) + 1} needs both a word (front) and a meaning (back).`;
    if (filledCards.some((c) => c.front.length > LIMITS.cardText || c.back.length > LIMITS.cardText)) {
      return `Each side of a card must be under ${LIMITS.cardText} characters.`;
    }
    if (filledCards.some((c) => c.hint.length > LIMITS.hint)) return `Hints must be under ${LIMITS.hint} characters.`;
    if (filledCards.some((c) => c.example.length > LIMITS.example)) return `Examples must be under ${LIMITS.example} characters.`;
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError(null);
    const body = {
      title: title.trim(),
      topic: topic.trim(),
      subject: subject.trim() || undefined,
      description: description.trim() || undefined,
      cards: filledCards.map((c) => ({ id: c.id, front: c.front, back: c.back, hint: c.hint.trim() || undefined, example: c.example.trim() || undefined })),
    };
    try {
      if (deck) {
        await api.updateFlashcardDeck(deck.id, body);
        await api.setFlashcardShares(deck.id, [...shared]);
        toast.success('Flashcards saved');
      } else {
        const res = await api.createFlashcardDeck({ ...body, studentIds: [...shared] });
        toast.success(res.sharedWith ? `Flashcards shared with ${res.sharedWith} student${res.sharedWith === 1 ? '' : 's'}` : 'Flashcards saved');
      }
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Could not save the flashcards.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500';

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title={deck ? 'Edit vocab deck' : 'New vocab deck'} size="xl" closeOnBackdrop={false}>
      <div className="space-y-6">
        {/* Topic */}
        <section className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Deck title</span>
            <input className={`${inputCls} mt-1`} value={title} maxLength={LIMITS.title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. SAT words — week 3" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Topic</span>
            <input className={`${inputCls} mt-1`} value={topic} maxLength={LIMITS.topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Words about change" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Subject <span className="font-normal text-slate-400">(optional)</span></span>
            <input className={`${inputCls} mt-1`} value={subject} list="flashcard-subjects" onChange={(e) => setSubject(e.target.value)} placeholder="Choose or type" />
            <datalist id="flashcard-subjects">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-slate-600">About this topic <span className="font-normal text-slate-400">(optional — students read this before the cards)</span></span>
            <textarea className={`${inputCls} mt-1 min-h-[90px]`} value={description} maxLength={LIMITS.description} onChange={(e) => setDescription(e.target.value)}
              placeholder="A short explanation, key rules or tips for this topic…" />
          </label>
        </section>

        {/* Cards */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h4 className="text-sm font-bold text-slate-900">Cards <span className="font-medium text-slate-400">({filledCards.length})</span></h4>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={<ClipboardPaste size={14} />} onClick={() => setBulkOpen((v) => !v)}>Paste many</Button>
              <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setCards((cs) => [...cs, blankCard()])} disabled={cards.length >= LIMITS.cards}>Add card</Button>
            </div>
          </div>

          {bulkOpen && (
            <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
              <p className="text-xs text-slate-600 mb-2">
                One card per line: <code className="bg-white px-1 rounded break-all">word | hint | meaning | example</code>. The example is optional;
                {' '}<code className="bg-white px-1 rounded">word | meaning</code> (no hint) also works.
              </p>
              <textarea className={`${inputCls} min-h-[130px] font-mono text-xs`} value={bulkText} onChange={(e) => setBulkText(e.target.value)}
                placeholder={'ubiquitous | think: everywhere | present or found everywhere | Phones are ubiquitous in schools.\nephemeral | lasts a day | lasting a very short time\nmitigate | opposite of worsen | to make less severe'} />
              <div className="mt-2 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setBulkOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={importBulk}>Add these cards</Button>
              </div>
            </div>
          )}

          <ol className="space-y-3">
            {cards.map((c, i) => (
              <li key={c.key} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500">Card {i + 1}</span>
                  <div className="flex items-center gap-1 text-slate-400">
                    <button type="button" className="p-1 rounded hover:bg-slate-100 disabled:opacity-30" onClick={() => moveCard(i, -1)} disabled={i === 0} aria-label={`Move card ${i + 1} up`}><ArrowUp size={14} /></button>
                    <button type="button" className="p-1 rounded hover:bg-slate-100 disabled:opacity-30" onClick={() => moveCard(i, 1)} disabled={i === cards.length - 1} aria-label={`Move card ${i + 1} down`}><ArrowDown size={14} /></button>
                    <button type="button" className="p-1 rounded hover:bg-red-50 hover:text-red-600" onClick={() => removeCard(c.key)} aria-label={`Delete card ${i + 1}`}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <textarea className={`${inputCls} min-h-[64px]`} value={c.front} maxLength={LIMITS.cardText} onChange={(e) => updateCard(c.key, { front: e.target.value })}
                    placeholder="Front — word or term" aria-label={`Card ${i + 1} front`} />
                  <textarea className={`${inputCls} min-h-[64px]`} value={c.back} maxLength={LIMITS.cardText} onChange={(e) => updateCard(c.key, { back: e.target.value })}
                    placeholder="Back — meaning" aria-label={`Card ${i + 1} back`} />
                  <input className={inputCls} value={c.hint} maxLength={LIMITS.hint} onChange={(e) => updateCard(c.key, { hint: e.target.value })}
                    placeholder="Hint (optional)" aria-label={`Card ${i + 1} hint`} />
                  <input className={inputCls} value={c.example} maxLength={LIMITS.example} onChange={(e) => updateCard(c.key, { example: e.target.value })}
                    placeholder="Example sentence (optional)" aria-label={`Card ${i + 1} example`} />
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Sharing */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><Users size={15} /> Share with students <span className="font-medium text-slate-400">({shared.size} selected)</span></h4>
            {students.length > 0 && (
              <div className="flex gap-2 text-xs font-semibold">
                <button type="button" className="text-blue-600 hover:underline" onClick={() => setShared(new Set(students.map((s) => s.id)))}>Select all</button>
                <button type="button" className="text-slate-500 hover:underline" onClick={() => setShared(new Set())}>Clear</button>
              </div>
            )}
          </div>
          {students.length === 0 ? (
            <p className="text-xs text-slate-500 rounded-lg bg-slate-50 px-3 py-2">No students to share with yet. You can save the deck now and share it later.</p>
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
                    <input type="checkbox" className="accent-blue-600" checked={shared.has(s.id)}
                      onChange={(e) => setShared((prev) => { const n = new Set(prev); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n; })} />
                    <span className="font-medium text-slate-800">{s.name || s.email}</span>
                    {s.name && <span className="text-xs text-slate-400 truncate">{s.email}</span>}
                  </label>
                ))}
                {filteredStudents.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">No students match “{studentQuery}”.</p>}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">Newly selected students get a notification. Unselecting a student removes their access.</p>
            </>
          )}
        </section>

        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving}>{deck ? 'Save changes' : shared.size ? 'Save & share' : 'Save deck'}</Button>
        </div>
      </div>
    </Modal>
  );
}
