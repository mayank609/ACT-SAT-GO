// Shared analytics core used by the student "Analytics" page and the admin
// per-student analytics view. Pure data helpers + a loader that turns a
// student's submitted attempts into scored, taxonomy-tagged question records.

import { api } from './api';
import { SAT_CONTENT, SUBDOMAINS_BY_DOMAIN, SKILLS_BY_SUBDOMAIN } from '../data/satDomains';

// ─── Taxonomy lookup maps (derived once from the canonical blueprint) ──────────
// The SAT content tree is: Section → Domain → Subdomain → Skill. A question's
// tagged topic can sit at any level, so we build reverse maps to resolve any
// topic name back up to its Domain and Subdomain.

export type SectionKey = 'Reading and Writing' | 'Math';
export type SubjectKey = 'rw' | 'math' | 'other';
export type Status = 'correct' | 'incorrect' | 'skipped';

const DOMAIN_TO_SECTION: Record<string, SectionKey> = {};
for (const [section, domains] of Object.entries(SAT_CONTENT)) {
  for (const d of domains) DOMAIN_TO_SECTION[d.name] = section as SectionKey;
}

const SUBDOMAIN_TO_DOMAIN: Record<string, string> = {};
for (const [domain, subs] of Object.entries(SUBDOMAINS_BY_DOMAIN)) {
  for (const s of subs) SUBDOMAIN_TO_DOMAIN[s] = domain;
}

const SKILL_TO_SUBDOMAIN: Record<string, string> = {};
for (const [sub, skills] of Object.entries(SKILLS_BY_SUBDOMAIN)) {
  for (const sk of skills) SKILL_TO_SUBDOMAIN[sk] = sub;
}

/** Resolve any tagged topic (+ its DB parent) to a { domain, subdomain } pair. */
function resolveTaxonomy(topicName?: string, parentName?: string): { domain: string; subdomain: string } {
  const name = (topicName || '').trim();
  const parent = (parentName || '').trim();

  if (DOMAIN_TO_SECTION[name]) return { domain: name, subdomain: 'General' };
  if (SUBDOMAIN_TO_DOMAIN[name]) return { domain: SUBDOMAIN_TO_DOMAIN[name], subdomain: name };
  if (SKILL_TO_SUBDOMAIN[name]) {
    const sub = SKILL_TO_SUBDOMAIN[name];
    return { domain: SUBDOMAIN_TO_DOMAIN[sub] ?? parent ?? 'Other', subdomain: sub };
  }
  if (parent && DOMAIN_TO_SECTION[parent]) return { domain: parent, subdomain: name || 'General' };
  if (parent && SUBDOMAIN_TO_DOMAIN[parent]) return { domain: SUBDOMAIN_TO_DOMAIN[parent], subdomain: parent };
  if (parent) return { domain: parent, subdomain: name || parent };
  if (name) return { domain: 'Other', subdomain: name };
  return { domain: 'Other', subdomain: 'Untagged' };
}

// ─── DB shapes (mirrors the /api/attempts/:id payload) ─────────────────────────

interface DbAnswer { key?: string; keys?: string[]; value?: number }
interface DbTopic { name: string; parent?: { name: string } | null }
interface DbQuestion {
  id: string;
  type: string;
  content: { text: string; meta?: { isPassage?: boolean } };
  correctAnswer: DbAnswer;
  subject?: string | null;
  parentQuestionId?: string | null;
  topic?: DbTopic | null;
  childQuestions?: DbQuestion[];
}
interface DbTestQuestion { question: DbQuestion }
interface DbSectionAttempt { section: { name: string; questions: DbTestQuestion[] } }
interface DbAttemptAnswer {
  questionId: string;
  answerGiven: DbAnswer | null;
  timeSpentSeconds: number;
  doubtStatus?: 'doubt' | 'cleared' | null;
}
interface DbAttempt {
  id: string;
  test: { title: string };
  sectionAttempts: DbSectionAttempt[];
  answers: DbAttemptAnswer[];
}

// ─── Per-question record ───────────────────────────────────────────────────────

export interface QRecord {
  subject: SubjectKey;
  sectionName: string;
  domain: string;
  subdomain: string;
  status: Status;
  doubt: boolean;
  cleared: boolean;
  time: number;
}

function answersMatch(given: DbAnswer | null, correct: DbAnswer): boolean {
  if (!given) return false;
  if (correct.value !== undefined) return Number(given.value) === Number(correct.value);
  if (correct.keys) {
    return JSON.stringify([...(given.keys ?? [])].map(k => k.toUpperCase()).sort()) ===
           JSON.stringify([...correct.keys].map(k => k.toUpperCase()).sort());
  }
  if (correct.key) return given.key?.toUpperCase() === correct.key.toUpperCase();
  return false;
}

/** Decide RW vs Math, preferring the resolved domain, then the usual heuristics. */
function resolveSubject(domain: string, q: DbQuestion, sectionName: string, testTitle: string): SubjectKey {
  const section = DOMAIN_TO_SECTION[domain];
  if (section === 'Reading and Writing') return 'rw';
  if (section === 'Math') return 'math';

  const hay = `${q.subject ?? ''} ${sectionName} ${testTitle}`.toLowerCase();
  if (/(math|calc|algebra|geometry)/.test(hay)) return 'math';
  if (/(english|reading|writing|verbal|grammar|rw)/.test(hay)) return 'rw';
  return 'other';
}

/** Flatten one attempt's questions (expanding passages) into scored QRecords. */
export function recordsFromAttempt(attempt: DbAttempt): QRecord[] {
  const answers = new Map(attempt.answers.map(a => [a.questionId, a]));
  const out: QRecord[] = [];

  for (const sa of attempt.sectionAttempts ?? []) {
    const sectionName = sa.section.name;

    for (const tq of sa.section.questions ?? []) {
      const q = tq.question;
      if (q.parentQuestionId) continue; // child rows handled via their passage parent
      const isPassage = q.type === 'PASSAGE' || q.content?.meta?.isPassage === true;
      const leaves: DbQuestion[] =
        isPassage && q.childQuestions?.length
          ? q.childQuestions.map(cq => ({ ...cq, topic: cq.topic ?? q.topic }))
          : [q];

      for (const leaf of leaves) {
        const ans = answers.get(leaf.id);
        let status: Status = 'skipped';
        if (ans && ans.answerGiven != null) {
          status = answersMatch(ans.answerGiven, leaf.correctAnswer) ? 'correct' : 'incorrect';
        }
        const { domain, subdomain } = resolveTaxonomy(leaf.topic?.name, leaf.topic?.parent?.name);
        out.push({
          subject: resolveSubject(domain, leaf, sectionName, attempt.test.title),
          sectionName,
          domain,
          subdomain,
          status,
          doubt: ans?.doubtStatus === 'doubt',
          cleared: ans?.doubtStatus === 'cleared',
          time: ans?.timeSpentSeconds ?? 0,
        });
      }
    }
  }
  return out;
}

// ─── Scaled SAT score (mirrors the backend submit-route formula exactly) ───────

export interface ScaledScore { rw: number; math: number; total: number }

export function computeSatScore(recs: QRecord[]): ScaledScore {
  const sections = new Map<string, { correct: number; total: number }>();
  for (const r of recs) {
    const s = sections.get(r.sectionName) ?? { correct: 0, total: 0 };
    s.total++;
    if (r.status === 'correct') s.correct++;
    sections.set(r.sectionName, s);
  }

  const moduleOf = (name: string): 1 | 2 | null => {
    const m = name.match(/module\s*([12])\b/);
    if (m) return m[1] === '1' ? 1 : 2;
    if (/\b(?:1|one)\b/.test(name)) return 1;
    if (/\b(?:2|two)\b/.test(name)) return 2;
    return null;
  };

  let rw1C = 0, rw2C = 0, m1C = 0, m2C = 0;
  let rw1T = 0, rw2T = 0, m1T = 0, m2T = 0;
  for (const [name, { correct, total }] of sections) {
    const n = name.toLowerCase();
    const isMath = n.includes('math');
    const isRW = n.includes('reading') || n.includes('writing') || n.includes('rw');
    const mod = moduleOf(n);
    if (isMath) {
      if (mod === 1 || (mod === null && m1T === 0)) { m1C += correct; m1T += total; }
      else { m2C += correct; m2T += total; }
    } else if (isRW) {
      if (mod === 1 || (mod === null && rw1T === 0)) { rw1C += correct; rw1T += total; }
      else { rw2C += correct; rw2T += total; }
    }
  }

  const rwTotal = rw1T + rw2T || 54;
  const mathTotal = m1T + m2T || 44;
  let rw = rw1C >= 18
    ? 400 + Math.round(((rw1C + rw2C) / rwTotal) * 400 / 10) * 10
    : 200 + Math.round(((rw1C + rw2C) / rwTotal) * 450 / 10) * 10;
  let math = m1C >= 14
    ? 420 + Math.round(((m1C + m2C) / mathTotal) * 380 / 10) * 10
    : 200 + Math.round(((m1C + m2C) / mathTotal) * 450 / 10) * 10;
  rw = Math.min(800, Math.max(200, rw));
  math = Math.min(800, Math.max(200, math));
  return { rw, math, total: rw + math };
}

// ─── Aggregation ───────────────────────────────────────────────────────────────

export interface Agg { total: number; correct: number; incorrect: number; skipped: number; doubts: number; cleared: number; time: number }
export const emptyAgg = (): Agg => ({ total: 0, correct: 0, incorrect: 0, skipped: 0, doubts: 0, cleared: 0, time: 0 });
export function fold(agg: Agg, r: QRecord) {
  agg.total++;
  agg[r.status]++;
  if (r.doubt) agg.doubts++;
  if (r.cleared) agg.cleared++;
  agg.time += r.time;
}
export function aggregate(recs: QRecord[]): Agg {
  const a = emptyAgg();
  for (const r of recs) fold(a, r);
  return a;
}
export const accuracy = (a: Agg) => (a.total > 0 ? Math.round((a.correct / a.total) * 100) : 0);
export const avgTime = (a: Agg) => (a.total > 0 ? Math.round(a.time / a.total) : 0);

export function fmtTime(sec: number): string {
  if (!sec) return '0s';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Domain + subdomain breakdown for one subject (always 4 canonical domains). */
export function buildBreakdown(recs: QRecord[], subject: 'rw' | 'math') {
  const sectionKey: SectionKey = subject === 'math' ? 'Math' : 'Reading and Writing';
  const domainAgg = new Map<string, Agg>();
  for (const d of SAT_CONTENT[sectionKey]) domainAgg.set(d.name, emptyAgg());
  const subAgg = new Map<string, Agg>();

  for (const r of recs) {
    if (r.subject !== subject) continue;
    if (!domainAgg.has(r.domain)) domainAgg.set(r.domain, emptyAgg());
    fold(domainAgg.get(r.domain)!, r);
    if (!subAgg.has(r.subdomain)) subAgg.set(r.subdomain, emptyAgg());
    fold(subAgg.get(r.subdomain)!, r);
  }

  const domainRows = Array.from(domainAgg.entries()).map(([name, agg]) => ({ name, agg }));
  const skillRows = Array.from(subAgg.entries())
    .map(([name, agg]) => ({ name, agg }))
    .sort((a, b) => accuracy(a.agg) - accuracy(b.agg)); // weakest first
  return { domainRows, skillRows };
}

// ─── Loader ────────────────────────────────────────────────────────────────────

export interface LoadedAttempt {
  id: string;
  title: string;
  completedAt: string | null;
  totalScore: number | null;
  /** A diagnostic test (by title or category) — used to include/exclude it. */
  isDiagnostic: boolean;
}

interface RawAttempt {
  id: string;
  status: string;
  completedAt?: string | null;
  totalScore?: number | null;
  test?: { title?: string; category?: string };
}

/**
 * Fetch a student's submitted attempts and the scored question records for each.
 * Records are keyed by attempt id so callers can include/exclude attempts
 * (e.g. drop diagnostics) before aggregating.
 */
export async function loadStudentAnalytics(
  studentId: string
): Promise<{ attempts: LoadedAttempt[]; records: Map<string, QRecord[]> }> {
  const { attempts: raw } = await api.getStudentAttempts(studentId);
  const submitted = ((raw as RawAttempt[]) ?? []).filter(a => a.status === 'SUBMITTED');

  const attempts: LoadedAttempt[] = submitted.map(a => ({
    id: a.id,
    title: a.test?.title ?? 'Test',
    completedAt: a.completedAt ?? null,
    totalScore: a.totalScore ?? null,
    isDiagnostic: /diagnostic/i.test(a.test?.title ?? '') || /diagnostic/i.test(a.test?.category ?? ''),
  }));

  const full = await Promise.all(submitted.map(a => api.getAttempt(a.id).catch(() => null)));
  const records = new Map<string, QRecord[]>();
  for (const f of full) {
    if (!f) continue;
    const attempt = (f as { attempt: DbAttempt }).attempt;
    records.set(attempt.id, recordsFromAttempt(attempt));
  }

  return { attempts, records };
}
