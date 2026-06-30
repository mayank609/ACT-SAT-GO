import { Calculator, Info } from 'lucide-react';

// Digital SAT raw→scaled conversion tables, reproduced exactly from the
// test-ninjas.com Digital SAT Score Calculator. A raw section score is mapped
// to a lookup index, and the table value is the final scaled section score
// (200–800). RW uses a 0–66 index, Math a 0–54 index.
export const RW_SCALE: number[] = [
  200, 200, 200, 200, 200, 200, 200, 210, 210, 220, 240, 250, 260, 270, 290, 300, 330,
  350, 360, 370, 380, 380, 390, 400, 410, 420, 430, 430, 440, 450, 460, 470, 470, 480,
  490, 500, 500, 510, 520, 530, 540, 550, 550, 560, 570, 580, 590, 600, 600, 610, 620,
  630, 640, 640, 650, 660, 670, 680, 690, 700, 710, 720, 730, 740, 760, 780, 800,
];
export const MATH_SCALE: number[] = [
  200, 200, 200, 200, 200, 200, 200, 210, 220, 240, 270, 300, 310, 320, 330, 340, 350,
  350, 360, 370, 380, 390, 390, 400, 410, 420, 440, 450, 460, 480, 490, 500, 520, 530,
  540, 550, 570, 580, 590, 600, 610, 620, 640, 650, 670, 690, 710, 730, 750, 760, 770,
  780, 790, 790, 800,
];

// Convert a section's two module raw scores into a scaled section score (200–800),
// replicating test-ninjas.com exactly:
//   • Adaptive easy-route: if Module 1 is below the routing threshold (18 for RW,
//     15 for Math), Module 2's contribution is weighted down to round(0.8 × M2).
//   • The combined raw is normalized to the table index (×66 for RW, ×54 for Math)
//     and looked up in the conversion table.
export function satSectionScore(
  m1: number,
  m2: number,
  total: number,
  isMath: boolean,
  adaptive = true,
): number {
  let eff2 = m2;
  if (adaptive && (isMath ? m1 < 15 : m1 < 18)) {
    eff2 = Math.round(0.8 * m2);
  }
  const raw = m1 + eff2;
  if (!(total > 0)) return 200;
  const ratio = Math.max(0, Math.min(1, raw / total));
  const table = isMath ? MATH_SCALE : RW_SCALE;
  const idx = Math.min(Math.round((isMath ? 54 : 66) * ratio), table.length - 1);
  return table[idx];
}

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
    return {
      rw: satSectionScore(rw1, rw2, 54, false, isAdaptive),
      math: satSectionScore(math1, math2, 44, true, isAdaptive),
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
                  {math1 >= 15 ? 'Harder Module 2 routing applied' : 'Easier Module 2 routing applied (Score capped)'}
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
