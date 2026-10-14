import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Role, User } from '@prisma/client'

/**
 * Auth helpers for API route handlers.
 *
 * Authentication is performed centrally in `src/proxy.ts`, which verifies the
 * Supabase JWT for every `/api/` request and forwards a trusted `x-user-id`
 * header. These helpers cover *authorization* (role checks) on top of that.
 *
 * Because the proxy already rejected anonymous requests, a missing `x-user-id`
 * here means the route was somehow reached without the proxy (misconfiguration)
 * — we still fail closed.
 */

// The Supabase auth user id forwarded by the proxy (=== the DB User.id).
export function getUserId(request: NextRequest): string | null {
  return request.headers.get('x-user-id')
}

// Loads the authenticated DB user, or null if it can't be resolved. A
// soft-deleted user (deletedAt set) is treated as unauthenticated everywhere
// this is used — deleting an account also revokes its active session.
export async function getCurrentUser(request: NextRequest): Promise<User | null> {
  const userId = getUserId(request)
  if (!userId) return null
  const userEmail = request.headers.get('x-user-email') || ''

  try {
    let user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user && userEmail) {
      user = await prisma.user.findUnique({ where: { email: userEmail } })
    }
    if (user?.deletedAt) return null
    if (user) return user
  } catch (dbErr) {
    console.error('Error fetching current user from DB:', dbErr)
  }

  return null
}

/**
 * Require the caller to have one of the given roles.
 * On success returns the DB user; on failure returns a NextResponse to return
 * directly from the handler:
 *
 *   const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
 *   if (auth instanceof NextResponse) return auth
 *   const user = auth // typed as User
 */
export async function requireRole(
  request: NextRequest,
  roles: Role[]
): Promise<User | NextResponse> {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (!roles.includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  return user
}

// Convenience: require any authenticated user (role-agnostic).
export async function requireUser(request: NextRequest): Promise<User | NextResponse> {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  return user
}

/**
 * Allow the request only if the caller may see or change this student's data:
 * the student themselves, an admin, or a tutor assigned to the student.
 * Returns true, or a 401/403 NextResponse to return from the handler.
 *
 * The common case (a student on their own data) is decided from the trusted
 * x-user-id header alone, without a database lookup.
 */
export async function requireStudentAccess(
  request: NextRequest,
  studentId: string
): Promise<true | NextResponse> {
  const userId = getUserId(request)
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  if (userId === studentId) return true

  const user = await getCurrentUser(request)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  if (user.id === studentId || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true
  if (user.role === 'TUTOR') {
    const assigned = await prisma.tutorAssignment.findUnique({
      where: { tutorId_studentId: { tutorId: user.id, studentId } },
      select: { id: true },
    })
    if (assigned) return true
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// An attempt's owner never changes, so remember it per process.
const attemptOwnerCache = new Map<string, string>()
const ATTEMPT_OWNER_CACHE_MAX = 5000

async function getAttemptStudentId(attemptId: string): Promise<string | null> {
  const cached = attemptOwnerCache.get(attemptId)
  if (cached) return cached
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    select: { studentId: true },
  })
  if (!attempt) return null
  if (attemptOwnerCache.size >= ATTEMPT_OWNER_CACHE_MAX) {
    const oldest = attemptOwnerCache.keys().next().value
    if (oldest !== undefined) attemptOwnerCache.delete(oldest)
  }
  attemptOwnerCache.set(attemptId, attempt.studentId)
  return attempt.studentId
}

/**
 * Same as requireStudentAccess, for a route addressed by attempt id.
 * Returns a 404 when the attempt does not exist.
 */
export async function requireAttemptAccess(
  request: NextRequest,
  attemptId: string
): Promise<true | NextResponse> {
  const studentId = await getAttemptStudentId(attemptId)
  if (!studentId) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
  return requireStudentAccess(request, studentId)
}
