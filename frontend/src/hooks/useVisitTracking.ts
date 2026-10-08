import { useEffect, useRef } from 'react';
import { QuestionTimeTracker } from '../lib/questionTimeTracker';

interface Options {
  /** Real attempt id; null/undefined (or preview mode) disables tracking. */
  attemptId: string | null | undefined;
  enabled: boolean;
  /** The question currently on screen, or null when none is (directions, break, review screen…). */
  questionId: string | null;
  /**
   * The current question's answer in its stored (server) shape, or null.
   * Pass `undefined` while the local answer state still belongs to the
   * previous question, so the switch itself is never logged as an answer.
   */
  answer: unknown;
  /** Grid-in answers are logged once typing settles, not on every keystroke. */
  debounceAnswer: boolean;
  flagged: boolean;
  finished: boolean;
}

const NUMERIC_SETTLE_MS = 1200;
/**
 * A question must stay on screen this long to count as a visit. Filters out
 * single-render flashes between UI states (e.g. the review screen closing a
 * frame before the module-transition screen opens), which are not something
 * the student did. Real visits are backdated to when the question appeared.
 */
const ENTER_SETTLE_MS = 150;

/**
 * Feeds the test player's state into a QuestionTimeTracker. Driving it from
 * state (rather than from each button handler) means every way of changing
 * question — Next, Back, palette, review screen, module change, resume —
 * goes through the same single call site.
 */
export function useVisitTracking({ attemptId, enabled, questionId, answer, debounceAnswer, flagged, finished }: Options): {
  /** Close the open visit and send all queued events. Await before submitting a module. */
  flush: () => Promise<void>;
} {
  const trackerRef = useRef<QuestionTimeTracker | null>(null);
  const lastAnswer = useRef<{ q: string | null; json: string | null }>({ q: null, json: null });
  const lastFlag = useRef<{ q: string | null; on: boolean }>({ q: null, on: false });
  const pending = useRef<{ q: string; choice: unknown; timer: ReturnType<typeof setTimeout> } | null>(null);
  const pendingEnter = useRef<{ q: string; at: number; timer: ReturnType<typeof setTimeout> } | null>(null);

  const flushEnter = () => {
    const p = pendingEnter.current;
    if (!p) return;
    clearTimeout(p.timer);
    pendingEnter.current = null;
    trackerRef.current?.enter(p.q, p.at);
  };
  const cancelEnter = () => {
    if (pendingEnter.current) clearTimeout(pendingEnter.current.timer);
    pendingEnter.current = null;
  };

  const flushPending = () => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    trackerRef.current?.answer(p.q, p.choice);
  };

  // Create one tracker per attempt.
  useEffect(() => {
    if (!enabled || !attemptId) return;
    const tracker = new QuestionTimeTracker({ attemptId });
    trackerRef.current = tracker;
    return () => {
      cancelEnter();
      flushPending();
      tracker.destroy();
      if (trackerRef.current === tracker) trackerRef.current = null;
    };
  }, [enabled, attemptId]);

  // ENTER / LEAVE — a new question, or no question, on screen.
  useEffect(() => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    flushPending(); // a settling grid-in answer belongs to the visit being left
    cancelEnter();
    // The previous visit ends now, whatever comes next.
    tracker.leave();
    if (!questionId) return;
    const at = tracker.now();
    const q = questionId;
    pendingEnter.current = { q, at, timer: setTimeout(flushEnter, ENTER_SETTLE_MS) };
  }, [questionId, enabled, attemptId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ANSWER / CLEAR — only changes made while the question stays on screen.
  useEffect(() => {
    if (!questionId || answer === undefined) return;
    const json = JSON.stringify(answer ?? null);
    const prev = lastAnswer.current;
    lastAnswer.current = { q: questionId, json };
    // First settled value after arriving on a question is the baseline, not a change.
    if (prev.q !== questionId || prev.json === json) return;
    const tracker = trackerRef.current;
    if (!tracker) return;
    flushEnter(); // an answer this quick still belongs to the visit that just started
    if (debounceAnswer) {
      if (pending.current) clearTimeout(pending.current.timer);
      const timer = setTimeout(flushPending, NUMERIC_SETTLE_MS);
      pending.current = { q: questionId, choice: answer ?? null, timer };
    } else {
      flushPending();
      tracker.answer(questionId, answer ?? null);
    }
  }, [questionId, answer, debounceAnswer]); // eslint-disable-line react-hooks/exhaustive-deps

  // FLAG / UNFLAG
  useEffect(() => {
    if (!questionId) return;
    const prev = lastFlag.current;
    lastFlag.current = { q: questionId, on: flagged };
    if (prev.q !== questionId || prev.on === flagged) return;
    flushEnter();
    trackerRef.current?.markReview(questionId, flagged);
  }, [questionId, flagged]);

  // SUBMIT
  useEffect(() => {
    if (!finished) return;
    cancelEnter();
    flushPending();
    trackerRef.current?.end('SUBMIT');
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = async () => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    // A question that appeared < ENTER_SETTLE_MS ago is a flash between screens
    // (e.g. review screen → module transition), not a visit.
    cancelEnter();
    flushPending();
    // The module is being submitted (e.g. its timer ran out with a question
    // still showing): close that visit now so the server sees its full length.
    tracker.leave();
    await tracker.flushAll();
  };
  return { flush };
}
