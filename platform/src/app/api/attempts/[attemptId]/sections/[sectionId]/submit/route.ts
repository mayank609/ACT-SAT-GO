import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { numericValuesEqual } from '@/lib/numericAnswer'

type AnswerJson = { key?: string; keys?: string[]; value?: number; values?: number[] } | null

// Digital SAT raw→scaled conversion tables, reproduced exactly from the
// test-ninjas.com Digital SAT Score Calculator. RW uses a 0–66 index, Math 0–54.
const RW_SCALE: number[] = [
  200, 200, 200, 200, 200, 200, 200, 210, 210, 220, 240, 250, 260, 270, 290, 300, 330,
  350, 360, 370, 380, 380, 390, 400, 410, 420, 430, 430, 440, 450, 460, 470, 470, 480,
  490, 500, 500, 510, 520, 530, 540, 550, 550, 560, 570, 580, 590, 600, 600, 610, 620,
  630, 640, 640, 650, 660, 670, 680, 690, 700, 710, 720, 730, 740, 760, 780, 800,
]
const MATH_SCALE: number[] = [
  200, 200, 200, 200, 200, 200, 200, 210, 220, 240, 270, 300, 310, 320, 330, 340, 350,
  350, 360, 370, 380, 390, 390, 400, 410, 420, 440, 450, 460, 480, 490, 500, 520, 530,
  540, 550, 570, 580, 590, 600, 610, 620, 640, 650, 670, 690, 710, 730, 750, 760, 770,
  780, 790, 790, 800,
]

// Convert a section's two module raw scores into a scaled section score (200–800),
// replicating test-ninjas.com: adaptive easy-route weights Module 2 down to
// round(0.8 × M2) when Module 1 is below the routing threshold (18 RW, 15 Math),
// then the combined raw is normalized to the table index and looked up.
function satSectionScore(m1: number, m2: number, total: number, isMath: boolean, adaptive = true): number {
  let eff2 = m2
  if (adaptive && (isMath ? m1 < 15 : m1 < 18)) {
    eff2 = Math.round(0.8 * m2)
  }
  const raw = m1 + eff2
  if (!(total > 0)) return 200
  const ratio = Math.max(0, Math.min(1, raw / total))
  const table = isMath ? MATH_SCALE : RW_SCALE
  const idx = Math.min(Math.round((isMath ? 54 : 66) * ratio), table.length - 1)
  return table[idx]
}

function isAnswerCorrect(given: unknown, correct: unknown): boolean {
  if (!given || !correct) return false;
  const g = given as AnswerJson;
  const c = correct as AnswerJson;
  if (!g || !c) return false;
  
  // Numeric (supports fraction answers, decimal-equivalent with tolerance).
  // A question may accept several distinct correct values — matches if the
  // given answer equals any one of them.
  if (c.value !== undefined) {
    if (g.value === undefined) return false;
    if (Array.isArray(c.values) && c.values.length > 0) {
      return c.values.some((v) => numericValuesEqual(g.value, v));
    }
    return numericValuesEqual(g.value, c.value);
  }

  // MSQ — order-independent, case-insensitive
  if (Array.isArray(c.keys)) {
    if (!Array.isArray(g.keys)) return false;
    const gKeys = g.keys.map((k) => String(k).toUpperCase().trim()).sort();
    const cKeys = c.keys.map((k) => String(k).toUpperCase().trim()).sort();
    return JSON.stringify(gKeys) === JSON.stringify(cKeys);
  }
  
  // MCQ — case-insensitive
  if (c.key !== undefined) {
    if (g.key === undefined) return false;
    return String(g.key).toUpperCase().trim() === String(c.key).toUpperCase().trim();
  }
  
  return false;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ attemptId: string; sectionId: string }> }
) {
  const { attemptId, sectionId } = await params

  try {
    // 1. Flush Redis answers → PostgreSQL
    // Upstash auto-deserializes JSON, so values may arrive as objects instead of strings
    const cachedAnswers = (await redis.hgetall(`answers:${attemptId}`)) as Record<string, unknown> | null

    if (cachedAnswers) {
      const upserts = Object.entries(cachedAnswers).map(([questionId, raw]) => {
        const data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as {
          answerGiven: Prisma.InputJsonValue | null; timeSpentSeconds: number; isFlagged: boolean
        }
        return prisma.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId } },
          update: {
            answerGiven: data.answerGiven ?? Prisma.DbNull,
            timeSpentSeconds: data.timeSpentSeconds,
            isFlagged: data.isFlagged,
          },
          create: {
            attemptId,
            questionId,
            answerGiven: data.answerGiven ?? Prisma.DbNull,
            timeSpentSeconds: data.timeSpentSeconds,
            isFlagged: data.isFlagged,
          },
        })
      })
      await Promise.all(upserts)
      await redis.del(`answers:${attemptId}`)
    }

    // 2. Mark section complete — upsert in case startSection was never called
    await prisma.sectionAttempt.upsert({
      where: { attemptId_sectionId: { attemptId, sectionId } },
      update: { completedAt: new Date() },
      create: { attemptId, sectionId, startedAt: new Date(), completedAt: new Date() },
    })

    // 3. Clean up Redis timer
    await redis.del(`timer:${attemptId}:${sectionId}`)

    // 4. Check if all sections done → calculate and save total score
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        sectionAttempts: true,
        test: {
          include: {
            sections: true
          }
        }
      },
    })

    if (attempt && attempt.test) {
      const allSections = attempt.test.sections
      const completedCount = attempt.sectionAttempts.filter((sa) => sa.completedAt !== null).length

      if (completedCount >= allSections.length) {
        const answers = await prisma.attemptAnswer.findMany({
          where: { attemptId },
          include: {
            question: {
              include: { 
                testQuestions: { where: { testId: attempt.testId } },
                parentQuestion: {
                  include: { testQuestions: { where: { testId: attempt.testId } } }
                }
              },
            },
          },
        })

        // Fetch all TestQuestions for this test to build the structure
        const testQuestions = await prisma.testQuestion.findMany({
          where: { testId: attempt.testId },
          include: {
            question: {
              include: {
                childQuestions: true
              }
            }
          }
        })

        // Group and flatten questions by section to know which are answerable
        const sectionQuestionsMap = new Map<string, string[]>() // sectionId -> questionIds
        const questionToSectionMap = new Map<string, string>() // questionId -> sectionId

        for (const tq of testQuestions) {
          const q = tq.question
          // Skip child question rows: counted via their passage parent below.
          if ((q as any).parentQuestionId) continue
          const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true)

          if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
            for (const cq of q.childQuestions) {
              if (!sectionQuestionsMap.has(tq.sectionId)) {
                sectionQuestionsMap.set(tq.sectionId, [])
              }
              sectionQuestionsMap.get(tq.sectionId)!.push(cq.id)
              questionToSectionMap.set(cq.id, tq.sectionId)
            }
          } else if (!isPassage) {
            if (!sectionQuestionsMap.has(tq.sectionId)) {
              sectionQuestionsMap.set(tq.sectionId, [])
            }
            sectionQuestionsMap.get(tq.sectionId)!.push(q.id)
            questionToSectionMap.set(q.id, tq.sectionId)
          }
        }

        // Group correct answers by section
        const sectionCorrectMap = new Map<string, number>()
        for (const sec of allSections) {
          sectionCorrectMap.set(sec.id, 0)
        }

        for (const answer of answers) {
          if (answer.answerGiven === null || answer.answerGiven === undefined) {
            continue
          }

          const correct = isAnswerCorrect(answer.answerGiven, answer.question.correctAnswer)
          if (correct) {
            const secId = questionToSectionMap.get(answer.questionId)
            if (secId) {
              sectionCorrectMap.set(secId, (sectionCorrectMap.get(secId) || 0) + 1)
            }
          }
        }

        // Determine test category
        const categoryUpper = attempt.test.category?.toUpperCase() || ''
        const titleUpper = attempt.test.title?.toUpperCase() || ''
        
        const isSAT = categoryUpper === 'SAT' || titleUpper.includes('SAT') || 
                      (categoryUpper === 'MOCK' && !titleUpper.includes('ACT'));
        const isACT = categoryUpper === 'ACT' || titleUpper.includes('ACT');

        let finalScaledScore = 0

        if (isSAT) {
          let rw1Correct = 0, rw2Correct = 0, math1Correct = 0, math2Correct = 0
          let rw1Total = 0, rw2Total = 0, math1Total = 0, math2Total = 0

          // Names like "Section 1 : Reading & Writing (Module 2)" contain both
          // digits, so prefer an explicit "Module N" marker over bare digits.
          const moduleOf = (name: string): 1 | 2 | null => {
            const m = name.match(/module\s*([12])\b/)
            if (m) return m[1] === '1' ? 1 : 2
            if (/\b(?:1|one)\b/.test(name)) return 1
            if (/\b(?:2|two)\b/.test(name)) return 2
            return null
          }

          for (const sec of allSections) {
            const secName = sec.name.toLowerCase()
            const isMath = secName.includes('math')
            const isRW = secName.includes('reading') || secName.includes('writing') || secName.includes('rw')

            const correct = sectionCorrectMap.get(sec.id) || 0
            const total = sectionQuestionsMap.get(sec.id)?.length || 0
            const mod = moduleOf(secName)

            if (isMath) {
              if (mod === 1 || (mod === null && math1Total === 0)) {
                math1Correct += correct
                math1Total += total
              } else {
                math2Correct += correct
                math2Total += total
              }
            } else if (isRW) {
              if (mod === 1 || (mod === null && rw1Total === 0)) {
                rw1Correct += correct
                rw1Total += total
              } else {
                rw2Correct += correct
                rw2Total += total
              }
            }
          }

          const rwActualTotal = rw1Total + rw2Total || 54
          const mathActualTotal = math1Total + math2Total || 44

          const rwScaled = satSectionScore(rw1Correct, rw2Correct, rwActualTotal, false)
          const mathScaled = satSectionScore(math1Correct, math2Correct, mathActualTotal, true)

          finalScaledScore = rwScaled + mathScaled
          console.log(`[Submit] SAT calculation: RW=${rwScaled} (M1=${rw1Correct}/${rw1Total}, M2=${rw2Correct}/${rw2Total}), Math=${mathScaled} (M1=${math1Correct}/${math1Total}, M2=${math2Correct}/${math2Total})`)
        } else if (isACT) {
          const sectionScores: number[] = []
          for (const sec of allSections) {
            const correct = sectionCorrectMap.get(sec.id) || 0
            const total = sectionQuestionsMap.get(sec.id)?.length || 0
            const scaled = total > 0 ? Math.max(1, Math.min(36, Math.round((correct / total) * 36))) : 1
            sectionScores.push(scaled)
            console.log(`[Submit] ACT Section "${sec.name}": correct=${correct}, total=${total}, scaled=${scaled}`)
          }
          finalScaledScore = sectionScores.length > 0 
            ? Math.round(sectionScores.reduce((sum, s) => sum + s, 0) / sectionScores.length)
            : 0
        } else {
          // Fallback to raw positive marks
          let rawScore = 0
          for (const answer of answers) {
            if (answer.answerGiven === null || answer.answerGiven === undefined) continue
            const correct = isAnswerCorrect(answer.answerGiven, answer.question.correctAnswer)
            
            let tq = answer.question.testQuestions[0]
            if (!tq && answer.question.parentQuestion?.testQuestions?.length) {
              tq = answer.question.parentQuestion.testQuestions[0]
            }
            const marksPositive = tq?.marksPositive ?? 1
            const marksNegative = tq?.marksNegative ?? 0

            if (correct) {
              rawScore += marksPositive
            } else {
              rawScore = Math.max(0, rawScore - marksNegative)
            }
          }
          finalScaledScore = rawScore
        }

        console.log(`[Submit] Final score: ${finalScaledScore}`)
        
        await prisma.testAttempt.update({
          where: { id: attemptId },
          data: { status: 'SUBMITTED', totalScore: finalScaledScore, completedAt: new Date() },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST submit section:', error)
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 })
  }
}
