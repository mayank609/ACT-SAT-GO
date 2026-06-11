/**
 * Bootstrap / reset a SUPER_ADMIN login.
 *
 * Creates (or updates) a Supabase Auth account AND a matching local DB user row
 * whose `id` equals the Supabase auth id — which is what the login lookup
 * (`GET /api/users/[id]`) requires.
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts [email] [password] [name]
 *
 * Defaults: admin@actsat.com / Admin@12345 / "Super Admin"
 *
 * Non-destructive: if a different DB row already owns the email (e.g. from the
 * seed), its email is renamed to free it up — no rows are deleted, so related
 * tests/attempts are preserved.
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const EMAIL = (process.argv[2] ?? 'admin@actsat.com').toLowerCase()
const PASSWORD = process.argv[3] ?? 'Admin@12345'
const NAME = process.argv[4] ?? 'Super Admin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function resolveAuthUserId(): Promise<string> {
  // Try to create the auth user first.
  const { data, error } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: NAME, role: 'super_admin' },
  })

  if (!error && data.user) {
    console.log('✅ Supabase Auth user created.')
    return data.user.id
  }

  // Already exists → locate them and reset the password.
  if (error && /already|registered|exists/i.test(error.message)) {
    let page = 1
    for (;;) {
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
      if (listErr) throw listErr
      const found = list.users.find((u) => u.email?.toLowerCase() === EMAIL)
      if (found) {
        await supabase.auth.admin.updateUserById(found.id, {
          password: PASSWORD,
          email_confirm: true,
          user_metadata: { name: NAME, role: 'super_admin' },
        })
        console.log('✅ Existing Supabase Auth user found — password reset.')
        return found.id
      }
      if (list.users.length < 200) break
      page++
    }
    throw new Error('Supabase reports the email exists but it could not be located.')
  }

  throw error
}

async function main() {
  const authId = await resolveAuthUserId()

  // Free the email if a *different* DB row currently owns it (non-destructive).
  const existingByEmail = await prisma.user.findUnique({ where: { email: EMAIL } })
  if (existingByEmail && existingByEmail.id !== authId) {
    const legacyEmail = `legacy+${existingByEmail.id.slice(0, 8)}_${EMAIL}`
    await prisma.user.update({
      where: { id: existingByEmail.id },
      data: { email: legacyEmail },
    })
    console.log(`ℹ️  Renamed pre-existing DB row's email to "${legacyEmail}" (kept its data).`)
  }

  await prisma.user.upsert({
    where: { id: authId },
    update: { email: EMAIL, name: NAME, role: 'SUPER_ADMIN' },
    create: {
      id: authId,
      email: EMAIL,
      name: NAME,
      role: 'SUPER_ADMIN',
      permissions: { displayName: NAME },
    },
  })

  console.log('\n────────────────────────────────────────')
  console.log('  ✅ SUPER_ADMIN ready to log in')
  console.log(`     Email:    ${EMAIL}`)
  console.log(`     Password: ${PASSWORD}`)
  console.log('────────────────────────────────────────\n')
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e?.message ?? e)
    process.exitCode = 1
  })
  .finally(() => pool.end())
