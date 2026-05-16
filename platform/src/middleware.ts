import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  const url = new URL(request.url)

  // 1. Define route groups
  const isProtectedRoute = url.pathname.startsWith('/admin') || 
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
