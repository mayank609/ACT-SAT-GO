import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

const NEXT_SAT_DATE_KEY = 'settings:nextSatDate'

// GET /api/settings — platform-wide settings shared across all dashboards
// (e.g. the "Next SAT Date" countdown shown in admin/tutor sidebars).
export async function GET() {
  try {
    const nextSatDate = await redis.get<string>(NEXT_SAT_DATE_KEY)
    return NextResponse.json({ nextSatDate: nextSatDate ?? null })
  } catch (error) {
    console.error('GET /api/settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

// PUT /api/settings — body: { nextSatDate: string (YYYY-MM-DD) | null }
export async function PUT(request: NextRequest) {
  try {
    const { nextSatDate } = await request.json()
    if (nextSatDate !== null && typeof nextSatDate !== 'string') {
      return NextResponse.json({ error: 'nextSatDate must be a date string or null' }, { status: 400 })
    }
    if (nextSatDate === null) {
      await redis.del(NEXT_SAT_DATE_KEY)
    } else {
      await redis.set(NEXT_SAT_DATE_KEY, nextSatDate)
    }
    return NextResponse.json({ nextSatDate })
  } catch (error) {
    console.error('PUT /api/settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
