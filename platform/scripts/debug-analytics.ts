import "dotenv/config";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const attempts = await prisma.testAttempt.findMany({
    where: { status: 'SUBMITTED' },
    include: {
      test: {
        include: {
          sections: {
            orderBy: { orderIndex: 'asc' },
            include: {
              questions: {
                orderBy: { orderIndex: 'asc' },
                include: {
                  question: {
                    include: {
                      childQuestions: true,
                      topic: true
                    }
                  }
                }
              }
            }
          }
        }
      },
      answers: true
    },
    orderBy: { completedAt: 'asc' }
  });

  if (attempts.length === 0) {
    console.log("No SUBMITTED attempts found.");
    return;
  }

  const latest = attempts[attempts.length - 1];
  console.log('Latest Attempt ID:', latest.id);
  console.log('Number of answers:', latest.answers.length);
  
  if (latest.answers.length === 0) {
    console.log('WARNING: Attempt has NO answers in DB!');
  } else {
    console.log('Sample answer questionIds:', latest.answers.slice(0, 5).map(a => a.questionId));
  }

  for (const section of latest.test.sections) {
    console.log(`\nSection: ${section.name}`);
    console.log(`Number of parent questions: ${section.questions.length}`);
    let childCount = 0;
    section.questions.forEach(tq => {
      if (tq.question.type === 'PASSAGE' && tq.question.childQuestions) {
        childCount += tq.question.childQuestions.length;
      }
    });
    console.log(`Number of child questions: ${childCount}`);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
