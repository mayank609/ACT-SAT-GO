import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth
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
      include: { test: { select: { category: true, title: true } } },
    })

    const bucketsACT: Record<string, number> = {
      '1–10': 0, '11–15': 0, '16–20': 0, '21–25': 0, '26–30': 0, '31–36': 0,
    }
    const bucketsSAT: Record<string, number> = {
      '400–800': 0, '800–1000': 0, '1000–1200': 0, '1200–1400': 0, '1400–1600': 0,
    }

    let hasSAT = false
    let hasACT = false

    for (const a of submitted) {
      const s = a.totalScore ?? 0
      const cat = a.test?.category?.toUpperCase() || ''
      const title = a.test?.title?.toUpperCase() || ''
      const isSATAttempt = cat === 'SAT' || title.includes('SAT') || s > 36
      
      if (isSATAttempt) {
        hasSAT = true
        if (s <= 800) bucketsSAT['400–800']++
        else if (s <= 1000) bucketsSAT['800–1000']++
        else if (s <= 1200) bucketsSAT['1000–1200']++
        else if (s <= 1400) bucketsSAT['1200–1400']++
        else bucketsSAT['1400–1600']++
      } else {
        hasACT = true
        if (s <= 10) bucketsACT['1–10']++
        else if (s <= 15) bucketsACT['11–15']++
        else if (s <= 20) bucketsACT['16–20']++
        else if (s <= 25) bucketsACT['21–25']++
        else if (s <= 30) bucketsACT['26–30']++
        else bucketsACT['31–36']++
      }
    }

    const scoreDistributionACT = Object.entries(bucketsACT).map(([range, count]) => ({ range, count }))
    const scoreDistributionSAT = Object.entries(bucketsSAT).map(([range, count]) => ({ range, count }))
    const scoreDistribution = hasSAT && !hasACT ? scoreDistributionSAT : scoreDistributionACT

    return NextResponse.json({
      activityData: days,
      scoreDistribution,
      scoreDistributionACT,
      scoreDistributionSAT,
      hasSAT,
      hasACT
    })
  } catch (error) {
    console.error('GET /api/analytics/platform:', error)
    return NextResponse.json({ error: 'Failed to fetch platform analytics' }, { status: 500 })
  }
}
