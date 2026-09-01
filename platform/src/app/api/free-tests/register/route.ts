import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { randomUUID } from 'crypto'
import type { FreeTestConfig } from '../route'

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

    // Resolve test configuration
    const raw = await redis.get<string>(FREE_TEST_CONFIG_KEY)
    const config: FreeTestConfig | null = raw
      ? (typeof raw === 'string' ? JSON.parse(raw) : (raw as unknown as FreeTestConfig))
      : null

    let selectedTestId = requestedTestId

    if (!selectedTestId && config) {
      const normalizedExam = String(exam || 'SAT').toUpperCase()
      if (config.examTests && config.examTests[normalizedExam as keyof typeof config.examTests]) {
        selectedTestId = config.examTests[normalizedExam as keyof typeof config.examTests]
      }
      if (!selectedTestId) {
        selectedTestId = config.activeTestId
      }
    }

    // If still no testId, find the first published test
    if (!selectedTestId) {
      const firstTest = await prisma.test.findFirst({
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true },
      })
      if (!firstTest) {
        return NextResponse.json(
          { error: 'No free test is currently available. Please contact support.' },
          { status: 404 }
        )
      }
      selectedTestId = firstTest.id
    }

    // Verify test exists
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

    if (!test) {
      return NextResponse.json({ error: 'Selected test not found' }, { status: 404 })
    }

    const leadId = `lead_${randomUUID().replace(/-/g, '').slice(0, 12)}_${Date.now()}`
    const now = new Date().toISOString()

    const newLead: FreeTestLead = {
      id: leadId,
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: String(phone).trim(),
      exam: String(exam || test.category || 'SAT').toUpperCase(),
      grade: grade ? String(grade).trim() : '',
      school: school ? String(school).trim() : '',
      targetScore: targetScore ? String(targetScore).trim() : '',
      testId: test.id,
      testTitle: test.title,
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
    await Promise.all([
      redis.set(leadKey(leadId), JSON.stringify(newLead)),
      redis.lpush(LEADS_LIST_KEY, leadId),
    ])

    return NextResponse.json({
      success: true,
      lead: newLead,
      test: {
        id: test.id,
        title: test.title,
        category: test.category,
        description: test.description,
        sections: test.sections,
      },
    })
  } catch (error) {
    console.error('POST /api/free-tests/register:', error)
    return NextResponse.json({ error: 'Failed to register lead for free test' }, { status: 500 })
  }
}
