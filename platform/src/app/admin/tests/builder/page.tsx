import { getAllTopics } from '@/actions/test-actions'
import QuestionEditor from '@/components/admin/QuestionEditor'
import { prisma } from '@/lib/prisma'

export default async function TestBuilderPage() {
  // Fetch topics for the dropdown
  const { topics } = await getAllTopics()
  
  // Fetch existing questions (limiting to 10 for demo purposes)
  const existingQuestions = await prisma.question.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
  })

  // Format topics for the dropdown (flattening subtopics for simple selection)
  const formattedTopics = topics?.flatMap(t => [
    { id: t.id, name: t.name },
    ...(t.subTopics?.map(st => ({ id: st.id, name: `${t.name} > ${st.name}` })) || [])
  ]) || []

  return (
    <div className="min-h-screen bg-[#020617] text-white p-8 font-sans selection:bg-emerald-500/30">
      <div className="max-w-6xl mx-auto space-y-12 py-8">
        
        {/* Header */}
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white mb-2">
            Test Builder <span className="text-emerald-400">Question Bank</span>
          </h1>
          <p className="text-slate-400">
            Create and edit questions with rich text support and automatic saving.
          </p>
        </div>

        {/* Create New Question Section */}
        <section className="space-y-4">
          <QuestionEditor topics={formattedTopics} />
        </section>

        {/* Existing Questions List (Demo) */}
        {existingQuestions.length > 0 && (
          <section className="space-y-6 pt-12 border-t border-slate-800">
            <h2 className="text-2xl font-bold">Recent Questions</h2>
            <div className="grid grid-cols-1 gap-8">
              {existingQuestions.map(q => (
                <QuestionEditor 
                  key={q.id} 
                  topics={formattedTopics}
                  initialData={{
                    id: q.id,
                    type: q.type,
                    content: q.content as { text: string },
                    options: q.options,
                    correctAnswer: q.correctAnswer,
                    difficultyLevel: q.difficultyLevel,
                    topicId: q.topicId || undefined
                  }} 
                />
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
