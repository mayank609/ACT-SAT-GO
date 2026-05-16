import { CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';

interface Topic {
  name: string;
  accuracy: number;
  questionsCorrect: number;
  questionsTotal: number;
  status: 'strong' | 'improving' | 'needs_work';
}

interface TopicBreakdownProps {
  strongTopics: Topic[];
  improvementTopics: Topic[];
}

function TopicPill({ topic, isPill = true }: { topic: Topic; isPill?: boolean }) {
  const statusColors = {
    strong: 'bg-green-50 border-green-200 text-green-700',
    improving: 'bg-blue-50 border-blue-200 text-blue-700',
    needs_work: 'bg-orange-50 border-orange-200 text-orange-700',
  };

  const iconClasses = {
    strong: 'text-green-500',
    improving: 'text-blue-500',
    needs_work: 'text-orange-500',
  };

  if (isPill) {
    return (
      <div className={`${statusColors[topic.status]} rounded-full px-3 py-1.5 border text-xs font-medium flex items-center gap-2 transition-all hover:shadow-md`}>
        {topic.status === 'strong' && <CheckCircle className={`${iconClasses[topic.status]} w-3 h-3`} />}
        {topic.status === 'improving' && <TrendingUp className={`${iconClasses[topic.status]} w-3 h-3`} />}
        {topic.status === 'needs_work' && <AlertCircle className={`${iconClasses[topic.status]} w-3 h-3`} />}
        {topic.name}
        <span className="font-semibold">{topic.accuracy}%</span>
      </div>
    );
  }

  return (
    <div className={`${statusColors[topic.status]} rounded-xl p-4 border transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-sm mb-1">{topic.name}</p>
          <p className="text-xs opacity-75">
            {topic.questionsCorrect} / {topic.questionsTotal} correct
          </p>
        </div>
        {topic.status === 'strong' && <CheckCircle className={`${iconClasses[topic.status]} w-5 h-5 flex-shrink-0`} />}
        {topic.status === 'improving' && <TrendingUp className={`${iconClasses[topic.status]} w-5 h-5 flex-shrink-0`} />}
        {topic.status === 'needs_work' && <AlertCircle className={`${iconClasses[topic.status]} w-5 h-5 flex-shrink-0`} />}
      </div>

      {/* Accuracy bar */}
      <div className="h-2 bg-black/10 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            topic.status === 'strong'
              ? 'bg-green-500'
              : topic.status === 'improving'
                ? 'bg-blue-500'
                : 'bg-orange-500'
          }`}
          style={{ width: `${topic.accuracy}%` }}
        />
      </div>

      <p className="text-sm font-bold mt-2">{topic.accuracy}%</p>
    </div>
  );
}

export function TopicBreakdown({ strongTopics, improvementTopics }: TopicBreakdownProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">Topic Analysis</h2>

      {/* Strong Topics */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <div className="w-1 h-4 bg-green-500 rounded-full" />
          Strong Topics
        </h3>
        <div className="flex flex-wrap gap-2 mb-6">
          {strongTopics.map((topic, i) => (
            <TopicPill key={i} topic={topic} />
          ))}
        </div>
      </div>

      {/* Needs Improvement */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <div className="w-1 h-4 bg-orange-500 rounded-full" />
          Needs Improvement
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {improvementTopics.map((topic, i) => (
            <TopicPill key={i} topic={topic} isPill={false} />
          ))}
        </div>
      </div>

      {/* Quick Insights */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100/50">
        <p className="text-sm font-semibold text-slate-900 mb-2">💡 Quick Insight</p>
        <p className="text-sm text-slate-700">
          You're mastering{' '}
          <span className="font-semibold text-green-600">Math & Physics</span>, but consider focusing on{' '}
          <span className="font-semibold text-orange-600">Data Interpretation</span> to boost your overall score by ~2 points.
        </p>
      </div>
    </div>
  );
}
