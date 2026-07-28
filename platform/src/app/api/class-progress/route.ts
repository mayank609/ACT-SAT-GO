import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { redis } from '@/lib/redis'
import { requireRole } from '@/lib/auth'

const ENTRY_TTL = 60 * 60 * 24 * 365 // 1 year

interface ClassProgressEntry {
  id: string
  topic: string
  homework: string
  notes: string
  classDate: string
  author: string
  createdAt: string
  startTime?: string
  durationMinutes?: number
  actualDurationMinutes?: number
  subject?: string
  status?: string
  sessionType?: string
  understanding?: number
  attendance?: string
  engagement?: string
  nextSessionGoal?: string
  nextSessionAt?: string
}

async function loadEntries(tutorId: string, studentId: string): Promise<ClassProgressEntry[]> {
  const raw = await redis.get<string>(`classProgress:${tutorId}:${studentId}`)
  if (!raw) return []
  return typeof raw === 'string' ? JSON.parse(raw) : (raw as ClassProgressEntry[])
}

// GET /api/class-progress?tutorId=xxx&studentId=xxx
export async function GET(request: NextRequest) {
  const tutorId = request.nextUrl.searchParams.get('tutorId')
  const studentId = request.nextUrl.searchParams.get('studentId')
  if (!tutorId || !studentId) {
    return NextResponse.json({ error: 'tutorId and studentId required' }, { status: 400 })
  }
  try {
    const entries = await loadEntries(tutorId, studentId)
    return NextResponse.json({ entries })
  } catch (error) {
    console.error('GET /api/class-progress:', error)
    return NextResponse.json({ error: 'Failed to fetch class progress' }, { status: 500 })
  }
}

// POST /api/class-progress — body: { tutorId, studentId, topic, homework?, notes?, classDate?, author,
//   startTime?, durationMinutes?, subject?, status?, understanding?, attendance?, engagement?, nextSessionGoal?, nextSessionAt? }
export async function POST(request: NextRequest) {
  try {
    const {
      tutorId, studentId, topic, homework, notes, classDate, author,
      startTime, durationMinutes, actualDurationMinutes, subject, status, sessionType, understanding, attendance, engagement, nextSessionGoal, nextSessionAt,
    } = await request.json()
    if (!tutorId || !studentId || !topic) {
      return NextResponse.json({ error: 'tutorId, studentId, topic required' }, { status: 400 })
    }
    const entries = await loadEntries(tutorId, studentId)
    const entry: ClassProgressEntry = {
      id: randomUUID(),
      topic: String(topic).trim(),
      homework: homework ? String(homework).trim() : '',
      notes: notes ? String(notes).trim() : '',
      classDate: classDate ? String(classDate) : new Date().toISOString().split('T')[0],
      author: author ?? 'Tutor',
      createdAt: new Date().toISOString(),
      ...(startTime ? { startTime: String(startTime) } : {}),
      ...(durationMinutes ? { durationMinutes: Number(durationMinutes) } : {}),
      ...(actualDurationMinutes ? { actualDurationMinutes: Number(actualDurationMinutes) } : {}),
      ...(subject ? { subject: String(subject) } : {}),
      ...(status ? { status: String(status) } : {}),
      ...(sessionType ? { sessionType: String(sessionType) } : {}),
      ...(understanding ? { understanding: Number(understanding) } : {}),
      ...(attendance ? { attendance: String(attendance) } : {}),
      ...(engagement ? { engagement: String(engagement) } : {}),
      ...(nextSessionGoal ? { nextSessionGoal: String(nextSessionGoal).trim() } : {}),
      ...(nextSessionAt ? { nextSessionAt: String(nextSessionAt) } : {}),
    }
    entries.unshift(entry)
    await redis.set(`classProgress:${tutorId}:${studentId}`, JSON.stringify(entries), { ex: ENTRY_TTL })
    return NextResponse.json({ entry })
  } catch (error) {
    console.error('POST /api/class-progress:', error)
    return NextResponse.json({ error: 'Failed to save class progress' }, { status: 500 })
  }
}

// DELETE /api/class-progress?tutorId=xxx&studentId=xxx&entryId=xxx — admin/super-admin only.
export async function DELETE(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth

  const tutorId = request.nextUrl.searchParams.get('tutorId')
  const studentId = request.nextUrl.searchParams.get('studentId')
  const entryId = request.nextUrl.searchParams.get('entryId')
  if (!tutorId || !studentId || !entryId) {
    return NextResponse.json({ error: 'tutorId, studentId, entryId required' }, { status: 400 })
  }
  try {
    const entries = await loadEntries(tutorId, studentId)
    const filtered = entries.filter((e) => e.id !== entryId)
    await redis.set(`classProgress:${tutorId}:${studentId}`, JSON.stringify(filtered), { ex: ENTRY_TTL })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/class-progress:', error)
    return NextResponse.json({ error: 'Failed to delete class progress entry' }, { status: 500 })
  }
}

// PATCH /api/class-progress — body: { tutorId, studentId, entryId, ...fields to update }.
// Lets admin/super-admin correct or manage a tutor's logged session entry.
export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth

  try {
    const {
      tutorId, studentId, entryId, topic, homework, notes, classDate,
      durationMinutes, actualDurationMinutes, subject, status, sessionType,
    } = await request.json()
    if (!tutorId || !studentId || !entryId) {
      return NextResponse.json({ error: 'tutorId, studentId, entryId required' }, { status: 400 })
    }
    const entries = await loadEntries(tutorId, studentId)
    const idx = entries.findIndex((e) => e.id === entryId)
    if (idx === -1) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }
    const updated: ClassProgressEntry = {
      ...entries[idx],
      ...(topic !== undefined ? { topic: String(topic).trim() } : {}),
      ...(homework !== undefined ? { homework: String(homework).trim() } : {}),
      ...(notes !== undefined ? { notes: String(notes).trim() } : {}),
      ...(classDate !== undefined ? { classDate: String(classDate) } : {}),
      ...(durationMinutes !== undefined ? { durationMinutes: Number(durationMinutes) } : {}),
      ...(actualDurationMinutes !== undefined ? { actualDurationMinutes: Number(actualDurationMinutes) } : {}),
      ...(subject !== undefined ? { subject: String(subject) } : {}),
      ...(status !== undefined ? { status: String(status) } : {}),
      ...(sessionType !== undefined ? { sessionType: String(sessionType) } : {}),
    }
    entries[idx] = updated
    await redis.set(`classProgress:${tutorId}:${studentId}`, JSON.stringify(entries), { ex: ENTRY_TTL })
    return NextResponse.json({ entry: updated })
  } catch (error) {
    console.error('PATCH /api/class-progress:', error)
    return NextResponse.json({ error: 'Failed to update class progress entry' }, { status: 500 })
  }
}
