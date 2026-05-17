import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { randomUUID } from 'crypto'

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

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId query param is required' }, { status: 400 })
  }

  try {
    const ids = await redis.lrange(`user_notifs:${userId}`, 0, 49)

    if (!ids || ids.length === 0) {
      return NextResponse.json({ notifications: [] })
    }

    const rawItems = await Promise.all(
      ids.map((id) => redis.get<string>(`notif:${id}`)),
    )

    const notifications: Notification[] = rawItems
      .filter((item): item is string => item !== null)
      .map((item) => {
        if (typeof item === 'object') return item as unknown as Notification
        return JSON.parse(item) as Notification
      })
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )

    return NextResponse.json({ notifications })
  } catch (error) {
    console.error('GET /api/notifications:', error)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: { userId?: string; type?: string; title?: string; body?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { userId, type, title, body: notifBody } = body

  if (!userId || !type || !title || !notifBody) {
    return NextResponse.json(
      { error: 'userId, type, title, and body are required' },
      { status: 400 },
    )
  }

  try {
    const id = randomUUID()
    const notification: Notification = {
      id,
      userId,
      type,
      title,
      body: notifBody,
      read: false,
      createdAt: new Date().toISOString(),
    }

    const TTL = 2592000 // 30 days in seconds

    await redis.set(`notif:${id}`, JSON.stringify(notification), { ex: TTL })
    await redis.lpush(`user_notifs:${userId}`, id)

    return NextResponse.json({ notification }, { status: 201 })
  } catch (error) {
    console.error('POST /api/notifications:', error)
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 })
  }
}
