import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import 'dotenv/config'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')

  // ── Clean slate ───────────────────────────────────────────────────────────
  await prisma.cheatingLog.deleteMany()
  await prisma.attemptAnswer.deleteMany()
  await prisma.sectionAttempt.deleteMany()
  await prisma.testAttempt.deleteMany()
  await prisma.testAssignment.deleteMany()
  await prisma.testQuestion.deleteMany()
  await prisma.testSection.deleteMany()
  await prisma.test.deleteMany()
  await prisma.question.deleteMany()
  await prisma.topic.deleteMany()
  await prisma.tutorAssignment.deleteMany()
  await prisma.user.deleteMany()

  // ── Users ─────────────────────────────────────────────────────────────────
  const superAdmin = await prisma.user.create({ data: { email: 'admin@actsat.com', role: 'SUPER_ADMIN', name: 'Super Admin' } })
  const admin      = await prisma.user.create({ data: { email: 'staff@actsat.com', role: 'ADMIN', name: 'Staff Admin' } })
  const tutor1     = await prisma.user.create({ data: { email: 'emily@actsat.com', role: 'TUTOR', name: 'Emily Rodriguez' } })
  const student1   = await prisma.user.create({ data: { email: 'alex@actsat.com',  role: 'STUDENT', name: 'Alex Thompson' } })
  const student2   = await prisma.user.create({ data: { email: 'morgan@actsat.com', role: 'STUDENT', name: 'Morgan Vance' } })
  const student3   = await prisma.user.create({ data: { email: 'casey@actsat.com',  role: 'STUDENT', name: 'Casey Miller' } })

  await prisma.tutorAssignment.createMany({
    data: [
      { tutorId: tutor1.id, studentId: student1.id },
      { tutorId: tutor1.id, studentId: student2.id },
      { tutorId: tutor1.id, studentId: student3.id },
    ],
  })
  console.log('✓ Users & assignments')

  // ── Topics ────────────────────────────────────────────────────────────────
  const tMath    = await prisma.topic.create({ data: { name: 'Mathematics' } })
  const tEng     = await prisma.topic.create({ data: { name: 'English' } })
  const tRead    = await prisma.topic.create({ data: { name: 'Reading' } })
  const tSci     = await prisma.topic.create({ data: { name: 'Science' } })

  const [algebra, geometry, trig, stats, grammar, rhetoric, inference, mainIdea, dataInterp, sciReason] =
    await Promise.all([
      prisma.topic.create({ data: { name: 'Algebra',               parentId: tMath.id } }),
      prisma.topic.create({ data: { name: 'Geometry',              parentId: tMath.id } }),
      prisma.topic.create({ data: { name: 'Trigonometry',          parentId: tMath.id } }),
      prisma.topic.create({ data: { name: 'Statistics',            parentId: tMath.id } }),
      prisma.topic.create({ data: { name: 'Grammar & Usage',       parentId: tEng.id  } }),
      prisma.topic.create({ data: { name: 'Rhetoric',              parentId: tEng.id  } }),
      prisma.topic.create({ data: { name: 'Inference',             parentId: tRead.id } }),
      prisma.topic.create({ data: { name: 'Main Idea',             parentId: tRead.id } }),
      prisma.topic.create({ data: { name: 'Data Interpretation',   parentId: tSci.id  } }),
      prisma.topic.create({ data: { name: 'Scientific Reasoning',  parentId: tSci.id  } }),
    ])
  console.log('✓ Topics')

  // ── Questions ─────────────────────────────────────────────────────────────
  // Helper
  const mcq = (text: string, opts: Record<string, string>, correct: string, topicId: string, diff: 'EASY'|'MEDIUM'|'HARD') =>
    prisma.question.create({ data: { type: 'MCQ', content: { text }, options: opts, correctAnswer: { key: correct }, topicId, difficultyLevel: diff } })

  const num = (text: string, answer: number, topicId: string, diff: 'EASY'|'MEDIUM'|'HARD') =>
    prisma.question.create({ data: { type: 'NUMERIC', content: { text }, correctAnswer: { value: answer }, topicId, difficultyLevel: diff } })

  // Math questions
  const [mq1, mq2, mq3, mq4, mq5, mq6, mq7, mq8, mq9, mq10] = await Promise.all([
    mcq('If 3x + 6 = 21, what is x?', { A:'3', B:'5', C:'7', D:'9' }, 'B', algebra.id, 'EASY'),
    mcq('What is the slope of y = 4x - 7?', { A:'-7', B:'4', C:'-4', D:'7' }, 'B', algebra.id, 'EASY'),
    mcq('A circle has radius 5. What is its area?', { A:'10π', B:'25π', C:'5π', D:'50π' }, 'B', geometry.id, 'MEDIUM'),
    mcq('What is sin(30°)?', { A:'√3/2', B:'1/2', C:'1', D:'√2/2' }, 'B', trig.id, 'MEDIUM'),
    mcq('The average of 8, 12, and x is 10. Find x.', { A:'8', B:'10', C:'12', D:'14' }, 'B', stats.id, 'MEDIUM'),
    num('Solve: 2x² = 50. Find positive x.', 5, algebra.id, 'MEDIUM'),
    mcq('Lines l and m are parallel, cut by transversal. If one angle is 65°, the co-interior angle is?', { A:'65°', B:'115°', C:'25°', D:'180°' }, 'B', geometry.id, 'HARD'),
    mcq('What is the period of f(x) = 3sin(2x)?', { A:'π', B:'2π', C:'3π', D:'π/2' }, 'A', trig.id, 'HARD'),
    num('A rectangle has perimeter 36 and length 10. Find its area.', 80, geometry.id, 'MEDIUM'),
    mcq('Which value of x satisfies |2x - 3| = 7?', { A:'5 or -2', B:'5 only', C:'-2 only', D:'2 or -5' }, 'A', algebra.id, 'HARD'),
  ])

  // English questions
  const [eq1, eq2, eq3, eq4, eq5, eq6, eq7, eq8] = await Promise.all([
    mcq('Choose the correct sentence: ___', { A:'Him and I went.', B:'He and I went.', C:'He and me went.', D:'Him and me went.' }, 'B', grammar.id, 'EASY'),
    mcq('Which word is a conjunction? "She studied hard, ___ she passed."', { A:'so', B:'very', C:'quickly', D:'often' }, 'A', grammar.id, 'EASY'),
    mcq("The author's primary purpose in the passage is to ___", { A:'entertain', B:'persuade', C:'inform', D:'critique' }, 'C', rhetoric.id, 'MEDIUM'),
    mcq('Which revision best improves sentence clarity?', { A:'Original', B:'Option B', C:'Option C', D:'Option D' }, 'C', rhetoric.id, 'MEDIUM'),
    mcq('The word "ephemeral" most nearly means:', { A:'everlasting', B:'short-lived', C:'mysterious', D:'colorful' }, 'B', grammar.id, 'HARD'),
    mcq('What is the subject of the sentence: "Running fast, the dog reached the fence."?', { A:'Running', B:'fast', C:'dog', D:'fence' }, 'C', grammar.id, 'EASY'),
    mcq('Which sentence uses the semicolon correctly?', { A:'I like apples; and oranges.', B:'She left early; she had a meeting.', C:'He runs; fast.', D:'They sang; happily.' }, 'B', grammar.id, 'MEDIUM'),
    mcq('The tone of the passage can best be described as:', { A:'sarcastic', B:'melancholic', C:'optimistic', D:'indifferent' }, 'C', rhetoric.id, 'MEDIUM'),
  ])

  // Reading questions
  const [rq1, rq2, rq3, rq4, rq5, rq6] = await Promise.all([
    mcq('Based on the passage, the author implies that ___', { A:'change is inevitable', B:'tradition must be preserved', C:'progress harms society', D:'nature is indifferent' }, 'A', inference.id, 'MEDIUM'),
    mcq('The central argument of the passage is best stated as ___', { A:'Option A', B:'Option B', C:'Option C', D:'Option D' }, 'B', mainIdea.id, 'MEDIUM'),
    mcq('The word "austere" in line 12 most likely means:', { A:'warm', B:'severe', C:'colorful', D:'generous' }, 'B', inference.id, 'MEDIUM'),
    mcq('Which detail best supports the main idea?', { A:'Detail A', B:'Detail B', C:'Detail C', D:'Detail D' }, 'C', mainIdea.id, 'HARD'),
    mcq("The author's attitude toward the subject can be described as ___", { A:'critical', B:'neutral', C:'enthusiastic', D:'dismissive' }, 'C', inference.id, 'HARD'),
    mcq('What can be inferred from the final paragraph?', { A:'The problem is unsolvable', B:'Further research is needed', C:'The solution was found', D:'The author disagrees' }, 'B', inference.id, 'HARD'),
  ])

  // Science questions
  const [sq1, sq2, sq3, sq4, sq5, sq6] = await Promise.all([
    mcq('According to Figure 1, as temperature increases, enzyme activity ___', { A:'decreases steadily', B:'increases then decreases', C:'stays constant', D:'increases steadily' }, 'B', dataInterp.id, 'MEDIUM'),
    mcq('Which hypothesis is supported by the experimental data?', { A:'Hypothesis 1', B:'Hypothesis 2', C:'Hypothesis 3', D:'None' }, 'A', sciReason.id, 'MEDIUM'),
    mcq('In Experiment 2, the control group had ___', { A:'no fertiliser', B:'double fertiliser', C:'UV exposure', D:'reduced water' }, 'A', dataInterp.id, 'EASY'),
    mcq('A student claims that higher pH increases reaction rate. The data ___', { A:'supports the claim', B:'refutes the claim', C:'is inconclusive', D:'is irrelevant' }, 'C', sciReason.id, 'HARD'),
    mcq('The independent variable in Study 3 is ___', { A:'temperature', B:'time', C:'pressure', D:'mass' }, 'A', dataInterp.id, 'MEDIUM'),
    mcq('Based on Tables 1 and 2, what trend is consistent across both experiments?', { A:'Inverse relationship', B:'Direct relationship', C:'No relationship', D:'Exponential growth' }, 'B', sciReason.id, 'HARD'),
  ])
  console.log('✓ Questions (30+)')

  // ── Tests ─────────────────────────────────────────────────────────────────
  const actFull1 = await prisma.test.create({
    data: { title: 'ACT Full Practice Test #1', description: 'Full-length ACT simulation across all 4 sections.', createdById: superAdmin.id, status: 'PUBLISHED' },
  })
  const actMath = await prisma.test.create({
    data: { title: 'ACT Math Focus Test', description: 'Deep-dive into ACT Math: algebra, geometry, and trig.', createdById: tutor1.id, status: 'PUBLISHED' },
  })
  const satPractice = await prisma.test.create({
    data: { title: 'SAT Practice Test #1', description: 'SAT reading, writing, and math sections.', createdById: superAdmin.id, status: 'PUBLISHED' },
  })
  const draftTest = await prisma.test.create({
    data: { title: 'ACT Science Deep Dive [Draft]', description: 'Science reasoning practice — still in review.', createdById: tutor1.id, status: 'DRAFT' },
  })
  console.log('✓ Tests')

  // ── Sections ──────────────────────────────────────────────────────────────
  // ACT Full #1
  const actEngSec  = await prisma.testSection.create({ data: { testId: actFull1.id, name: 'English',  durationMinutes: 45, orderIndex: 1 } })
  const actMathSec = await prisma.testSection.create({ data: { testId: actFull1.id, name: 'Math',     durationMinutes: 60, orderIndex: 2 } })
  const actReadSec = await prisma.testSection.create({ data: { testId: actFull1.id, name: 'Reading',  durationMinutes: 35, orderIndex: 3 } })
  const actSciSec  = await prisma.testSection.create({ data: { testId: actFull1.id, name: 'Science',  durationMinutes: 35, orderIndex: 4 } })

  // ACT Math Focus
  const mathNoCalc = await prisma.testSection.create({ data: { testId: actMath.id, name: 'No Calculator', durationMinutes: 30, orderIndex: 1 } })
  const mathCalc   = await prisma.testSection.create({ data: { testId: actMath.id, name: 'Calculator',    durationMinutes: 45, orderIndex: 2 } })

  // SAT Practice
  const satRWSec   = await prisma.testSection.create({ data: { testId: satPractice.id, name: 'Reading & Writing', durationMinutes: 32, orderIndex: 1 } })
  const satMathSec = await prisma.testSection.create({ data: { testId: satPractice.id, name: 'Math',              durationMinutes: 35, orderIndex: 2 } })

  // Draft test
  const draftSec = await prisma.testSection.create({ data: { testId: draftTest.id, name: 'Science Reasoning', durationMinutes: 35, orderIndex: 1 } })

  // ── Assign questions to sections ──────────────────────────────────────────
  const assign = (testId: string, sectionId: string, questions: { id: string }[], markPos = 1, markNeg = 0.25) =>
    prisma.testQuestion.createMany({
      data: questions.map((q, i) => ({
        testId, sectionId, questionId: q.id, orderIndex: i + 1, marksPositive: markPos, marksNegative: markNeg,
      })),
    })

  await Promise.all([
    assign(actFull1.id, actEngSec.id,  [eq1, eq2, eq3, eq4, eq5, eq6, eq7, eq8]),
    assign(actFull1.id, actMathSec.id, [mq1, mq2, mq3, mq4, mq5, mq6, mq7, mq8, mq9, mq10]),
    assign(actFull1.id, actReadSec.id, [rq1, rq2, rq3, rq4, rq5, rq6]),
    assign(actFull1.id, actSciSec.id,  [sq1, sq2, sq3, sq4, sq5, sq6]),
    assign(actMath.id, mathNoCalc.id,  [mq1, mq2, mq3, mq4, mq5]),
    assign(actMath.id, mathCalc.id,    [mq6, mq7, mq8, mq9, mq10]),
    assign(satPractice.id, satRWSec.id,   [eq1, eq2, eq3, eq4, rq1, rq2, rq3], 1, 0),
    assign(satPractice.id, satMathSec.id, [mq1, mq2, mq3, mq4, mq5, mq6], 1, 0),
    assign(draftTest.id, draftSec.id,  [sq1, sq2, sq3, sq4, sq5, sq6]),
  ])
  console.log('✓ Test questions assigned')

  // ── TestAttempts — student1 completed ACT Full #1 (score 28) ─────────────
  const attempt1 = await prisma.testAttempt.create({
    data: {
      testId: actFull1.id, studentId: student1.id,
      status: 'SUBMITTED', totalScore: 28,
      startedAt: new Date('2026-05-01T09:00:00Z'),
      completedAt: new Date('2026-05-01T12:00:00Z'),
    },
  })
  // Section attempts for attempt1
  await prisma.sectionAttempt.createMany({
    data: [
      { attemptId: attempt1.id, sectionId: actEngSec.id,  startedAt: new Date('2026-05-01T09:00:00Z'), completedAt: new Date('2026-05-01T09:45:00Z') },
      { attemptId: attempt1.id, sectionId: actMathSec.id, startedAt: new Date('2026-05-01T09:50:00Z'), completedAt: new Date('2026-05-01T10:50:00Z') },
      { attemptId: attempt1.id, sectionId: actReadSec.id, startedAt: new Date('2026-05-01T11:00:00Z'), completedAt: new Date('2026-05-01T11:35:00Z') },
      { attemptId: attempt1.id, sectionId: actSciSec.id,  startedAt: new Date('2026-05-01T11:40:00Z'), completedAt: new Date('2026-05-01T12:00:00Z') },
    ],
  })
  // Answers for attempt1 — mix of right and wrong
  await prisma.attemptAnswer.createMany({
    data: [
      // English — 6/8 correct
      { attemptId: attempt1.id, questionId: eq1.id, answerGiven: { key: 'B' }, timeSpentSeconds: 45,  isFlagged: false },
      { attemptId: attempt1.id, questionId: eq2.id, answerGiven: { key: 'A' }, timeSpentSeconds: 30,  isFlagged: false },
      { attemptId: attempt1.id, questionId: eq3.id, answerGiven: { key: 'C' }, timeSpentSeconds: 60,  isFlagged: false },
      { attemptId: attempt1.id, questionId: eq4.id, answerGiven: { key: 'A' }, timeSpentSeconds: 55,  isFlagged: true  }, // wrong
      { attemptId: attempt1.id, questionId: eq5.id, answerGiven: { key: 'B' }, timeSpentSeconds: 90,  isFlagged: false },
      { attemptId: attempt1.id, questionId: eq6.id, answerGiven: { key: 'C' }, timeSpentSeconds: 40,  isFlagged: false },
      { attemptId: attempt1.id, questionId: eq7.id, answerGiven: { key: 'B' }, timeSpentSeconds: 50,  isFlagged: false },
      { attemptId: attempt1.id, questionId: eq8.id, answerGiven: { key: 'A' }, timeSpentSeconds: 35,  isFlagged: true  }, // wrong
      // Math — 7/10 correct
      { attemptId: attempt1.id, questionId: mq1.id, answerGiven: { key: 'B' }, timeSpentSeconds: 60,  isFlagged: false },
      { attemptId: attempt1.id, questionId: mq2.id, answerGiven: { key: 'B' }, timeSpentSeconds: 55,  isFlagged: false },
      { attemptId: attempt1.id, questionId: mq3.id, answerGiven: { key: 'B' }, timeSpentSeconds: 80,  isFlagged: false },
      { attemptId: attempt1.id, questionId: mq4.id, answerGiven: { key: 'A' }, timeSpentSeconds: 90,  isFlagged: true  }, // wrong
      { attemptId: attempt1.id, questionId: mq5.id, answerGiven: { key: 'B' }, timeSpentSeconds: 70,  isFlagged: false },
      { attemptId: attempt1.id, questionId: mq6.id, answerGiven: { value: 5  }, timeSpentSeconds: 120, isFlagged: false },
      { attemptId: attempt1.id, questionId: mq7.id, answerGiven: { key: 'A'  }, timeSpentSeconds: 95,  isFlagged: true  }, // wrong
      { attemptId: attempt1.id, questionId: mq8.id, answerGiven: { key: 'A' }, timeSpentSeconds: 110, isFlagged: false },
      { attemptId: attempt1.id, questionId: mq9.id, answerGiven: { value: 80 }, timeSpentSeconds: 100, isFlagged: false },
      { attemptId: attempt1.id, questionId: mq10.id,answerGiven: { key: 'A' }, timeSpentSeconds: 130, isFlagged: false },
      // Reading — 4/6 correct
      { attemptId: attempt1.id, questionId: rq1.id, answerGiven: { key: 'A' }, timeSpentSeconds: 75,  isFlagged: false },
      { attemptId: attempt1.id, questionId: rq2.id, answerGiven: { key: 'B' }, timeSpentSeconds: 80,  isFlagged: false },
      { attemptId: attempt1.id, questionId: rq3.id, answerGiven: { key: 'B' }, timeSpentSeconds: 65,  isFlagged: false },
      { attemptId: attempt1.id, questionId: rq4.id, answerGiven: { key: 'A' }, timeSpentSeconds: 90,  isFlagged: true  }, // wrong
      { attemptId: attempt1.id, questionId: rq5.id, answerGiven: { key: 'C' }, timeSpentSeconds: 100, isFlagged: false },
      { attemptId: attempt1.id, questionId: rq6.id, answerGiven: { key: 'A' }, timeSpentSeconds: 85,  isFlagged: true  }, // wrong
      // Science — 4/6 correct
      { attemptId: attempt1.id, questionId: sq1.id, answerGiven: { key: 'B' }, timeSpentSeconds: 70,  isFlagged: false },
      { attemptId: attempt1.id, questionId: sq2.id, answerGiven: { key: 'A' }, timeSpentSeconds: 65,  isFlagged: false },
      { attemptId: attempt1.id, questionId: sq3.id, answerGiven: { key: 'A' }, timeSpentSeconds: 50,  isFlagged: false },
      { attemptId: attempt1.id, questionId: sq4.id, answerGiven: { key: 'A' }, timeSpentSeconds: 110, isFlagged: true  }, // wrong
      { attemptId: attempt1.id, questionId: sq5.id, answerGiven: { key: 'A' }, timeSpentSeconds: 75,  isFlagged: false },
      { attemptId: attempt1.id, questionId: sq6.id, answerGiven: { key: 'A' }, timeSpentSeconds: 90,  isFlagged: true  }, // wrong
    ],
  })

  // Cheating logs for attempt1
  await prisma.cheatingLog.createMany({
    data: [
      { attemptId: attempt1.id, eventType: 'tab_switch',      metadata: { switchNumber: 1, section: 'Math' } },
      { attemptId: attempt1.id, eventType: 'fullscreen_exit', metadata: { switchNumber: 1, section: 'Science' } },
    ],
  })

  // ── TestAttempts — student2 completed ACT Full #1 (score 31) ─────────────
  const attempt2 = await prisma.testAttempt.create({
    data: {
      testId: actFull1.id, studentId: student2.id,
      status: 'SUBMITTED', totalScore: 31,
      startedAt: new Date('2026-05-03T09:00:00Z'),
      completedAt: new Date('2026-05-03T12:00:00Z'),
    },
  })
  await prisma.sectionAttempt.createMany({
    data: [
      { attemptId: attempt2.id, sectionId: actEngSec.id,  startedAt: new Date('2026-05-03T09:00:00Z'), completedAt: new Date('2026-05-03T09:45:00Z') },
      { attemptId: attempt2.id, sectionId: actMathSec.id, startedAt: new Date('2026-05-03T09:50:00Z'), completedAt: new Date('2026-05-03T10:50:00Z') },
      { attemptId: attempt2.id, sectionId: actReadSec.id, startedAt: new Date('2026-05-03T11:00:00Z'), completedAt: new Date('2026-05-03T11:35:00Z') },
      { attemptId: attempt2.id, sectionId: actSciSec.id,  startedAt: new Date('2026-05-03T11:40:00Z'), completedAt: new Date('2026-05-03T12:00:00Z') },
    ],
  })
  await prisma.attemptAnswer.createMany({
    data: [
      { attemptId: attempt2.id, questionId: eq1.id, answerGiven: { key: 'B' }, timeSpentSeconds: 35, isFlagged: false },
      { attemptId: attempt2.id, questionId: eq2.id, answerGiven: { key: 'A' }, timeSpentSeconds: 25, isFlagged: false },
      { attemptId: attempt2.id, questionId: eq3.id, answerGiven: { key: 'C' }, timeSpentSeconds: 45, isFlagged: false },
      { attemptId: attempt2.id, questionId: eq4.id, answerGiven: { key: 'C' }, timeSpentSeconds: 50, isFlagged: false },
      { attemptId: attempt2.id, questionId: eq5.id, answerGiven: { key: 'B' }, timeSpentSeconds: 80, isFlagged: false },
      { attemptId: attempt2.id, questionId: eq6.id, answerGiven: { key: 'C' }, timeSpentSeconds: 30, isFlagged: false },
      { attemptId: attempt2.id, questionId: eq7.id, answerGiven: { key: 'B' }, timeSpentSeconds: 40, isFlagged: false },
      { attemptId: attempt2.id, questionId: eq8.id, answerGiven: { key: 'C' }, timeSpentSeconds: 30, isFlagged: false },
      { attemptId: attempt2.id, questionId: mq1.id, answerGiven: { key: 'B' }, timeSpentSeconds: 45, isFlagged: false },
      { attemptId: attempt2.id, questionId: mq2.id, answerGiven: { key: 'B' }, timeSpentSeconds: 40, isFlagged: false },
      { attemptId: attempt2.id, questionId: mq3.id, answerGiven: { key: 'B' }, timeSpentSeconds: 60, isFlagged: false },
      { attemptId: attempt2.id, questionId: mq4.id, answerGiven: { key: 'B' }, timeSpentSeconds: 75, isFlagged: false },
      { attemptId: attempt2.id, questionId: mq5.id, answerGiven: { key: 'B' }, timeSpentSeconds: 55, isFlagged: false },
      { attemptId: attempt2.id, questionId: mq6.id, answerGiven: { value: 5  }, timeSpentSeconds: 90, isFlagged: false },
      { attemptId: attempt2.id, questionId: mq7.id, answerGiven: { key: 'B'  }, timeSpentSeconds: 80, isFlagged: false },
      { attemptId: attempt2.id, questionId: mq8.id, answerGiven: { key: 'A' }, timeSpentSeconds: 95, isFlagged: false },
      { attemptId: attempt2.id, questionId: mq9.id, answerGiven: { value: 80 }, timeSpentSeconds: 85, isFlagged: false },
      { attemptId: attempt2.id, questionId: mq10.id,answerGiven: { key: 'A' }, timeSpentSeconds: 100,isFlagged: false },
      { attemptId: attempt2.id, questionId: rq1.id, answerGiven: { key: 'A' }, timeSpentSeconds: 60, isFlagged: false },
      { attemptId: attempt2.id, questionId: rq2.id, answerGiven: { key: 'B' }, timeSpentSeconds: 65, isFlagged: false },
      { attemptId: attempt2.id, questionId: rq3.id, answerGiven: { key: 'B' }, timeSpentSeconds: 55, isFlagged: false },
      { attemptId: attempt2.id, questionId: rq4.id, answerGiven: { key: 'C' }, timeSpentSeconds: 70, isFlagged: false },
      { attemptId: attempt2.id, questionId: rq5.id, answerGiven: { key: 'C' }, timeSpentSeconds: 80, isFlagged: false },
      { attemptId: attempt2.id, questionId: rq6.id, answerGiven: { key: 'B' }, timeSpentSeconds: 75, isFlagged: false },
      { attemptId: attempt2.id, questionId: sq1.id, answerGiven: { key: 'B' }, timeSpentSeconds: 55, isFlagged: false },
      { attemptId: attempt2.id, questionId: sq2.id, answerGiven: { key: 'A' }, timeSpentSeconds: 60, isFlagged: false },
      { attemptId: attempt2.id, questionId: sq3.id, answerGiven: { key: 'A' }, timeSpentSeconds: 45, isFlagged: false },
      { attemptId: attempt2.id, questionId: sq4.id, answerGiven: { key: 'C' }, timeSpentSeconds: 95, isFlagged: false },
      { attemptId: attempt2.id, questionId: sq5.id, answerGiven: { key: 'A' }, timeSpentSeconds: 60, isFlagged: false },
      { attemptId: attempt2.id, questionId: sq6.id, answerGiven: { key: 'B' }, timeSpentSeconds: 80, isFlagged: false },
    ],
  })

  // ── TestAttempt — student1 IN_PROGRESS on ACT Math Focus ─────────────────
  const attempt3 = await prisma.testAttempt.create({
    data: {
      testId: actMath.id, studentId: student1.id,
      status: 'IN_PROGRESS',
      startedAt: new Date('2026-05-17T08:00:00Z'),
    },
  })
  await prisma.sectionAttempt.create({
    data: { attemptId: attempt3.id, sectionId: mathNoCalc.id, startedAt: new Date('2026-05-17T08:00:00Z') },
  })

  // ── Test Assignments ────────────────────────────────────────────────────────
  await prisma.testAssignment.createMany({
    data: [
      {
        testId: actFull1.id,
        studentId: student1.id,
        dueAt: new Date('2026-06-15T23:59:59Z'),
        availableFrom: new Date('2026-05-01T00:00:00Z'),
        availableUntil: new Date('2026-06-15T23:59:59Z'),
        maxAttempts: 2,
        isActive: true,
      },
      {
        testId: actMath.id,
        studentId: student1.id,
        dueAt: new Date('2026-06-10T23:59:59Z'),
        availableFrom: new Date('2026-05-10T00:00:00Z'),
        availableUntil: new Date('2026-06-10T23:59:59Z'),
        maxAttempts: 2,
        isActive: true,
      },
      {
        testId: satPractice.id,
        studentId: student1.id,
        dueAt: new Date('2026-06-20T23:59:59Z'),
        availableFrom: new Date('2026-05-20T00:00:00Z'),
        availableUntil: new Date('2026-06-20T23:59:59Z'),
        maxAttempts: 1,
        isActive: true,
      },
      {
        testId: actFull1.id,
        studentId: student2.id,
        dueAt: new Date('2026-06-15T23:59:59Z'),
        availableFrom: new Date('2026-05-01T00:00:00Z'),
        availableUntil: new Date('2026-06-15T23:59:59Z'),
        maxAttempts: 2,
        isActive: true,
      },
      {
        testId: satPractice.id,
        studentId: student3.id,
        dueAt: new Date('2026-06-18T23:59:59Z'),
        availableFrom: new Date('2026-05-20T00:00:00Z'),
        availableUntil: new Date('2026-06-18T23:59:59Z'),
        maxAttempts: 1,
        isActive: true,
      },
    ],
  })

  console.log('✓ Test attempts, answers & cheating logs')
  console.log(`
  ✅ Seed complete!
     Users:    5 (1 super_admin, 1 tutor, 3 students)
     Topics:   14 (4 parents + 10 sub-topics)
     Questions: 30
     Tests:    4 (3 published, 1 draft)
     Attempts: 3 (2 submitted, 1 in-progress)
     Answers:  60
     Cheating logs: 2
  `)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
