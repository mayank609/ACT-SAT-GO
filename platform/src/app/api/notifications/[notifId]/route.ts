import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

interface Notification {
  id: string
  userId: string
  type: string
  title: string
  body: string
  read: boolean
  createdAt: string
}

// ── PATCH — mark notification as read ─────────────────────────────────────────

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ notifId: string }> }
) {
  const { notifId } = await params

  try {
    const raw = await redis.get<string>(`notif:${notifId}`)

    if (!raw) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    const notification: Notification =
      typeof raw === 'object'
        ? (raw as unknown as Notification)
        : (JSON.parse(raw) as Notification)

    notification.read = true

    const TTL = 2592000 // 30 days in seconds
    await redis.set(`notif:${notifId}`, JSON.stringify(notification), { ex: TTL })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PATCH /api/notifications/[notifId]:', error)
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
  }
}
