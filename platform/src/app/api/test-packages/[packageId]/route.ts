import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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

// GET /api/test-packages/:packageId
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ packageId: string }> },
) {
  const { packageId } = await params
  try {
    const pkg = await prisma.testPackage.findUnique({
      where: { id: packageId },
      include: PACKAGE_INCLUDE,
    })
    if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    return NextResponse.json({ package: pkg })
  } catch (error) {
    console.error('GET /api/test-packages/[packageId]:', error)
    return NextResponse.json({ error: 'Failed to fetch package' }, { status: 500 })
  }
}

// PATCH /api/test-packages/:packageId
// Body: { title?, description?, testIds? }  — testIds (if present) replaces the set.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ packageId: string }> },
) {
  const { packageId } = await params
  let body: { title?: string; description?: string | null; testIds?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const existing = await prisma.testPackage.findUnique({ where: { id: packageId } })
    if (!existing) return NextResponse.json({ error: 'Package not found' }, { status: 404 })

    const ops = []
    if (body.title !== undefined || body.description !== undefined) {
      ops.push(
        prisma.testPackage.update({
          where: { id: packageId },
          data: {
            ...(body.title !== undefined ? { title: body.title.trim() } : {}),
            ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
          },
        }),
      )
    }
    if (Array.isArray(body.testIds)) {
      const uniqueTestIds = [...new Set(body.testIds)]
      ops.push(prisma.testPackageItem.deleteMany({ where: { packageId } }))
      if (uniqueTestIds.length > 0) {
        ops.push(
          prisma.testPackageItem.createMany({
            data: uniqueTestIds.map((testId, idx) => ({ packageId, testId, orderIndex: idx })),
          }),
        )
      }
    }
    if (ops.length > 0) await prisma.$transaction(ops)

    const pkg = await prisma.testPackage.findUnique({
      where: { id: packageId },
      include: PACKAGE_INCLUDE,
    })
    return NextResponse.json({ package: pkg })
  } catch (error) {
    console.error('PATCH /api/test-packages/[packageId]:', error)
    return NextResponse.json({ error: 'Failed to update package' }, { status: 500 })
  }
}

// DELETE /api/test-packages/:packageId
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ packageId: string }> },
) {
  const { packageId } = await params
  try {
    await prisma.testPackage.delete({ where: { id: packageId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/test-packages/[packageId]:', error)
    return NextResponse.json({ error: 'Failed to delete package' }, { status: 500 })
  }
}
