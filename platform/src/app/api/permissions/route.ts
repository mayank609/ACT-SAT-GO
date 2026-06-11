import { NextRequest, NextResponse } from 'next/server'
import { getPermissions, savePermissions, PermissionRow } from '@/lib/permissionsStore'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth
  try {
    const permissions = getPermissions()
    return NextResponse.json({ permissions })
  } catch (error) {
    console.error('GET /api/permissions error:', error)
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth
  try {
    const body = await request.json()
    const { permissions } = body as { permissions?: PermissionRow[] }

    if (!permissions || !Array.isArray(permissions)) {
      return NextResponse.json({ error: 'permissions array is required' }, { status: 400 })
    }

    const success = savePermissions(permissions)
    if (!success) {
      return NextResponse.json({ error: 'Failed to write permissions' }, { status: 500 })
    }

    return NextResponse.json({ success: true, permissions: getPermissions() })
  } catch (error) {
    console.error('POST /api/permissions error:', error)
    return NextResponse.json({ error: 'Failed to save permissions' }, { status: 500 })
  }
}
