import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const FREE_TEST_CONFIG_KEY = 'settings:freeTests'

export interface FreeTestConfig {
  activeTestId: string | null
  examTests: {
    SAT?: string | null
    ACT?: string | null
    AP?: string | null
    GENERAL?: string | null
  }
  bannerTitle: string
  bannerSubtitle: string
  instructions: string
  activeOnWebsite: boolean
}

const DEFAULT_CONFIG: FreeTestConfig = {
  activeTestId: null,
  examTests: {
    SAT: null,
    ACT: null,
    AP: null,
  },
  bannerTitle: 'Free Full-Length Diagnostic Test',
  bannerSubtitle: 'Experience the real exam interface, get instant detailed analytics, and identify your exact strengths and weak areas.',
  instructions: 'This is a timed diagnostic test designed to simulate official exam conditions. Work carefully and manage your time wisely.',
  activeOnWebsite: true,
}

// GET /api/free-tests — get configuration and list of available tests
export async function GET() {
  try {
    const raw = await redis.get<string>(FREE_TEST_CONFIG_KEY)
    let config: FreeTestConfig = raw
      ? (typeof raw === 'string' ? JSON.parse(raw) : (raw as unknown as FreeTestConfig))
      : DEFAULT_CONFIG

    // If no active test is set yet, pick the first published test as default
    const publishedTests = await prisma.test.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        category: true,
        subCategory: true,
        description: true,
        createdAt: true,
        sections: {
          select: {
            id: true,
            name: true,
            durationMinutes: true,
            _count: { select: { questions: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!config.activeTestId && publishedTests.length > 0) {
      config = { ...config, activeTestId: publishedTests[0].id }
    }

    // Resolve details for currently configured active tests
    const activeTestDetails: Record<string, any> = {}
    for (const [exam, testId] of Object.entries(config.examTests || {})) {
      if (testId) {
        const found = publishedTests.find((t) => t.id === testId)
        if (found) activeTestDetails[exam] = found
      }
    }
    if (config.activeTestId) {
      const found = publishedTests.find((t) => t.id === config.activeTestId)
      if (found) activeTestDetails.DEFAULT = found
    }

    return NextResponse.json({
      config,
      activeTestDetails,
      availableTests: publishedTests,
    })
  } catch (error) {
    console.error('GET /api/free-tests:', error)
    return NextResponse.json({ error: 'Failed to fetch free test settings' }, { status: 500 })
  }
}

// POST /api/free-tests — update free test configuration (admin only)
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    const raw = await redis.get<string>(FREE_TEST_CONFIG_KEY)
    const existing: FreeTestConfig = raw
      ? (typeof raw === 'string' ? JSON.parse(raw) : (raw as unknown as FreeTestConfig))
      : DEFAULT_CONFIG

    const updated: FreeTestConfig = {
      ...existing,
      ...(body.activeTestId !== undefined ? { activeTestId: body.activeTestId } : {}),
      ...(body.examTests ? { examTests: { ...existing.examTests, ...body.examTests } } : {}),
      ...(body.bannerTitle !== undefined ? { bannerTitle: String(body.bannerTitle).trim() } : {}),
      ...(body.bannerSubtitle !== undefined ? { bannerSubtitle: String(body.bannerSubtitle).trim() } : {}),
      ...(body.instructions !== undefined ? { instructions: String(body.instructions).trim() } : {}),
      ...(body.activeOnWebsite !== undefined ? { activeOnWebsite: Boolean(body.activeOnWebsite) } : {}),
    }

    await redis.set(FREE_TEST_CONFIG_KEY, JSON.stringify(updated))
    return NextResponse.json({ success: true, config: updated })
  } catch (error) {
    console.error('POST /api/free-tests:', error)
    return NextResponse.json({ error: 'Failed to update free test settings' }, { status: 500 })
  }
}
