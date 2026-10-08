// Unit tests for src/lib/timeAnalytics.ts — the scenarios from the
// "Visit-Level Time Analytics" spec (sections 8 and 12).
// Run: node --experimental-strip-types scripts/test-time-analytics.ts
import assert from 'node:assert/strict'
import { buildVisits, summarise, insights, type TrackedEvent, type Result } from '../src/lib/timeAnalytics.ts'

const KEY: Record<string, string> = { q4: 'A', q7: 'B', q11: 'C', q12: 'D', q20: 'A', q21: 'B' }
const grade = (q: string, choice: unknown): Result =>
  (choice as { key: string }).key === KEY[q] ? 'correct' : 'incorrect'

const s = (m: number, sec: number) => (m * 60 + sec) * 1000
let seq = 0
const ev = (t: number, type: string, questionId: string | null, choice?: string): TrackedEvent =>
  ({ seq: ++seq, t, type, questionId, ...(choice ? { choice: { key: choice } } : {}) })

const events: TrackedEvent[] = [
  // Q4: skipped on the first pass
  ev(s(0, 30), 'ENTER', 'q4'),
  ev(s(0, 42), 'LEAVE', 'q4'),
  // Q7: answered wrong, later a 1 s glance with no change
  ev(s(0, 42), 'ENTER', 'q7'),
  ev(s(0, 50), 'ANSWER', 'q7', 'C'),
  ev(s(0, 50), 'ANSWER', 'q7', 'C'), // re-click: ignored
  ev(s(0, 56), 'LEAVE', 'q7'),
  // Q11: tab hidden 40 s, answered wrong (worked example in the spec)
  ev(s(2, 20), 'ENTER', 'q11'),
  ev(s(3, 55), 'HIDDEN', 'q11'),
  ev(s(4, 35), 'VISIBLE', 'q11'),
  ev(s(4, 45), 'ANSWER', 'q11', 'B'),
  ev(s(4, 50), 'LEAVE', 'q11'),
  // Q12: right on the first visit
  ev(s(4, 50), 'ENTER', 'q12'),
  ev(s(5, 30), 'ANSWER', 'q12', 'D'),
  ev(s(6, 0), 'LEAVE', 'q12'),
  // Q20: wrong then right inside one visit; LEAVE lost (next ENTER closes it)
  ev(s(8, 50), 'ENTER', 'q20'),
  ev(s(9, 10), 'ANSWER', 'q20', 'B'),
  ev(s(9, 30), 'ANSWER', 'q20', 'A'),
  // Q4 on return: answered right
  ev(s(9, 40), 'ENTER', 'q4'),
  ev(s(10, 0), 'ANSWER', 'q4', 'A'),
  ev(s(10, 6), 'LEAVE', 'q4'),
  // Q11 visit 2: fixed
  ev(s(10, 6), 'ENTER', 'q11'),
  ev(s(10, 44), 'ANSWER', 'q11', 'C'),
  ev(s(10, 47), 'LEAVE', 'q11'),
  // Q12 visit 2: changed to wrong on review
  ev(s(10, 47), 'ENTER', 'q12'),
  ev(s(11, 10), 'ANSWER', 'q12', 'A'),
  ev(s(11, 15), 'LEAVE', 'q12'),
  // Q7 glance
  ev(s(11, 15), 'ENTER', 'q7'),
  ev(s(11, 16), 'LEAVE', 'q7'),
  // Q21: open when the module timer ran out; then heartbeats only
  ev(s(11, 16), 'ENTER', 'q21'),
  ev(s(11, 20), 'FLAG', 'q21'),
  ev(s(11, 26), 'HEARTBEAT', 'q21'),
  ev(s(11, 30), 'TIME_UP', null),
]

// Shuffle to prove ordering is by seq, not by arrival.
const shuffled = [...events].reverse()
const visits = buildVisits(shuffled, grade)
const qIds = ['q4', 'q7', 'q11', 'q12', 'q20', 'q21']
const summary = summarise(visits, qIds)
const byQ = (q: string) => visits.filter((v) => v.questionId === q)
const sum = (q: string) => summary.find((x) => x.questionId === q)!

// Q11: two visits; visit 1 spans 150 s with 110 s active (40 s hidden excluded)
const q11 = byQ('q11')
assert.equal(q11.length, 2)
assert.equal(q11[0].end - q11[0].start, 150_000)
assert.equal(q11[0].activeMs, 110_000)
assert.deepEqual(q11[0].pauses, [{ start: s(3, 55), end: s(4, 35) }])
assert.equal(q11[0].exitResult, 'incorrect')
assert.equal(q11[1].entryResult, 'incorrect')
assert.equal(q11[1].activeMs, 41_000)
assert.equal(q11[1].exitResult, 'correct')
assert.equal(q11[1].isFinal, true)
assert.equal(q11[0].isFinal, false)
assert.equal(sum('q11').change, 'wrong_to_right')
assert.equal(sum('q11').pattern, 'W→R')

// Q12: right to wrong
assert.equal(sum('q12').change, 'right_to_wrong')
assert.equal(sum('q12').finalResult, 'incorrect')
assert.equal(sum('q12').answeredInVisit, 2)

// Q20: W→R inside one visit, closed by the next ENTER although LEAVE was lost
const q20 = byQ('q20')
assert.equal(q20.length, 1)
assert.equal(q20[0].answers.length, 2)
assert.equal(q20[0].end, s(9, 40))
assert.equal(sum('q20').pattern, 'W→R')

// Q7: re-click ignored; revisit is a glance with no change
const q7 = byQ('q7')
assert.equal(q7[0].answers.length, 1)
assert.equal(q7[1].glance, true)
assert.equal(q7[0].isFinal, true)
assert.equal(sum('q7').change, 'none')

// Q4: skipped, answered on return
assert.equal(byQ('q4')[0].exitResult, 'unanswered')
assert.equal(sum('q4').answeredInVisit, 2)

// Q21: TIME_UP closes the open visit; flag is kept
assert.equal(byQ('q21')[0].end, s(11, 30))
assert.equal(sum('q21').flaggedAtEnd, true)
assert.equal(sum('q21').finalResult, 'unanswered')

// Crash: no closing event — the last heartbeat bounds the visit
const crash = buildVisits([
  { seq: 1, t: 0, type: 'ENTER', questionId: 'q4' },
  { seq: 2, t: 10_000, type: 'HEARTBEAT', questionId: 'q4' },
], grade)
assert.equal(crash[0].end, 10_000)

// Page refresh on a question (spec §12 step 7): pagehide logs HIDDEN, the
// reloaded player continues the seq and ENTERs the same question again.
// That is two visits, and the first ends when the page went away.
const reload = buildVisits([
  { seq: 1, t: 0, type: 'ENTER', questionId: 'q4' },
  { seq: 2, t: 4_000, type: 'HIDDEN', questionId: 'q4' },
  { seq: 3, t: 12_000, type: 'ENTER', questionId: 'q4' },
  { seq: 4, t: 15_000, type: 'ANSWER', questionId: 'q4', choice: { key: 'A' } },
  { seq: 5, t: 16_000, type: 'SUBMIT', questionId: null },
], grade)
assert.equal(reload.length, 2)
assert.deepEqual([reload[0].start, reload[0].end, reload[0].activeMs, reload[0].pauses.length], [0, 4_000, 4_000, 0])
assert.deepEqual([reload[1].visitNo, reload[1].start, reload[1].activeMs, reload[1].isFinal], [2, 12_000, 4_000, true])

// Crash with no pagehide: the last heartbeat ends the visit; re-ENTER is a new visit.
const crash2 = buildVisits([
  { seq: 1, t: 0, type: 'ENTER', questionId: 'q4' },
  { seq: 2, t: 10_000, type: 'HEARTBEAT', questionId: 'q4' },
  { seq: 3, t: 60_000, type: 'ENTER', questionId: 'q4' },
  { seq: 4, t: 62_000, type: 'LEAVE', questionId: 'q4' },
], grade)
assert.deepEqual(crash2.map((v) => [v.visitNo, v.start, v.end]), [[1, 0, 10_000], [2, 60_000, 62_000]])

// A duplicate ENTER for the open visit (no interruption) is still ignored.
const dup = buildVisits([
  { seq: 1, t: 0, type: 'ENTER', questionId: 'q4' },
  { seq: 2, t: 2_000, type: 'ENTER', questionId: 'q4' },
  { seq: 3, t: 5_000, type: 'LEAVE', questionId: 'q4' },
], grade)
assert.deepEqual(dup.map((v) => [v.start, v.end]), [[0, 5_000]])

// Properties: visits never overlap, end ≥ start, active + paused = span
const sorted = [...visits].sort((a, b) => a.start - b.start)
for (let i = 0; i < sorted.length; i++) {
  const v = sorted[i]
  assert.ok(v.end >= v.start)
  const paused = v.pauses.reduce((p, x) => p + x.end - x.start, 0)
  assert.equal(v.activeMs + paused, v.end - v.start)
  if (i > 0) assert.ok(sorted[i - 1].end <= v.start, 'visits overlap')
}

const m = insights(visits, summary, 34_000)
assert.equal(m.rightToWrong, 1)
assert.equal(m.wrongToRight, 2)
assert.equal(m.skipAndReturn, 1)
assert.equal(m.glances, 1)
assert.equal(m.pausedMs, 40_000)
assert.equal(m.unfinishedFlags, 1)

console.log(`timeAnalytics: all assertions passed (${visits.length} visits)`)
