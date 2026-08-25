import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { ALL_DOMAIN_NAMES } from '../frontend/src/data/satDomains'

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const DOMAIN_SYNONYMS: Record<string, string[]> = {
  'Information and Ideas': ['information and ideas', 'information', 'main idea', 'central idea', 'inference', 'evidence', 'command of evidence'],
  'Craft and Structure': ['craft and structure', 'craft', 'structure', 'vocabulary', 'words in context', 'text structure', 'cross-text'],
  'Expression of Ideas': ['expression of ideas', 'expression', 'rhetoric', 'rhetorical', 'transitions', 'synthesis'],
  'Standard English Conventions': ['standard english conventions', 'conventions', 'grammar', 'usage', 'punctuation', 'sentence structure', 'english'],
  'Algebra': ['algebra', 'linear'],
  'Advanced Math': ['advanced math', 'advanced', 'nonlinear', 'quadratic', 'function', 'exponential'],
  'Problem-Solving and Data Analysis': ['problem-solving and data analysis', 'problem solving', 'data analysis', 'data interpretation', 'statistics', 'ratio', 'rates', 'percent', 'probability', 'proportion'],
  'Geometry': ['geometry', 'geometry and trigonometry', 'trigonometry', 'trig'],
}

function domainCandidates(q: any): string[] {
  const content = q.content as any
  return [content?.meta?.domain, q.topic?.name, q.topic?.parent?.name, q.subject].filter(Boolean) as string[]
}

function matchCanonicalDomain(q: any): string | null {
  const cands = domainCandidates(q).map((c) => c.trim().toLowerCase())
  if (!cands.length) return null
  const direct = ALL_DOMAIN_NAMES.find((d) => cands.includes(d.toLowerCase()))
  if (direct) return direct
  for (const [domain, syns] of Object.entries(DOMAIN_SYNONYMS)) {
    for (const c of cands) {
      if (syns.some((s) => c === s || c.includes(s) || s.includes(c))) return domain
    }
  }
  return null
}

async function main() {
  // Find latest submitted attempt
  const attempts = await prisma.testAttempt.findMany({
    orderBy: { completedAt: 'desc' },
    take: 5,
    include: {
      test: {
        include: {
          sections: {
            include: {
              questions: {
                include: {
                  question: {
                    include: {
                      topic: {
                        include: { parent: true }
                      },
                      childQuestions: {
                        include: {
                          topic: {
                            include: { parent: true }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  })

  if (!attempts.length) {
    console.log('No attempts found.')
    return
  }

  for (const attempt of attempts) {
    console.log(`\n======================================================`)
    console.log(`Attempt ID: ${attempt.id}`)
    console.log(`Test Title: ${attempt.test.title}`)
    console.log(`Status: ${attempt.status}`)
    console.log(`======================================================`)

    const sections = attempt.test.sections
    for (const sec of sections) {
      console.log(`\nSection: ${sec.name}`)
      let totalQ = 0
      let matchedCount = 0

      for (const tq of sec.questions) {
        const q = tq.question
        const isPassage = q.type === 'PASSAGE'
        const qs = isPassage && q.childQuestions?.length ? q.childQuestions : [q]

        for (const cq of qs) {
          totalQ++
          const cands = domainCandidates(cq)
          const matched = matchCanonicalDomain(cq)
          if (matched) {
            matchedCount++
          } else {
            console.log(`  [MISMATCHED QUESTION]`)
            console.log(`    ID: ${cq.id}`)
            console.log(`    Type: ${cq.type}`)
            console.log(`    Subject: ${cq.subject}`)
            console.log(`    Topic Name: ${cq.topic?.name}`)
            console.log(`    Parent Topic: ${cq.topic?.parent?.name}`)
            console.log(`    Meta Domain: ${(cq.content as any)?.meta?.domain}`)
            console.log(`    Candidates: ${JSON.stringify(cands)}`)
          }
        }
      }
      console.log(`Section Summary: Matched ${matchedCount}/${totalQ} questions to canonical domains`)
    }
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
