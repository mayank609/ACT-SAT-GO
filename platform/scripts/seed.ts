import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Starting seed...')

  // ── 1. Wipe existing data (FK-safe order) ──────────────────────────────────
  console.log('🗑  Clearing existing data...')
  await prisma.cheatingLog.deleteMany()
  await prisma.attemptAnswer.deleteMany()
  await prisma.sectionAttempt.deleteMany()
  await prisma.testAttempt.deleteMany()
  await prisma.testAssignment.deleteMany()
  await prisma.testQuestion.deleteMany()
  await prisma.testSection.deleteMany()
  await prisma.test.deleteMany()
  await prisma.tutorAssignment.deleteMany()
  await prisma.user.deleteMany()
  console.log('✅ Cleared')

  // ── 2. Users ────────────────────────────────────────────────────────────────
  console.log('👤 Creating users...')

  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@actsat.com',
      role: 'ADMIN',
      permissions: { displayName: 'Admin User' },
    },
  })

  const tutor = await prisma.user.create({
    data: {
      name: 'Emily Rodriguez',
      email: 'emily.rodriguez@actsat.com',
      role: 'TUTOR',
      permissions: { displayName: 'Emily Rodriguez', specialization: ['ACT Prep', 'Math', 'English'] },
    },
  })

  const student1 = await prisma.user.create({
    data: {
      name: 'Alex Thompson',
      email: 'alex.thompson@student.com',
      role: 'STUDENT',
      permissions: { displayName: 'Alex Thompson', grade: '11', targetScore: 32 },
    },
  })

  const student2 = await prisma.user.create({
    data: {
      name: 'Morgan Davis',
      email: 'morgan.davis@student.com',
      role: 'STUDENT',
      permissions: { displayName: 'Morgan Davis', grade: '10', targetScore: 28 },
    },
  })

  const student3 = await prisma.user.create({
    data: {
      name: 'Casey Brown',
      email: 'casey.brown@student.com',
      role: 'STUDENT',
      permissions: { displayName: 'Casey Brown', grade: '12', targetScore: 34 },
    },
  })

  console.log(`✅ Created users: admin, tutor, 3 students`)

  // ── 3. Tutor assignments ────────────────────────────────────────────────────
  await prisma.tutorAssignment.createMany({
    data: [
      { tutorId: tutor.id, studentId: student1.id },
      { tutorId: tutor.id, studentId: student2.id },
      { tutorId: tutor.id, studentId: student3.id },
    ],
  })
  console.log('✅ Tutor assignments created')

  // ── 4. Create test ──────────────────────────────────────────────────────────
  console.log('📝 Creating test...')

  const test = await prisma.test.create({
    data: {
      title: 'ACT Full Practice Test #1',
      description: 'A comprehensive ACT practice test covering Math and English sections.',
      createdById: admin.id,
      status: 'PUBLISHED',
    },
  })

  const mathSection = await prisma.testSection.create({
    data: { testId: test.id, name: 'Mathematics', durationMinutes: 60, orderIndex: 0 },
  })

  const englishSection = await prisma.testSection.create({
    data: { testId: test.id, name: 'English', durationMinutes: 45, orderIndex: 1 },
  })

  console.log('✅ Test and sections created')

  await prisma.testAssignment.createMany({
    data: [
      {
        testId: test.id,
        studentId: student1.id,
        dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        availableFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        availableUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        maxAttempts: 2,
        isActive: true,
      },
      {
        testId: test.id,
        studentId: student2.id,
        dueAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        availableFrom: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        availableUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        maxAttempts: 2,
        isActive: true,
      },
      {
        testId: test.id,
        studentId: student3.id,
        dueAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        availableFrom: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        availableUntil: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        maxAttempts: 1,
        isActive: true,
      },
    ],
  })

  // ── 5. Questions ────────────────────────────────────────────────────────────
  console.log('❓ Creating questions...')

  const mathQuestions = await Promise.all([
    prisma.question.create({
      data: {
        type: 'MCQ',
        content: { text: 'If 2x + 3 = 11, what is the value of x?' },
        options: { A: '2', B: '3', C: '4', D: '5' },
        correctAnswer: { key: 'C' },
        difficultyLevel: 'EASY',
      },
    }),
    prisma.question.create({
      data: {
        type: 'MCQ',
        content: { text: 'What is the slope of the line passing through (2, 3) and (4, 7)?' },
        options: { A: '1', B: '2', C: '3', D: '4' },
        correctAnswer: { key: 'B' },
        difficultyLevel: 'MEDIUM',
      },
    }),
    prisma.question.create({
      data: {
        type: 'NUMERIC',
        content: { text: 'What is the area of a rectangle with length 8 and width 5?' },
        correctAnswer: { value: 40 },
        difficultyLevel: 'EASY',
      },
    }),
    prisma.question.create({
      data: {
        type: 'MCQ',
        content: { text: 'Which of the following is a factor of x² − 5x + 6?' },
        options: { A: '(x − 1)', B: '(x − 2)', C: '(x + 2)', D: '(x + 3)' },
        correctAnswer: { key: 'B' },
        difficultyLevel: 'MEDIUM',
      },
    }),
    prisma.question.create({
      data: {
        type: 'MCQ',
        content: { text: 'In a right triangle, if one leg is 3 and the hypotenuse is 5, what is the other leg?' },
        options: { A: '2', B: '3', C: '4', D: '5' },
        correctAnswer: { key: 'C' },
        difficultyLevel: 'MEDIUM',
      },
    }),
  ])

  const englishQuestions = await Promise.all([
    prisma.question.create({
      data: {
        type: 'MCQ',
        content: { text: 'Choose the correctly punctuated sentence:', explanation: 'A comma splice joins two independent clauses with only a comma.' },
        options: {
          A: 'She ran quickly, however she missed the bus.',
          B: 'She ran quickly; however, she missed the bus.',
          C: 'She ran quickly however she missed the bus.',
          D: 'She ran quickly however, she missed the bus.',
        },
        correctAnswer: { key: 'B' },
        difficultyLevel: 'MEDIUM',
      },
    }),
    prisma.question.create({
      data: {
        type: 'MCQ',
        content: { text: 'Which sentence uses the apostrophe correctly?' },
        options: {
          A: "The dog's bone was buried in the yard.",
          B: "The dogs' bone was buried in the yard.",
          C: "The dog\'s bone was buried in the yard.",
          D: "The dogs bone was buried in the yard.",
        },
        correctAnswer: { key: 'A' },
        difficultyLevel: 'EASY',
      },
    }),
    prisma.question.create({
      data: {
        type: 'MCQ',
        content: { text: 'Select the word that best completes the sentence: The scientist\'s findings were _____, overturning decades of accepted theory.' },
        options: { A: 'mundane', B: 'revolutionary', C: 'predictable', D: 'unremarkable' },
        correctAnswer: { key: 'B' },
        difficultyLevel: 'EASY',
      },
    }),
    prisma.question.create({
      data: {
        type: 'MCQ',
        content: { text: 'Which of the following contains a dangling modifier?' },
        options: {
          A: 'Running through the park, the trees looked beautiful.',
          B: 'The trees looked beautiful as I ran through the park.',
          C: 'While running through the park, I noticed the beautiful trees.',
          D: 'The beautiful trees lined the path I ran through.',
        },
        correctAnswer: { key: 'A' },
        difficultyLevel: 'HARD',
      },
    }),
    prisma.question.create({
      data: {
        type: 'MSQ',
        content: { text: 'Which of the following are examples of figurative language? (Select all that apply)' },
        options: { A: 'Simile', B: 'Metaphor', C: 'Alliteration', D: 'Conjunction' },
        correctAnswer: { keys: ['A', 'B', 'C'] },
        difficultyLevel: 'MEDIUM',
      },
    }),
  ])

  // Link questions to test sections
  await Promise.all([
    ...mathQuestions.map((q, i) =>
      prisma.testQuestion.create({
        data: {
          testId: test.id,
          sectionId: mathSection.id,
          questionId: q.id,
          orderIndex: i,
          marksPositive: 1,
          marksNegative: 0,
        },
      })
    ),
    ...englishQuestions.map((q, i) =>
      prisma.testQuestion.create({
        data: {
          testId: test.id,
          sectionId: englishSection.id,
          questionId: q.id,
          orderIndex: i,
          marksPositive: 1,
          marksNegative: 0,
        },
      })
    ),
  ])

  console.log('✅ 10 questions created and linked')

  // ── 6. Submitted attempt for Alex ───────────────────────────────────────────
  console.log('📊 Creating submitted attempt for Alex...')

  const alexAttempt = await prisma.testAttempt.create({
    data: {
      testId: test.id,
      studentId: student1.id,
      status: 'SUBMITTED',
      totalScore: 7,
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  })

  await prisma.sectionAttempt.create({
    data: {
      attemptId: alexAttempt.id,
      sectionId: mathSection.id,
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    },
  })

  await prisma.sectionAttempt.create({
    data: {
      attemptId: alexAttempt.id,
      sectionId: englishSection.id,
      startedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  })

  // Alex's answers — correct on most
  await prisma.attemptAnswer.createMany({
    data: [
      { attemptId: alexAttempt.id, questionId: mathQuestions[0].id, answerGiven: { key: 'C' }, timeSpentSeconds: 45, isFlagged: false },     // correct
      { attemptId: alexAttempt.id, questionId: mathQuestions[1].id, answerGiven: { key: 'B' }, timeSpentSeconds: 60, isFlagged: false },     // correct
      { attemptId: alexAttempt.id, questionId: mathQuestions[2].id, answerGiven: { value: 40 }, timeSpentSeconds: 30, isFlagged: false },    // correct
      { attemptId: alexAttempt.id, questionId: mathQuestions[3].id, answerGiven: { key: 'A' }, timeSpentSeconds: 90, isFlagged: true },      // wrong (correct B)
      { attemptId: alexAttempt.id, questionId: mathQuestions[4].id, answerGiven: { key: 'C' }, timeSpentSeconds: 75, isFlagged: false },     // correct
      { attemptId: alexAttempt.id, questionId: englishQuestions[0].id, answerGiven: { key: 'B' }, timeSpentSeconds: 40, isFlagged: false },  // correct
      { attemptId: alexAttempt.id, questionId: englishQuestions[1].id, answerGiven: { key: 'A' }, timeSpentSeconds: 35, isFlagged: false },  // correct
      { attemptId: alexAttempt.id, questionId: englishQuestions[2].id, answerGiven: { key: 'C' }, timeSpentSeconds: 50, isFlagged: true },   // wrong (correct B)
      { attemptId: alexAttempt.id, questionId: englishQuestions[3].id, answerGiven: { key: 'A' }, timeSpentSeconds: 80, isFlagged: false },  // correct
      { attemptId: alexAttempt.id, questionId: englishQuestions[4].id, answerGiven: { keys: ['A', 'B', 'C'] }, timeSpentSeconds: 65, isFlagged: false }, // correct
    ],
  })

  console.log('✅ Alex attempt: submitted, score 8/10')

  // ── 7. In-progress attempt for Morgan ───────────────────────────────────────
  console.log('🔄 Creating in-progress attempt for Morgan...')

  const morganAttempt = await prisma.testAttempt.create({
    data: {
      testId: test.id,
      studentId: student2.id,
      status: 'IN_PROGRESS',
      startedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  })

  await prisma.sectionAttempt.create({
    data: {
      attemptId: morganAttempt.id,
      sectionId: mathSection.id,
      startedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  })

  // Partial answers saved to Redis (simulated as DB for seed purposes)
  await prisma.attemptAnswer.createMany({
    data: [
      { attemptId: morganAttempt.id, questionId: mathQuestions[0].id, answerGiven: { key: 'B' }, timeSpentSeconds: 55, isFlagged: false },
      { attemptId: morganAttempt.id, questionId: mathQuestions[1].id, answerGiven: { key: 'B' }, timeSpentSeconds: 70, isFlagged: false },
    ],
  })

  console.log('✅ Morgan attempt: in-progress')

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n🎉 Seed complete!\n')
  console.log('Users:')
  console.log(`  Admin:    ${admin.email}`)
  console.log(`  Tutor:    ${tutor.email}`)
  console.log(`  Student1: ${student1.email} (Alex — submitted attempt, score 8/10)`)
  console.log(`  Student2: ${student2.email} (Morgan — in-progress attempt)`)
  console.log(`  Student3: ${student3.email} (Casey — no attempts)`)
  console.log(`\nTest: "${test.title}" (${test.id})`)
  console.log(`  Math section:    ${mathSection.id} (5 questions, 60 min)`)
  console.log(`  English section: ${englishSection.id} (5 questions, 45 min)`)
  console.log('\nLogin as any user to test:')
  console.log('  Admin role   → admin@actsat.com')
  console.log('  Tutor role   → emily.rodriguez@actsat.com')
  console.log('  Student role → alex.thompson@student.com (or morgan/casey)')
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
