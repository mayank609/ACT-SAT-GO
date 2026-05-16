import { Calendar, Clock, BookOpen } from 'lucide-react';

interface PlannerItem {
  id: string;
  date: string;
  day: string;
  title: string;
  description: string;
  duration: number; // minutes
  type: 'study' | 'test' | 'review' | 'assignment';
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
}

function PlannerItemCard({ item }: { item: PlannerItem }) {
  const typeColors = {
    study: { bg: 'bg-blue-50', border: 'border-blue-200', icon: '📚', label: 'Study' },
    test: { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: '✏️', label: 'Test' },
    review: { bg: 'bg-purple-50', border: 'border-purple-200', icon: '👀', label: 'Review' },
    assignment: { bg: 'bg-green-50', border: 'border-green-200', icon: '✅', label: 'Assignment' },
  };

  const typeConfig = typeColors[item.type];
  const priorityColors = {
    high: 'text-red-600',
    medium: 'text-orange-600',
    low: 'text-blue-600',
  };

  return (
    <div
      className={`${typeConfig.bg} border ${typeConfig.border} rounded-lg p-4 transition-all hover:shadow-md ${item.completed ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={item.completed}
          className="w-5 h-5 mt-0.5 rounded border-slate-300 text-indigo-600 cursor-pointer"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className={`font-semibold text-sm ${item.completed ? 'line-through text-slate-500' : 'text-slate-900'}`}>
              {typeConfig.icon} {item.title}
            </h4>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${priorityColors[item.priority]}`}>
              {item.priority === 'high' && '🔴 High'}
              {item.priority === 'medium' && '🟠 Medium'}
              {item.priority === 'low' && '🟢 Low'}
            </span>
          </div>

          <p className="text-xs text-slate-700 mb-2">{item.description}</p>

          <div className="flex items-center gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {item.duration} min
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {item.date}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StudyPlanner() {
  const plannerItems: PlannerItem[] = [
    {
      id: '1',
      date: 'Today',
      day: 'Mon',
      title: 'Integration by Parts Practice',
      description: 'Complete 20 integration problems from problem set',
      duration: 45,
      type: 'study',
      priority: 'high',
      completed: true,
    },
    {
      id: '2',
      date: 'Today',
      day: 'Mon',
      title: 'Reading Section Mock Test',
      description: 'Take a 35-minute timed reading section test',
      duration: 35,
      type: 'test',
      priority: 'high',
      completed: false,
    },
    {
      id: '3',
      date: 'Tomorrow',
      day: 'Tue',
      title: 'Review Yesterday\'s Mistakes',
      description: 'Go through all incorrect answers from reading test',
      duration: 30,
      type: 'review',
      priority: 'high',
      completed: false,
    },
    {
      id: '4',
      date: 'Tomorrow',
      day: 'Tue',
      title: 'Coordinate Geometry',
      description: 'Study coordinate geometry concepts and solve 15 problems',
      duration: 60,
      type: 'study',
      priority: 'medium',
      completed: false,
    },
    {
      id: '5',
      date: 'Wed',
      day: 'Wed',
      title: 'Full ACT Practice Test',
      description: 'Take complete ACT practice test under timed conditions',
      duration: 175,
      type: 'test',
      priority: 'high',
      completed: false,
    },
  ];

  const completedCount = plannerItems.filter((item) => item.completed).length;
  const completionPercent = Math.round((completedCount / plannerItems.length) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          Study Planner
        </h2>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-900">{completionPercent}% Complete</p>
          <p className="text-xs text-slate-600">
            {completedCount} of {plannerItems.length} tasks
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${completionPercent}%` }} />
      </div>

      {/* Planner Items */}
      <div className="space-y-3">
        {plannerItems.map((item) => (
          <PlannerItemCard key={item.id} item={item} />
        ))}
      </div>

      {/* CTA */}
      <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors">
        + Add New Study Session
      </button>
    </div>
  );
}
