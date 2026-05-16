import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar } from 'recharts';
import { useState } from 'react';

const chartData = [
  { test: 'T-1', score: 24, classAvg: 25, accuracy: 72 },
  { test: 'T-2', score: 25, classAvg: 25.5, accuracy: 74 },
  { test: 'T-3', score: 26, classAvg: 25.8, accuracy: 76 },
  { test: 'T-4', score: 27, classAvg: 26, accuracy: 78 },
  { test: 'T-5', score: 27, classAvg: 26.3, accuracy: 77 },
  { test: 'Live', score: 28, classAvg: 26.5, accuracy: 82 },
];

type ChartType = 'score' | 'accuracy';

export function TestActivityChart() {
  const [chartType, setChartType] = useState<ChartType>('score');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Test Performance Analytics</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setChartType('score')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              chartType === 'score'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Score Trend
          </button>
          <button
            onClick={() => setChartType('accuracy')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              chartType === 'accuracy'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Accuracy
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
        <ResponsiveContainer width="100%" height={300}>
          {chartType === 'score' ? (
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="test" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Legend />
              <Bar dataKey="score" fill="#6366f1" radius={[8, 8, 0, 0]} name="Your Score" />
              <Line dataKey="classAvg" stroke="#94a3b8" strokeWidth={2} name="Class Average" />
            </ComposedChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="test" stroke="#64748b" />
              <YAxis stroke="#64748b" domain={[70, 85]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Legend />
              <Line
                dataKey="accuracy"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 5 }}
                activeDot={{ r: 7 }}
                name="Accuracy %"
              />
            </LineChart>
          )}
        </ResponsiveContainer>

        {/* Legend Info */}
        <div className="mt-6 grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-600 font-medium mb-1">Latest Score</p>
            <p className="text-2xl font-bold text-slate-900">28/36</p>
          </div>
          <div>
            <p className="text-xs text-slate-600 font-medium mb-1">Accuracy</p>
            <p className="text-2xl font-bold text-green-600">82%</p>
          </div>
          <div>
            <p className="text-xs text-slate-600 font-medium mb-1">Improvement</p>
            <p className="text-2xl font-bold text-blue-600">+4 pts</p>
          </div>
        </div>
      </div>
    </div>
  );
}
