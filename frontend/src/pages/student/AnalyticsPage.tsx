import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Target, XCircle, HelpCircle, ShieldCheck, Clock, CheckCircle2, Layers, Wrench,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { SAT_CONTENT, SUBDOMAINS_BY_DOMAIN, SKILLS_BY_SUBDOMAIN } from '../../data/satDomains';

// ─── Taxonomy lookup maps (derived once from the canonical blueprint) ──────────
// The SAT content tree is: Section → Domain → Subdomain → Skill. A question's
// tagged topic can sit at any level, so we build reverse maps to resolve any
// topic name back up to its Domain and Subdomain.

type SectionKey = 'Reading and Writing' | 'Math';

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
  // Fall back to the DB parent topic if the leaf wasn't recognised.
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

type AttemptMeta = { id: string; status: string; completedAt: string | null; totalScore: number | null; test: { title: string } };

// ─── Per-question record + answer comparison ───────────────────────────────────

type SubjectKey = 'rw' | 'math' | 'other';
type Status = 'correct' | 'incorrect' | 'skipped';

interface QRecord {
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
function recordsFromAttempt(attempt: DbAttempt): QRecord[] {
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
// Backend persists only the summed totalScore, so we recompute the RW / Math
// split client-side; the two scaled scores add up to the stored total.

interface ScaledScore { rw: number; math: number; total: number }

function computeSatScore(recs: QRecord[]): ScaledScore {
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

interface Agg { total: number; correct: number; incorrect: number; skipped: number; doubts: number; cleared: number; time: number }
const emptyAgg = (): Agg => ({ total: 0, correct: 0, incorrect: 0, skipped: 0, doubts: 0, cleared: 0, time: 0 });
function fold(agg: Agg, r: QRecord) {
  agg.total++;
  agg[r.status]++;
  if (r.doubt) agg.doubts++;
  if (r.cleared) agg.cleared++;
  agg.time += r.time;
}
const accuracy = (a: Agg) => (a.total > 0 ? Math.round((a.correct / a.total) * 100) : 0);
const avgTime = (a: Agg) => (a.total > 0 ? Math.round(a.time / a.total) : 0);

function fmtTime(sec: number): string {
  if (!sec) return '0s';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─── Small UI bits ───────────────────────────────────────────────────────────

function AccuracyBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-500';
  const text = pct >= 80 ? 'text-emerald-700' : pct >= 60 ? 'text-amber-700' : 'text-red-600';
  return (
    <div className="flex items-center gap-2 min-w-[96px]">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-9 text-right ${text}`}>{pct}%</span>
    </div>
  );
}

/** A Domain or Skill breakdown table for the selected subject. */
function BreakdownTable({
  title, subtitle, icon, firstColLabel, rows,
}: {
  title: string; subtitle: string; icon: ReactNode; firstColLabel: string;
  rows: Array<{ name: string; agg: Agg }>;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <span className="text-[#1b3d6e]">{icon}</span>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{firstColLabel}</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Correct / Total</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-red-500 uppercase tracking-wide">Mistakes</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-amber-600 uppercase tracking-wide">Doubts</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-emerald-600 uppercase tracking-wide">Cleared</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Avg Time</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide w-36">Accuracy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">No data yet</td></tr>
            ) : rows.map(({ name, agg }) => {
              const acc = accuracy(agg);
              const empty = agg.total === 0;
              return (
                <tr key={name} className={`hover:bg-gray-50 transition-colors ${empty ? 'opacity-50' : acc < 40 ? 'bg-red-50/30' : acc < 60 ? 'bg-amber-50/20' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{name}</td>
                  <td className="px-3 py-3 text-center font-semibold text-gray-700">
                    <span className="text-emerald-600">{agg.correct}</span>
                    <span className="text-gray-300"> / </span>{agg.total}
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-red-500">{agg.incorrect}</td>
                  <td className="px-3 py-3 text-center font-bold text-amber-600">{agg.doubts}</td>
                  <td className="px-3 py-3 text-center font-bold text-emerald-600">{agg.cleared}</td>
                  <td className="px-3 py-3 text-center text-xs text-gray-500">{fmtTime(avgTime(agg))}</td>
                  <td className="px-4 py-3">{empty ? <span className="text-xs text-gray-300">—</span> : <AccuracyBar pct={acc} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const { dbId } = useAuthStore();
  const navigate = useNavigate();

  const [attempts, setAttempts] = useState<AttemptMeta[]>([]);
  const [records, setRecords] = useState<Map<string, QRecord[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<string>('latest'); // 'all', 'latest', or an attempt id
  const [subject, setSubject] = useState<Exclude<SubjectKey, 'other'>>('rw');

  useEffect(() => {
    if (!dbId) { setLoading(false); return; }
    let cancelled = false;

    api.getStudentAttempts(dbId)
      .then(async ({ attempts: raw }) => {
        const submitted = ((raw as AttemptMeta[]) ?? []).filter(a => a.status === 'SUBMITTED');
        if (cancelled) return;
        setAttempts(submitted);

        const full = await Promise.all(submitted.map(a => api.getAttempt(a.id).catch(() => null)));
        if (cancelled) return;

        const map = new Map<string, QRecord[]>();
        for (const f of full) {
          if (!f) continue;
          const attempt = (f as { attempt: DbAttempt }).attempt;
          map.set(attempt.id, recordsFromAttempt(attempt));
        }
        setRecords(map);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [dbId]);

  // The single attempt the score header refers to (latest, or an explicit pick).
  const activeAttemptId = scope === 'all'
    ? null
    : scope === 'latest'
      ? attempts[0]?.id ?? null
      : scope;

  // Records in scope (all attempts, or one).
  const scoped = useMemo(() => {
    if (scope === 'all') return Array.from(records.values()).flat();
    return activeAttemptId ? records.get(activeAttemptId) ?? [] : [];
  }, [records, scope, activeAttemptId]);

  // Score card — scaled SAT score (a single attempt) or the average across tests.
  const scoreCard = useMemo(() => {
    const round10 = (x: number) => Math.round(x / 10) * 10;
    if (scope !== 'all' && activeAttemptId) {
      const s = computeSatScore(records.get(activeAttemptId) ?? []);
      const meta = attempts.find(a => a.id === activeAttemptId);
      const sub = meta
        ? `${meta.test.title}${meta.completedAt ? ` · ${new Date(meta.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}`
        : '';
      return { label: 'Total Score', total: meta?.totalScore ?? s.total, rw: s.rw, math: s.math, sub };
    }
    const per = attempts.map(a => computeSatScore(records.get(a.id) ?? []));
    if (per.length === 0) return { label: 'Avg Score', total: 0, rw: 0, math: 0, sub: '' };
    const rw = round10(per.reduce((s, p) => s + p.rw, 0) / per.length);
    const math = round10(per.reduce((s, p) => s + p.math, 0) / per.length);
    const totals = attempts.map(a => a.totalScore).filter((t): t is number => t != null);
    const total = totals.length ? round10(totals.reduce((s, t) => s + t, 0) / totals.length) : rw + math;
    return { label: 'Avg Score', total, rw, math, sub: `Average across ${per.length} test${per.length !== 1 ? 's' : ''}` };
  }, [scope, activeAttemptId, records, attempts]);

  // Combined summary (RW + Math) for the metric strip.
  const summary = useMemo(() => {
    const a = emptyAgg();
    for (const r of scoped) fold(a, r);
    return a;
  }, [scoped]);

  // Domain + Subdomain breakdown for the active subject.
  const { domainRows, skillRows } = useMemo(() => {
    const subjectRecs = scoped.filter(r => r.subject === subject);

    // Domains: always show the 4 canonical domains in blueprint order.
    const sectionKey: SectionKey = subject === 'math' ? 'Math' : 'Reading and Writing';
    const domainAgg = new Map<string, Agg>();
    for (const d of SAT_CONTENT[sectionKey]) domainAgg.set(d.name, emptyAgg());
    const subAgg = new Map<string, Agg>();

    for (const r of subjectRecs) {
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
  }, [scoped, subject]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-[#1b3d6e]" />
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Target size={24} className="text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">No tests completed yet</h2>
        <p className="text-gray-500 text-sm mb-6">Finish a test to unlock your score &amp; analytics.</p>
        <button
          onClick={() => navigate('/my-tests')}
          className="px-5 py-2.5 bg-[#1b3d6e] text-white rounded-lg text-sm font-medium hover:bg-[#15305a] transition-colors"
        >
          Go to My Tests
        </button>
      </div>
    );
  }

  const acc = accuracy(summary);
  const metrics = [
    { label: 'Correct / Total', value: `${summary.correct}/${summary.total}`, cls: 'text-gray-900', icon: <Target size={14} className="text-gray-400" /> },
    { label: 'Mistakes', value: summary.incorrect, cls: 'text-red-600', icon: <XCircle size={14} className="text-red-400" /> },
    { label: 'Doubts', value: summary.doubts, cls: 'text-amber-600', icon: <HelpCircle size={14} className="text-amber-400" /> },
    { label: 'Cleared', value: summary.cleared, cls: 'text-emerald-600', icon: <ShieldCheck size={14} className="text-emerald-400" /> },
    { label: 'Total Time Spent', value: fmtTime(summary.time), cls: 'text-gray-900', icon: <Clock size={14} className="text-gray-400" /> },
    { label: 'Accuracy', value: `${acc}%`, cls: acc >= 80 ? 'text-emerald-600' : acc >= 60 ? 'text-amber-600' : 'text-red-600', icon: <CheckCircle2 size={14} className="text-gray-400" /> },
  ];

  const subjectLabel = subject === 'rw' ? 'Reading & Writing' : 'Math';

  return (
    <div className="space-y-5 max-w-5xl">
      {/* ── Header + scope ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm mt-0.5">Score, overall summary &amp; domain breakdown</p>
        </div>
        <select
          value={scope}
          onChange={e => setScope(e.target.value)}
          className="ml-auto px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1b3d6e] min-w-[220px]"
        >
          <option value="latest">Latest Test</option>
          <option value="all">All Tests ({attempts.length})</option>
          <optgroup label="Specific test">
            {attempts.map(a => (
              <option key={a.id} value={a.id}>
                {a.test.title}{a.completedAt ? ` — ${new Date(a.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* ── Total score (RW | Math) ────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-5 sm:px-7 py-5">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-[11px] font-bold uppercase tracking-widest leading-tight w-16">{scoreCard.label}</span>
            <span className="text-5xl sm:text-6xl font-black text-[#0f1e3d] tracking-tight tabular-nums">{scoreCard.total}</span>
          </div>
          <div className="flex items-center gap-6 sm:gap-8 pr-1">
            <div className="flex items-baseline gap-2">
              <span className="text-blue-600 font-semibold text-base sm:text-lg">RW</span>
              <span className="text-2xl sm:text-3xl font-black text-gray-900 tabular-nums">{scoreCard.rw}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-blue-600 font-semibold text-base sm:text-lg">Math</span>
              <span className="text-2xl sm:text-3xl font-black text-gray-900 tabular-nums">{scoreCard.math}</span>
            </div>
            <div className="flex items-baseline gap-2 pl-5 sm:pl-7 border-l border-gray-100">
              <span className="text-gray-400 font-semibold text-base sm:text-lg">Accuracy</span>
              <span className={`text-2xl sm:text-3xl font-black tabular-nums ${acc >= 80 ? 'text-emerald-600' : acc >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{acc}%</span>
            </div>
          </div>
        </div>
        {scoreCard.sub && <p className="text-xs text-gray-400 mt-3 border-t border-gray-50 pt-2.5">{scoreCard.sub}</p>}
      </div>

      {/* ── Overall summary strip ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map(m => (
          <div key={m.label} className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-1">{m.icon}{m.label}</p>
            <p className={`text-2xl font-bold mt-1 ${m.cls}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* ── Subject toggle ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 pt-1">
        <span className="text-xs text-gray-500 font-medium">Breakdown for:</span>
        {([['rw', 'Reading & Writing'], ['math', 'Math']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSubject(key)}
            className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors ${
              subject === key ? 'bg-[#1b3d6e] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Domain-wise analysis ───────────────────────────────────────── */}
      <BreakdownTable
        title="Domain-wise Analysis"
        subtitle={`${subjectLabel} · ${SAT_CONTENT[subject === 'math' ? 'Math' : 'Reading and Writing'].length} content domains`}
        icon={<Layers size={15} />}
        firstColLabel="Domain"
        rows={domainRows}
      />

      {/* ── Skill analysis ─────────────────────────────────────────────── */}
      <BreakdownTable
        title="Skill Analysis"
        subtitle={`${subjectLabel} · subdomains, weakest first`}
        icon={<Wrench size={15} />}
        firstColLabel="Skill"
        rows={skillRows}
      />
    </div>
  );
}
