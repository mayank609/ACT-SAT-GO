import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'
// fs/promises is only available in the Node.js runtime, not Edge.
export const runtime = 'nodejs'

const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]

const MAX_SIZE = 5 * 1024 * 1024 // 5MB

// Paths under public/uploads/ are served by Next.js at /uploads/…
// The "_local_/" prefix on the stored `path` field tells the delete route
// to remove the file from the filesystem instead of from Supabase.
const LOCAL_STORAGE_PREFIX = '_local_/'

function localUploadDir(context: string) {
  return join(process.cwd(), 'public', 'uploads', context)
}

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const context = (formData.get('context') as string) || 'questions'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPEG, GIF, WEBP, SVG.' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    if (buffer.length === 0) {
      return NextResponse.json({ error: 'File is empty or corrupted' }, { status: 400 })
    }

    const uniqueId = crypto.randomUUID()
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const relPath = `${context}/${uniqueId}_${cleanFileName}`

    // ── 1. Try Supabase admin client (bypasses RLS entirely) ──────────────────
    const adminClient = createAdminClient()
    if (adminClient) {
      const result = await supabaseUpload(adminClient, relPath, buffer, file.type)
      if (result.ok) {
        return NextResponse.json({
          url: result.url,
          path: relPath,
          fileName: file.name,
          size: file.size,
        })
      }
      console.warn('[images/upload] Admin-client Supabase upload failed:', result.error)
    } else {
      console.warn(
        '[images/upload] SUPABASE_SERVICE_ROLE_KEY is not set — ' +
        'admin client unavailable. Add it to platform/.env to bypass storage RLS.'
      )
    }

    // ── 2. Try Supabase with the user's JWT (requires storage RLS policy) ─────
    const authHeader = request.headers.get('authorization') ?? ''
    const userToken = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : null

    if (userToken) {
      const jwtClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: { autoRefreshToken: false, persistSession: false },
          global: { headers: { Authorization: `Bearer ${userToken}` } },
        }
      )
      const result = await supabaseUpload(jwtClient, relPath, buffer, file.type)
      if (result.ok) {
        return NextResponse.json({
          url: result.url,
          path: relPath,
          fileName: file.name,
          size: file.size,
        })
      }
      console.warn(
        '[images/upload] JWT-client Supabase upload failed:', result.error,
        '— To fix without the service_role key, run this SQL in Supabase Dashboard → SQL Editor:\n',
        'CREATE POLICY "Authenticated users can upload images" ON storage.objects\n',
        'FOR INSERT TO authenticated WITH CHECK (bucket_id = \'images\');\n',
        'CREATE POLICY "Public read images" ON storage.objects\n',
        'FOR SELECT TO public USING (bucket_id = \'images\');'
      )
    }

    // ── 3. Local filesystem fallback (always works in dev) ────────────────────
    console.log('[images/upload] Falling back to local filesystem storage.')
    await mkdir(localUploadDir(context), { recursive: true })
    await writeFile(join(localUploadDir(context), `${uniqueId}_${cleanFileName}`), buffer)

    const localUrl = `${appBaseUrl()}/uploads/${relPath}`
    return NextResponse.json({
      url: localUrl,
      path: `${LOCAL_STORAGE_PREFIX}${relPath}`,
      fileName: file.name,
      size: file.size,
    })
  } catch (error) {
    console.error('[images/upload] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error during upload' }, { status: 500 })
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function supabaseUpload(
  client: any,
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  // Ensure bucket exists (silently ignored if client lacks permission)
  try {
    const { data: buckets } = await client.storage.listBuckets()
    if (!buckets?.some((b: { name: string }) => b.name === 'images')) {
      await client.storage.createBucket('images', {
        public: true,
        allowedMimeTypes: ALLOWED_TYPES,
        fileSizeLimit: MAX_SIZE,
      })
    }
  } catch {
    // Non-fatal: bucket may already exist or client may lack createBucket permission
  }

  const { error } = await client.storage
    .from('images')
    .upload(storagePath, buffer, { contentType, cacheControl: '3600', upsert: true })

  if (error) return { ok: false, error: error.message }

  const { data: { publicUrl } } = client.storage.from('images').getPublicUrl(storagePath)
  return { ok: true, url: publicUrl }
}
