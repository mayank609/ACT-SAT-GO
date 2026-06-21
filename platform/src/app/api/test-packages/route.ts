import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

// Shared include so list + detail return the same shape (tests with question/time counts).
const PACKAGE_INCLUDE = {
  items: {
    orderBy: { orderIndex: 'asc' as const },
    include: {
      test: {
        include: {
          sections: {
            orderBy: { orderIndex: 'asc' as const },
            include: { _count: { select: { questions: true } } },
          },
        },
      },
    },
  },
}

// GET /api/test-packages  → all packages with their tests
export async function GET() {
  try {
    const packages = await prisma.testPackage.findMany({
      include: PACKAGE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ packages })
  } catch (error) {
    console.error('GET /api/test-packages:', error)
    return NextResponse.json({ error: 'Failed to fetch packages' }, { status: 500 })
  }
}

// POST /api/test-packages
// Body: { title, description?, testIds: string[], createdById }
export async function POST(request: NextRequest) {
  let body: { title?: string; description?: string | null; testIds?: string[]; createdById?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, description, testIds, createdById } = body

  if (!title?.trim() || !createdById || !Array.isArray(testIds) || testIds.length === 0) {
    return NextResponse.json(
      { error: 'title, createdById, and a non-empty testIds array are required' },
      { status: 400 },
    )
  }

  try {
    const packageId = randomUUID()
    // De-dupe while preserving the caller's ordering.
    const uniqueTestIds = [...new Set(testIds)]

    await prisma.$transaction([
      prisma.testPackage.create({
        data: {
          id: packageId,
          title: title.trim(),
          description: description?.trim() || null,
          createdById,
        },
      }),
      prisma.testPackageItem.createMany({
        data: uniqueTestIds.map((testId, idx) => ({ packageId, testId, orderIndex: idx })),
      }),
    ])

    const pkg = await prisma.testPackage.findUnique({
      where: { id: packageId },
      include: PACKAGE_INCLUDE,
    })

    return NextResponse.json({ package: pkg }, { status: 201 })
  } catch (error) {
    console.error('POST /api/test-packages:', error)
    return NextResponse.json({ error: 'Failed to create package' }, { status: 500 })
  }
}
