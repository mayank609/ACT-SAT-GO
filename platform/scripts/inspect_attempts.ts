import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const attempt = await prisma.testAttempt.findFirst({
    where: { status: 'SUBMITTED' },
    orderBy: { completedAt: 'desc' },
    include: {
      sectionAttempts: {
        include: {
          section: {
            include: {
              questions: {
                include: {
                  question: {
                    include: {
                      topic: {
                        include: {
                          parent: true
                        }
                      },
                      childQuestions: {
                        include: {
                          topic: {
                            include: {
                              parent: true
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
    }
  });

  if (!attempt) {
    console.log("No submitted attempts found");
    return;
  }

  console.log("Attempt Title:", attempt.id, attempt.completedAt);
  
  let count = 0;
  for (const sa of attempt.sectionAttempts) {
    console.log("Section name:", sa.section.name);
    for (const tq of sa.section.questions) {
      const q = tq.question;
      console.log(`Question [${q.id}]:`);
      console.log("  - type:", q.type);
      console.log("  - content.meta:", q.content ? (q.content as any).meta : undefined);
      console.log("  - topic:", q.topic ? { name: q.topic.name, parentName: q.topic.parent?.name } : null);
      console.log("  - subject:", (q as any).subject);
      
      if (q.childQuestions && q.childQuestions.length > 0) {
        console.log("  - Child questions count:", q.childQuestions.length);
        for (const cq of q.childQuestions) {
          console.log(`    Child [${cq.id}]:`);
          console.log("      - content.meta:", cq.content ? (cq.content as any).meta : undefined);
          console.log("      - topic:", cq.topic ? { name: cq.topic.name, parentName: cq.topic.parent?.name } : null);
          console.log("      - subject:", (cq as any).subject);
        }
      }
      
      count++;
      if (count >= 10) break;
    }
    if (count >= 10) break;
  }
}

main().catch(console.error).finally(() => pool.end());
