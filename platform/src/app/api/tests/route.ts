import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const tests = await prisma.test.findMany({
      where: { status: 'PUBLISHED' },
      include: {
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: { _count: { select: { questions: true } } },
        },
        _count: { select: { attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ tests })
  } catch (error) {
    console.error('GET /api/tests:', error)
    return NextResponse.json({ error: 'Failed to fetch tests' }, { status: 500 })
  }
}
