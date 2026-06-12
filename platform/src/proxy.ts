import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { updateSession } from '@/lib/supabase/middleware'

const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*'

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

// Endpoints under /api that are intentionally public (no bearer token required).
const PUBLIC_API_PREFIXES = ['/api/health']

export async function proxy(request: NextRequest) {
  const url = new URL(request.url)

  // CORS preflight — let all OPTIONS requests through immediately
  if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
    return new NextResponse(null, { status: 204, headers: corsHeaders() })
  }

  // ── API authentication gate ────────────────────────────────────────────────
  // The frontend is a separate SPA that sends `Authorization: Bearer <jwt>`.
  // Verify the Supabase JWT here once for every /api/ route, then forward a
  // trusted `x-user-id` header that route handlers can rely on for authorization.
  if (url.pathname.startsWith('/api/')) {
    const isPublic = PUBLIC_API_PREFIXES.some((p) => url.pathname.startsWith(p))

    if (!isPublic) {
      const authHeader = request.headers.get('authorization') ?? ''
      const token = authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : ''

      if (!token) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401, headers: corsHeaders() }
        )
      }

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data, error } = await supabase.auth.getUser(token)

      if (error || !data.user) {
        return NextResponse.json(
          { error: 'Invalid or expired session' },
          { status: 401, headers: corsHeaders() }
        )
      }

      // Forward a trusted identity to route handlers. Strip any client-supplied
      // values first so they cannot be spoofed.
      const fwdHeaders = new Headers(request.headers)
      fwdHeaders.delete('x-user-id')
      fwdHeaders.delete('x-user-email')
      fwdHeaders.set('x-user-id', data.user.id)
      if (data.user.email) fwdHeaders.set('x-user-email', data.user.email)

      const res = NextResponse.next({ request: { headers: fwdHeaders } })
      for (const [k, v] of Object.entries(corsHeaders())) res.headers.set(k, v)
      return res
    }

    // Public API route — CORS only.
    const res = NextResponse.next()
    for (const [k, v] of Object.entries(corsHeaders())) res.headers.set(k, v)
    return res
  }

  const { supabaseResponse, user } = await updateSession(request)

  // 1. Define route groups
  const isProtectedRoute = (url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/tests/builder')) || 
                           url.pathname.startsWith('/tutor') || 
                           url.pathname.startsWith('/student') ||
                           url.pathname.startsWith('/test-engine')

  const isAuthRoute = url.pathname.startsWith('/login') || 
                      url.pathname.startsWith('/register')

  // 2. Authentication Protection
  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthRoute && user) {
    // If logged in, redirect away from login/register
    // In a future step, we will redirect to their specific dashboard based on role
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 3. RBAC (Role Based Access Control)
  // Note: We will implement fine-grained role checks once we sync 
  // the database role to the Supabase Auth metadata in Step 3.
  if (user && isProtectedRoute) {
    const role = user.app_metadata?.role

    if (url.pathname.startsWith('/admin') && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    
    if (url.pathname.startsWith('/tutor') && role !== 'TUTOR' && role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

// Next.js middleware requires a default export.
export default proxy

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
