import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import type { User } from '@prisma/client'

/**
 * Free Demo Test pipeline — shared helpers.
 *
 * Flow:
 *   website "Free Demo Test" form  →  POST /api/free-tests/register
 *     → creates a Supabase auth user (email + password chosen by the student)
 *     → creates a Prisma User (role STUDENT, permissions.accountType = 'DEMO')
 *     → assigns the configured demo test (TestAssignment, maxAttempts 1)
 *     → stores a lead snapshot in Redis for the admin "Free Test Leads" page
 *
 *   The student then logs into the test portal with those credentials and can
 *   only take that one demo test. The attempt goes through the normal test
 *   engine, so results/analytics are real TestAttempt data.
 *
 * Source of truth:
 *   - Account + attempt data: Postgres (User / TestAssignment / TestAttempt)
 *   - Lead CRM fields (leadStatus, notes): Redis (`lead:freeTest:<id>`)
 *   The leads view merges both, so a lost Redis entry never hides a signup.
 */

export const FREE_TEST_CONFIG_KEY = 'settings:freeTests'
export const LEADS_LIST_KEY = 'leads:freeTest:list'
export const leadKey = (id: string) => `lead:freeTest:${id}`

export const DEMO_ACCOUNT_TYPE = 'DEMO'

export type LeadTestStatus = 'Registered' | 'In-Progress' | 'Completed' | 'Abandoned'
export type LeadCrmStatus = 'New' | 'Contacted' | 'Follow-Up' | 'Enrolled' | 'Archived'

export interface FreeTestConfig {
  activeTestId: string | null
  examTests: {
    SAT?: string | null
    ACT?: string | null
    AP?: string | null
    GENERAL?: string | null
  }
  bannerTitle: string
  bannerSubtitle: string
  instructions: string
  activeOnWebsite: boolean
}

export const DEFAULT_CONFIG: FreeTestConfig = {
  activeTestId: null,
  examTests: { SAT: null, ACT: null, AP: null, GENERAL: null },
  bannerTitle: 'Free Demo Test',
  bannerSubtitle:
    'Create your free account, take one full demo test on our real exam platform, and get a detailed score report with section and topic analytics.',
  instructions:
    'This is a timed demo test that simulates official exam conditions. You get one attempt — work carefully and manage your time wisely.',
  activeOnWebsite: true,
}

export interface FreeTestLead {
  id: string
  name: string
  email: string
  phone: string
  exam: string
  grade?: string
  school?: string
  targetScore?: string
  /** Demo test assigned to this lead's account (may be empty if none was configured). */
  testId: string
  testTitle: string
  status: LeadTestStatus
  leadStatus: LeadCrmStatus
  registeredAt: string
  startedAt?: string | null
  completedAt?: string | null
  totalScore?: number | null
  maxScore?: number | null
  percentage?: number | null
  notes?: string
  /** Portal account backing this lead (Supabase auth id === Prisma User.id). */
  userId?: string | null
  accountCreated?: boolean
  assignmentId?: string | null
  attemptId?: string | null
  source?: string
}

// ── Redis lead storage ───────────────────────────────────────────────────────

function parseJson<T>(raw: unknown): T | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }
  return raw as T
}

export async function loadConfig(): Promise<FreeTestConfig> {
  try {
    const raw = await redis.get<string>(FREE_TEST_CONFIG_KEY)
    const parsed = parseJson<Partial<FreeTestConfig>>(raw)
    if (!parsed) return DEFAULT_CONFIG
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      examTests: { ...DEFAULT_CONFIG.examTests, ...(parsed.examTests ?? {}) },
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export async function saveLead(lead: FreeTestLead): Promise<void> {
  try {
    await redis.set(leadKey(lead.id), JSON.stringify(lead))
    const ids = await redis.lrange(LEADS_LIST_KEY, 0, 1000)
    if (!ids || !ids.includes(lead.id)) {
      await redis.lpush(LEADS_LIST_KEY, lead.id)
    }
  } catch (err) {
    console.error('demoLeads.saveLead: redis write failed', err)
  }
}

export async function getLead(leadId: string): Promise<FreeTestLead | null> {
  try {
    const raw = await redis.get<string>(leadKey(leadId))
    return parseJson<FreeTestLead>(raw)
  } catch {
    return null
  }
}

export async function deleteLeadRecord(leadId: string): Promise<void> {
  await Promise.all([redis.del(leadKey(leadId)), redis.lrem(LEADS_LIST_KEY, 0, leadId)])
}

async function readLeadsFromRedis(): Promise<FreeTestLead[]> {
  try {
    const ids = await redis.lrange(LEADS_LIST_KEY, 0, 1000)
    if (!ids || ids.length === 0) return []
    const unique = Array.from(new Set(ids.filter(Boolean)))
    const raws = await Promise.all(unique.map((id) => redis.get<string>(leadKey(id))))
    const leads: FreeTestLead[] = []
    for (const raw of raws) {
      const lead = parseJson<FreeTestLead>(raw)
      if (lead && lead.id) leads.push(lead)
    }
    return leads
  } catch (err) {
    console.error('demoLeads.readLeadsFromRedis failed', err)
    return []
  }
}

// ── Demo account helpers ─────────────────────────────────────────────────────

export function isDemoUser(user: Pick<User, 'permissions'> | null | undefined): boolean {
  if (!user) return false
  const perms = (user.permissions ?? {}) as Record<string, unknown>
  return perms.accountType === DEMO_ACCOUNT_TYPE
}

/**
 * Pick the demo test for a given exam: per-exam config → global default →
 * newest published "Diagnostic" test → newest published test. Returns null when
 * nothing is published yet (the lead is still captured; admin assigns later).
 */
export async function resolveDemoTestId(exam: string, config?: FreeTestConfig): Promise<string | null> {
  const cfg = config ?? (await loadConfig())
  const examKey = exam.toUpperCase() as keyof FreeTestConfig['examTests']
  const candidates = [cfg.examTests?.[examKey], cfg.activeTestId].filter(Boolean) as string[]

  for (const id of candidates) {
    const t = await prisma.test.findFirst({ where: { id, status: 'PUBLISHED' }, select: { id: true } })
    if (t) return t.id
  }

  const diagnostic = await prisma.test.findFirst({
    where: { status: 'PUBLISHED', category: { equals: 'Diagnostic', mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  if (diagnostic) return diagnostic.id

  const newest = await prisma.test.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  return newest?.id ?? null
}

/**
 * Give a demo account exactly one active assignment: deactivate any previous
 * demo assignment, then create a fresh one with a single attempt.
 */
export async function assignDemoTest(userId: string, testId: string): Promise<{ id: string; testId: string }> {
  const existing = await prisma.testAssignment.findFirst({
    where: { studentId: userId, testId, isActive: true },
  })
  if (existing) return { id: existing.id, testId }

  await prisma.testAssignment.updateMany({
    where: { studentId: userId, isActive: true },
    data: { isActive: false },
  })
  const created = await prisma.testAssignment.create({
    data: { testId, studentId: userId, maxAttempts: 1, isActive: true },
  })
  return { id: created.id, testId }
}

// ── Merged leads view (Redis CRM fields + live Postgres account/attempt data) ─

type DemoUserRow = {
  id: string
  name: string | null
  email: string
  permissions: unknown
  createdAt: Date
  deletedAt: Date | null
  testAssignments: Array<{ id: string; testId: string; isActive: boolean; createdAt: Date; test: { id: string; title: string; category: string | null } }>
  attempts: Array<{ id: string; testId: string; status: string; totalScore: number | null; startedAt: Date; completedAt: Date | null; test: { title: string; category: string | null } }>
}

function maxScoreFor(exam: string, category?: string | null): number {
  const c = `${exam} ${category ?? ''}`.toUpperCase()
  if (c.includes('ACT')) return 36
  if (c.includes('SAT')) return 1600
  return 100
}

function leadFromUser(u: DemoUserRow): FreeTestLead {
  const perms = (u.permissions ?? {}) as Record<string, unknown>
  const snap = (perms.demoLead ?? {}) as Record<string, unknown>
  return {
    id: (snap.leadId as string) || `user_${u.id}`,
    name: u.name || (perms.displayName as string) || u.email.split('@')[0],
    email: u.email,
    phone: (perms.phone as string) || (snap.phone as string) || '',
    exam: String(snap.exam || 'SAT').toUpperCase(),
    grade: (perms.grade as string) || (snap.grade as string) || '',
    school: (perms.schoolName as string) || (snap.school as string) || '',
    targetScore: (snap.targetScore as string) || '',
    testId: '',
    testTitle: '',
    status: 'Registered',
    leadStatus: 'New',
    registeredAt: (snap.registeredAt as string) || u.createdAt.toISOString(),
    notes: '',
    userId: u.id,
    accountCreated: true,
    source: (snap.source as string) || 'website',
  }
}

function applyLiveState(lead: FreeTestLead, u: DemoUserRow | undefined): FreeTestLead {
  if (!u) return { ...lead, accountCreated: Boolean(lead.userId) }

  const activeAssignment = u.testAssignments.find((a) => a.isActive) ?? u.testAssignments[0]
  const attempt = u.attempts[0] ?? null
  const maxScore = maxScoreFor(lead.exam, attempt?.test.category ?? activeAssignment?.test.category)

  let status: LeadTestStatus = 'Registered'
  if (attempt?.status === 'SUBMITTED' || attempt?.status === 'EVALUATED') status = 'Completed'
  else if (attempt?.status === 'IN_PROGRESS') status = 'In-Progress'

  const totalScore = status === 'Completed' ? attempt?.totalScore ?? null : null

  return {
    ...lead,
    userId: u.id,
    accountCreated: true,
    assignmentId: activeAssignment?.id ?? null,
    testId: attempt?.testId ?? activeAssignment?.testId ?? lead.testId ?? '',
    testTitle: attempt?.test.title ?? activeAssignment?.test.title ?? lead.testTitle ?? '',
    attemptId: attempt?.id ?? null,
    status,
    startedAt: attempt?.startedAt?.toISOString() ?? null,
    completedAt: attempt?.completedAt?.toISOString() ?? null,
    totalScore,
    maxScore: totalScore != null ? maxScore : null,
    percentage: totalScore != null && maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : null,
  }
}

async function loadDemoUsers(): Promise<DemoUserRow[]> {
  const users = await prisma.user.findMany({
    where: { role: 'STUDENT', deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      permissions: true,
      createdAt: true,
      deletedAt: true,
      testAssignments: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, testId: true, isActive: true, createdAt: true, test: { select: { id: true, title: true, category: true } } },
      },
      attempts: {
        orderBy: { startedAt: 'desc' },
        take: 1,
        select: { id: true, testId: true, status: true, totalScore: true, startedAt: true, completedAt: true, test: { select: { title: true, category: true } } },
      },
    },
  })
  return users.filter((u) => isDemoUser(u)) as DemoUserRow[]
}

/** All leads, newest first, with account/attempt state resolved from Postgres. */
export async function buildLeadsView(): Promise<FreeTestLead[]> {
  const [redisLeads, demoUsers] = await Promise.all([readLeadsFromRedis(), loadDemoUsers().catch((e) => {
    console.error('demoLeads.loadDemoUsers failed', e)
    return [] as DemoUserRow[]
  })])

  const usersById = new Map(demoUsers.map((u) => [u.id, u]))
  const usersByEmail = new Map(demoUsers.map((u) => [u.email.toLowerCase(), u]))
  const seenUsers = new Set<string>()

  const merged: FreeTestLead[] = redisLeads.map((lead) => {
    const u = (lead.userId && usersById.get(lead.userId)) || usersByEmail.get(lead.email.toLowerCase())
    if (u) seenUsers.add(u.id)
    return applyLiveState(lead, u)
  })

  // Demo accounts whose Redis lead entry is missing (evicted / created before
  // this pipeline) still show up, built from the profile snapshot.
  for (const u of demoUsers) {
    if (seenUsers.has(u.id)) continue
    merged.push(applyLiveState(leadFromUser(u), u))
  }

  merged.sort((a, b) => new Date(b.registeredAt || 0).getTime() - new Date(a.registeredAt || 0).getTime())
  return merged
}

/** Resolve a single lead (by lead id or user id) with live state. */
export async function getLeadView(leadId: string): Promise<FreeTestLead | null> {
  const all = await buildLeadsView()
  return all.find((l) => l.id === leadId || l.userId === leadId) ?? null
}
