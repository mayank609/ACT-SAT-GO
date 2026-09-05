import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import {
  buildLeadsView,
  deleteLeadRecord,
  getLead,
  isDemoUser,
  saveLead,
  type FreeTestLead,
} from '@/lib/demoLeads'

export const dynamic = 'force-dynamic'

const STAFF = ['ADMIN', 'SUPER_ADMIN'] as const

// GET /api/free-tests/leads — all demo-test leads with live account/attempt state
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, [...STAFF])
  if (auth instanceof NextResponse) return auth

  try {
    const leads = await buildLeadsView()

    const total = leads.length
    const completed = leads.filter((l) => l.status === 'Completed').length
    const inProgress = leads.filter((l) => l.status === 'In-Progress').length
    const enrolled = leads.filter((l) => l.leadStatus === 'Enrolled').length
    const pct = leads.map((l) => l.percentage).filter((p): p is number => p != null)
    const summary = {
      total,
      registered: total - completed - inProgress,
      inProgress,
      completed,
      enrolled,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
      conversionRate: total ? Math.round((enrolled / total) * 100) : 0,
      avgPercentage: pct.length ? Math.round(pct.reduce((a, b) => a + b, 0) / pct.length) : null,
    }

    return NextResponse.json({ leads, summary })
  } catch (error) {
    console.error('GET /api/free-tests/leads:', error)
    return NextResponse.json({ error: 'Failed to fetch free test leads' }, { status: 500 })
  }
}

// PATCH /api/free-tests/leads — update CRM fields (leadStatus, notes)
export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, [...STAFF])
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    const { leadId, leadStatus, notes } = body as { leadId?: string; leadStatus?: FreeTestLead['leadStatus']; notes?: string }

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }

    // Leads that only exist as demo accounts (no Redis row yet) get one created on first edit.
    let lead = await getLead(leadId)
    if (!lead) {
      const all = await buildLeadsView()
      const view = all.find((l) => l.id === leadId || l.userId === leadId)
      if (!view) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      lead = view
    }

    const updated: FreeTestLead = {
      ...lead,
      ...(leadStatus !== undefined ? { leadStatus } : {}),
      ...(notes !== undefined ? { notes: String(notes).trim() } : {}),
    }
    await saveLead(updated)

    return NextResponse.json({ success: true, lead: updated })
  } catch (error) {
    console.error('PATCH /api/free-tests/leads:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

// DELETE /api/free-tests/leads?leadId=… — remove the lead and revoke its demo login
export async function DELETE(request: NextRequest) {
  const auth = await requireRole(request, [...STAFF])
  if (auth instanceof NextResponse) return auth

  try {
    const leadId = new URL(request.url).searchParams.get('leadId')
    if (!leadId) {
      return NextResponse.json({ error: 'leadId parameter is required' }, { status: 400 })
    }

    const lead = await getLead(leadId)
    const userId = lead?.userId ?? (leadId.startsWith('user_') ? leadId.slice(5) : null)

    let accountRevoked = false
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, permissions: true, deletedAt: true } })
      // Only ever touch DEMO accounts here — never a real enrolled student.
      if (user && isDemoUser(user) && !user.deletedAt) {
        await prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } })
        await prisma.testAssignment.updateMany({ where: { studentId: userId }, data: { isActive: false } })
        // Soft-deleted users resolve to "unauthenticated" in getCurrentUser, so every
        // API call from that login fails from now on and the portal signs them out.
        accountRevoked = true
      }
    }

    if (lead) await deleteLeadRecord(leadId)

    return NextResponse.json({ success: true, message: 'Lead deleted successfully', accountRevoked })
  } catch (error) {
    console.error('DELETE /api/free-tests/leads:', error)
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
