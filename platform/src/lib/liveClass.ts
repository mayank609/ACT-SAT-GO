import { createHmac, randomUUID } from 'crypto'
import { redis } from '@/lib/redis'

/**
 * Live classes run on 100ms (https://www.100ms.live). The portal creates one
 * 100ms room per class and opens 100ms's ready-made meeting screen (video,
 * audio, mute, screen share, chat, recording, whiteboard) inside the page.
 *
 * Setup lives in Render env vars, from the 100ms dashboard (Developer section):
 *   HMS_ACCESS_KEY, HMS_APP_SECRET  — app access key and secret
 *   HMS_TEMPLATE_ID                 — the template rooms are created from
 *   HMS_SUBDOMAIN                   — e.g. "actsatgo" for actsatgo.app.100ms.live
 *   HMS_HOST_ROLE, HMS_GUEST_ROLE   — role names in that template (default host / guest)
 */
const API = 'https://api.100ms.live/v2'
const KEY = 'liveClasses'
const CLASS_TTL = 60 * 60 * 6 // a forgotten class drops off after 6 hours

export interface LiveClass {
  roomId: string
  studentId: string
  studentName: string
  tutorId: string
  tutorName: string
  hostCode: string
  guestCode: string
  startedAt: string
}

export function liveClassConfigured(): boolean {
  return !!(process.env.HMS_ACCESS_KEY && process.env.HMS_APP_SECRET && process.env.HMS_TEMPLATE_ID && process.env.HMS_SUBDOMAIN)
}

export function meetingUrl(code: string): string {
  return `https://${process.env.HMS_SUBDOMAIN}.app.100ms.live/meeting/${code}`
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url')

// Short-lived management token (HS256 JWT signed with the app secret).
function managementToken(): string {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    access_key: process.env.HMS_ACCESS_KEY,
    type: 'management',
    version: 2,
    jti: randomUUID(),
    iat: now,
    nbf: now,
    exp: now + 10 * 60,
  }))
  const sig = createHmac('sha256', process.env.HMS_APP_SECRET as string).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

async function hms<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${managementToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`100ms ${path} failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

// Creates a room for this class and returns its host and guest join codes.
export async function createClassRoom(name: string): Promise<{ roomId: string; hostCode: string; guestCode: string }> {
  const room = await hms<{ id: string }>('/rooms', {
    name: `${name}-${Date.now()}`.replace(/[^a-zA-Z0-9.\-_:]/g, '-').slice(0, 80),
    template_id: process.env.HMS_TEMPLATE_ID,
  })
  const codes = await hms<{ data: { code: string; role: string }[] }>(`/room-codes/room/${room.id}`, {})
  const hostRole = process.env.HMS_HOST_ROLE || 'host'
  const guestRole = process.env.HMS_GUEST_ROLE || 'guest'
  const hostCode = codes.data.find((c) => c.role === hostRole)?.code
  const guestCode = codes.data.find((c) => c.role === guestRole)?.code
  if (!hostCode || !guestCode) {
    throw new Error(`100ms template has no "${hostRole}" / "${guestRole}" roles (found: ${codes.data.map((c) => c.role).join(', ')})`)
  }
  return { roomId: room.id, hostCode, guestCode }
}

// Ends a class: disables the room so its join links stop working.
export async function disableClassRoom(roomId: string): Promise<void> {
  await hms(`/rooms/${roomId}`, { enabled: false })
}

export async function loadLiveClasses(): Promise<LiveClass[]> {
  const raw = await redis.get<string>(KEY)
  if (!raw) return []
  const list = (typeof raw === 'string' ? JSON.parse(raw) : raw) as LiveClass[]
  const cutoff = Date.now() - CLASS_TTL * 1000
  return list.filter((c) => new Date(c.startedAt).getTime() > cutoff)
}

export async function saveLiveClasses(list: LiveClass[]): Promise<void> {
  await redis.set(KEY, JSON.stringify(list), { ex: CLASS_TTL })
}
