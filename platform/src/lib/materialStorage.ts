import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { createAdminClient } from '@/lib/supabase/admin'

// Where protected PDFs live. They go to a PRIVATE Supabase bucket (never a
// public URL) and are only read back by our API. Without a service-role key
// (local dev) they fall back to a folder outside public/, so they can't be
// fetched directly either.

const BUCKET = 'study-materials'
const LOCAL_PREFIX = '_local_/'
const localRoot = () => join(process.cwd(), '.data', 'materials')

let bucketReady: Promise<void> | null = null
function ensureBucket(client: NonNullable<ReturnType<typeof createAdminClient>>) {
  bucketReady ??= (async () => {
    const { data } = await client.storage.getBucket(BUCKET)
    if (data) return
    const { error } = await client.storage.createBucket(BUCKET, { public: false, allowedMimeTypes: ['application/pdf'] })
    if (error && !/exists/i.test(error.message)) throw new Error(error.message)
  })().catch((e) => { bucketReady = null; throw e })
  return bucketReady
}

/** Stores the PDF and returns the path to keep in StudyMaterial.storagePath. */
export async function putMaterialFile(key: string, data: Uint8Array): Promise<string> {
  const client = createAdminClient()
  if (client) {
    try {
      await ensureBucket(client)
      const { error } = await client.storage.from(BUCKET).upload(key, data, { contentType: 'application/pdf', upsert: false })
      if (!error) return key
      console.warn('[materials] Supabase upload failed, using local storage:', error.message)
    } catch (e) {
      console.warn('[materials] Supabase storage unavailable, using local storage:', (e as Error).message)
    }
  } else {
    console.warn('[materials] SUPABASE_SERVICE_ROLE_KEY not set — storing the PDF on local disk')
  }
  const file = join(localRoot(), key)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, data)
  return LOCAL_PREFIX + key
}

export async function getMaterialFile(path: string): Promise<Uint8Array> {
  if (path.startsWith(LOCAL_PREFIX)) return new Uint8Array(await readFile(join(localRoot(), path.slice(LOCAL_PREFIX.length))))
  const client = createAdminClient()
  if (!client) throw new Error('Supabase storage is not configured')
  const { data, error } = await client.storage.from(BUCKET).download(path)
  if (error || !data) throw new Error(error?.message || 'File not found in storage')
  return new Uint8Array(await data.arrayBuffer())
}

export async function deleteMaterialFile(path: string): Promise<void> {
  try {
    if (path.startsWith(LOCAL_PREFIX)) await unlink(join(localRoot(), path.slice(LOCAL_PREFIX.length)))
    else await createAdminClient()?.storage.from(BUCKET).remove([path])
  } catch (e) {
    console.warn('[materials] could not delete stored file', path, (e as Error).message)
  }
}
