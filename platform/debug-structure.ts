import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const attemptId = 'f51035ed-495d-4097-931e-450a0eb7f91f'
  
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      test: {
        include: {
          sections: {
            orderBy: { orderIndex: 'asc' },
            include: {
              questions: {
                orderBy: { orderIndex: 'asc' },
                take: 2,
                include: {
                  question: {
                    include: {
                      childQuestions: true
                    }
                  }
                }
              }
            }
          }
        }
      },
      sectionAttempts: {
        include: {
          section: {
            include: {
              questions: {
                orderBy: { orderIndex: 'asc' },
                take: 2,
                include: {
                  question: {
                    include: {
                      childQuestions: true
                    }
                  }
                }
              }
            }
          }
        }
      },
      answers: {
        take: 3,
        include: { question: true }
      }
    }
  })
  
  console.log('=== TEST STRUCTURE ===')
  console.log('Test:', attempt?.test.title)
  console.log('Sections:', attempt?.test.sections.length)
  
  if (attempt?.test.sections[0]) {
    const sec = attempt.test.sections[0]
    console.log(`\nFirst section: ${sec.name}`)
    console.log(`  Questions in test.sections[0].questions: ${sec.questions.length}`)
    if (sec.questions[0]) {
      const q = sec.questions[0].question
      console.log(`  First question ID: ${q.id}`)
      console.log(`  First question correctAnswer:`, q.correctAnswer)
      console.log(`  First question type:`, q.type)
      console.log(`  First question childQuestions:`, q.childQuestions?.length || 0)
    }
  }
  
  console.log('\n=== SECTION ATTEMPTS ===')
  console.log('SectionAttempts:', attempt?.sectionAttempts.length)
  
  if (attempt?.sectionAttempts[0]) {
    const sa = attempt.sectionAttempts[0]
    console.log(`\nFirst section attempt: ${sa.section.name}`)
    console.log(`  Questions in sectionAttempts[0].section.questions: ${sa.section.questions.length}`)
    if (sa.section.questions[0]) {
      const q = sa.section.questions[0].question
      console.log(`  First question ID: ${q.id}`)
      console.log(`  First question correctAnswer:`, q.correctAnswer)
      console.log(`  First question type:`, q.type)
    }
  }
  
  console.log('\n=== ANSWERS ===')
  console.log(`Total answers: ${attempt?.answers.length}`)
  attempt?.answers.forEach((a, i) => {
    console.log(`Answer ${i+1}: Q=${a.questionId}, Given=${JSON.stringify(a.answerGiven)}, Correct=${JSON.stringify(a.question?.correctAnswer)?.slice(0, 30)}`)
  })
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
