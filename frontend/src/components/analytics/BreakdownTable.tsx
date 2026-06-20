import type { ReactNode } from 'react';
import { type Agg, accuracy, avgTime, fmtTime } from '../../lib/analyticsData';

export function AccuracyBar({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 60 ? 'bg-amber-400' :
                'bg-rose-400';
  return (
    <div className="flex items-center gap-2 min-w-[96px]">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold w-9 text-right text-slate-700">{pct}%</span>
    </div>
  );
}

/** A Domain or Skill breakdown table (Correct/Total · Mistakes · Doubts · Cleared · Avg Time · Accuracy). */
export function BreakdownTable({
  title, subtitle, icon, firstColLabel, rows,
}: {
  title: string; subtitle: string; icon: ReactNode; firstColLabel: string;
  rows: Array<{ name: string; agg: Agg }>;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <span className="text-[#1b3d6e]">{icon}</span>
        <div>
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{firstColLabel}</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Correct / Total</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Mistakes</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Doubts</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Cleared</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Avg Time</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide w-36">Accuracy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">No data yet</td></tr>
            ) : rows.map(({ name, agg }) => {
              const acc = accuracy(agg);
              const empty = agg.total === 0;
              return (
                <tr key={name} className={`hover:bg-gray-50 transition-colors ${empty ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{name}</td>
                  <td className="px-3 py-3 text-center font-semibold text-slate-700">
                    <span className="text-emerald-600">{agg.correct}</span>
                    <span className="text-gray-300"> / </span>
                    <span className="text-gray-500">{agg.total}</span>
                  </td>
                  <td className={`px-3 py-3 text-center ${agg.incorrect > 0 ? 'font-semibold text-rose-500' : 'text-slate-400'}`}>{agg.incorrect}</td>
                  <td className={`px-3 py-3 text-center ${agg.doubts > 0 ? 'font-semibold text-amber-500' : 'text-slate-400'}`}>{agg.doubts}</td>
                  <td className={`px-3 py-3 text-center ${agg.cleared > 0 ? 'font-semibold text-blue-500' : 'text-slate-400'}`}>{agg.cleared}</td>
                  <td className="px-3 py-3 text-center text-xs text-slate-500">{fmtTime(avgTime(agg))}</td>
                  <td className="px-4 py-3">{empty ? <span className="text-xs text-gray-300">—</span> : <AccuracyBar pct={acc} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
