import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { MOCK_TESTS, MOCK_ANALYTICS, MOCK_ATTEMPTS } from '../../data/mockData';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const topicRadar = [
  { topic: 'Algebra', score: 87 },
  { topic: 'Grammar', score: 82 },
  { topic: 'Reading', score: 77 },
  { topic: 'Science', score: 73 },
  { topic: 'Geometry', score: 65 },
  { topic: 'Trig', score: 60 },
];

interface QuestionReviewItemProps {
  question: { id: string; text: string; type: string; options?: { id: string; text: string }[]; correctAnswer: string | string[] | number; topic: string; difficulty: string; explanation?: string };
  index: number;
  attempt?: { selectedAnswer?: string | string[] | number | null; state: string; timeSpent: number };
}

function QuestionReviewItem({ question, index, attempt }: QuestionReviewItemProps) {
  const [showExplanation, setShowExplanation] = useState(false);
  const userAnswer = attempt?.selectedAnswer;
  const correctAnswer = question.correctAnswer;
  const isCorrect = Array.isArray(correctAnswer)
    ? JSON.stringify([...(userAnswer as string[])].sort()) === JSON.stringify([...correctAnswer].sort())
    : String(userAnswer) === String(correctAnswer);
  const isSkipped = !userAnswer || (Array.isArray(userAnswer) && userAnswer.length === 0);

  return (
    <div className={`border-2 rounded-xl overflow-hidden ${isCorrect ? 'border-emerald-200' : isSkipped ? 'border-slate-200' : 'border-red-200'}`}>
      <div className={`px-3 md:px-4 py-3 flex items-start gap-2 md:gap-3 ${isCorrect ? 'bg-emerald-50' : isSkipped ? 'bg-slate-50' : 'bg-red-50'}`}>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${isCorrect ? 'bg-emerald-500' : isSkipped ? 'bg-slate-400' : 'bg-red-500'}`}>
            {index + 1}
          </div>
          {isCorrect ? <CheckCircle size={14} className="text-emerald-600" /> : <XCircle size={14} className={isSkipped ? 'text-slate-400' : 'text-red-500'} />}
        </div>
        <p className="text-sm text-slate-800 flex-1 leading-relaxed min-w-0">
          {question.text || `Question ${index + 1}: Sample question`}
        </p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {attempt?.timeSpent && <span className="text-xs text-slate-500 hidden sm:flex items-center gap-1"><Clock size={9} />{attempt.timeSpent}s</span>}
          <Badge variant={isCorrect ? 'success' : isSkipped ? 'default' : 'danger'} size="sm">
            {isCorrect ? 'Correct' : isSkipped ? 'Skip' : 'Wrong'}
          </Badge>
        </div>
      </div>

      <div className="px-3 md:px-4 py-3 bg-white">
        {question.options && (
          <div className="space-y-1.5 mb-3">
            {question.options.map((opt) => {
              const isUserAnswer = Array.isArray(userAnswer) ? userAnswer.includes(opt.id) : userAnswer === opt.id;
              const isCorrectOption = Array.isArray(correctAnswer) ? correctAnswer.includes(opt.id) : correctAnswer === opt.id;
              return (
                <div key={opt.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
                  isCorrectOption ? 'bg-emerald-50 border border-emerald-200' :
                  isUserAnswer && !isCorrectOption ? 'bg-red-50 border border-red-200' : 'border border-transparent'
                }`}>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isCorrectOption ? 'border-emerald-500 bg-emerald-500 text-white' :
                    isUserAnswer ? 'border-red-400 bg-red-400 text-white' : 'border-slate-300 text-slate-500'
                  }`}>{opt.id.toUpperCase()}</div>
                  <span className={`flex-1 min-w-0 ${isCorrectOption ? 'text-emerald-800 font-medium' : isUserAnswer ? 'text-red-700 line-through' : 'text-slate-600'}`}>
                    {opt.text || `Option ${opt.id.toUpperCase()}`}
                  </span>
                  {isCorrectOption && <span className="text-xs text-emerald-600 font-medium flex-shrink-0">✓</span>}
                  {isUserAnswer && !isCorrectOption && <span className="text-xs text-red-500 font-medium flex-shrink-0">✗</span>}
                </div>
              );
            })}
          </div>
        )}
        {question.explanation && (
          <button onClick={() => setShowExplanation(!showExplanation)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
            {showExplanation ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {showExplanation ? 'Hide' : 'Show'} Explanation
          </button>
        )}
        {showExplanation && question.explanation && (
          <div className="mt-2 p-3 bg-blue-50 rounded-xl text-xs text-blue-900">{question.explanation}</div>
        )}
      </div>
    </div>
  );
}

export function TestReviewPage() {
  useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(0);

  const attempt = MOCK_ATTEMPTS[0];
  const test = MOCK_TESTS.find((t) => t.id === attempt?.testId) ?? MOCK_TESTS[0];

  const sectionBarData = MOCK_ANALYTICS.sections.map((s) => ({
    name: s.sectionName,
    correct: s.correct,
    incorrect: s.incorrect,
    skipped: s.skipped,
  }));

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold text-slate-900 truncate">Test Review: {test.title}</h1>
          <p className="text-sm text-slate-500">Completed · Attempt #{attempt?.id}</p>
        </div>
      </div>

      {/* Score summary */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-4 md:p-6 text-white">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          <div className="col-span-2 sm:col-span-1 text-center bg-white/10 rounded-xl p-3 md:p-4">
            <p className="text-3xl md:text-5xl font-bold">{MOCK_ANALYTICS.totalScore}</p>
            <p className="text-blue-200 text-xs mt-1">Composite</p>
            <p className="text-blue-300 text-xs">(out of 36)</p>
          </div>
          {MOCK_ANALYTICS.sections.map((sec) => (
            <div key={sec.sectionId} className="text-center bg-white/10 rounded-xl p-3">
              <p className="text-2xl md:text-3xl font-bold">{sec.accuracy.toFixed(0)}%</p>
              <p className="text-blue-200 text-xs mt-1 truncate">{sec.sectionName}</p>
              <p className="text-blue-300 text-xs">{sec.correct}/{sec.totalQuestions}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-blue-500/50 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg md:text-xl font-bold">{MOCK_ANALYTICS.overallAccuracy}%</p>
            <p className="text-blue-300 text-xs">Accuracy</p>
          </div>
          <div>
            <p className="text-lg md:text-xl font-bold">{MOCK_ANALYTICS.percentile}th</p>
            <p className="text-blue-300 text-xs">Percentile</p>
          </div>
          <div>
            <p className="text-lg md:text-xl font-bold">{Math.round(MOCK_ANALYTICS.totalTimeUsed / 60)}m</p>
            <p className="text-blue-300 text-xs">Time Used</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Section chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 md:p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Section Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sectionBarData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="correct" fill="#10b981" radius={[4, 4, 0, 0]} name="Correct" barSize={20} />
              <Bar dataKey="incorrect" fill="#ef4444" radius={[4, 4, 0, 0]} name="Wrong" barSize={20} />
              <Bar dataKey="skipped" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Skipped" barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Skill Profile</h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={topicRadar}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="topic" tick={{ fontSize: 9, fill: '#94a3b8' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Section tabs + question review */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="border-b border-slate-200 flex overflow-x-auto">
          {test.sections.map((sec, idx) => {
            const secAna = MOCK_ANALYTICS.sections.find((s) => s.sectionId === sec.id);
            return (
              <button key={sec.id} onClick={() => setActiveSection(idx)}
                className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all ${
                  activeSection === idx ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                {sec.name}
                {secAna && <span className={`ml-1.5 text-xs ${activeSection === idx ? 'text-blue-400' : 'text-slate-400'}`}>{secAna.correct}/{secAna.totalQuestions}</span>}
              </button>
            );
          })}
        </div>

        <div className="p-4 md:p-6">
          {/* Section stats */}
          {MOCK_ANALYTICS.sections[activeSection] && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 mb-5">
              {[
                { label: 'Correct', value: MOCK_ANALYTICS.sections[activeSection].correct, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Wrong', value: MOCK_ANALYTICS.sections[activeSection].incorrect, color: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Skipped', value: MOCK_ANALYTICS.sections[activeSection].skipped, color: 'text-slate-600', bg: 'bg-slate-50' },
                { label: 'Accuracy', value: `${MOCK_ANALYTICS.sections[activeSection].accuracy.toFixed(0)}%`, color: 'text-blue-600', bg: 'bg-blue-50' },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Questions */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {test.sections[activeSection]?.questions.slice(0, 10).map((q, idx) => (
              <QuestionReviewItem key={q.id}
                question={q as Parameters<typeof QuestionReviewItem>[0]['question']}
                index={idx}
                attempt={{ selectedAnswer: idx % 3 === 0 ? null : q.correctAnswer, state: 'answered', timeSpent: 30 + idx * 5 }}
              />
            ))}
            {(test.sections[activeSection]?.questions.length ?? 0) > 10 && (
              <p className="text-center text-sm text-slate-400 py-4">
                Showing 10 of {test.sections[activeSection].questions.length} questions
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-end">
        <Button variant="secondary" onClick={() => navigate('/dashboard')}>Dashboard</Button>
        <Button variant="secondary" onClick={() => navigate('/my-progress')}>View Progress</Button>
      </div>
    </div>
  );
}
