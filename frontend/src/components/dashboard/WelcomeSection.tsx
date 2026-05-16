import { Flame, TrendingUp, Trophy } from 'lucide-react';

interface WelcomeSectionProps {
  studentName: string;
  completionPercent: number;
  currentStreak: number;
  studyGoalTarget: number;
  currentXp: number;
  nextLevel?: number;
}

export function WelcomeSection({
  studentName,
  completionPercent,
  currentStreak,
  studyGoalTarget,
  currentXp,
}: WelcomeSectionProps) {
  const firstName = studentName.split(' ')[0];

  return (
    <div className="space-y-4">
      {/* Main Welcome Card */}
      <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 rounded-2xl p-8 border border-indigo-100/50 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Welcome back, {firstName} 👋
            </h1>
            <p className="text-lg text-slate-600 mb-6">
              You've completed <span className="font-semibold text-indigo-600">{completionPercent}%</span> of your weekly study goals. Keep it up!
            </p>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-700">Weekly Study Goal</span>
                <span className="text-sm font-semibold text-indigo-600">{completionPercent}/{studyGoalTarget}</span>
              </div>
              <div className="h-3 bg-white/60 rounded-full overflow-hidden border border-indigo-200/50">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Streak and XP Cards */}
          <div className="flex gap-4 flex-shrink-0 flex-col sm:flex-row">
            <div className="bg-white/70 backdrop-blur rounded-xl p-4 border border-white text-center min-w-fit">
              <Flame className="w-6 h-6 text-orange-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-900">{currentStreak}</p>
              <p className="text-xs text-slate-600">Day Streak</p>
            </div>
            <div className="bg-white/70 backdrop-blur rounded-xl p-4 border border-white text-center min-w-fit">
              <TrendingUp className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-900">{currentXp}</p>
              <p className="text-xs text-slate-600">XP Points</p>
            </div>
            <div className="bg-white/70 backdrop-blur rounded-xl p-4 border border-white text-center min-w-fit">
              <Trophy className="w-6 h-6 text-amber-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-900">Rank 5</p>
              <p className="text-xs text-slate-600">Top Student</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-100 hover:border-slate-200 transition-colors">
          <p className="text-xs text-slate-600 font-medium mb-1">Tests Completed</p>
          <p className="text-2xl font-bold text-slate-900">12</p>
          <p className="text-xs text-green-600 mt-1">↑ 2 this week</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 hover:border-slate-200 transition-colors">
          <p className="text-xs text-slate-600 font-medium mb-1">Avg Score</p>
          <p className="text-2xl font-bold text-slate-900">28</p>
          <p className="text-xs text-blue-600 mt-1">Target: 32</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 hover:border-slate-200 transition-colors">
          <p className="text-xs text-slate-600 font-medium mb-1">Global Rank</p>
          <p className="text-2xl font-bold text-slate-900">142</p>
          <p className="text-xs text-green-600 mt-1">↑ Top 5%</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 hover:border-slate-200 transition-colors">
          <p className="text-xs text-slate-600 font-medium mb-1">Study Hours</p>
          <p className="text-2xl font-bold text-slate-900">24.5</p>
          <p className="text-xs text-blue-600 mt-1">This month</p>
        </div>
      </div>
    </div>
  );
}
