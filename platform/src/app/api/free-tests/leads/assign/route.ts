import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { assignDemoTest, getLead, getLeadView, isDemoUser, resolveDemoTestId, saveLead } from '@/lib/demoLeads'

export const dynamic = 'force-dynamic'

/**
 * POST /api/free-tests/leads/assign  (admin)
 *
 * Body: { leadId: string; testId?: string }
 *
 * (Re)assigns the demo test to a lead's portal account. Used when a lead
 * registered before a demo test was configured, or when the admin wants a
 * different demo test for that student. The test must be PUBLISHED. Any earlier
 * active assignment for that account is deactivated so the student still only
 * sees one test.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth

  try {
    const body = (await request.json()) as { leadId?: string; testId?: string }
    if (!body.leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }

    const view = await getLeadView(body.leadId)
    if (!view) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (!view.userId) {
      return NextResponse.json({ error: 'This lead has no portal account to assign a test to.' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: view.userId }, select: { id: true, permissions: true, deletedAt: true } })
    if (!user || user.deletedAt || !isDemoUser(user)) {
      return NextResponse.json({ error: 'Lead account is not an active demo account.' }, { status: 400 })
    }

    if (view.status === 'Completed') {
      return NextResponse.json({ error: 'This lead has already completed their demo test.' }, { status: 409 })
    }

    const testId = body.testId || (await resolveDemoTestId(view.exam))
    if (!testId) {
      return NextResponse.json({ error: 'No published test is available to assign. Publish a demo test first.' }, { status: 400 })
    }
    const test = await prisma.test.findFirst({ where: { id: testId, status: 'PUBLISHED' }, select: { id: true, title: true } })
    if (!test) {
      return NextResponse.json({ error: 'The selected test is not published.' }, { status: 400 })
    }

    const assignment = await assignDemoTest(user.id, test.id)

    // Keep the Redis snapshot in sync so the list shows the new test immediately.
    const stored = await getLead(view.id)
    if (stored) {
      await saveLead({ ...stored, testId: test.id, testTitle: test.title, assignmentId: assignment.id })
    }

    return NextResponse.json({ success: true, assignmentId: assignment.id, test })
  } catch (error) {
    console.error('POST /api/free-tests/leads/assign:', error)
    return NextResponse.json({ error: 'Failed to assign demo test' }, { status: 500 })
  }
}
