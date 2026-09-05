import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { randomUUID } from 'crypto'
import type { FreeTestConfig } from '../route'
import { FALLBACK_SAT_TEST, FALLBACK_ACT_TEST } from '@/data/mockDiagnosticTest'

export const dynamic = 'force-dynamic'

const FREE_TEST_CONFIG_KEY = 'settings:freeTests'
const LEADS_LIST_KEY = 'leads:freeTest:list'
const leadKey = (id: string) => `lead:freeTest:${id}`

export interface FreeTestLead {
  id: string
  name: string
  email: string
  phone: string
  exam: string
  grade?: string
  school?: string
  targetScore?: string
  testId: string
  testTitle: string
  status: 'Registered' | 'In-Progress' | 'Completed' | 'Abandoned'
  leadStatus: 'New' | 'Contacted' | 'Follow-Up' | 'Enrolled' | 'Archived'
  registeredAt: string
  startedAt?: string | null
  completedAt?: string | null
  totalScore?: number | null
  maxScore?: number | null
  percentage?: number | null
  timeSpentSeconds?: number | null
  sectionScores?: Array<{
    sectionId: string
    sectionName: string
    score: number
    maxScore: number
    correct: number
    total: number
  }>
  answers?: Record<string, {
    questionId: string
    answerGiven: any
    isCorrect: boolean
    timeSpentSeconds?: number
  }>
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, exam, grade, school, targetScore, requestedTestId } = body

    if (!name || !email || !phone) {
      return NextResponse.json(
        { error: 'Name, email, and phone number are required to register for the free test.' },
        { status: 400 }
      )
    }

    const normalizedExam = String(exam || 'SAT').toUpperCase()
    const fallbackTest = normalizedExam === 'ACT' ? FALLBACK_ACT_TEST : FALLBACK_SAT_TEST

    // Resolve test configuration
    let selectedTestId = requestedTestId
    try {
      const raw = await redis.get<string>(FREE_TEST_CONFIG_KEY)
      const config: FreeTestConfig | null = raw
        ? (typeof raw === 'string' ? JSON.parse(raw) : (raw as unknown as FreeTestConfig))
        : null

      if (!selectedTestId && config) {
        if (config.examTests && config.examTests[normalizedExam as keyof typeof config.examTests]) {
          selectedTestId = config.examTests[normalizedExam as keyof typeof config.examTests]
        }
        if (!selectedTestId) {
          selectedTestId = config.activeTestId
        }
      }
    } catch {
      // Redis config lookup fallback
    }

    let resolvedTestInfo = {
      id: fallbackTest.id,
      title: fallbackTest.title,
      category: fallbackTest.category,
      description: fallbackTest.description,
      sections: fallbackTest.sections.map((s) => ({
        id: s.id,
        name: s.name,
        durationMinutes: s.durationMinutes,
        _count: { questions: s.questions.length },
      })),
    }

    // Try finding test in database if ID is specified or published test exists
    try {
      if (selectedTestId && selectedTestId !== 'sat_diagnostic_default' && selectedTestId !== 'act_diagnostic_default') {
        const test = await prisma.test.findUnique({
          where: { id: selectedTestId },
          select: {
            id: true,
            title: true,
            category: true,
            description: true,
            sections: {
              select: {
                id: true,
                name: true,
                durationMinutes: true,
                _count: { select: { questions: true } },
              },
            },
          },
        })
        if (test) {
          resolvedTestInfo = {
            id: test.id,
            title: test.title,
            category: test.category || normalizedExam,
            description: test.description || '',
            sections: test.sections,
          }
        }
      } else if (!selectedTestId) {
        const firstTest = await prisma.test.findFirst({
          where: { status: 'PUBLISHED' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            category: true,
            description: true,
            sections: {
              select: {
                id: true,
                name: true,
                durationMinutes: true,
                _count: { select: { questions: true } },
              },
            },
          },
        })
        if (firstTest) {
          resolvedTestInfo = {
            id: firstTest.id,
            title: firstTest.title,
            category: firstTest.category || normalizedExam,
            description: firstTest.description || '',
            sections: firstTest.sections,
          }
        }
      }
    } catch (dbErr) {
      console.warn('Prisma lookup failed, falling back to mock test:', dbErr)
    }

    const leadId = `lead_${randomUUID().replace(/-/g, '').slice(0, 12)}_${Date.now()}`
    const now = new Date().toISOString()

    const newLead: FreeTestLead = {
      id: leadId,
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: String(phone).trim(),
      exam: String(exam || resolvedTestInfo.category || 'SAT').toUpperCase(),
      grade: grade ? String(grade).trim() : '',
      school: school ? String(school).trim() : '',
      targetScore: targetScore ? String(targetScore).trim() : '',
      testId: resolvedTestInfo.id,
      testTitle: resolvedTestInfo.title,
      status: 'Registered',
      leadStatus: 'New',
      registeredAt: now,
      startedAt: null,
      completedAt: null,
      totalScore: null,
      maxScore: null,
      percentage: null,
      timeSpentSeconds: 0,
      sectionScores: [],
      answers: {},
      notes: '',
    }

    // Save in Redis
    try {
      await Promise.all([
        redis.set(leadKey(leadId), JSON.stringify(newLead)),
        redis.lpush(LEADS_LIST_KEY, leadId),
      ])
    } catch (redisErr) {
      console.error('Redis save failed in /api/free-tests/register:', redisErr)
    }

    return NextResponse.json({
      success: true,
      leadId,
      lead: newLead,
      test: resolvedTestInfo,
    })
  } catch (error) {
    console.error('POST /api/free-tests/register:', error)
    return NextResponse.json({ error: 'Failed to register lead for free test' }, { status: 500 })
  }
}
