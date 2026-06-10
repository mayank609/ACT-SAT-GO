import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { writeFileSync } from 'fs'

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const BASE = 'http://localhost:3000'
const TEST_ID = '42e3cb7d-da57-469c-9f8d-29a814739dfb' // Diagnostic Test 1

let pass = 0, fail = 0
function check(label: string, cond: boolean, detail = '') {
  console.log(`  ${cond ? '✅' : '❌'} ${label}${detail ? '  — ' + detail : ''}`)
  cond ? pass++ : fail++
}
async function api(method: string, path: string, body?: any) {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const json = await r.json().catch(() => ({}))
  return { status: r.status, json }
}
function isCorrect(given: any, correct: any): boolean {
  if (!given || !correct) return false
  if (correct.value !== undefined) return given.value !== undefined && Number(given.value) === Number(correct.value)
  if (Array.isArray(correct.keys)) return Array.isArray(given.keys) && JSON.stringify(given.keys.map((k:any)=>String(k).toUpperCase()).sort()) === JSON.stringify(correct.keys.map((k:any)=>String(k).toUpperCase()).sort())
  if (correct.key !== undefined) return given.key !== undefined && String(given.key).toUpperCase() === String(correct.key).toUpperCase()
  return false
}
function wrongFor(correct: any): any {
  if (correct.key !== undefined) { const opts = ['A','B','C','D']; return { key: opts.find(o => o !== String(correct.key).toUpperCase()) ?? 'A' } }
  if (Array.isArray(correct.keys)) return { keys: ['A'] }
  if (correct.value !== undefined) return { value: Number(correct.value) + 1 }
  return { key: 'Z' }
}

async function main() {
  console.log('\n━━━ STEP 1: Backup + wipe students ━━━')
  const students = await prisma.user.findMany({ where: { role: 'STUDENT' }, include: { attempts: { include: { answers: true } } } })
  writeFileSync('students-backup.json', JSON.stringify(students, null, 2))
  console.log(`  Backed up ${students.length} students (+attempts) → students-backup.json`)
  const del = await prisma.user.deleteMany({ where: { role: 'STUDENT' } })
  console.log(`  Deleted ${del.count} students (attempts/answers/assignments cascaded)`)
  check('all students removed', (await prisma.user.count({ where: { role: 'STUDENT' } })) === 0)

  console.log('\n━━━ STEP 2: Create fresh student (via API) ━━━')
  const tutor = await prisma.user.findFirst({ where: { role: 'TUTOR' } })
  const email = `e2e_${Date.now()}@student.test`
  const created = await api('POST', '/api/users', { name: 'E2E Student', email, role: 'student', grade: '11', targetScore: 32, tutorId: tutor?.id })
  check('POST /api/users → 200/201', created.status === 200 || created.status === 201, `status=${created.status}`)
  const studentId = created.json?.user?.id
  check('student id returned', !!studentId, studentId)
  if (!studentId) throw new Error('cannot continue: ' + JSON.stringify(created.json))

  console.log('\n━━━ STEP 3: Assign test + tutor ━━━')
  const assign = await api('POST', '/api/test-assignments', { testId: TEST_ID, studentIds: [studentId], maxAttempts: 3 })
  check('POST /api/test-assignments → ok', assign.status === 200 || assign.status === 201, `status=${assign.status}`)
  if (tutor) check('tutor linked to student', !!(await prisma.tutorAssignment.findFirst({ where: { tutorId: tutor.id, studentId } })))

  console.log('\n━━━ STEP 4: Start attempt ━━━')
  const start = await api('POST', '/api/attempts', { testId: TEST_ID, studentId })
  check('POST /api/attempts → ok', start.status === 200 || start.status === 201, `status=${start.status} ${JSON.stringify(start.json)}`)
  const attemptId = start.json?.attemptId
  check('attemptId returned', !!attemptId, attemptId)
  if (!attemptId) throw new Error('no attemptId')

  console.log('\n━━━ STEP 5: Answer every section (70% correct, ~9% skipped) ━━━')
  const sections = await prisma.testSection.findMany({
    where: { testId: TEST_ID }, orderBy: { orderIndex: 'asc' },
    include: { questions: { include: { question: { include: { childQuestions: true } } } } },
  })
  let expCorrect = 0, expWrong = 0, expSkipped = 0
  const perSectionExpected: Record<string, {correct:number,incorrect:number,skipped:number,total:number}> = {}
  let gi = 0
  for (const sec of sections) {
    const answerable: { id: string; correct: any }[] = []
    for (const tq of sec.questions) {
      const q: any = tq.question
      if (q.parentQuestionId) continue
      const isPassage = q.type === 'PASSAGE' || (q.content && q.content.meta?.isPassage === true)
      if (isPassage && q.childQuestions?.length) q.childQuestions.forEach((cq: any) => answerable.push({ id: cq.id, correct: cq.correctAnswer }))
      else if (!isPassage) answerable.push({ id: q.id, correct: q.correctAnswer })
    }
    perSectionExpected[sec.name] = { correct: 0, incorrect: 0, skipped: 0, total: answerable.length }
    await api('POST', `/api/attempts/${attemptId}/sections/${sec.id}/start`)
    for (const aq of answerable) {
      gi++
      const skip = gi % 11 === 0
      const wrong = !skip && gi % 10 < 3
      if (skip) { perSectionExpected[sec.name].skipped++; expSkipped++; continue }
      const answerGiven = wrong ? wrongFor(aq.correct) : aq.correct
      if (isCorrect(answerGiven, aq.correct)) { perSectionExpected[sec.name].correct++; expCorrect++ }
      else { perSectionExpected[sec.name].incorrect++; expWrong++ }
      await api('POST', `/api/attempts/${attemptId}/autosave`, { questionId: aq.id, answerGiven, timeSpentSeconds: 30 + (gi % 20) })
    }
    const sub = await api('POST', `/api/attempts/${attemptId}/sections/${sec.id}/submit`)
    check(`submit "${sec.name}" → ok`, sub.status === 200, `status=${sub.status}`)
  }
  console.log(`  Expected: correct=${expCorrect} wrong=${expWrong} skipped=${expSkipped} (answerable=${expCorrect+expWrong+expSkipped})`)

  console.log('\n━━━ STEP 6: Verify attempt scored ━━━')
  const at = await prisma.testAttempt.findUnique({ where: { id: attemptId } })
  check('attempt status SUBMITTED', at?.status === 'SUBMITTED', `status=${at?.status}`)
  check('totalScore set (>0)', (at?.totalScore ?? 0) > 0, `score=${at?.totalScore}`)
  const dbAnswers = await prisma.attemptAnswer.count({ where: { attemptId } })
  check('answers persisted to DB', dbAnswers === expCorrect + expWrong, `db=${dbAnswers} expected=${expCorrect+expWrong}`)

  console.log('\n━━━ STEP 7: Student analytics endpoint ━━━')
  const an = await api('GET', `/api/analytics/student/${studentId}?attemptId=${attemptId}`)
  check('GET analytics → 200', an.status === 200)
  const b = an.json
  const totCorrect = b.sectionStats?.reduce((s:number,x:any)=>s+x.correct,0)
  const totIncorrect = b.sectionStats?.reduce((s:number,x:any)=>s+x.incorrect,0)
  const totSkipped = b.sectionStats?.reduce((s:number,x:any)=>s+x.skipped,0)
  check('analytics correct matches', totCorrect === expCorrect, `analytics=${totCorrect} expected=${expCorrect}`)
  check('analytics incorrect matches', totIncorrect === expWrong, `analytics=${totIncorrect} expected=${expWrong}`)
  check('analytics skipped matches', totSkipped === expSkipped, `analytics=${totSkipped} expected=${expSkipped}`)
  check('pacing count == answerable', b.questionPacingStats?.length === expCorrect+expWrong+expSkipped, `pacing=${b.questionPacingStats?.length}`)
  for (const ss of b.sectionStats ?? []) {
    const exp = perSectionExpected[ss.sectionName]
    if (exp) check(`  section "${ss.sectionName}"`, ss.correct===exp.correct && ss.incorrect===exp.incorrect && ss.skipped===exp.skipped, `got ${ss.correct}/${ss.incorrect}/${ss.skipped} exp ${exp.correct}/${exp.incorrect}/${exp.skipped}`)
  }

  console.log('\n━━━ STEP 8: Admin/Tutor monitoring views ━━━')
  const attemptsList = await api('GET', `/api/attempts?studentId=${studentId}`)
  check('GET /api/attempts (admin/tutor) → 200', attemptsList.status === 200)
  const row = attemptsList.json.attempts?.find((a:any)=>a.id===attemptId)
  check('attempt visible in monitoring', !!row, row ? `score=${row.totalScore} status=${row.status}` : 'not found')
  const plat = await api('GET', '/api/analytics/platform')
  check('GET /api/analytics/platform → 200', plat.status === 200 && Array.isArray(plat.json.activityData))

  console.log(`\n━━━ RESULT: ${pass} passed, ${fail} failed ━━━`)
  console.log(`Score: ${at?.totalScore}  (correct ${expCorrect}/${expCorrect+expWrong+expSkipped})`)
}

main().catch(e => { console.error('E2E ERROR:', e); fail++ }).finally(async () => { await prisma.$disconnect(); process.exit(fail > 0 ? 1 : 0) })
