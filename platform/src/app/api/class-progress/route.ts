import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { redis } from '@/lib/redis'

const ENTRY_TTL = 60 * 60 * 24 * 365 // 1 year

interface ClassProgressEntry {
  id: string
  topic: string
  notes: string
  classDate: string
  author: string
  createdAt: string
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

// POST /api/class-progress — body: { tutorId, studentId, topic, notes?, classDate?, author }
export async function POST(request: NextRequest) {
  try {
    const { tutorId, studentId, topic, notes, classDate, author } = await request.json()
    if (!tutorId || !studentId || !topic) {
      return NextResponse.json({ error: 'tutorId, studentId, topic required' }, { status: 400 })
    }
    const entries = await loadEntries(tutorId, studentId)
    const entry: ClassProgressEntry = {
      id: randomUUID(),
      topic: String(topic).trim(),
      notes: notes ? String(notes).trim() : '',
      classDate: classDate ? String(classDate) : new Date().toISOString().split('T')[0],
      author: author ?? 'Tutor',
      createdAt: new Date().toISOString(),
    }
    entries.unshift(entry)
    await redis.set(`classProgress:${tutorId}:${studentId}`, JSON.stringify(entries), { ex: ENTRY_TTL })
    return NextResponse.json({ entry })
  } catch (error) {
    console.error('POST /api/class-progress:', error)
    return NextResponse.json({ error: 'Failed to save class progress' }, { status: 500 })
  }
}

// DELETE /api/class-progress?tutorId=xxx&studentId=xxx&entryId=xxx
export async function DELETE(request: NextRequest) {
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
