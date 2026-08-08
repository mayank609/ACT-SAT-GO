import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { requireRole, requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const SUBDOMAINS_KEY = 'taxonomy:subdomainsByDomain'
const SKILLS_KEY = 'taxonomy:skillsMap'

type TaxonomyMap = Record<string, string[]>

async function loadMap(key: string): Promise<TaxonomyMap> {
  const raw = await redis.get<string>(key)
  if (!raw) return {}
  return typeof raw === 'string' ? JSON.parse(raw) : (raw as unknown as TaxonomyMap)
}

// GET /api/taxonomy — the shared Domain → Subdomain → Skill overrides admins have
// added on top of the built-in SAT content hierarchy. Any authenticated user may
// read this (needed by the Test Builder's topic/subdomain/skill pickers).
export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (auth instanceof NextResponse) return auth

  try {
    const [subdomainsByDomain, skillsMap] = await Promise.all([loadMap(SUBDOMAINS_KEY), loadMap(SKILLS_KEY)])
    return NextResponse.json({ subdomainsByDomain, skillsMap })
  } catch (error) {
    console.error('GET /api/taxonomy:', error)
    return NextResponse.json({ error: 'Failed to fetch taxonomy' }, { status: 500 })
  }
}

// PUT /api/taxonomy — admin/super-admin only. Body: { subdomainsByDomain?: Map, skillsMap?: Map }.
// Either field may be sent independently and fully replaces that map (the caller
// is expected to send the complete merged map, not a delta).
export async function PUT(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    const result: { subdomainsByDomain?: TaxonomyMap; skillsMap?: TaxonomyMap } = {}

    if ('subdomainsByDomain' in body) {
      const map = body.subdomainsByDomain
      if (typeof map !== 'object' || map === null) {
        return NextResponse.json({ error: 'subdomainsByDomain must be an object' }, { status: 400 })
      }
      await redis.set(SUBDOMAINS_KEY, JSON.stringify(map))
      result.subdomainsByDomain = map
    }

    if ('skillsMap' in body) {
      const map = body.skillsMap
      if (typeof map !== 'object' || map === null) {
        return NextResponse.json({ error: 'skillsMap must be an object' }, { status: 400 })
      }
      await redis.set(SKILLS_KEY, JSON.stringify(map))
      result.skillsMap = map
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('PUT /api/taxonomy:', error)
    return NextResponse.json({ error: 'Failed to update taxonomy' }, { status: 500 })
  }
}
