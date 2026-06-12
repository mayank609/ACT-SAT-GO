import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const LOCAL_STORAGE_PREFIX = '_local_/'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { path } = body as { path?: string }

    if (!path) {
      return NextResponse.json({ error: 'Storage path is required' }, { status: 400 })
    }

    // ── Local filesystem delete ────────────────────────────────────────────────
    if (path.startsWith(LOCAL_STORAGE_PREFIX)) {
      const relPath = path.slice(LOCAL_STORAGE_PREFIX.length)
      const absPath = join(process.cwd(), 'public', 'uploads', relPath)
      if (existsSync(absPath)) {
        await unlink(absPath)
        return NextResponse.json({ success: true, wasDeleted: true })
      }
      return NextResponse.json({ success: true, wasDeleted: false })
    }

    // ── Supabase storage delete ────────────────────────────────────────────────
    // Prefer admin client (bypasses RLS). Fall back to JWT-authenticated client.
    let supabaseClient = createAdminClient()

    if (!supabaseClient) {
      const authHeader = request.headers.get('authorization') ?? ''
      const token = authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : null
      if (token) {
        supabaseClient = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            auth: { autoRefreshToken: false, persistSession: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          }
        )
      }
    }

    if (!supabaseClient) {
      return NextResponse.json(
        { error: 'No storage client available — add SUPABASE_SERVICE_ROLE_KEY to platform/.env' },
        { status: 500 }
      )
    }

    const { data, error } = await supabaseClient.storage.from('images').remove([path])

    if (error) {
      console.error('[images/delete] Supabase deletion error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, wasDeleted: !!(data && data.length > 0) })
  } catch (error) {
    console.error('[images/delete] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error during deletion' }, { status: 500 })
  }
}
