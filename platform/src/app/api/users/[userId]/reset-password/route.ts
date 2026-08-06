import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateTempPassword } from '@/lib/tempPassword'

export const dynamic = 'force-dynamic'

// POST /api/users/[userId]/reset-password — admin-only. Generates a fresh
// temporary password and sets it directly in Supabase Auth. The password
// shown at account creation is never stored anywhere in plaintext (Supabase
// only keeps a hash), so this is the only way to hand a user new credentials
// if the original one-time popup was closed before it was saved.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth

  const { userId } = await params
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.deletedAt) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const supabaseAdmin = createAdminClient()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is missing in backend .env' }, { status: 500 })
  }

  const tempPassword = generateTempPassword()
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: tempPassword })
  if (error) {
    return NextResponse.json({ error: `Supabase Auth: ${error.message}` }, { status: 400 })
  }

  return NextResponse.json({ tempPassword })
}
