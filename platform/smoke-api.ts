// Live API smoke test — hits the running dev server the way the UI does.
const BASE = 'http://localhost:3000'

async function get(path: string) {
  const r = await fetch(BASE + path)
  const body = await r.json().catch(() => ({}))
  return { status: r.status, body }
}

function ok(cond: boolean) { return cond ? '✅' : '❌' }

async function main() {
  // 1. Users by role
  const roles = ['SUPER_ADMIN', 'ADMIN', 'TUTOR', 'STUDENT']
  const usersByRole: Record<string, any[]> = {}
  for (const role of roles) {
    const { status, body } = await get(`/api/users?role=${role}`)
    usersByRole[role] = body.users ?? []
    console.log(`${ok(status === 200)} GET /api/users?role=${role}  → ${status}  count=${usersByRole[role].length}`)
  }

  const student = usersByRole['STUDENT'][0]
  const tutor = usersByRole['TUTOR'][0]
  const admin = (usersByRole['ADMIN'][0] ?? usersByRole['SUPER_ADMIN'][0])

  // 2. Platform analytics (admin dashboard)
  {
    const { status, body } = await get('/api/analytics/platform')
    console.log(`${ok(status === 200 && Array.isArray(body.activityData))} GET /api/analytics/platform  → ${status}  activity=${body.activityData?.length} scoreDist=${body.scoreDistribution?.length}`)
  }

  // 3. Attempts list (admin/tutor monitoring)
  {
    const { status, body } = await get('/api/attempts')
    console.log(`${ok(status === 200 && Array.isArray(body.attempts))} GET /api/attempts  → ${status}  count=${body.attempts?.length}`)
  }

  // 4. For every student that has attempts, fetch their attempts + analytics
  for (const s of usersByRole['STUDENT']) {
    const att = await get(`/api/students/${s.id}/attempts`)
    const n = att.body.attempts?.length ?? 0
    if (n === 0) continue
    const an = await get(`/api/analytics/student/${s.id}`)
    const b = an.body
    console.log(`\n  Student ${s.name} (${s.id.slice(0,8)})`)
    console.log(`    ${ok(att.status === 200)} /students/${s.id.slice(0,8)}/attempts → ${att.status} count=${n}`)
    console.log(`    ${ok(an.status === 200)} /analytics/student → ${an.status}  totalAttempts=${b.totalAttempts} latestScore=${b.latestScore} avgScore=${b.avgScore} overallAccuracy=${b.overallAccuracy}`)
    console.log(`       trend=${b.trend?.length} sectionStats=${b.sectionStats?.length} pacing=${b.questionPacingStats?.length}`)
    if (b.sectionStats?.length) {
      for (const ss of b.sectionStats) console.log(`         · ${ss.sectionName}: ${ss.correct}✓/${ss.incorrect}✗/${ss.skipped}∅  acc=${ss.accuracy}%  time=${ss.timeUsed}/${ss.timeAllocated}s`)
    }
    // domain check from pacing
    if (b.questionPacingStats?.length) {
      const domains = [...new Set(b.questionPacingStats.map((q:any)=>q.topicName))]
      console.log(`       domains seen in pacing: ${domains.join(', ')}`)
    }
  }

  // 5. Tutor assignments (tutor sees their students)
  if (tutor) {
    const { status, body } = await get(`/api/tutor-assignments?tutorId=${tutor.id}`)
    console.log(`\n${ok(status === 200)} GET /api/tutor-assignments?tutorId=${tutor.id.slice(0,8)} → ${status}  students=${body.assignments?.length ?? body.studentIds?.length ?? '?'}`)
  }
  console.log(`\nadmin=${admin?.name} tutor=${tutor?.name} student=${student?.name}`)
}

main().catch(e => { console.error('SMOKE FAILED:', e) })
