import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { isHomeworkTest } from '@/lib/testCategorize'

// Automatic WhatsApp updates to a student's parent, sent through the WhatsApp
// Business Cloud API (Meta). Nothing is sent until these are set on the server:
//   WHATSAPP_TOKEN            permanent access token of the WhatsApp Business app
//   WHATSAPP_PHONE_NUMBER_ID  the sending number's Phone Number ID
// Optional: WHATSAPP_TEMPLATE_PTM (default "ptm_update"), WHATSAPP_TEMPLATE_TEST
// (default "test_result"), WHATSAPP_TEMPLATE_LANG (default "en").
// Messages a business starts must use templates approved by Meta; the template
// wording lives in /mnt/project-files/whatsapp/ for whoever sets the account up.
// Sending never blocks or fails the save that triggered it.

const GRAPH_URL = 'https://graph.facebook.com/v21.0'

type Perms = Record<string, unknown>

function configured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

/** Digits with country code; a bare 10-digit number is taken as Indian (+91). */
export function waNumber(phone: string | null | undefined): string {
  const raw = (phone ?? '').trim()
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (!raw.startsWith('+') && digits.length === 10) return `91${digits}`
  return digits.replace(/^00/, '')
}

// Template parameters may not be empty or contain new lines, tabs or 4+ spaces.
function param(v: string | number | null | undefined): { type: 'text'; text: string } {
  const text = String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim()
  return { type: 'text', text: text || '-' }
}

function fmtDate(d: string | Date | null | undefined, timeZone = 'Asia/Kolkata'): string {
  if (!d) return '-'
  const date = typeof d === 'string' && d.length === 10 ? new Date(`${d}T00:00:00Z`) : new Date(d)
  if (isNaN(date.getTime())) return String(d)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  try {
    return date.toLocaleDateString('en-GB', typeof d === 'string' && d.length === 10 ? { ...opts, timeZone: 'UTC' } : { ...opts, timeZone })
  } catch {
    return date.toLocaleDateString('en-GB', opts)
  }
}

async function sendTemplate(to: string, template: string, params: Array<string | number | null | undefined>): Promise<void> {
  const res = await fetch(`${GRAPH_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: template,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
        components: [{ type: 'body', parameters: params.map(param) }],
      },
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`WhatsApp ${template} ${res.status}: ${(await res.text()).slice(0, 300)}`)
}

function studentInfo(u: { name: string | null; email: string; permissions: unknown }) {
  const p = (u.permissions ?? {}) as Perms
  return {
    name: u.name || (p.displayName as string) || u.email.split('@')[0],
    to: waNumber(p.parentPhone as string | undefined),
    timeZone: (p.timezone as string) || 'Asia/Kolkata',
    demo: p.accountType === 'DEMO',
  }
}

/** PTM report saved by an admin → message to the parent. */
export async function notifyParentPtm(studentId: string, report: {
  ptmDate: string; targetTestDate: string | null; prepStatus: string; mocksCompleted: number; remarks: string
}): Promise<void> {
  if (!configured()) return
  try {
    const u = await prisma.user.findUnique({ where: { id: studentId }, select: { name: true, email: true, permissions: true } })
    if (!u) return
    const s = studentInfo(u)
    if (!s.to || s.demo) return
    await sendTemplate(s.to, process.env.WHATSAPP_TEMPLATE_PTM || 'ptm_update', [
      s.name, fmtDate(report.ptmDate), report.prepStatus, fmtDate(report.targetTestDate), report.mocksCompleted, report.remarks,
    ])
  } catch (err) {
    console.error('WhatsApp PTM update failed:', err)
  }
}

// "Mock", "Sectional", "Practice Sheet" (Test Builder categories) or homework.
function testKind(test: { title: string; category: string | null; subCategory: string | null }): string | null {
  if (isHomeworkTest(test)) return 'Homework'
  const cat = (test.category ?? '').trim().toLowerCase()
  if (cat === 'mock' || (!cat && test.title.toLowerCase().includes('mock'))) return 'Mock Test'
  if (cat === 'sectional') return 'Sectional Test'
  if (cat === 'practice sheet') return 'Practice Sheet'
  return null
}

/** Test attempt just submitted → score message to the parent (once per attempt). */
export async function notifyParentTestResult(attemptId: string): Promise<void> {
  if (!configured()) return
  try {
    const a = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      select: {
        status: true, totalScore: true, completedAt: true,
        test: { select: { title: true, category: true, subCategory: true, _count: { select: { questions: true } } } },
        student: { select: { name: true, email: true, permissions: true } },
      },
    })
    if (!a || a.status === 'IN_PROGRESS') return
    const kind = testKind(a.test)
    if (!kind) return
    const s = studentInfo(a.student)
    if (!s.to || s.demo) return

    const key = `wa:test:${attemptId}`
    if (await redis.get(key)) return
    await redis.set(key, '1', { ex: 60 * 60 * 24 * 30 })

    // Practice sheets and homework are raw "correct out of total"; mocks and sectionals are scaled.
    const raw = kind === 'Practice Sheet' || kind === 'Homework'
    const score = a.totalScore == null
      ? '-'
      : raw ? `${Math.round(a.totalScore)} / ${a.test._count.questions} correct` : String(Math.round(a.totalScore))
    await sendTemplate(s.to, process.env.WHATSAPP_TEMPLATE_TEST || 'test_result', [
      s.name, kind, a.test.title, fmtDate(a.completedAt, s.timeZone), score,
    ])
  } catch (err) {
    console.error('WhatsApp test result failed:', err)
  }
}
