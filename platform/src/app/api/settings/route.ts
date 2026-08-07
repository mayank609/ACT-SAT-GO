import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

const NEXT_SAT_DATE_KEY = 'settings:nextSatDate'
const SAT_TEST_DATES_KEY = 'settings:satTestDates'

// GET /api/settings — platform-wide settings shared across all dashboards
// (e.g. the "Next SAT Date" countdown shown in admin/tutor sidebars, and the
// full official test-date calendar shown in the super admin console).
export async function GET() {
  try {
    const [nextSatDate, rawDates] = await Promise.all([
      redis.get<string>(NEXT_SAT_DATE_KEY),
      redis.get<string>(SAT_TEST_DATES_KEY),
    ])
    const satTestDates: string[] = rawDates
      ? (typeof rawDates === 'string' ? JSON.parse(rawDates) : (rawDates as unknown as string[]))
      : []
    return NextResponse.json({ nextSatDate: nextSatDate ?? null, satTestDates })
  } catch (error) {
    console.error('GET /api/settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

// PUT /api/settings — body: { nextSatDate?: string (YYYY-MM-DD) | null, satTestDates?: string[] }
// Either field may be sent independently; only fields present in the body are updated.
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const result: { nextSatDate?: string | null; satTestDates?: string[] } = {}

    if ('nextSatDate' in body) {
      const { nextSatDate } = body
      if (nextSatDate !== null && typeof nextSatDate !== 'string') {
        return NextResponse.json({ error: 'nextSatDate must be a date string or null' }, { status: 400 })
      }
      if (nextSatDate === null) {
        await redis.del(NEXT_SAT_DATE_KEY)
      } else {
        await redis.set(NEXT_SAT_DATE_KEY, nextSatDate)
      }
      result.nextSatDate = nextSatDate
    }

    if ('satTestDates' in body) {
      const { satTestDates } = body
      if (!Array.isArray(satTestDates) || satTestDates.some((d) => typeof d !== 'string')) {
        return NextResponse.json({ error: 'satTestDates must be an array of date strings' }, { status: 400 })
      }
      const sorted = [...new Set(satTestDates)].sort()
      await redis.set(SAT_TEST_DATES_KEY, JSON.stringify(sorted))
      result.satTestDates = sorted
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('PUT /api/settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
