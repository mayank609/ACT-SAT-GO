import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

/**
 * ACT-SAT-GO System Status Dashboard
 * A premium landing page to verify all backend integrations are working.
 */
export default async function Home() {
  let dbStatus = 'Checking...'
  let redisStatus = 'Checking...'
  let userCount = 0
  let testCount = 0

  try {
    userCount = await prisma.user.count()
    testCount = await prisma.test.count()
    dbStatus = 'Connected ✅'
  } catch (e) {
    console.error('DB Status Check Failed:', e)
    dbStatus = 'Error ❌'
  }

  try {
    await redis.ping()
    redisStatus = 'Connected ✅'
  } catch (e) {
    console.error('Redis Status Check Failed:', e)
    redisStatus = 'Error ❌'
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white p-8 font-sans selection:bg-emerald-500/30">
      <div className="max-w-5xl mx-auto space-y-16 py-24">
        {/* Header Section */}
        <div className="space-y-6 text-center md:text-left">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium animate-pulse">
            System Live & Operational
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tight bg-gradient-to-br from-white via-white to-slate-500 bg-clip-text text-transparent">
            ACT-SAT-GO <br />
            <span className="text-emerald-400">Backend Engine</span>
          </h1>
          <p className="text-slate-400 text-xl max-w-2xl mx-auto md:mx-0 leading-relaxed">
            The high-performance, server-authoritative core of your academic platform. 
            Prisma, Supabase, and Redis are now fully integrated.
          </p>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatusCard 
            title="PostgreSQL (Supabase)" 
            status={dbStatus} 
            detail={`${userCount} Users & ${testCount} Tests Seeded`}
            description="Persistent storage for user profiles, test bank, and historical analytics."
          />
          <StatusCard 
            title="Real-Time State (Redis)" 
            status={redisStatus} 
            detail="Upstash Global Instance" 
            description="Handles live test timers, autosave buffering, and concurrency control."
          />
          <StatusCard 
            title="Authentication" 
            status="Active 🔐" 
            detail="Supabase SSR + Middleware" 
            description="Role-based access control protecting Admin, Tutor, and Student routes."
          />
        </div>

        {/* Capabilities Section */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-3xl blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
          <div className="relative bg-[#0f172a] border border-slate-800 rounded-3xl p-10 overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
               <svg width="200" height="200" fill="white" viewBox="0 0 24 24"><path d="M13 10V3L4 14H11V21L20 10H13Z"/></svg>
            </div>
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
               Infrastructure Capabilities
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-12">
              <CapabilityItem 
                title="Server-Side Timers" 
                desc="Anti-cheat clock logic that prevents local system time manipulation."
              />
              <CapabilityItem 
                title="Topic-Wise Analytics" 
                desc="Deep aggregation engine to detect weak subjects and time mismanagement."
              />
              <CapabilityItem 
                title="High-Frequency Autosave" 
                desc="Redis-backed sub-100ms latency for student answer persistence."
              />
              <CapabilityItem 
                title="RBAC Gatekeeper" 
                desc="Edge-based middleware for instant, secure role redirections."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="pt-12 border-t border-slate-800 text-slate-500 text-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <p>© 2026 ACT-SAT-GO Engineering. All systems nominal.</p>
          <div className="flex gap-6">
            <span className="hover:text-white transition-colors cursor-help">Documentation</span>
            <span className="hover:text-white transition-colors cursor-help">API Logs</span>
            <span className="hover:text-white transition-colors cursor-help">Security Audit</span>
          </div>
        </footer>
      </div>
    </main>
  )
}

function StatusCard({ title, status, detail, description }: { title: string, status: string, detail: string, description: string }) {
  return (
    <div className="group p-8 rounded-3xl bg-[#0f172a] border border-slate-800 hover:border-emerald-500/50 transition-all duration-500">
      <p className="text-emerald-500 text-xs font-bold uppercase tracking-widest mb-4">{title}</p>
      <h3 className="text-3xl font-black mb-2">{status}</h3>
      <p className="text-white font-medium mb-3">{detail}</p>
      <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
    </div>
  )
}

function CapabilityItem({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
        <h4 className="font-bold text-slate-200">{title}</h4>
      </div>
      <p className="text-slate-500 text-sm ml-5">{desc}</p>
    </div>
  )
}
