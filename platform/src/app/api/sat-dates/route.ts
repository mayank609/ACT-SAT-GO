import { NextResponse } from 'next/server'
import { upcomingSatDates } from '@/lib/satDates'

export const dynamic = 'force-dynamic'

// GET /api/sat-dates — upcoming official SAT test dates from College Board.
export async function GET() {
  try {
    return NextResponse.json(await upcomingSatDates())
  } catch (error) {
    console.error('GET /api/sat-dates:', error)
    return NextResponse.json({ error: 'Failed to load SAT dates' }, { status: 500 })
  }
}
