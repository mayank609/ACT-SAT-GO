import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { path } = body

    if (!path) {
      return NextResponse.json({ error: 'Storage path is required' }, { status: 400 })
    }

    // Initialize Supabase client (Try Admin client first, then Server client)
    let supabase = createAdminClient()
    if (!supabase) {
      supabase = await createClient()
    }

    // Delete the file from the 'images' bucket
    const { data, error } = await supabase.storage.from('images').remove([path])

    if (error) {
      console.error('Supabase deletion error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Check if anything was actually deleted (Supabase remove returns a list of deleted objects)
    const wasDeleted = data && data.length > 0

    return NextResponse.json({ success: true, wasDeleted })
  } catch (error) {
    console.error('POST /api/images/delete error:', error)
    return NextResponse.json(
      { error: 'Internal server error during deletion' },
      { status: 500 }
    )
  }
}
