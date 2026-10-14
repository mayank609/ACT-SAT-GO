import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import {
  createClassRoom, disableClassRoom, liveClassConfigured, loadLiveClasses, meetingUrl, saveLiveClasses,
} from '@/lib/liveClass'

export const dynamic = 'force-dynamic'

const NOT_CONFIGURED = 'Live classes are not set up on the server yet (100ms keys are missing).'
const isAdmin = (role: string) => role === 'ADMIN' || role === 'SUPER_ADMIN'
const nameOf = (u: { name: string | null; email: string; permissions: unknown }) =>
  u.name ?? ((u.permissions ?? {}) as { displayName?: string }).displayName ?? u.email.split('@')[0]

// GET /api/live-class — the live classes the caller may join, each with the
// join link for their role (admins and the tutor join as host, the student as guest).
export async function GET(request: NextRequest) {
  const user = await requireUser(request)
  if (user instanceof NextResponse) return user
  if (!liveClassConfigured()) return NextResponse.json({ configured: false, classes: [] })
  try {
    const all = await loadLiveClasses()
    const mine = all.filter((c) => isAdmin(user.role) || c.tutorId === user.id || c.studentId === user.id)
    return NextResponse.json({
      configured: true,
      classes: mine.map(({ hostCode, guestCode, ...c }) => ({
        ...c,
        joinUrl: meetingUrl(c.studentId === user.id ? guestCode : hostCode),
        canEnd: isAdmin(user.role) || c.tutorId === user.id,
      })),
    })
  } catch (error) {
    console.error('GET /api/live-class:', error)
    return NextResponse.json({ error: 'Failed to load live classes' }, { status: 500 })
  }
}

// POST /api/live-class — body { studentId, tutorId? }. A tutor starts a class
// with one of their students; an admin may start one for any tutor (or themselves).
export async function POST(request: NextRequest) {
  const user = await requireUser(request)
  if (user instanceof NextResponse) return user
  if (user.role !== 'TUTOR' && !isAdmin(user.role)) {
    return NextResponse.json({ error: 'Only tutors and admins can start a class' }, { status: 403 })
  }
  if (!liveClassConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 })

  const { studentId, tutorId: requestedTutorId } = (await request.json().catch(() => ({}))) as { studentId?: string; tutorId?: string }
  if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 })
  const tutorId = isAdmin(user.role) && requestedTutorId ? requestedTutorId : user.id

  try {
    if (user.role === 'TUTOR') {
      const link = await prisma.tutorAssignment.findUnique({ where: { tutorId_studentId: { tutorId, studentId } } })
      if (!link) return NextResponse.json({ error: 'This student is not assigned to you' }, { status: 403 })
    }
    const [student, tutor] = await Promise.all([
      prisma.user.findUnique({ where: { id: studentId } }),
      prisma.user.findUnique({ where: { id: tutorId } }),
    ])
    if (!student || student.deletedAt || student.role !== 'STUDENT') return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    if (!tutor) return NextResponse.json({ error: 'Tutor not found' }, { status: 404 })

    const all = await loadLiveClasses()
    const existing = all.find((c) => c.studentId === studentId)
    if (existing) {
      return NextResponse.json({ error: `${existing.studentName} already has a live class with ${existing.tutorName}` }, { status: 409 })
    }

    const room = await createClassRoom(`${nameOf(tutor)}-${nameOf(student)}`)
    const cls = {
      ...room,
      studentId, studentName: nameOf(student),
      tutorId, tutorName: nameOf(tutor),
      startedAt: new Date().toISOString(),
    }
    await saveLiveClasses([...all, cls])
    return NextResponse.json({ class: { roomId: cls.roomId, studentId, studentName: cls.studentName, tutorId, tutorName: cls.tutorName, startedAt: cls.startedAt, joinUrl: meetingUrl(cls.hostCode), canEnd: true } }, { status: 201 })
  } catch (error) {
    console.error('POST /api/live-class:', error)
    return NextResponse.json({ error: 'Could not start the class' }, { status: 500 })
  }
}

// DELETE /api/live-class?roomId=… — the class's tutor or an admin ends it.
export async function DELETE(request: NextRequest) {
  const user = await requireUser(request)
  if (user instanceof NextResponse) return user
  const roomId = request.nextUrl.searchParams.get('roomId')
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })
  try {
    const all = await loadLiveClasses()
    const cls = all.find((c) => c.roomId === roomId)
    if (!cls) return NextResponse.json({ success: true })
    if (!isAdmin(user.role) && cls.tutorId !== user.id) {
      return NextResponse.json({ error: 'Only the tutor or an admin can end this class' }, { status: 403 })
    }
    await disableClassRoom(roomId).catch((e) => console.warn('[live-class] could not disable room:', e))
    await saveLiveClasses(all.filter((c) => c.roomId !== roomId))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/live-class:', error)
    return NextResponse.json({ error: 'Could not end the class' }, { status: 500 })
  }
}
