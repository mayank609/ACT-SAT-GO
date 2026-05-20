import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml'
]

const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const context = (formData.get('context') as string) || 'questions'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // 1. Validation
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PNG, JPEG, GIF, WEBP, and SVG are allowed.' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    if (buffer.length === 0) {
      return NextResponse.json(
        { error: 'File is empty or corrupted' },
        { status: 400 }
      )
    }

    // 2. Initialize Supabase client (Try Admin client first, then Server client)
    let supabase = createAdminClient()
    if (!supabase) {
      supabase = await createClient()
    }

    // 3. Ensure bucket exists
    try {
      const { data: buckets } = await supabase.storage.listBuckets()
      const exists = buckets?.some((b) => b.name === 'images')
      if (!exists) {
        await supabase.storage.createBucket('images', {
          public: true,
          allowedMimeTypes: ALLOWED_TYPES,
          fileSizeLimit: MAX_SIZE
        })
      }
    } catch (err) {
      console.warn('Failed to verify/create images bucket:', err)
    }

    // 4. Generate unique file path
    const uniqueId = crypto.randomUUID()
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `${context}/${uniqueId}_${cleanFileName}`

    // 5. Upload file
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // 6. Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(storagePath)

    return NextResponse.json({
      url: publicUrl,
      path: storagePath,
      fileName: file.name,
      size: file.size
    })
  } catch (error) {
    console.error('POST /api/images/upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error during upload' },
      { status: 500 }
    )
  }
}
