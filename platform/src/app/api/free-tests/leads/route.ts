import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { requireRole } from '@/lib/auth'
import type { FreeTestLead } from '../register/route'

export const dynamic = 'force-dynamic'

const LEADS_LIST_KEY = 'leads:freeTest:list'
const leadKey = (id: string) => `lead:freeTest:${id}`

// GET /api/free-tests/leads — admin gets all free test leads
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth

  try {
    const leadIds = await redis.lrange(LEADS_LIST_KEY, 0, 500)
    if (!leadIds || leadIds.length === 0) {
      return NextResponse.json({ leads: [] })
    }

    const keys = leadIds.map((id) => leadKey(id))
    const rawLeads = await Promise.all(keys.map((k) => redis.get<string>(k)))

    const leads: FreeTestLead[] = []
    for (const raw of rawLeads) {
      if (raw) {
        try {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
          leads.push(parsed)
        } catch {
          // ignore corrupted entry
        }
      }
    }

    // Sort by registeredAt desc
    leads.sort((a, b) => new Date(b.registeredAt || 0).getTime() - new Date(a.registeredAt || 0).getTime())

    return NextResponse.json({ leads })
  } catch (error) {
    console.error('GET /api/free-tests/leads:', error)
    return NextResponse.json({ error: 'Failed to fetch free test leads' }, { status: 500 })
  }
}

// PATCH /api/free-tests/leads — update lead status or notes (admin only)
export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    const { leadId, leadStatus, notes } = body

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }

    const raw = await redis.get<string>(leadKey(leadId))
    if (!raw) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const lead: FreeTestLead = typeof raw === 'string' ? JSON.parse(raw) : (raw as unknown as FreeTestLead)

    const updated: FreeTestLead = {
      ...lead,
      ...(leadStatus !== undefined ? { leadStatus } : {}),
      ...(notes !== undefined ? { notes: String(notes).trim() } : {}),
    }

    await redis.set(leadKey(leadId), JSON.stringify(updated))

    return NextResponse.json({ success: true, lead: updated })
  } catch (error) {
    console.error('PATCH /api/free-tests/leads:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

// DELETE /api/free-tests/leads — delete lead (admin only)
export async function DELETE(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('leadId')

    if (!leadId) {
      return NextResponse.json({ error: 'leadId parameter is required' }, { status: 400 })
    }

    await Promise.all([
      redis.del(leadKey(leadId)),
      redis.lrem(LEADS_LIST_KEY, 0, leadId),
    ])

    return NextResponse.json({ success: true, message: 'Lead deleted successfully' })
  } catch (error) {
    console.error('DELETE /api/free-tests/leads:', error)
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
