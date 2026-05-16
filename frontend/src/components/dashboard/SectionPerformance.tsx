import { BookOpen, Percent } from 'lucide-react';

interface SectionPerf {
  name: string;
  accuracy: number;
  color: 'blue' | 'purple' | 'green' | 'orange';
}

interface SectionPerformanceProps {
  sections: SectionPerf[];
}

function SectionBar({ section }: { section: SectionPerf }) {
  const colorMap = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
  };

  const lightColorMap = {
    blue: 'bg-blue-50',
    purple: 'bg-purple-50',
    green: 'bg-green-50',
    orange: 'bg-orange-50',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">{section.name}</p>
        <p className="text-sm font-bold text-slate-900">{section.accuracy}%</p>
      </div>
      <div className={`h-3 ${lightColorMap[section.color]} rounded-full overflow-hidden border border-slate-200`}>
        <div
          className={`h-full ${colorMap[section.color]} rounded-full transition-all duration-500`}
          style={{ width: `${section.accuracy}%` }}
        />
      </div>
    </div>
  );
}

export function SectionPerformance({ sections }: SectionPerformanceProps) {
  const avgAccuracy = Math.round(sections.reduce((sum, s) => sum + s.accuracy, 0) / sections.length);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          Section Performance
        </h2>
        <div className="flex items-center gap-2">
          <Percent className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-900">Avg: {avgAccuracy}%</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-6">
        {sections.map((section, i) => (
          <SectionBar key={i} section={section} />
        ))}

        {/* Summary Stats */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-600 mb-1">Best Section</p>
            <p className="text-lg font-bold text-slate-900">English</p>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">Average</p>
            <p className="text-lg font-bold text-slate-900">{avgAccuracy}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">Target</p>
            <p className="text-lg font-bold text-indigo-600">90%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
