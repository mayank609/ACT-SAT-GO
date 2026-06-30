// Shared analytics core used by the student "Analytics" page and the admin
// per-student analytics view. Pure data helpers + a loader that turns a
// student's submitted attempts into scored, taxonomy-tagged question records.

import { api } from './api';
import { SAT_CONTENT, SUBDOMAINS_BY_DOMAIN, SKILLS_BY_SUBDOMAIN, ALL_DOMAIN_NAMES } from '../data/satDomains';

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

// Case-insensitive lookups: canonical domain, subdomain → domain, skill → subdomain/domain.
const DOMAIN_LC = new Map<string, string>();
for (const d of ALL_DOMAIN_NAMES) DOMAIN_LC.set(d.toLowerCase(), d);

const SUBDOMAIN_LC = new Map<string, { domain: string; sub: string }>();
for (const [domain, subs] of Object.entries(SUBDOMAINS_BY_DOMAIN)) {
  for (const s of subs) SUBDOMAIN_LC.set(s.toLowerCase(), { domain, sub: s });
}

const SKILL_LC = new Map<string, { domain: string; sub: string }>();
for (const [sub, skills] of Object.entries(SKILLS_BY_SUBDOMAIN)) {
  const domain = SUBDOMAIN_LC.get(sub.toLowerCase())?.domain ?? 'Other';
  for (const sk of skills) SKILL_LC.set(sk.toLowerCase(), { domain, sub });
}

// Keyword fallback when a tagged name isn't an exact canonical match
// (mirrors TestReviewPage's resolver), keyed by the canonical SAT domains.
const DOMAIN_SYNONYMS: Record<string, string[]> = {
  'Information and Ideas': ['information', 'main idea', 'central idea', 'inference', 'evidence'],
  'Craft and Structure': ['craft', 'structure', 'vocabulary', 'words in context', 'cross-text'],
  'Expression of Ideas': ['expression', 'rhetoric', 'transition', 'synthesis'],
  'Standard English Conventions': ['conventions', 'grammar', 'usage', 'punctuation', 'sentence structure', 'boundaries', 'english'],
  'Algebra': ['algebra', 'linear'],
  'Advanced Math': ['advanced math', 'advanced', 'nonlinear', 'quadratic', 'function', 'exponential', 'polynomial', 'radical', 'parabola', 'absolute value'],
  'Problem-Solving and Data Analysis': ['problem', 'data analysis', 'data interpretation', 'statistics', 'ratio', 'rate', 'percent', 'probability', 'proportion', 'research'],
  'Geometry': ['geometry', 'trigonometry', 'trig', 'triangle', 'circle', 'angle', 'area', 'volume', 'polygon', 'line'],
};

interface TaxonomyInput {
  content?: { meta?: { domain?: string | null; subTopic?: string | null } | null } | null;
  topic?: { name: string; parent?: { name: string } | null } | null;
  subject?: string | null;
}

/**
 * Resolve a question's domain + subdomain. Considers the Test-Builder tags
 * (content.meta.domain / subTopic) first, then the linked topic and its parent,
 * with an exact-name match and a keyword fallback — same precedence the review
 * page uses, so analytics buckets match what the rest of the app shows.
 */
function resolveTaxonomy(q: TaxonomyInput): { domain: string; subdomain: string } {
  const meta = q.content?.meta ?? null;
  const origCands = [meta?.domain, q.topic?.name, q.topic?.parent?.name, q.subject].filter(Boolean) as string[];
  const cands = origCands.map(c => c.trim().toLowerCase());

  let domain: string | null = null;
  let subFromCand: string | null = null;
  for (const c of cands) {
    if (DOMAIN_LC.has(c)) { domain = DOMAIN_LC.get(c)!; break; }
    const sd = SUBDOMAIN_LC.get(c);
    if (sd) { domain = sd.domain; subFromCand = sd.sub; break; }
    const sk = SKILL_LC.get(c);
    if (sk) { domain = sk.domain; subFromCand = sk.sub; break; }
  }
  if (!domain) {
    for (const [d, syns] of Object.entries(DOMAIN_SYNONYMS)) {
      if (cands.some(c => syns.some(s => c === s || c.includes(s) || s.includes(c)))) { domain = d; break; }
    }
  }
  if (!domain) return { domain: 'Other', subdomain: origCands[0] ?? 'Untagged' };

  const subs = SUBDOMAINS_BY_DOMAIN[domain] ?? [];
  const tagged = meta?.subTopic?.trim().toLowerCase();
  let subdomain: string | null = null;
  if (tagged) subdomain = subs.find(s => s.toLowerCase() === tagged) ?? null;
  if (!subdomain && subFromCand && subs.includes(subFromCand)) subdomain = subFromCand;
  if (!subdomain) {
    const subCands = [meta?.subTopic, ...origCands].filter(Boolean).map(c => (c as string).trim().toLowerCase());
    for (const s of subs) {
      const sl = s.toLowerCase();
      if (subCands.some(c => c === sl || c.includes(sl) || sl.includes(c))) { subdomain = s; break; }
    }
  }
  return { domain, subdomain: subdomain ?? 'General' };
}

// ─── DB shapes (mirrors the /api/attempts/:id payload) ─────────────────────────

interface DbAnswer { key?: string; keys?: string[]; value?: number }
interface DbTopic { name: string; parent?: { name: string } | null }
interface DbQuestion {
  id: string;
  type: string;
  content: { text: string; meta?: { isPassage?: boolean; domain?: string | null; subTopic?: string | null } };
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

// Mirrors `taAnswersMatch` (QuestionWiseReport) — the app-wide correctness check.
function answersMatch(given: DbAnswer | null, correct: DbAnswer): boolean {
  if (!given || !correct) return false;
  if (correct.value !== undefined) {
    if (given.value === undefined) return false;
    return Math.abs(Number(given.value) - Number(correct.value)) <= 1e-9 + 1e-6 * Math.abs(Number(correct.value));
  }
  if (correct.keys) {
    if (!given.keys) return false;
    const g = given.keys.map(k => String(k).toUpperCase().trim()).sort();
    const c = correct.keys.map(k => String(k).toUpperCase().trim()).sort();
    return JSON.stringify(g) === JSON.stringify(c);
  }
  if (correct.key !== undefined) {
    if (given.key === undefined) return false;
    return String(given.key).toUpperCase().trim() === String(correct.key).toUpperCase().trim();
  }
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
        const { domain, subdomain } = resolveTaxonomy(leaf);
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

// ─── Scaled SAT score (mirrors the backend submit-route conversion exactly) ─────

// Digital SAT raw→scaled conversion tables, reproduced exactly from the
// test-ninjas.com Digital SAT Score Calculator. RW uses a 0–66 index, Math 0–54.
const RW_SCALE: number[] = [
  200, 200, 200, 200, 200, 200, 200, 210, 210, 220, 240, 250, 260, 270, 290, 300, 330,
  350, 360, 370, 380, 380, 390, 400, 410, 420, 430, 430, 440, 450, 460, 470, 470, 480,
  490, 500, 500, 510, 520, 530, 540, 550, 550, 560, 570, 580, 590, 600, 600, 610, 620,
  630, 640, 640, 650, 660, 670, 680, 690, 700, 710, 720, 730, 740, 760, 780, 800,
];
const MATH_SCALE: number[] = [
  200, 200, 200, 200, 200, 200, 200, 210, 220, 240, 270, 300, 310, 320, 330, 340, 350,
  350, 360, 370, 380, 390, 390, 400, 410, 420, 440, 450, 460, 480, 490, 500, 520, 530,
  540, 550, 570, 580, 590, 600, 610, 620, 640, 650, 670, 690, 710, 730, 750, 760, 770,
  780, 790, 790, 800,
];

// Convert a section's two module raw scores into a scaled section score (200–800),
// replicating test-ninjas.com: adaptive easy-route weights Module 2 down to
// round(0.8 × M2) when Module 1 is below the routing threshold (18 RW, 15 Math),
// then the combined raw is normalized to the table index and looked up.
export function satSectionScore(m1: number, m2: number, total: number, isMath: boolean, adaptive = true): number {
  let eff2 = m2;
  if (adaptive && (isMath ? m1 < 15 : m1 < 18)) {
    eff2 = Math.round(0.8 * m2);
  }
  const raw = m1 + eff2;
  if (!(total > 0)) return 200;
  const ratio = Math.max(0, Math.min(1, raw / total));
  const table = isMath ? MATH_SCALE : RW_SCALE;
  const idx = Math.min(Math.round((isMath ? 54 : 66) * ratio), table.length - 1);
  return table[idx];
}

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
  const rw = satSectionScore(rw1C, rw2C, rwTotal, false);
  const math = satSectionScore(m1C, m2C, mathTotal, true);
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

interface RawAttempt extends DbAttempt {
  status: string;
  completedAt?: string | null;
  totalScore?: number | null;
  test: { title: string; category?: string };
}

/**
 * Fetch a student's submitted attempts and the scored question records for each.
 * Records are keyed by attempt id so callers can include/exclude attempts
 * (e.g. drop diagnostics) before aggregating.
 *
 * The list endpoint already embeds sectionAttempts + answers + questions, so we
 * score from that directly (one reliable request). We then enrich each attempt
 * with a full /attempts/:id fetch to expand passages and pull topic tags —
 * sequentially and best-effort, so a slow/failed enrich never blanks the data.
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

  const records = new Map<string, QRecord[]>();

  // 1) Baseline from the embedded list payload (always available).
  for (const a of submitted) {
    records.set(a.id, recordsFromAttempt(a));
  }

  // 2) Enrich with the full attempt (passages expanded + topic tags) when it loads.
  for (const a of submitted) {
    try {
      const f = await api.getAttempt(a.id);
      const attempt = (f as { attempt: DbAttempt }).attempt;
      const recs = recordsFromAttempt(attempt);
      if (recs.length) records.set(a.id, recs);
    } catch {
      // keep the baseline records for this attempt
    }
  }

  return { attempts, records };
}
