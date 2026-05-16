import { Sparkles, Lightbulb, Target, Clock, TrendingUp } from 'lucide-react';

interface Recommendation {
  id: string;
  type: 'focus' | 'time_mgmt' | 'improvement' | 'strategy';
  title: string;
  description: string;
  icon: React.ReactNode;
  actionable: boolean;
  priority: 'high' | 'medium' | 'low';
}

export function AIRecommendations() {
  const recommendations: Recommendation[] = [
    {
      id: '1',
      type: 'focus',
      title: 'Focus on Integration by Parts',
      description:
        'You struggled with integration problems in your last 3 tests. Master this topic to boost your Calculus score by ~15%.',
      icon: <Target className="w-5 h-5" />,
      actionable: true,
      priority: 'high',
    },
    {
      id: '2',
      type: 'time_mgmt',
      title: 'Speed Up Your Reading',
      description:
        'You spent 42 seconds per question in Reading (vs. avg 35s). Practice with timed drills to improve time management.',
      icon: <Clock className="w-5 h-5" />,
      actionable: true,
      priority: 'high',
    },
    {
      id: '3',
      type: 'improvement',
      title: 'Coordinate Geometry Mastery',
      description:
        'Your accuracy is 58% in Coordinate Geometry. Complete the recommended practice set to reach 75%+.',
      icon: <TrendingUp className="w-5 h-5" />,
      actionable: true,
      priority: 'medium',
    },
    {
      id: '4',
      type: 'strategy',
      title: 'Smart Question Selection',
      description:
        'Skip harder questions initially. Solve all easy/medium first, then tackle difficult ones to maximize your score.',
      icon: <Lightbulb className="w-5 h-5" />,
      actionable: false,
      priority: 'medium',
    },
  ];

  const priorityColors = {
    high: 'border-red-200 bg-red-50 text-red-900',
    medium: 'border-orange-200 bg-orange-50 text-orange-900',
    low: 'border-blue-200 bg-blue-50 text-blue-900',
  };

  const priorityBadgeColors = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-orange-100 text-orange-700',
    low: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          AI-Powered Recommendations
        </h2>
      </div>

      <div className="space-y-3">
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className={`border rounded-xl p-4 transition-all hover:shadow-md ${priorityColors[rec.priority]}`}
          >
            <div className="flex gap-4">
              <div className="p-2 bg-white/50 rounded-lg flex-shrink-0 h-fit">
                {rec.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-sm">{rec.title}</h3>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-lg flex-shrink-0 ${priorityBadgeColors[rec.priority]}`}>
                    {rec.priority === 'high' && '🔥 High'}
                    {rec.priority === 'medium' && '⚠️ Medium'}
                    {rec.priority === 'low' && 'ℹ️ Low'}
                  </span>
                </div>
                <p className="text-sm opacity-90">{rec.description}</p>

                {rec.actionable && (
                  <button className="mt-3 text-xs font-semibold px-3 py-1.5 bg-white/40 hover:bg-white/60 rounded-lg transition-colors">
                    View Practice Set →
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Study Plan CTA */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-5 text-white mt-6">
        <h3 className="font-semibold mb-2">📚 Personalized Study Plan</h3>
        <p className="text-sm mb-4 opacity-90">
          Based on your performance, we've created a custom 7-day study plan to improve your weak areas.
        </p>
        <button className="w-full bg-white/20 hover:bg-white/30 text-white font-semibold py-2.5 rounded-lg transition-colors">
          View My Study Plan
        </button>
      </div>
    </div>
  );
}
