import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/class-progress/batch[?tutorId=…][&studentId=…]
// Every session log for a set of tutor–student pairs in ONE request, read with
// Redis MGET — attendance/salary pages used to send one request per pair
// (hundreds), each its own Redis round trip.
//   ADMIN / SUPER_ADMIN: all pairs (optionally narrowed by tutorId/studentId)
//   TUTOR:   their own pairs
//   STUDENT: their own pairs
// Response: { entries: { "<tutorId>:<studentId>": ClassProgressEntry[] } }

const CHUNK = 100

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  let tutorId = request.nextUrl.searchParams.get('tutorId') || undefined
  let studentId = request.nextUrl.searchParams.get('studentId') || undefined
  if (user.role === 'TUTOR') tutorId = user.id
  else if (user.role === 'STUDENT') studentId = user.id
  else if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const pairs = await prisma.tutorAssignment.findMany({
      where: { ...(tutorId ? { tutorId } : {}), ...(studentId ? { studentId } : {}) },
      select: { tutorId: true, studentId: true },
    })
    const keys = pairs.map((p) => `classProgress:${p.tutorId}:${p.studentId}`)
    const chunks: string[][] = []
    for (let i = 0; i < keys.length; i += CHUNK) chunks.push(keys.slice(i, i + CHUNK))
    const values = (await Promise.all(chunks.map((c) => redis.mget<unknown>(c)))).flat()

    const entries: Record<string, unknown[]> = {}
    pairs.forEach((p, i) => {
      const raw = values[i]
      if (!raw) return
      const list = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (Array.isArray(list) && list.length) entries[`${p.tutorId}:${p.studentId}`] = list
    })
    return NextResponse.json({ entries })
  } catch (error) {
    console.error('GET /api/class-progress/batch:', error)
    return NextResponse.json({ error: 'Failed to load session logs' }, { status: 500 })
  }
}
