import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import type { User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

// Shared rules for content a tutor/admin creates and shares with students
// (flashcards, articles):
//  - TUTOR: create; manage only their own items; share only with students
//    assigned to them.
//  - ADMIN / SUPER_ADMIN: everything, with any student.

export const isAdmin = (u: User) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN'
export const canAuthor = (u: User) => isAdmin(u) || u.role === 'TUTOR'
export const canManage = (u: User, item: { createdById: string }) => isAdmin(u) || item.createdById === u.id

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status })

/**
 * Keeps only the student ids this user may share with: any active student for
 * admins, the tutor's assigned students for tutors.
 */
export async function allowedStudentIds(u: User, requested: unknown): Promise<string[]> {
  const ids = Array.isArray(requested) ? [...new Set(requested.filter((x): x is string => typeof x === 'string'))] : []
  if (ids.length === 0) return []
  if (isAdmin(u)) {
    const rows = await prisma.user.findMany({
      where: { id: { in: ids }, role: 'STUDENT', deletedAt: null },
      select: { id: true },
    })
    return rows.map((r) => r.id)
  }
  const rows = await prisma.tutorAssignment.findMany({
    where: { tutorId: u.id, studentId: { in: ids }, student: { deletedAt: null } },
    select: { studentId: true },
  })
  return rows.map((r) => r.studentId)
}

/**
 * In-app notification (the Redis list the notification bell reads) plus a
 * durable DB copy. `link` is an in-app path opened when it is clicked.
 * Never throws — a failed notification must not fail the request.
 */
export async function notifyUsers(userIds: string[], n: { title: string; body: string; link: string }) {
  await Promise.all(
    userIds.map(async (userId) => {
      try {
        await prisma.notification.create({
          data: { userId, type: 'TUTOR_ANNOUNCEMENT', title: n.title, body: n.body, link: n.link, read: false },
        })
      } catch (e) {
        console.error('[notify] DB notification failed', e)
      }
      try {
        const notifId = randomUUID()
        const payload = { id: notifId, userId, type: 'TUTOR_ANNOUNCEMENT', ...n, read: false, createdAt: new Date().toISOString() }
        await redis.set(`notif:${notifId}`, JSON.stringify(payload), { ex: 2_592_000 }) // 30 days
        await redis.lpush(`user_notifs:${userId}`, notifId)
      } catch (e) {
        console.error('[notify] in-app notification failed', e)
      }
    }),
  )
}
