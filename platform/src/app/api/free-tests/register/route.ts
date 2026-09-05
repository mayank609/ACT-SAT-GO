import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  assignDemoTest,
  loadConfig,
  resolveDemoTestId,
  saveLead,
  DEMO_ACCOUNT_TYPE,
  type FreeTestLead,
} from '@/lib/demoLeads'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8

/**
 * POST /api/free-tests/register  (public — called from the website)
 *
 * Body: { name, email, phone, password, exam?, grade?, school?, targetScore? }
 *
 * Creates the demo student's portal account (Supabase auth + Prisma User with
 * permissions.accountType = 'DEMO'), assigns the configured demo test with a
 * single attempt, and stores the lead for the admin panel.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const phone = String(body.phone ?? '').trim()
  const password = String(body.password ?? '')
  const exam = String(body.exam ?? 'SAT').trim().toUpperCase() || 'SAT'
  const grade = body.grade ? String(body.grade).trim() : ''
  const school = body.school ? String(body.school).trim() : ''
  const targetScore = body.targetScore ? String(body.targetScore).trim() : ''

  if (!name || !email || !phone) {
    return NextResponse.json(
      { error: 'Name, email and phone number are required.' },
      { status: 400 }
    )
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Please choose a password with at least ${MIN_PASSWORD} characters. You will use it to log in to the test portal.` },
      { status: 400 }
    )
  }

  try {
    // 1. Duplicate check — one demo account per email.
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, permissions: true, deletedAt: true } })
    if (existing) {
      const perms = (existing.permissions ?? {}) as Record<string, unknown>
      const isDemo = perms.accountType === DEMO_ACCOUNT_TYPE
      return NextResponse.json(
        {
          error: isDemo
            ? 'You have already registered for the free demo test. Log in to the test portal with your email and password.'
            : 'An account with this email already exists. Please log in to the test portal instead.',
          code: 'ALREADY_REGISTERED',
        },
        { status: 409 }
      )
    }

    // 2. Resolve which test is the demo test for this exam.
    const config = await loadConfig()
    const demoTestId = await resolveDemoTestId(exam, config)
    const demoTest = demoTestId
      ? await prisma.test.findUnique({ where: { id: demoTestId }, select: { id: true, title: true, category: true } })
      : null

    // 3. Supabase auth account with the student's chosen password.
    const supabaseAdmin = createAdminClient()
    let userId: string = randomUUID()
    let accountWarning: string | null = null

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role: 'student', accountType: DEMO_ACCOUNT_TYPE.toLowerCase() },
      })
      if (error) {
        const msg = error.message || ''
        const duplicate = /already|exists|registered/i.test(msg)
        return NextResponse.json(
          {
            error: duplicate
              ? 'An account with this email already exists. Please log in to the test portal instead.'
              : `Could not create your account: ${msg}`,
            code: duplicate ? 'ALREADY_REGISTERED' : 'AUTH_ERROR',
          },
          { status: duplicate ? 409 : 400 }
        )
      }
      if (data?.user?.id) userId = data.user.id
    } else {
      accountWarning = 'SUPABASE_SERVICE_ROLE_KEY is not configured — lead saved but no login account was created.'
      console.warn(`/api/free-tests/register: ${accountWarning}`)
    }

    const leadId = `lead_${randomUUID().replace(/-/g, '').slice(0, 12)}_${Date.now()}`
    const now = new Date().toISOString()

    // 4. Prisma profile mirroring the auth user. Roll back the auth user if this fails
    //    so we never leave an orphaned login that could hit the admin auto-provisioning path.
    try {
      await prisma.user.create({
        data: {
          id: userId,
          name,
          email,
          role: 'STUDENT',
          permissions: {
            displayName: name,
            accountType: DEMO_ACCOUNT_TYPE,
            phone,
            ...(grade ? { grade } : {}),
            ...(school ? { schoolName: school } : {}),
            demoLead: { leadId, exam, grade, school, targetScore, phone, registeredAt: now, source: 'website' },
          },
        },
      })
    } catch (dbErr) {
      console.error('/api/free-tests/register: prisma.user.create failed, rolling back auth user', dbErr)
      if (supabaseAdmin) {
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {})
      }
      return NextResponse.json({ error: 'Could not create your account. Please try again.' }, { status: 500 })
    }

    // 5. One-attempt assignment of the demo test.
    let assignmentId: string | null = null
    if (demoTest) {
      try {
        const a = await assignDemoTest(userId, demoTest.id)
        assignmentId = a.id
      } catch (assignErr) {
        console.error('/api/free-tests/register: assignDemoTest failed', assignErr)
      }
    }

    // 6. Lead snapshot for the admin panel.
    const lead: FreeTestLead = {
      id: leadId,
      name,
      email,
      phone,
      exam,
      grade,
      school,
      targetScore,
      testId: demoTest?.id ?? '',
      testTitle: demoTest?.title ?? '',
      status: 'Registered',
      leadStatus: 'New',
      registeredAt: now,
      startedAt: null,
      completedAt: null,
      totalScore: null,
      maxScore: null,
      percentage: null,
      notes: '',
      userId,
      accountCreated: Boolean(supabaseAdmin),
      assignmentId,
      attemptId: null,
      source: 'website',
    }
    await saveLead(lead)

    return NextResponse.json(
      {
        success: true,
        leadId,
        userId,
        email,
        accountCreated: Boolean(supabaseAdmin),
        test: demoTest ? { id: demoTest.id, title: demoTest.title, category: demoTest.category } : null,
        testAssigned: Boolean(assignmentId),
        ...(accountWarning ? { warning: accountWarning } : {}),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/free-tests/register:', error)
    return NextResponse.json({ error: 'Failed to register for the free demo test.' }, { status: 500 })
  }
}
