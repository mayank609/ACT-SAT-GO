import { Calendar, Clock, ChevronRight, Play } from 'lucide-react';

interface UpcomingTest {
  id: string;
  name: string;
  subject: string;
  date: string;
  duration: number; // minutes
  difficulty: 'easy' | 'medium' | 'hard';
  daysUntil: number;
  status: 'not_started' | 'in_progress' | 'ready';
}

function TestCard({ test }: { test: UpcomingTest }) {
  const difficultyColors = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-orange-100 text-orange-700',
    hard: 'bg-red-100 text-red-700',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 hover:border-slate-200 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 mb-1">{test.name}</h3>
          <p className="text-xs text-slate-600">{test.subject}</p>
        </div>
        <div className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex-shrink-0 ${difficultyColors[test.difficulty]}`}>
          {test.difficulty.charAt(0).toUpperCase() + test.difficulty.slice(1)}
        </div>
      </div>

      <div className="space-y-2 mb-4 pb-4 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Calendar className="w-4 h-4" />
          <span>{test.date}</span>
          <span className="text-xs font-semibold text-indigo-600">({test.daysUntil}d away)</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Clock className="w-4 h-4" />
          <span>{test.duration} minutes</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 group">
          <Play className="w-4 h-4" />
          Start Test
        </button>
        <button className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function UpcomingTests() {
  const upcomingTests: UpcomingTest[] = [
    {
      id: '1',
      name: 'ACT Full Practice Test #3',
      subject: 'ACT Comprehensive',
      date: 'Mar 18, 2024',
      duration: 175,
      difficulty: 'hard',
      daysUntil: 2,
      status: 'ready',
    },
    {
      id: '2',
      name: 'SAT Math Practice',
      subject: 'Mathematics',
      date: 'Mar 22, 2024',
      duration: 70,
      difficulty: 'medium',
      daysUntil: 6,
      status: 'not_started',
    },
    {
      id: '3',
      name: 'Reading & Writing Review',
      subject: 'SAT Verbal',
      date: 'Mar 25, 2024',
      duration: 64,
      difficulty: 'medium',
      daysUntil: 9,
      status: 'not_started',
    },
    {
      id: '4',
      name: 'Science Diagnostic',
      subject: 'Science',
      date: 'Mar 28, 2024',
      duration: 35,
      difficulty: 'easy',
      daysUntil: 12,
      status: 'not_started',
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-indigo-600" />
        Upcoming Tests
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {upcomingTests.map((test) => (
          <TestCard key={test.id} test={test} />
        ))}
      </div>

      {/* View More Button */}
      <button className="w-full py-3 border-2 border-slate-200 hover:border-slate-300 text-slate-700 font-semibold rounded-xl transition-colors hover:bg-slate-50">
        View All Tests
      </button>
    </div>
  );
}
