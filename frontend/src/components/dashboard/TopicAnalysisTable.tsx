import { useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface TopicData {
  sno: number;
  topic: string;
  totalQuestions: number;
  correctQuestions: number;
  accuracy: number;
  avgMistakes: number | string;
}

interface TopicAnalysisTableProps {
  data: TopicData[];
  loading?: boolean;
}

export function TopicAnalysisTable({ data, loading = false }: TopicAnalysisTableProps) {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  const getAccuracyColor = (accuracy: number): string => {
    if (accuracy >= 80) return '#10b981'; // emerald
    if (accuracy >= 60) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-[#1b3d6e] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 font-medium">No topic data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('table')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'table'
              ? 'bg-[#1b3d6e] text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Table2 size={16} /> Table View
        </button>
        <button
          onClick={() => setViewMode('chart')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'chart'
              ? 'bg-[#1b3d6e] text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <BarChart3 size={16} /> Chart View
        </button>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">S.NO.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Topic</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Total Q's</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Correct Q's</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Accuracy</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Avg Mistakes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((row, idx) => (
                  <tr 
                    key={row.sno}
                    className={`transition-colors ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/40'
                    } hover:bg-blue-50/60`}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-600">{row.sno}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 font-medium">{row.topic}</td>
                    <td className="px-4 py-3 text-sm text-center text-slate-700">{row.totalQuestions}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-semibold text-sm">
                        {row.correctQuestions}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg font-semibold text-sm ${
                        row.accuracy >= 80 ? 'bg-emerald-100 text-emerald-700' :
                        row.accuracy >= 60 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {row.accuracy.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-slate-700 font-medium">
                      {typeof row.avgMistakes === 'string' ? row.avgMistakes : Number(row.avgMistakes).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Chart View */}
      {viewMode === 'chart' && (
        <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl p-8 shadow-sm">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data} margin={{ top: 30, right: 40, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis 
                dataKey="topic" 
                angle={-35}
                textAnchor="end"
                height={60}
                tick={{ fontSize: 13, fill: '#475569', fontWeight: 500 }}
                interval={0}
              />
              <YAxis 
                domain={[0, 100]}
                label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 13, fill: '#475569', fontWeight: 500 } }}
                tick={{ fontSize: 12, fill: '#64748b' }}
                width={50}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                  padding: '12px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
                }}
                labelStyle={{ color: '#fff', fontSize: 13, fontWeight: 600 }}
                formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Accuracy']}
                cursor={{ fill: 'rgba(27, 61, 110, 0.08)' }}
              />
              <Bar dataKey="accuracy" radius={[10, 10, 4, 4]} isAnimationActive={true}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getAccuracyColor(entry.accuracy)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
