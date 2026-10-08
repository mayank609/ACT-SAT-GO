import { api, postAttemptEvents } from './api';

// Logs what happens in the test player as small timestamped events
// (ENTER / LEAVE a question, ANSWER, FLAG, tab HIDDEN/VISIBLE, IDLE/ACTIVE,
// HEARTBEAT, SUBMIT…). The server rebuilds per-question *visits* from them for
// the Time Analytics chart. Rules (from the Time Analytics spec):
//  - time comes from performance.now() (monotonic — immune to clock changes);
//  - only the raw choice is sent, never whether it is correct;
//  - events are batched every 10 s and retried; the last batch uses keepalive;
//  - a reloaded player continues the same seq counter and time axis.

type EventType =
  | 'ENTER' | 'LEAVE' | 'ANSWER' | 'CLEAR' | 'FLAG' | 'UNFLAG'
  | 'HIDDEN' | 'VISIBLE' | 'IDLE' | 'ACTIVE' | 'HEARTBEAT'
  | 'SUBMIT' | 'MODULE_END' | 'TIME_UP';

interface QueuedEvent {
  localSeq: number;
  type: EventType;
  questionId: string | null;
  /** ms since this tracker started (performance.now based) */
  rel: number;
  wall: number;
  choice?: unknown;
}

/** Events per POST; keeps each body well under the 64 KB keepalive limit. */
const MAX_BATCH = 200;

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart', 'wheel'] as const;

export class QuestionTimeTracker {
  private readonly attemptId: string;
  private readonly idleMs: number;
  private queue: QueuedEvent[] = [];
  private localSeq = 0;
  private current: string | null = null;
  private readonly perf0 = performance.now();
  /** server state: seq / time offsets so a reload continues the same axis */
  private seqBase: number | null = null;
  private tBase = 0;
  private idle = false;
  private hidden = typeof document !== 'undefined' && document.hidden;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private heartbeat: ReturnType<typeof setInterval>;
  private flushing: Promise<boolean> | null = null;
  private destroyed = false;
  private lastActivity = 0;

  constructor({ attemptId, flushMs = 10_000, idleMs = 120_000 }: { attemptId: string; flushMs?: number; idleMs?: number }) {
    this.attemptId = attemptId;
    this.idleMs = idleMs;

    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, this.onActivity, { passive: true }));
    this.armIdle();

    this.heartbeat = setInterval(() => {
      if (this.current !== null) this.log('HEARTBEAT', this.current);
      void this.flush();
    }, flushMs);

    api.getAttemptEventState(attemptId)
      .then((s) => {
        this.seqBase = s.lastSeq;
        // Continue after the last stored event, and never behind the server's
        // view of elapsed time (keeps the axis aligned with the real clock).
        const elapsedHere = performance.now() - this.perf0;
        this.tBase = Math.max(s.lastT + 1, s.serverElapsedMs - elapsedHere, 0);
      })
      .catch(() => {
        // Server unreachable: fall back to a time-derived seq base, which still
        // sorts after any earlier segment of this attempt.
        this.seqBase = Math.floor(Date.now() / 1000) % 1_000_000_000;
        this.tBase = 0;
      })
      .finally(() => { void this.flush(); });
  }

  /** Tracker clock (ms since this tracker started). */
  now() {
    return Math.round(performance.now() - this.perf0);
  }

  private log(type: EventType, questionId: string | null, choice?: unknown, at?: number) {
    if (this.destroyed) return;
    this.queue.push({
      localSeq: ++this.localSeq,
      type,
      questionId,
      rel: at ?? this.now(),
      wall: Date.now(),
      ...(choice !== undefined ? { choice } : {}),
    });
  }

  /**
   * The question now on screen. Call on every way of changing question.
   * `at` (from now()) backdates the visit to when the question appeared.
   */
  enter(questionId: string, at?: number) {
    if (this.current === questionId) return;
    if (this.current !== null) this.log('LEAVE', this.current, undefined, at);
    this.current = questionId;
    this.log('ENTER', questionId, undefined, at);
    // A visit that starts while the tab is hidden / student idle starts paused.
    if (this.hidden) this.log('HIDDEN', questionId);
    else if (this.idle) this.log('IDLE', questionId);
  }

  /** No question on screen (directions, break, review screen…). */
  leave() {
    if (this.current === null) return;
    this.log('LEAVE', this.current);
    this.current = null;
  }

  /** Student picked / typed an answer (null = cleared). Send the choice, never correctness. */
  answer(questionId: string, choice: unknown) {
    if (choice === null || choice === undefined) this.log('CLEAR', questionId);
    else this.log('ANSWER', questionId, choice);
  }

  markReview(questionId: string, on: boolean) {
    this.log(on ? 'FLAG' : 'UNFLAG', questionId);
  }

  /** Module or attempt finished. */
  end(reason: 'SUBMIT' | 'MODULE_END' | 'TIME_UP' = 'SUBMIT') {
    if (this.current !== null) this.log('LEAVE', this.current);
    this.current = null;
    this.log(reason, null);
    void this.flushAll();
  }

  /** Stop listening; sends whatever is queued. */
  destroy() {
    if (this.destroyed) return;
    this.leave();
    void this.flushAll(); // drains even if a send is already in flight
    this.destroyed = true;
    clearInterval(this.heartbeat);
    clearTimeout(this.idleTimer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
    ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, this.onActivity));
  }

  private onVisibility = () => {
    this.hidden = document.hidden;
    if (this.current === null) return;
    this.log(document.hidden ? 'HIDDEN' : 'VISIBLE', this.current);
    if (document.hidden) void this.flush();
  };

  private onPageHide = () => {
    if (this.current !== null && !this.hidden) this.log('HIDDEN', this.current);
    void this.flush();
  };

  private onActivity = () => {
    // Cheap throttle: mousemove fires constantly.
    const t = performance.now();
    if (!this.idle && t - this.lastActivity < 1000) return;
    this.lastActivity = t;
    if (this.idle) {
      this.idle = false;
      if (this.current !== null) this.log('ACTIVE', this.current);
    }
    this.armIdle();
  };

  private armIdle() {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idle = true;
      if (this.current !== null) this.log('IDLE', this.current);
    }, this.idleMs);
  }

  /**
   * Sends everything queued so far and resolves once it is stored (or after
   * `timeoutMs`, so a slow network never blocks a submit).
   */
  async flushAll(timeoutMs = 4000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    const drain = async () => {
      while (Date.now() < deadline) {
        if (this.flushing) { await this.flushing; continue; }
        if (this.seqBase === null) { await new Promise((r) => setTimeout(r, 100)); continue; }
        if (this.queue.length === 0) return;
        if (!(await this.flush())) return; // send failed; the heartbeat will retry
      }
    };
    await Promise.race([drain(), new Promise<void>((r) => setTimeout(r, timeoutMs))]);
  }

  /** Sends one batch. Resolves true when it was stored (or nothing was due). */
  flush(): Promise<boolean> {
    if (this.flushing) return this.flushing;
    if (this.seqBase === null || this.queue.length === 0) return Promise.resolve(true);
    this.flushing = this.send().finally(() => { this.flushing = null; });
    return this.flushing;
  }

  private async send(): Promise<boolean> {
    const seqBase = this.seqBase;
    if (seqBase === null) return false;
    const batch = this.queue.splice(0, MAX_BATCH);
    const events = batch.map((e) => ({
      seq: seqBase + e.localSeq,
      type: e.type,
      questionId: e.questionId,
      t: Math.round(this.tBase + e.rel),
      wall: e.wall,
      ...(e.choice !== undefined ? { choice: e.choice } : {}),
    }));
    const ok = await postAttemptEvents(this.attemptId, events);
    if (!ok) this.queue = batch.concat(this.queue); // retry on the next flush
    return ok;
  }
}
