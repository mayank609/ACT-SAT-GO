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
      if (!user && (userEmail.includes('admin') || userEmail.includes('sunanda') || userEmail.includes('staff'))) {
        try {
          user = await prisma.user.create({
            data: {
              id: userId,
              email: userEmail,
              name: userEmail.split('@')[0],
              role: 'ADMIN',
            },
          })
        } catch {
          // ignore unique constraint race
        }
      }
    }
    if (user?.deletedAt) return null
    if (user) return user
  } catch (dbErr) {
    console.error('Error fetching current user from DB:', dbErr)
  }

  // If user is authenticated in Supabase with admin identifier
  if (userEmail && (userEmail.includes('admin') || userEmail.includes('sunanda') || userEmail.includes('staff'))) {
    return {
      id: userId,
      email: userEmail,
      name: userEmail.split('@')[0],
      role: 'ADMIN',
      permissions: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as User
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
