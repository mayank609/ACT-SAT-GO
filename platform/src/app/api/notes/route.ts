import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { redis } from '@/lib/redis'

const NOTE_TTL = 60 * 60 * 24 * 365 // 1 year

interface Note {
  id: string
  text: string
  author: string
  createdAt: string
}

async function loadNotes(tutorId: string, studentId: string): Promise<Note[]> {
  const raw = await redis.get<string>(`notes:${tutorId}:${studentId}`)
  if (!raw) return []
  return typeof raw === 'string' ? JSON.parse(raw) : (raw as Note[])
}

// GET /api/notes?tutorId=xxx&studentId=xxx
export async function GET(request: NextRequest) {
  const tutorId = request.nextUrl.searchParams.get('tutorId')
  const studentId = request.nextUrl.searchParams.get('studentId')
  if (!tutorId || !studentId) {
    return NextResponse.json({ error: 'tutorId and studentId required' }, { status: 400 })
  }
  try {
    const notes = await loadNotes(tutorId, studentId)
    return NextResponse.json({ notes })
  } catch (error) {
    console.error('GET /api/notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

// POST /api/notes — body: { tutorId, studentId, text, author }
export async function POST(request: NextRequest) {
  try {
    const { tutorId, studentId, text, author } = await request.json()
    if (!tutorId || !studentId || !text) {
      return NextResponse.json({ error: 'tutorId, studentId, text required' }, { status: 400 })
    }
    const notes = await loadNotes(tutorId, studentId)
    const note: Note = {
      id: randomUUID(),
      text: String(text).trim(),
      author: author ?? 'Tutor',
      createdAt: new Date().toISOString().split('T')[0],
    }
    notes.unshift(note)
    await redis.set(`notes:${tutorId}:${studentId}`, JSON.stringify(notes), { ex: NOTE_TTL })
    return NextResponse.json({ note })
  } catch (error) {
    console.error('POST /api/notes:', error)
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
  }
}

// DELETE /api/notes?tutorId=xxx&studentId=xxx&noteId=xxx
export async function DELETE(request: NextRequest) {
  const tutorId = request.nextUrl.searchParams.get('tutorId')
  const studentId = request.nextUrl.searchParams.get('studentId')
  const noteId = request.nextUrl.searchParams.get('noteId')
  if (!tutorId || !studentId || !noteId) {
    return NextResponse.json({ error: 'tutorId, studentId, noteId required' }, { status: 400 })
  }
  try {
    const notes = await loadNotes(tutorId, studentId)
    const filtered = notes.filter((n) => n.id !== noteId)
    await redis.set(`notes:${tutorId}:${studentId}`, JSON.stringify(filtered), { ex: NOTE_TTL })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/notes:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
