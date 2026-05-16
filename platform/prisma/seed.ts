import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import 'dotenv/config'

const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding the database with dummy data...')

  // Clean up existing data
  try {
    // Note: The order of deletions matters due to foreign key constraints
    await prisma.attemptAnswer.deleteMany()
    await prisma.sectionAttempt.deleteMany()
    await prisma.testAttempt.deleteMany()
    await prisma.testQuestion.deleteMany()
    await prisma.testSection.deleteMany()
    await prisma.test.deleteMany()
    await prisma.question.deleteMany()
    await prisma.topic.deleteMany()
    await prisma.tutorAssignment.deleteMany()
    await prisma.user.deleteMany()
  } catch (e) {
    console.log('Note: Clean-up step partially skipped or constraints prevented full deletion (normal on first run).')
  }

  // 1. Create Users
  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@platform.com',
      role: 'SUPER_ADMIN',
    },
  })

  const tutor1 = await prisma.user.create({
    data: {
      email: 'tutor@platform.com',
      role: 'TUTOR',
    },
  })

  const student1 = await prisma.user.create({
    data: {
      email: 'student1@platform.com',
      role: 'STUDENT',
    },
  })

  const student2 = await prisma.user.create({
    data: {
      email: 'student2@platform.com',
      role: 'STUDENT',
    },
  })

  // 2. Assign Tutor
  await prisma.tutorAssignment.create({
    data: { tutorId: tutor1.id, studentId: student1.id }
  })
  await prisma.tutorAssignment.create({
    data: { tutorId: tutor1.id, studentId: student2.id }
  })

  // 3. Create Topics
  const mathTopic = await prisma.topic.create({
    data: { name: 'Mathematics' }
  })
  
  const algebraSubTopic = await prisma.topic.create({
    data: { name: 'Algebra', parentId: mathTopic.id }
  })

  // 4. Create Questions
  const q1 = await prisma.question.create({
    data: {
      type: 'MCQ',
      difficultyLevel: 'EASY',
      topicId: algebraSubTopic.id,
      content: { text: "What is 2 + 2?" },
      options: { "A": "3", "B": "4", "C": "5", "D": "6" },
      correctAnswer: { "correct": "B" }
    }
  })

  const q2 = await prisma.question.create({
    data: {
      type: 'NUMERIC',
      difficultyLevel: 'MEDIUM',
      topicId: algebraSubTopic.id,
      content: { text: "Solve for x: 2x - 4 = 10" },
      correctAnswer: { "correct": 7 }
    }
  })

  // 5. Create Test
  const test1 = await prisma.test.create({
    data: {
      title: 'Math Practice Test 1',
      description: 'A dummy test to evaluate algebraic skills.',
      createdById: tutor1.id,
      status: 'PUBLISHED'
    }
  })

  // 6. Create Section
  const section1 = await prisma.testSection.create({
    data: {
      testId: test1.id,
      name: 'Section 1: No Calculator',
      durationMinutes: 15,
      orderIndex: 1
    }
  })

  // 7. Add Questions to Test
  await prisma.testQuestion.create({
    data: {
      testId: test1.id,
      sectionId: section1.id,
      questionId: q1.id,
      orderIndex: 1,
      marksPositive: 1.0,
      marksNegative: 0.25
    }
  })

  await prisma.testQuestion.create({
    data: {
      testId: test1.id,
      sectionId: section1.id,
      questionId: q2.id,
      orderIndex: 2,
      marksPositive: 2.0,
      marksNegative: 0.0
    }
  })

  console.log('Dummy data seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
