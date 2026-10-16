import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eye, Lightbulb, Loader2, RotateCcw, Shuffle, X,
} from 'lucide-react';
import { api, type FlashcardDeckDetail } from '../../lib/api';
import { Button } from '../../components/common/Button';

// Study a vocab / flashcard deck: read "About this topic", then go through the
// cards one at a time — reveal the hint if needed, flip to see the meaning and
// example, and mark each "I know this" or "Still learning". Students' progress
// (known + seen cards) is saved; tutors and admins get the same screen as a
// read-only preview.

type Mode = 'all' | 'learning';

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function FlashcardStudyPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const [deck, setDeck] = useState<FlashcardDeckDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>('all');
  const [isShuffled, setIsShuffled] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  const seenRef = useRef<Set<string>>(new Set());
  const [infoOpen, setInfoOpen] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPreview = !!deck?.canEdit;

  useEffect(() => {
    if (!deckId) return;
    api.getFlashcardDeck(deckId)
      .then(({ deck }) => {
        setDeck(deck);
        setKnown(new Set(deck.knownCardIds ?? []));
        seenRef.current = new Set([...(deck.seenCardIds ?? []), ...(deck.knownCardIds ?? [])]);
        setSeenCount(seenRef.current.size);
        setOrder(deck.cards.map((c) => c.id));
        // Returning students who have started already go straight to the cards.
        setInfoOpen(!(deck.knownCardIds && deck.knownCardIds.length > 0));
      })
      .catch((e) => setError(e.status === 403 ? 'This deck has not been shared with you.' : e.message || 'Could not load the flashcards.'));
  }, [deckId]);

  const cardsById = useMemo(() => new Map((deck?.cards ?? []).map((c) => [c.id, c])), [deck]);

  // The sequence being studied: every card, or only those not yet known (fixed when the round starts).
  const buildOrder = useCallback((m: Mode, shuffle: boolean, knownSet: Set<string>) => {
    const ids = (deck?.cards ?? []).map((c) => c.id).filter((id) => m === 'all' || !knownSet.has(id));
    return shuffle ? shuffled(ids) : ids;
  }, [deck]);

  const startRound = (m: Mode, shuffle = isShuffled) => {
    setMode(m);
    setIsShuffled(shuffle);
    setOrder(buildOrder(m, shuffle, known));
    setPos(0);
    setFlipped(false);
    setHintShown(false);
  };

  const persist = useCallback((next: Set<string>) => {
    if (!deck || isPreview) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(() => {
      api.saveFlashcardProgress(deck.id, [...next], [...seenRef.current])
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    }, 500);
  }, [deck, isPreview]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const done = pos >= order.length;
  const current = !done ? cardsById.get(order[pos]) : undefined;

  const go = useCallback((delta: number) => {
    setPos((p) => Math.max(0, Math.min(order.length, p + delta)));
    setFlipped(false);
    setHintShown(false);
  }, [order.length]);

  // A card counts as "seen" the first time it is flipped to the meaning.
  useEffect(() => {
    if (!flipped || !current || seenRef.current.has(current.id)) return;
    seenRef.current.add(current.id);
    setSeenCount(seenRef.current.size);
    persist(known);
  }, [flipped, current, known, persist]);

  const mark = useCallback((gotIt: boolean) => {
    if (!current) return;
    setKnown((prev) => {
      const next = new Set(prev);
      if (gotIt) next.add(current.id); else next.delete(current.id);
      persist(next);
      return next;
    });
    go(1);
  }, [current, go, persist]);

  // Keyboard: Space/Enter flip, ←/→ move, K = got it, L = still learning.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (!current) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped((f) => !f); }
      else if ((e.key === 'h' || e.key === 'H') && current.hint) setHintShown((v) => !v);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (flipped && (e.key === 'k' || e.key === 'K')) mark(true);
      else if (flipped && (e.key === 'l' || e.key === 'L')) mark(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, flipped, go, mark]);

  if (error) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <p className="text-slate-700 font-medium">{error}</p>
        <Button className="mt-4" variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => navigate('/flashcards')}>Back to vocab</Button>
      </div>
    );
  }
  if (!deck) {
    return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>;
  }

  const total = deck.cards.length;
  const knownCount = deck.cards.filter((c) => known.has(c.id)).length;
  const learningLeft = total - knownCount;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <button onClick={() => navigate('/flashcards')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Back to vocab">
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div className="min-w-0 flex-1">
          {deck.subject && <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">{deck.subject}</p>}
          <h1 className="text-xl font-semibold text-slate-900 leading-snug">{deck.title}</h1>
          <p className="text-sm text-slate-500">{deck.topic}{deck.createdByName ? ` · from ${deck.createdByName}` : ''}</p>
        </div>
      </div>

      {isPreview && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <Eye size={16} /> Preview — this is what your students see. Your answers here aren't saved.
        </div>
      )}

      {/* About this topic */}
      {deck.description && (
        <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/40">
          <button type="button" onClick={() => setInfoOpen((v) => !v)} className="w-full flex items-center justify-between px-5 py-3 text-left" aria-expanded={infoOpen}>
            <span className="text-sm font-bold text-slate-900">About this topic</span>
            {infoOpen ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
          </button>
          {infoOpen && <p className="px-5 pb-4 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{deck.description}</p>}
        </div>
      )}

      {/* Progress + controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[200px] flex-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
            <span>Known {knownCount} of {total}{!isPreview ? ` · seen ${Math.min(seenCount, total)}` : ''}</span>
            {!isPreview && saveState !== 'idle' && (
              <span className={saveState === 'error' ? 'text-red-600' : 'text-slate-400'}>
                {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Progress saved' : 'Not saved — check your connection'}
              </span>
            )}
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${total ? (knownCount / total) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-bold">
            <button type="button" onClick={() => startRound('all')} aria-pressed={mode === 'all'}
              className={`px-3 py-1.5 rounded-md ${mode === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>All cards</button>
            <button type="button" onClick={() => startRound('learning')} aria-pressed={mode === 'learning'} disabled={learningLeft === 0}
              className={`px-3 py-1.5 rounded-md disabled:opacity-40 ${mode === 'learning' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              Still learning ({learningLeft})
            </button>
          </div>
          <button type="button" onClick={() => startRound(mode, !isShuffled)} aria-pressed={isShuffled} title="Shuffle"
            className={`p-2 rounded-lg border ${isShuffled ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            <Shuffle size={16} />
          </button>
        </div>
      </div>

      {/* Card */}
      {done ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-4xl mb-2" aria-hidden="true">{learningLeft === 0 ? '🎉' : '👏'}</p>
          <h2 className="text-lg font-bold text-slate-900">{order.length === 0 ? 'Nothing left to study here' : 'Round complete!'}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {learningLeft === 0 ? `You know all ${total} cards in this deck.` : `You know ${knownCount} of ${total} cards. ${learningLeft} still to learn.`}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {learningLeft > 0 && <Button onClick={() => startRound('learning')}>Study the {learningLeft} I'm still learning</Button>}
            <Button variant="secondary" icon={<RotateCcw size={15} />} onClick={() => startRound('all')}>Go through all cards again</Button>
          </div>
        </div>
      ) : current && (
        <>
          <div className="mb-2 text-center text-xs font-semibold text-slate-400" aria-label={`Card ${pos + 1} of ${order.length}`}>{pos + 1} / {order.length}</div>
          <div className="[perspective:1200px]">
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              aria-label={flipped ? `Card ${pos + 1}, answer side. Click to flip back.` : `Card ${pos + 1}, question side. Click to flip.`}
              className="relative block w-full min-h-[280px] sm:min-h-[320px] cursor-pointer text-left"
              style={{ transformStyle: 'preserve-3d', transition: 'transform 0.45s ease', transform: flipped ? 'rotateY(180deg)' : 'none' }}
            >
              <div className="absolute inset-0 flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-md" style={{ backfaceVisibility: 'hidden' }}>
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Front</span>
                <div className="flex-1 grid place-items-center">
                  <div className="text-center">
                    <p className="text-2xl sm:text-3xl font-semibold text-slate-900 whitespace-pre-wrap break-words">{current.front}</p>
                    {hintShown && current.hint && (
                      <p className="mt-4 inline-flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        <Lightbulb size={15} className="mt-0.5 shrink-0" /> <span className="whitespace-pre-wrap">{current.hint}</span>
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-center text-xs text-slate-400"><span className="sm:hidden">Tap to flip</span><span className="hidden sm:inline">Click or press Space to flip</span></span>
              </div>
              <div className="absolute inset-0 flex flex-col rounded-3xl border border-blue-200 bg-blue-50 p-8 shadow-md"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                <span className="text-[11px] font-bold uppercase tracking-wide text-blue-600">Back</span>
                <div className="flex-1 grid place-items-center overflow-y-auto">
                  <div className="text-center">
                    <p className="text-lg sm:text-xl text-slate-800 whitespace-pre-wrap break-words">{current.back}</p>
                    {current.example && (
                      <p className="mt-3 text-sm italic text-slate-600 whitespace-pre-wrap">“{current.example}”</p>
                    )}
                  </div>
                </div>
                {known.has(current.id) && <span className="text-center text-xs font-semibold text-emerald-700">You marked this as known</span>}
              </div>
            </button>
          </div>

          {current.hint && !flipped && (
            <div className="mt-3 flex justify-center">
              <button type="button" onClick={() => setHintShown((v) => !v)} aria-pressed={hintShown}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50">
                <Lightbulb size={13} /> {hintShown ? 'Hide hint' : 'Show hint'}
              </button>
            </div>
          )}

          {/* Phone: the main action(s) on their own row, Previous / Next below. */}
          <div className="mt-5 grid grid-cols-2 items-center gap-3 sm:flex sm:justify-between">
            <div className="order-1 col-span-2 flex justify-center gap-2 sm:order-2">
              {flipped ? (
                <>
                  <Button className="flex-1 sm:flex-none" variant="secondary" icon={<X size={15} />} onClick={() => mark(false)} title="Still learning (L)">Still learning</Button>
                  <Button className="flex-1 sm:flex-none" variant="success" icon={<Check size={15} />} onClick={() => mark(true)} title="I know this (K)">I know this</Button>
                </>
              ) : (
                <Button className="w-full sm:w-auto" onClick={() => setFlipped(true)}>Show meaning</Button>
              )}
            </div>
            <div className="order-2 sm:order-1">
              <Button variant="ghost" icon={<ChevronLeft size={16} />} onClick={() => go(-1)} disabled={pos === 0}>Previous</Button>
            </div>
            <div className="order-3 justify-self-end">
              <Button variant="ghost" iconRight={<ChevronRight size={16} />} onClick={() => go(1)}>Next</Button>
            </div>
          </div>
          <p className="mt-3 hidden sm:block text-center text-[11px] text-slate-400">Keys: Space flip · H hint · ← → move · K I know this · L still learning</p>
        </>
      )}
    </div>
  );
}
