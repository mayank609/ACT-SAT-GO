import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { QuestionReviewItem, type DbAttempt, type DbTestQuestion } from './TestReviewPage';

export function SectionReviewPage() {
  const { attemptId, sectionIdx } = useParams<{ attemptId: string; sectionIdx: string }>();
  const [params] = useSearchParams();
  const focusQuestionId = params.get('q');
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<DbAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) { setError('No attempt ID'); setLoading(false); return; }
    api.getAttempt(attemptId)
      .then(({ attempt: raw }) => setAttempt(raw as DbAttempt))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [attemptId]);

  // Scroll to the question that was clicked in the overview table
  useEffect(() => {
    if (loading || !focusQuestionId) return;
    const el = document.getElementById(`review-q-${focusQuestionId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('ring-2', 'ring-blue-400', 'rounded-xl');
      const t = setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400', 'rounded-xl'), 2000);
      return () => clearTimeout(t);
    }
  }, [loading, focusQuestionId]);

  if (loading) return (
    <div className="flex items-center justify-center h-60">
      <Loader2 size={24} className="text-blue-500 animate-spin" />
    </div>
  );

  if (error || !attempt) return (
    <div className="text-center py-16">
      <p className="text-red-500 font-medium">{error ?? 'Attempt not found'}</p>
      <button onClick={() => navigate(-1)} className="mt-3 text-sm text-blue-600 hover:underline">Go back</button>
    </div>
  );

  const idx = Number(sectionIdx);
  const rawSections = [...attempt.sectionAttempts].sort((a, b) => a.section.orderIndex - b.section.orderIndex);
  const sa = rawSections[idx];

  if (!sa) return (
    <div className="text-center py-16">
      <p className="text-slate-500 font-medium">Section not found.</p>
      <button onClick={() => navigate(-1)} className="mt-3 text-sm text-blue-600 hover:underline">Go back</button>
    </div>
  );

  // Build answer lookup + flatten passage questions (same as the review page)
  const answersMap = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const flat: DbTestQuestion[] = [];
  const addedIds = new Set<string>();
  sa.section.questions.forEach((tq) => {
    const q = tq.question;
    const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
    if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
      q.childQuestions.forEach((cq) => {
        if (!addedIds.has(cq.id)) {
          addedIds.add(cq.id);
          flat.push({
            id: cq.id,
            questionId: cq.id,
            orderIndex: tq.orderIndex,
            question: {
              ...cq,
              subject: cq.subject || q.subject,
              topic: cq.topic || q.topic,
              content: {
                ...cq.content,
                meta: {
                  ...q.content?.meta,
                  ...cq.content?.meta,
                }
              },
              parentQuestionText: q.content.text
            } as any,
          });
        }
      });
    } else {
      const parent = (q as any).parentQuestion;
      if (!addedIds.has(q.id)) {
        addedIds.add(q.id);
        if (parent) {
          flat.push({
            id: q.id,
            questionId: q.id,
            orderIndex: tq.orderIndex,
            question: {
              ...q,
              subject: q.subject || parent.subject,
              topic: q.topic || parent.topic,
              content: {
                ...q.content,
                meta: {
                  ...parent.content?.meta,
                  ...q.content?.meta,
                }
              },
              parentQuestionText: parent.content?.text
            } as any,
          });
        } else {
          flat.push(tq);
        }
      }
    }
  });

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold text-slate-900 truncate">{sa.section.name}</h1>
          <p className="text-sm text-slate-500">{flat.length} questions · {attempt.test.title}</p>
        </div>
      </div>

      {/* All questions in this section */}
      <div className="space-y-4">
        {flat.map((tq, i) => (
          <div id={`review-q-${tq.questionId}`} key={tq.id} className="transition-all">
            <QuestionReviewItem tq={tq} index={i} studentAnswer={answersMap.get(tq.questionId)} />
          </div>
        ))}
      </div>
    </div>
  );
}
