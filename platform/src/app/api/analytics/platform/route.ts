import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { numericValuesEqual } from '@/lib/numericAnswer'

export const dynamic = 'force-dynamic'

function isAnswerCorrect(given: unknown, correct: unknown): boolean {
  if (!given || !correct) return false
  const g = given as { key?: string; keys?: string[]; value?: number }
  const c = correct as { key?: string; keys?: string[]; value?: number }

  if (c.value !== undefined) {
    if (g.value === undefined) return false
    return numericValuesEqual(g.value, c.value)
  }
  if (Array.isArray(c.keys)) {
    if (!Array.isArray(g.keys)) return false
    const gKeys = g.keys.map((k) => String(k).toUpperCase().trim()).sort()
    const cKeys = c.keys.map((k) => String(k).toUpperCase().trim()).sort()
    return JSON.stringify(gKeys) === JSON.stringify(cKeys)
  }
  if (c.key !== undefined) {
    if (g.key === undefined) return false
    return String(g.key).toUpperCase().trim() === String(c.key).toUpperCase().trim()
  }
  return false
}

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

    // Avg score improvement: last 30 days vs the prior 30-day window.
    const now = new Date()
    const day30Ago = new Date(now); day30Ago.setDate(day30Ago.getDate() - 30)
    const day60Ago = new Date(now); day60Ago.setDate(day60Ago.getDate() - 60)

    const [recentWindow, priorWindow] = await Promise.all([
      prisma.testAttempt.findMany({
        where: { status: 'SUBMITTED', totalScore: { not: null }, completedAt: { gte: day30Ago } },
        select: { totalScore: true },
      }),
      prisma.testAttempt.findMany({
        where: { status: 'SUBMITTED', totalScore: { not: null }, completedAt: { gte: day60Ago, lt: day30Ago } },
        select: { totalScore: true },
      }),
    ])

    const avg = (rows: { totalScore: number | null }[]) =>
      rows.length ? rows.reduce((a, r) => a + (r.totalScore ?? 0), 0) / rows.length : null

    const recentAvg = avg(recentWindow)
    const priorAvg = avg(priorWindow)
    const avgScoreImprovement = recentAvg !== null && priorAvg !== null
      ? Math.round((recentAvg - priorAvg) * 10) / 10
      : null

    // Subject strength: platform-wide accuracy split by section (Reading & Writing vs Math),
    // computed the same way per-student accuracy is computed in /api/analytics/student.
    // Bounded to the most recent 300 submitted attempts to keep this cheap.
    const recentAttempts = await prisma.testAttempt.findMany({
      where: { status: 'SUBMITTED' },
      orderBy: { completedAt: 'desc' },
      take: 300,
      include: {
        answers: { select: { questionId: true, answerGiven: true } },
        test: {
          include: {
            sections: {
              include: {
                questions: {
                  include: {
                    question: {
                      select: {
                        id: true, type: true, correctAnswer: true, parentQuestionId: true,
                        childQuestions: { select: { id: true, correctAnswer: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    const subjectTally = { rw: { correct: 0, total: 0 }, math: { correct: 0, total: 0 } }
    for (const attempt of recentAttempts) {
      const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a.answerGiven]))
      for (const section of attempt.test.sections) {
        const isMath = /math/i.test(section.name)
        const bucket = isMath ? subjectTally.math : subjectTally.rw
        for (const tq of section.questions) {
          const q = tq.question
          if (q.parentQuestionId) continue // reached via its passage parent's flattening below
          // Passages have no answer of their own — grade each child question instead.
          const gradable = q.type === 'PASSAGE' && q.childQuestions.length > 0
            ? q.childQuestions
            : [q]
          for (const gq of gradable) {
            const given = answerMap.get(gq.id)
            if (given === null || given === undefined) continue // skipped, not counted toward accuracy
            bucket.total++
            if (isAnswerCorrect(given, gq.correctAnswer)) bucket.correct++
          }
        }
      }
    }

    const pct = (b: { correct: number; total: number }) => (b.total > 0 ? Math.round((b.correct / b.total) * 100) : null)
    const subjectStrength = {
      rw: pct(subjectTally.rw),
      math: pct(subjectTally.math),
    }

    const openDoubtsCount = await prisma.attemptAnswer.count({ where: { doubtStatus: 'doubt' } })

    return NextResponse.json({
      activityData: days,
      scoreDistribution,
      scoreDistributionACT,
      scoreDistributionSAT,
      hasSAT,
      hasACT,
      avgScoreImprovement,
      subjectStrength,
      openDoubtsCount,
    })
  } catch (error) {
    console.error('GET /api/analytics/platform:', error)
    return NextResponse.json({ error: 'Failed to fetch platform analytics' }, { status: 500 })
  }
}
