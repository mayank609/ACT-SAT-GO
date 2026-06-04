import { Calculator, Info } from 'lucide-react';

export interface ScoreCalculatorProps {
  rw1?: number;
  rw2?: number;
  math1?: number;
  math2?: number;
  isAdaptive?: boolean;
}

export function ScoreCalculator({ 
  rw1 = 18, 
  rw2 = 18, 
  math1 = 15, 
  math2 = 15, 
  isAdaptive = true 
}: ScoreCalculatorProps) {

  const calculateScore = () => {
    let rwScore = 200;
    let mathScore = 200;

    if (!isAdaptive) {
      // Linear approximation
      rwScore = 200 + Math.round(((rw1 + rw2) / 54) * 600 / 10) * 10;
      mathScore = 200 + Math.round(((math1 + math2) / 44) * 600 / 10) * 10;
    } else {
      // Adaptive approximation
      // RW Route threshold ~ 18
      if (rw1 >= 18) {
        // Hard route
        const raw = rw1 + rw2;
        rwScore = 400 + Math.round((raw / 54) * 400 / 10) * 10;
      } else {
        // Easy route cap ~ 650
        const raw = rw1 + rw2;
        rwScore = 200 + Math.round((raw / 54) * 450 / 10) * 10;
      }

      // Math Route threshold ~ 14
      if (math1 >= 14) {
        // Hard route
        const raw = math1 + math2;
        mathScore = 420 + Math.round((raw / 44) * 380 / 10) * 10;
      } else {
        // Easy route cap ~ 650
        const raw = math1 + math2;
        mathScore = 200 + Math.round((raw / 44) * 450 / 10) * 10;
      }
    }

    return {
      rw: Math.min(800, Math.max(200, rwScore)),
      math: Math.min(800, Math.max(200, mathScore)),
    };
  };

  const scores = calculateScore();
  const totalScore = scores.rw + scores.math;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 md:p-7 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
          <Calculator size={24} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Digital SAT Score Calculator</h2>
      </div>

      <div className="prose prose-slate max-w-none text-slate-600 mb-6 text-sm">
        <p>
          Your Digital SAT score calculator starts with one number: how many questions you answered correctly in each module. 
          Those raw scores convert into scaled section scores from 200 to 800, combining into a total from 400 to 1600. 
          Below, you will find the interactive calculator, an explanation of adaptive scoring, section benchmarks, and percentile 
          rankings so you can see exactly where your score stacks up.
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8">
        <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-4 mb-6">
          <div>
            <h3 className="font-bold text-slate-900 mb-1">Breakdown</h3>
            <p className="text-xs text-slate-500 max-w-xl">
              This is the breakdown of your performance by module. Adaptive scoring was used to calculate your final score, weighing your performance in Module 2 based on your routing from Module 1.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 bg-white border border-slate-200 px-3 py-2 rounded-lg">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600">
              <Info size={14} />
            </div>
            <span className="text-sm font-semibold text-slate-700">Adaptive Scoring Applied</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* RW Sliders */}
          <div className="space-y-6 bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <h4 className="font-bold text-slate-800">Reading & Writing</h4>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-700">Module 1 (Max 27)</span>
                <span className="font-bold text-blue-600">{rw1} correct</span>
              </div>
              <progress max="27" value={rw1} className="w-full h-2 rounded-lg appearance-none [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:bg-blue-600" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-700">Module 2 (Max 27)</span>
                <span className="font-bold text-blue-600">{rw2} correct</span>
              </div>
              <progress max="27" value={rw2} className="w-full h-2 rounded-lg appearance-none [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:bg-blue-600" />
              {isAdaptive && (
                <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                  <Info size={12} />
                  {rw1 >= 18 ? 'Harder Module 2 routing applied' : 'Easier Module 2 routing applied (Score capped)'}
                </p>
              )}
            </div>
          </div>

          {/* Math Sliders */}
          <div className="space-y-6 bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <h4 className="font-bold text-slate-800">Math</h4>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-700">Module 1 (Max 22)</span>
                <span className="font-bold text-emerald-600">{math1} correct</span>
              </div>
              <progress max="22" value={math1} className="w-full h-2 rounded-lg appearance-none [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:bg-emerald-600" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-700">Module 2 (Max 22)</span>
                <span className="font-bold text-emerald-600">{math2} correct</span>
              </div>
              <progress max="22" value={math2} className="w-full h-2 rounded-lg appearance-none [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:bg-emerald-600" />
              {isAdaptive && (
                <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                  <Info size={12} />
                  {math1 >= 14 ? 'Harder Module 2 routing applied' : 'Easier Module 2 routing applied (Score capped)'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Score Output */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-900 rounded-xl p-6 text-white text-center shadow-lg">
        <h3 className="text-slate-300 text-sm font-semibold uppercase tracking-wider mb-2">Estimated Scaled Score</h3>
        <div className="text-5xl md:text-6xl font-black mb-6 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-200">
          {totalScore}
        </div>
        
        <div className="grid grid-cols-2 gap-4 divide-x divide-slate-700/50 border-t border-slate-700/50 pt-6">
          <div>
            <p className="text-slate-400 text-xs mb-1 uppercase font-bold tracking-wide">Reading & Writing</p>
            <p className="text-3xl font-bold text-blue-300">{scores.rw}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1 uppercase font-bold tracking-wide">Math</p>
            <p className="text-3xl font-bold text-emerald-300">{scores.math}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
