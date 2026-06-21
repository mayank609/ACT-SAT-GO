import { Eye } from 'lucide-react';

interface TestAttempt {
  id: string;
  testName: string;
  subject: string;
  score: number;
  maxScore: number;
  accuracy: number;
  timeTaken: number; // minutes
  rank: number;
  status: 'passed' | 'excellent' | 'good' | 'needs_improvement';
  date: string;
}

function StatusBadge({ status }: { status: string }) {
  const statusMap = {
    excellent: { bg: 'bg-green-100', text: 'text-green-700', label: 'Excellent' },
    good: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Good' },
    passed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Passed' },
    needs_improvement: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Improving' },
  };
  const config = statusMap[status as keyof typeof statusMap] || statusMap.good;
  return <span className={`${config.bg} ${config.text} text-xs font-semibold px-2.5 py-1 rounded-lg`}>{config.label}</span>;
}

export function RecentTestsTable() {
  const tests: TestAttempt[] = [
    {
      id: '1',
      testName: 'ACT Full Practice #1',
      subject: 'ACT Comprehensive',
      score: 28,
      maxScore: 36,
      accuracy: 82,
      timeTaken: 163,
      rank: 142,
      status: 'good',
      date: '2 days ago',
    },
    {
      id: '2',
      testName: 'Math Section Diagnostic',
      subject: 'Mathematics',
      score: 33,
      maxScore: 36,
      accuracy: 92,
      timeTaken: 60,
      rank: 45,
      status: 'excellent',
      date: '5 days ago',
    },
    {
      id: '3',
      testName: 'Reading Practice Test',
      subject: 'English/Reading',
      score: 25,
      maxScore: 36,
      accuracy: 76,
      timeTaken: 58,
      rank: 289,
      status: 'passed',
      date: '1 week ago',
    },
    {
      id: '4',
      testName: 'Science Section',
      subject: 'Science',
      score: 26,
      maxScore: 36,
      accuracy: 74,
      timeTaken: 35,
      rank: 156,
      status: 'needs_improvement',
      date: '2 weeks ago',
    },
    {
      id: '5',
      testName: 'SAT Math Practice #2',
      subject: 'Mathematics',
      score: 740,
      maxScore: 800,
      accuracy: 88,
      timeTaken: 70,
      rank: 89,
      status: 'excellent',
      date: '2 weeks ago',
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Recent Test Attempts</h2>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-50 to-blue-100/40 border-b border-blue-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-blue-800">Test Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-blue-800">Score</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-blue-800">Accuracy</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-blue-800">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-blue-800">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-blue-800">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-blue-800">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tests.map((test) => (
                <tr key={test.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{test.testName}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{test.date}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-bold text-slate-900">
                      {test.score}/{test.maxScore}
                    </p>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${test.accuracy >= 85 ? 'bg-green-500' : test.accuracy >= 75 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${test.accuracy}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-slate-900 min-w-fit">{test.accuracy}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-700">{test.timeTaken} min</td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-slate-900">#{test.rank}</td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={test.status} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors inline-flex items-center justify-center">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-sm text-slate-600">Showing 5 of 24 attempts</p>
          <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
            View All
          </button>
        </div>
      </div>
    </div>
  );
}
