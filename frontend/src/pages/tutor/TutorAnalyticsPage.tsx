import { useState } from 'react';
import { TrendingUp, AlertTriangle, Clock, Users, ArrowUpRight, CheckCircle2, ChevronRight, Award, Compass, BarChart3, HelpCircle } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Card, StatCard } from '../../components/common/Card';
import { MOCK_STUDENTS, MOCK_TUTORS } from '../../data/mockData';
import { useAuthStore } from '../../store/useAuthStore';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

// Custom mocks for student-specific topic performance
const STUDENT_TOPIC_DATA: Record<string, { topic: string; accuracy: number; category: string }[]> = {
  's-1': [ // Alex Thompson
    { topic: 'Grammar', accuracy: 88, category: 'English' },
    { topic: 'Algebra', accuracy: 86, category: 'Math' },
    { topic: 'Data Analysis', accuracy: 78, category: 'Science' },
    { topic: 'Main Idea', accuracy: 84, category: 'Reading' },
    { topic: 'Punctuation', accuracy: 75, category: 'English' },
    { topic: 'Trigonometry', accuracy: 45, category: 'Math' },
    { topic: 'Inference', accuracy: 52, category: 'Reading' },
  ],
  's-3': [ // Morgan Davis
    { topic: 'Grammar', accuracy: 72, category: 'English' },
    { topic: 'Algebra', accuracy: 68, category: 'Math' },
    { topic: 'Data Analysis', accuracy: 92, category: 'Science' },
    { topic: 'Main Idea', accuracy: 80, category: 'Reading' },
    { topic: 'Scientific Method', accuracy: 88, category: 'Science' },
    { topic: 'Trigonometry', accuracy: 60, category: 'Math' },
    { topic: 'Vocabulary', accuracy: 85, category: 'Reading' },
  ],
  's-4': [ // Casey Wilson
    { topic: 'Grammar', accuracy: 60, category: 'English' },
    { topic: 'Algebra', accuracy: 54, category: 'Math' },
    { topic: 'Data Analysis', accuracy: 65, category: 'Science' },
    { topic: 'Main Idea', accuracy: 70, category: 'Reading' },
    { topic: 'Punctuation', accuracy: 58, category: 'English' },
    { topic: 'Geometry', accuracy: 50, category: 'Math' },
    { topic: 'Inference', accuracy: 55, category: 'Reading' },
  ],
};

const DEFAULT_TOPIC_DATA = [
  { topic: 'Grammar', accuracy: 82, category: 'English' },
  { topic: 'Algebra', accuracy: 78, category: 'Math' },
  { topic: 'Data Analysis', accuracy: 75, category: 'Science' },
  { topic: 'Main Idea', accuracy: 79, category: 'Reading' },
  { topic: 'Punctuation', accuracy: 68, category: 'English' },
  { topic: 'Trigonometry', accuracy: 51, category: 'Math' },
  { topic: 'Inference', accuracy: 60, category: 'Reading' },
];

const HISTORICAL_TRENDS = [
  { month: 'Oct', 'Alex Thompson': 22, 'Jordan Lee': 20, 'Morgan Davis': 18, 'Casey Wilson': 16 },
  { month: 'Nov', 'Alex Thompson': 24, 'Jordan Lee': 22, 'Morgan Davis': 21, 'Casey Wilson': 19 },
  { month: 'Dec', 'Alex Thompson': 25, 'Jordan Lee': 24, 'Morgan Davis': 23, 'Casey Wilson': 21 },
  { month: 'Jan', 'Alex Thompson': 27, 'Jordan Lee': 25, 'Morgan Davis': 24, 'Casey Wilson': 22 },
  { month: 'Feb', 'Alex Thompson': 28, 'Jordan Lee': 26, 'Morgan Davis': 27, 'Casey Wilson': 24 },
];

export function TutorAnalyticsPage() {
  const { user } = useAuthStore();
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [comparisonIds, setComparisonIds] = useState<string[]>(['s-1', 's-3']);

  const tutor = MOCK_TUTORS.find((t) => t.id === user?.id) ?? MOCK_TUTORS[0];
  
  // Filter for students assigned to the logged-in tutor
  const assignedStudents = MOCK_STUDENTS.filter((s) =>
    tutor.assignedStudentIds?.includes(s.id) || s.tutorId === tutor.id
  );

  // Fallback to general students if none are explicitly assigned to make the dashboard highly functional
  const activeStudents = assignedStudents.length ? assignedStudents : MOCK_STUDENTS.slice(0, 4);

  // Compute overall stats
  const avgScore = activeStudents.length
    ? Math.round(activeStudents.reduce((a, s) => a + (s.avgScore ?? 0), 0) / activeStudents.length)
    : 0;
  const totalTests = activeStudents.reduce((a, s) => a + (s.testsAttempted ?? 0), 0);
  const onTrackCount = activeStudents.filter(
    (s) => (s.avgScore ?? 0) >= (s.targetScore ?? 36) * 0.85
  ).length;

  const currentStudentProfile = activeStudents.find(s => s.id === selectedStudent);

  // Dynamic topic analysis data based on selected student
  const topicPerformance = selectedStudent === 'all' 
    ? DEFAULT_TOPIC_DATA 
    : (STUDENT_TOPIC_DATA[selectedStudent] ?? DEFAULT_TOPIC_DATA);

  // Categorize Strong (>= 75%) and Weak (< 65%) Topics
  const strongTopics = topicPerformance.filter(t => t.accuracy >= 75);
  const weakTopics = topicPerformance.filter(t => t.accuracy < 65);

  // Section-wise accuracy calculation
  const getSectionAccuracy = (section: string) => {
    if (selectedStudent !== 'all') {
      const match = topicPerformance.find(t => t.category === section);
      return match ? match.accuracy : 70;
    }
    // Aggregate average
    const topics = topicPerformance.filter(t => t.category === section);
    return topics.length ? Math.round(topics.reduce((a, t) => a + t.accuracy, 0) / topics.length) : 70;
  };

  const sectionsList = [
    { name: 'English', accuracy: getSectionAccuracy('English'), questions: 75, time: '45m' },
    { name: 'Math', accuracy: getSectionAccuracy('Math'), questions: 60, time: '60m' },
    { name: 'Reading', accuracy: getSectionAccuracy('Reading'), questions: 40, time: '35m' },
    { name: 'Science', accuracy: getSectionAccuracy('Science'), questions: 40, time: '35m' },
  ];

  // Student comparison calculation
  const comparisonData = sectionsList.map(sec => {
    const dataRow: Record<string, string | number> = { section: sec.name };
    comparisonIds.forEach(id => {
      const student = activeStudents.find(s => s.id === id);
      if (student) {
        const studentTopics = STUDENT_TOPIC_DATA[id] ?? DEFAULT_TOPIC_DATA;
        const match = studentTopics.find(t => t.category === sec.name);
        dataRow[student.name] = match ? match.accuracy : 70;
      }
    });
    return dataRow;
  });

  const handleToggleComparison = (id: string) => {
    setComparisonIds(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id) 
        : [...prev, id]
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Student Performance Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {selectedStudent === 'all' 
              ? `Aggregated insights across all ${activeStudents.length} assigned students` 
              : `Performance breakdown for ${currentStudentProfile?.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-semibold hidden md:inline">Focus Student:</span>
          <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Students (Aggregate)</option>
            {activeStudents.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Dynamic Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Focus Group" value={selectedStudent === 'all' ? activeStudents.length : 1} subtitle={selectedStudent === 'all' ? 'Active Students' : 'Single Student Selected'} icon={<Users size={20} />} color="blue" />
        <StatCard title="Avg ACT Score" value={selectedStudent === 'all' ? avgScore : (currentStudentProfile?.avgScore || '—')} subtitle="Standard Scale Score" icon={<TrendingUp size={20} />} color="emerald" trend={{ value: 2.4, positive: true }} />
        <StatCard title="Practice Tests" value={selectedStudent === 'all' ? totalTests : (currentStudentProfile?.testsAttempted || 0)} subtitle="Attempts completed" icon={<Clock size={20} />} color="purple" />
        <StatCard title="Target Score Status" value={selectedStudent === 'all' ? `${onTrackCount}/${activeStudents.length}` : `${currentStudentProfile?.avgScore ?? 0}/${currentStudentProfile?.targetScore ?? 36}`} subtitle={selectedStudent === 'all' ? 'On track for target' : 'Current vs Target Score'} icon={<Award size={20} />} color="amber" />
      </div>

      {/* Heatmap & Accuracy Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        
        {/* Section Accuracy Heatmaps (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 p-4 md:p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Section-wise Performance Heatmaps</h3>
                <p className="text-[11px] text-slate-400">Score & syllabus revision categories by ACT subject</p>
              </div>
              <Badge variant="info" className="bg-blue-50 text-blue-700 border-blue-100 font-semibold text-[10px]">HEATMAP</Badge>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sectionsList.map((sec) => {
                const isExcellent = sec.accuracy >= 80;
                const isWarning = sec.accuracy < 65;
                const categoryLabel = isExcellent ? 'Excellent' : isWarning ? 'Needs Work' : 'Proficient';
                const progressColor = isExcellent ? 'bg-emerald-500' : isWarning ? 'bg-red-400' : 'bg-blue-500';
                const cardStyle = isExcellent 
                  ? 'border-emerald-100 bg-emerald-50/10' 
                  : isWarning 
                    ? 'border-red-100 bg-red-50/10 animate-pulse' 
                    : 'border-blue-50 bg-blue-50/5';
                
                return (
                  <div key={sec.name} className={`p-3 border rounded-xl shadow-xs transition-all ${cardStyle}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-xs font-bold text-slate-700 block">{sec.name} Section</span>
                        <span className="text-[10px] text-slate-400 block">{sec.questions} Qs • {sec.time} Limit</span>
                      </div>
                      <Badge variant={isExcellent ? 'success' : isWarning ? 'danger' : 'warning'} className="text-[9px] font-bold">
                        {categoryLabel}
                      </Badge>
                    </div>

                    <div className="flex items-end justify-between mt-3 mb-1">
                      <span className="text-xs text-slate-500">Syllabus Accuracy</span>
                      <span className="text-base font-extrabold text-slate-800">{sec.accuracy}%</span>
                    </div>

                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${sec.accuracy}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Historical Improvement Line Graph */}
          <div className="bg-white rounded-xl border border-slate-100 p-4 md:p-5 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Historical Improvement Trends</h3>
              <p className="text-[11px] text-slate-400 mb-4">Monthly score progress map showing growth trajectory</p>
            </div>
            
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={HISTORICAL_TRENDS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[12, 36]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                {selectedStudent === 'all' ? (
                  activeStudents.slice(0, 3).map((st, idx) => (
                    <Line key={st.id} type="monotone" dataKey={st.name} stroke={COLORS[idx]} strokeWidth={2} dot={{ r: 3 }} />
                  ))
                ) : (
                  <Line type="monotone" dataKey={currentStudentProfile?.name || ''} stroke="#3b82f6" strokeWidth={3} dot={{ r: 5 }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weak vs Strong Topic Cards (1/3 width) */}
        <div className="space-y-4">
          {/* Strong Topics */}
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-0.5"><CheckCircle2 className="text-emerald-500 w-4 h-4" /> Strong Syllabus Topics</h3>
            <p className="text-[10px] text-slate-400 mb-3">Concepts mastered with high proficiency</p>
            
            <div className="space-y-2">
              {strongTopics.map(t => (
                <div key={t.topic} className="flex items-center justify-between p-2 border border-emerald-50/50 bg-emerald-50/10 rounded-lg">
                  <div>
                    <span className="text-xs font-semibold text-slate-700 block">{t.topic}</span>
                    <span className="text-[9px] text-slate-400 uppercase font-semibold">{t.category} Category</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-700 block">{t.accuracy}%</span>
                    <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">Mastered</span>
                  </div>
                </div>
              ))}
              {strongTopics.length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">No current topics meet mastering threshold.</p>
              )}
            </div>
          </div>

          {/* Weak Topics */}
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-400" />
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-0.5"><AlertTriangle className="text-red-500 w-4 h-4 animate-pulse" /> Critical Syllabus Focus</h3>
            <p className="text-[10px] text-slate-400 mb-3">Key weak areas needing immediate revision</p>
            
            <div className="space-y-2">
              {weakTopics.map(t => (
                <div key={t.topic} className="flex items-center justify-between p-2 border border-red-50 bg-red-50/10 rounded-lg">
                  <div>
                    <span className="text-xs font-semibold text-slate-700 block">{t.topic}</span>
                    <span className="text-[9px] text-slate-400 uppercase font-semibold">{t.category} Category</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-red-600 block">{t.accuracy}%</span>
                    <span className="text-[8px] font-bold text-red-500 bg-red-50 px-1 py-0.5 rounded border border-red-100">Needs Work</span>
                  </div>
                </div>
              ))}
              {weakTopics.length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">No weak topics identified currently!</p>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Student Comparison & Topic-wise breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        
        {/* Student Comparison Chart (2/3 width) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-4 md:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5"><BarChart3 size={15} className="text-blue-500" /> Student Comparison Analytics</h3>
              <p className="text-[11px] text-slate-400">Select students below to overlay their accuracy profile side-by-side</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {activeStudents.map(st => (
                <label key={st.id} className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer hover:bg-slate-100 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={comparisonIds.includes(st.id)}
                    onChange={() => handleToggleComparison(st.id)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span className="font-semibold text-slate-700">{st.name.split(' ')[0]}</span>
                </label>
              ))}
            </div>
          </div>

          {comparisonIds.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center border border-dashed border-slate-200 rounded-xl">
              <span className="text-xs text-slate-400">Please select at least one student checkbox above to draw comparison graph.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={comparisonData} barSize={12} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                <XAxis dataKey="section" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                {comparisonIds.map((id, idx) => {
                  const name = activeStudents.find(s => s.id === id)?.name || '';
                  return (
                    <Bar key={id} dataKey={name} fill={COLORS[idx % COLORS.length]} radius={[3, 3, 0, 0]} />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Skill Radar Chart (1/3 width) */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-0.5"><Compass className="text-blue-500 w-4 h-4" /> Core Skill Profile</h3>
          <p className="text-[10px] text-slate-400 mb-3">Radial mapping of syllabus topic expertise</p>
          
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={topicPerformance}>
              <PolarGrid stroke="#f1f5f9" />
              <PolarAngleAxis dataKey="topic" tick={{ fontSize: 8, fill: '#64748b' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Accuracy" dataKey="accuracy" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '11px' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* Aggregate Student Performance Table summary */}
      <Card padding="none" className="border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-bold text-slate-900 text-sm">Class Performance Overview</h3>
          <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 font-bold uppercase">Syllabus Tracking</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                {['Student Profile', 'Grade', 'Completed Tests', 'Current Avg ACT', 'Target Goal', 'Gap to Target', 'Weekly Status', 'Action Plan'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeStudents.map((s, i) => {
                const gap = (s.targetScore ?? 36) - (s.avgScore ?? 0);
                const onTrack = gap <= 3;
                return (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 text-xs font-bold border border-blue-100 flex-shrink-0">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 block text-xs">{s.name}</span>
                          <span className="text-[10px] text-slate-400 block">{s.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs font-medium">{s.grade ? `Grade ${s.grade}` : '—'}</td>
                    <td className="px-4 py-3 text-slate-700 text-xs font-semibold">{s.testsAttempted ?? 0} tests</td>
                    <td className="px-4 py-3 font-extrabold text-slate-800 text-xs">{s.avgScore ?? '—'} pts</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{s.targetScore ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold ${gap > 5 ? 'text-red-500' : gap > 2 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {gap > 0 ? `−${gap} pts` : '+' + Math.abs(gap) + ' pts'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold flex items-center gap-0.5 ${i % 2 === 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
                        <ArrowUpRight size={12} />
                        {i % 2 === 0 ? 'Improving' : 'Steady Progress'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={onTrack ? 'success' : gap > 5 ? 'danger' : 'warning'} className="text-[10px] font-bold">
                        {onTrack ? 'On Track' : gap > 5 ? 'At Risk' : 'Needs Supervision'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
