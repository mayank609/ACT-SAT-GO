import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Last 7 days daily activity
    const days: { date: string; attempts: number; completions: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const next = new Date(d)
      next.setDate(next.getDate() + 1)

      const [attempts, completions] = await Promise.all([
        prisma.testAttempt.count({ where: { startedAt: { gte: d, lt: next } } }),
        prisma.testAttempt.count({ where: { completedAt: { gte: d, lt: next }, status: 'SUBMITTED' } }),
      ])

      days.push({
        date: d.toLocaleDateString('en-US', { weekday: 'short' }),
        attempts,
        completions,
      })
    }

    // Score distribution across all SUBMITTED attempts
    const submitted = await prisma.testAttempt.findMany({
      where: { status: 'SUBMITTED', totalScore: { not: null } },
      select: { totalScore: true },
    })

    const buckets: Record<string, number> = {
      '1–10': 0, '11–15': 0, '16–20': 0, '21–25': 0, '26–30': 0, '31–36': 0,
    }
    for (const { totalScore } of submitted) {
      const s = totalScore ?? 0
      if (s <= 10) buckets['1–10']++
      else if (s <= 15) buckets['11–15']++
      else if (s <= 20) buckets['16–20']++
      else if (s <= 25) buckets['21–25']++
      else if (s <= 30) buckets['26–30']++
      else buckets['31–36']++
    }

    const scoreDistribution = Object.entries(buckets).map(([range, count]) => ({ range, count }))

    return NextResponse.json({ activityData: days, scoreDistribution })
  } catch (error) {
    console.error('GET /api/analytics/platform:', error)
    return NextResponse.json({ error: 'Failed to fetch platform analytics' }, { status: 500 })
  }
}
