import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Clock, AlertCircle, Zap } from 'lucide-react';

const timeDistribution = [
  { name: 'Productive', value: 65, color: '#10b981' },
  { name: 'Thinking', value: 20, color: '#3b82f6' },
  { name: 'Wasted', value: 15, color: '#ef4444' },
];

const sectionTiming = [
  { section: 'English', avg: 35, target: 35 },
  { section: 'Math', avg: 62, target: 60 },
  { section: 'Reading', avg: 42, target: 35 },
  { section: 'Science', avg: 28, target: 35 },
];

export function TimeManagementAnalytics() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
        <Clock className="w-5 h-5 text-indigo-600" />
        Time Management Analytics
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Time Distribution Pie Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">Time Distribution (Last Test)</h3>

          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={timeDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {timeDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-4 space-y-2">
            {timeDistribution.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-700">{item.name}</span>
                </div>
                <span className="font-semibold text-slate-900">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section Timing Comparison */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">Section-wise Timing (vs Target)</h3>

          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={sectionTiming} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="section" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="avg" fill="#6366f1" radius={[8, 8, 0, 0]} name="Your Time" />
              <Bar dataKey="target" fill="#cbd5e1" radius={[8, 8, 0, 0]} name="Target" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Fastest Section</p>
              <p className="text-xs text-slate-600 mt-1">Science at 28 seconds/question</p>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Slowest Section</p>
              <p className="text-xs text-slate-600 mt-1">Math at 62 seconds/question (2min over)</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Improvement Tip</p>
              <p className="text-xs text-slate-600 mt-1">Focus on reading faster without losing accuracy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Time Waste Analysis */}
      <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-5 border border-red-200">
        <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          Time Waste Analysis
        </h3>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-900 mb-1">Revisits: 7 minutes</p>
            <p className="text-xs text-slate-700">You spent 7 minutes reviewing questions you'd already answered. Consider marking and moving on.</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900 mb-1">Stuck Questions: 8 minutes</p>
            <p className="text-xs text-slate-700">Save difficult questions for last. You solved only 3 out of 8 stuck questions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
