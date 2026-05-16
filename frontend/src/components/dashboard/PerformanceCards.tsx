import { TrendingUp, TrendingDown, Zap, Target, Clock, BookOpen, Star } from 'lucide-react';

interface PerformanceCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  unit?: string;
  trend?: number; // percentage change
  trendLabel?: string;
  color: 'indigo' | 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'pink';
  // Mini chart sparkline data (optional)
  sparkline?: number[];
}

function PerformanceCard({
  icon,
  label,
  value,
  unit,
  trend,
  trendLabel,
  color,
  sparkline,
}: PerformanceCardProps) {
  const colorClasses = {
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-600',
    blue: 'bg-blue-50 border-blue-100 text-blue-600',
    purple: 'bg-purple-50 border-purple-100 text-purple-600',
    green: 'bg-green-50 border-green-100 text-green-600',
    orange: 'bg-orange-50 border-orange-100 text-orange-600',
    red: 'bg-red-50 border-red-100 text-red-600',
    pink: 'bg-pink-50 border-pink-100 text-pink-600',
  };

  const trendColors = {
    positive: 'text-green-600 bg-green-50',
    negative: 'text-red-600 bg-red-50',
  };

  return (
    <div className={`${colorClasses[color]} rounded-2xl p-6 border transition-all duration-300 hover:shadow-md hover:border-current group`}>
      <div className="flex items-start justify-between mb-4">
        <div className="p-2.5 bg-white/50 rounded-xl group-hover:bg-white/80 transition-colors">
          {icon}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${trend >= 0 ? trendColors.positive : trendColors.negative}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      <p className="text-sm font-medium text-slate-600 mb-2">{label}</p>

      <div className="flex items-baseline gap-2 mb-3">
        <p className="text-3xl font-bold text-slate-900">{value}</p>
        {unit && <p className="text-sm text-slate-500">{unit}</p>}
      </div>

      {trendLabel && (
        <p className="text-xs text-slate-600">{trendLabel}</p>
      )}

      {sparkline && (
        <div className="mt-4 h-8 flex items-end gap-1">
          {sparkline.map((value, i) => {
            const maxVal = Math.max(...sparkline);
            const height = (value / maxVal) * 100;
            return (
              <div
                key={i}
                className="flex-1 bg-current opacity-40 rounded-sm transition-all hover:opacity-70"
                style={{ height: `${height}%`, minHeight: '2px' }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface PerformanceCardsProps {
  analytics: {
    overallGrade: string;
    testsTaken: number;
    globalRank: number;
    accuracy: number;
    avgTimePerQuestion: number;
    weeklyStudyHours: number;
    currentStreak: number;
    weakestSubject: string;
  };
}

export function PerformanceCards({ analytics }: PerformanceCardsProps) {
  const cardsData: PerformanceCardProps[] = [
    {
      icon: <Target className="w-5 h-5" />,
      label: 'Overall Grade',
      value: analytics.overallGrade,
      trend: 5,
      trendLabel: 'vs. last test',
      color: 'indigo',
      sparkline: [20, 45, 38, 55, 60, 52, 65],
    },
    {
      icon: <BookOpen className="w-5 h-5" />,
      label: 'Tests Taken',
      value: analytics.testsTaken,
      unit: 'completed',
      trendLabel: '2 in progress',
      color: 'blue',
      sparkline: [12, 12, 12, 14, 14, 16, 18],
    },
    {
      icon: <Star className="w-5 h-5" />,
      label: 'Global Rank',
      value: `#${analytics.globalRank}`,
      trend: -8,
      trendLabel: 'vs. last month',
      color: 'purple',
      sparkline: [200, 195, 180, 165, 155, 150, 142],
    },
    {
      icon: <Zap className="w-5 h-5" />,
      label: 'Accuracy',
      value: `${analytics.accuracy}%`,
      trend: 3,
      trendLabel: 'Target: 85%',
      color: 'green',
      sparkline: [72, 74, 76, 78, 80, 80, 82],
    },
    {
      icon: <Clock className="w-5 h-5" />,
      label: 'Avg Time/Question',
      value: analytics.avgTimePerQuestion,
      unit: 'sec',
      trend: -12,
      trendLabel: 'Getting faster!',
      color: 'orange',
      sparkline: [95, 92, 89, 87, 85, 83, 78],
    },
    {
      icon: <Zap className="w-5 h-5" />,
      label: 'Weekly Study',
      value: analytics.weeklyStudyHours,
      unit: 'hours',
      trend: 18,
      trendLabel: 'vs. last week',
      color: 'pink',
      sparkline: [8, 10, 12, 14, 16, 18, 24.5],
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Performance Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cardsData.map((card, i) => (
            <PerformanceCard key={i} {...card} />
          ))}
        </div>
      </div>
    </div>
  );
}
