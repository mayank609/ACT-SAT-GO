import { redis } from '@/lib/redis'

// Official SAT Weekend test dates published by College Board
// (satsuite.collegeboard.org/sat/dates-deadlines, checked 13 Oct 2026).
// Used when the live page can't be read.
const PUBLISHED_SAT_DATES = [
  '2026-10-03', '2026-11-07', '2026-12-05',
  '2027-03-06', '2027-05-01', '2027-06-05',
  // Anticipated 2027-28 dates
  '2027-08-28', '2027-09-18', '2027-10-09', '2027-11-06', '2027-12-04',
  '2028-03-04', '2028-05-06', '2028-06-03',
]

const CB_URL = 'https://satsuite.collegeboard.org/sat/dates-deadlines'
const CACHE_KEY = 'satDates:collegeboard'
const CACHE_TTL = 60 * 60 * 24 // re-read the College Board page once a day
const SAVED_KEY = 'settings:satTestDates' // dates added in the super admin console

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

// Pulls every "Month D, YYYY" date off the page and keeps the Saturdays: SAT
// Weekend tests are always on a Saturday, while the registration and change
// deadlines listed next to them never are.
export function parseSatDates(html: string): string[] {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
  const re = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),\s+(20\d{2})/g
  const out = new Set<string>()
  for (const m of text.matchAll(re)) {
    const month = MONTHS[m[1].toLowerCase()]
    const day = Number(m[2])
    const year = Number(m[3])
    const d = new Date(Date.UTC(year, month - 1, day))
    if (d.getUTCMonth() !== month - 1 || d.getUTCDay() !== 6) continue
    out.add(d.toISOString().slice(0, 10))
  }
  return [...out].sort()
}

async function fromCollegeBoard(): Promise<string[] | null> {
  try {
    const cached = await redis.get<string>(CACHE_KEY)
    if (cached) return typeof cached === 'string' ? JSON.parse(cached) : (cached as unknown as string[])
  } catch { /* fall through to a live read */ }
  try {
    const res = await fetch(CB_URL, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) return null
    const dates = parseSatDates(await res.text())
    if (dates.length < 3) return null // page layout changed; don't trust a near-empty read
    await redis.set(CACHE_KEY, JSON.stringify(dates), { ex: CACHE_TTL }).catch(() => {})
    return dates
  } catch {
    return null
  }
}

/** Upcoming official SAT dates (YYYY-MM-DD, soonest first). */
export async function upcomingSatDates(): Promise<{ dates: string[]; source: 'collegeboard' | 'published' }> {
  const live = await fromCollegeBoard()
  let saved: string[] = []
  try {
    const raw = await redis.get<string>(SAVED_KEY)
    if (raw) saved = typeof raw === 'string' ? JSON.parse(raw) : (raw as unknown as string[])
  } catch { /* optional */ }
  const today = new Date().toISOString().slice(0, 10)
  const all = new Set([...(live ?? PUBLISHED_SAT_DATES), ...saved])
  return {
    dates: [...all].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today).sort(),
    source: live ? 'collegeboard' : 'published',
  }
}
