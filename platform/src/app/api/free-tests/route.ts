import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { getCurrentUser, requireRole } from '@/lib/auth'
import { FREE_TEST_CONFIG_KEY, loadConfig, type FreeTestConfig } from '@/lib/demoLeads'

export const dynamic = 'force-dynamic'

export type { FreeTestConfig } from '@/lib/demoLeads'

/**
 * GET /api/free-tests — demo test configuration.
 *
 * Public (the website reads the banner copy + activeOnWebsite flag). The list of
 * published tests and resolved test details are only returned to admin callers
 * so the test catalogue is never exposed anonymously.
 */
export async function GET(request: NextRequest) {
  try {
    const config = await loadConfig()
    const requester = await getCurrentUser(request).catch(() => null)
    const isStaff = requester?.role === 'ADMIN' || requester?.role === 'SUPER_ADMIN'

    if (!isStaff) {
      return NextResponse.json({
        config: {
          bannerTitle: config.bannerTitle,
          bannerSubtitle: config.bannerSubtitle,
          instructions: config.instructions,
          activeOnWebsite: config.activeOnWebsite,
        },
      })
    }

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
          select: { id: true, name: true, durationMinutes: true, _count: { select: { questions: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const activeTestDetails: Record<string, unknown> = {}
    for (const [exam, testId] of Object.entries(config.examTests || {})) {
      if (!testId) continue
      const found = publishedTests.find((t) => t.id === testId)
      if (found) activeTestDetails[exam] = found
    }
    if (config.activeTestId) {
      const found = publishedTests.find((t) => t.id === config.activeTestId)
      if (found) activeTestDetails.DEFAULT = found
    }

    return NextResponse.json({ config, activeTestDetails, availableTests: publishedTests })
  } catch (error) {
    console.error('GET /api/free-tests:', error)
    return NextResponse.json({ error: 'Failed to fetch free test settings' }, { status: 500 })
  }
}

// POST /api/free-tests — update demo test configuration (admin only)
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth

  try {
    const body = (await request.json()) as Partial<FreeTestConfig>
    const existing = await loadConfig()

    const updated: FreeTestConfig = {
      ...existing,
      ...(body.activeTestId !== undefined ? { activeTestId: body.activeTestId || null } : {}),
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
