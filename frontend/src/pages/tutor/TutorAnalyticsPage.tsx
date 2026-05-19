import { useState, useMemo } from 'react';
import {
  TrendingUp, AlertTriangle, Clock, Users, ArrowUpRight,
  CheckCircle2, Award,
  Timer, Gauge, Activity, AlertCircle, AlertOctagon
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Card, StatCard } from '../../components/common/Card';
import { MOCK_STUDENTS, MOCK_TUTORS } from '../../data/mockData';
import { useAuthStore } from '../../store/useAuthStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ScatterChart, Scatter, ReferenceLine
} from 'recharts';

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
  's-2': [ // Jordan Lee
    { topic: 'Grammar', accuracy: 80, category: 'English' },
    { topic: 'Algebra', accuracy: 78, category: 'Math' },
    { topic: 'Data Analysis', accuracy: 70, category: 'Science' },
    { topic: 'Main Idea', accuracy: 78, category: 'Reading' },
    { topic: 'Punctuation', accuracy: 74, category: 'English' },
    { topic: 'Trigonometry', accuracy: 65, category: 'Math' },
    { topic: 'Inference', accuracy: 68, category: 'Reading' },
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


// Expanded student mocks
const EXTENDED_STUDENTS = [
  ...MOCK_STUDENTS,
  { id: 's-7', name: 'Devon Miller', email: 'devon@student.com', role: 'student', tutorId: 'tutor-1', grade: '11', targetScore: 33, testsAttempted: 6, avgScore: 30, lastActive: '2024-02-14' },
  { id: 's-8', name: 'Sam Brooks', email: 'sam@student.com', role: 'student', tutorId: 'tutor-1', grade: '10', targetScore: 28, testsAttempted: 4, avgScore: 23, lastActive: '2024-02-15' },
  { id: 's-9', name: 'Robin Foster', email: 'robin@student.com', role: 'student', tutorId: 'tutor-2', grade: '12', targetScore: 34, testsAttempted: 5, avgScore: 31, lastActive: '2024-02-13' },
];

// Mock Question-Level Pacing Data for Pacing Scatter Analysis
const PACING_MOCKS: Record<string, { qNum: number; timeSpent: number; topic: string; correct: boolean }[]> = {
  's-1': [ // Alex Thompson
    { qNum: 1, timeSpent: 22, topic: 'Algebra', correct: true },
    { qNum: 2, timeSpent: 28, topic: 'Grammar', correct: true },
    { qNum: 3, timeSpent: 125, topic: 'Trigonometry', correct: false },
    { qNum: 4, timeSpent: 30, topic: 'Punctuation', correct: true },
    { qNum: 5, timeSpent: 42, topic: 'Geometry', correct: true },
    { qNum: 6, timeSpent: 140, topic: 'Algebra', correct: false },
    { qNum: 7, timeSpent: 15, topic: 'Main Idea', correct: true },
    { qNum: 8, timeSpent: 32, topic: 'Vocabulary', correct: true },
    { qNum: 9, timeSpent: 98, topic: 'Trigonometry', correct: true },
    { qNum: 10, timeSpent: 45, topic: 'Grammar', correct: true },
  ],
  's-3': [ // Morgan Davis
    { qNum: 1, timeSpent: 12, topic: 'Algebra', correct: true },
    { qNum: 2, timeSpent: 14, topic: 'Grammar', correct: false },
    { qNum: 3, timeSpent: 110, topic: 'Inference', correct: false },
    { qNum: 4, timeSpent: 18, topic: 'Punctuation', correct: true },
    { qNum: 5, timeSpent: 15, topic: 'Geometry', correct: false },
    { qNum: 6, timeSpent: 135, topic: 'Main Idea', correct: true },
    { qNum: 7, timeSpent: 22, topic: 'Data Analysis', correct: true },
    { qNum: 8, timeSpent: 25, topic: 'Scientific Method', correct: true },
    { qNum: 9, timeSpent: 115, topic: 'Conflicting Viewpoints', correct: false },
    { qNum: 10, timeSpent: 14, topic: 'Grammar', correct: true },
  ],
  's-4': [ // Casey Wilson
    { qNum: 1, timeSpent: 75, topic: 'Algebra', correct: true },
    { qNum: 2, timeSpent: 82, topic: 'Grammar', correct: false },
    { qNum: 3, timeSpent: 95, topic: 'Geometry', correct: true },
    { qNum: 4, timeSpent: 70, topic: 'Punctuation', correct: true },
    { qNum: 5, timeSpent: 88, topic: 'Main Idea', correct: true },
    { qNum: 6, timeSpent: 120, topic: 'Inference', correct: false },
    { qNum: 7, timeSpent: 78, topic: 'Data Analysis', correct: true },
    { qNum: 8, timeSpent: 85, topic: 'Scientific Method', correct: false },
    { qNum: 9, timeSpent: 135, topic: 'Geometry', correct: true },
    { qNum: 10, timeSpent: 90, topic: 'Grammar', correct: true },
  ]
};

const DEFAULT_PACING = [
  { qNum: 1, timeSpent: 35, topic: 'Algebra', correct: true },
  { qNum: 2, timeSpent: 42, topic: 'Grammar', correct: true },
  { qNum: 3, timeSpent: 65, topic: 'Geometry', correct: true },
  { qNum: 4, timeSpent: 38, topic: 'Punctuation', correct: true },
  { qNum: 5, timeSpent: 52, topic: 'Main Idea', correct: false },
  { qNum: 6, timeSpent: 88, topic: 'Inference', correct: true },
  { qNum: 7, timeSpent: 40, topic: 'Data Analysis', correct: true },
  { qNum: 8, timeSpent: 45, topic: 'Scientific Method', correct: true },
  { qNum: 9, timeSpent: 92, topic: 'Geometry', correct: false },
  { qNum: 10, timeSpent: 30, topic: 'Grammar', correct: true },
];

export function TutorAnalyticsPage() {
  const { user } = useAuthStore();
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  
  const tutor = MOCK_TUTORS.find((t) => t.id === user?.id) ?? MOCK_TUTORS[0];
  
  // Filter for students assigned to the logged-in tutor using extended data
  const activeStudents = useMemo(() => {
    const list = EXTENDED_STUDENTS.filter((s) =>
      tutor.assignedStudentIds?.includes(s.id) || s.tutorId === tutor.id
    );
    return list.length ? list : EXTENDED_STUDENTS;
  }, [tutor]);

  // Aggregate metrics
  const avgScore = useMemo(() => {
    return activeStudents.length
      ? Math.round(activeStudents.reduce((a, s) => a + (s.avgScore ?? 0), 0) / activeStudents.length)
      : 0;
  }, [activeStudents]);

  const totalTests = useMemo(() => {
    return activeStudents.reduce((a, s) => a + (s.testsAttempted ?? 0), 0);
  }, [activeStudents]);

  const onTrackCount = useMemo(() => {
    return activeStudents.filter(
      (s) => (s.avgScore ?? 0) >= (s.targetScore ?? 36) * 0.85
    ).length;
  }, [activeStudents]);

  const currentStudentProfile = activeStudents.find(s => s.id === selectedStudent);

  // Dynamic topic analysis data based on selected student
  const topicPerformance = selectedStudent === 'all' 
    ? DEFAULT_TOPIC_DATA 
    : (STUDENT_TOPIC_DATA[selectedStudent] ?? DEFAULT_TOPIC_DATA);

  const strongTopics = topicPerformance.filter(t => t.accuracy >= 75);
  const weakTopics = topicPerformance.filter(t => t.accuracy < 65);

  const getSectionAccuracy = (section: string) => {
    if (selectedStudent !== 'all') {
      const match = topicPerformance.find(t => t.category === section);
      return match ? match.accuracy : 70;
    }
    const topics = topicPerformance.filter(t => t.category === section);
    return topics.length ? Math.round(topics.reduce((a, t) => a + t.accuracy, 0) / topics.length) : 70;
  };

  const sectionsList = [
    { name: 'English', accuracy: getSectionAccuracy('English'), questions: 75, time: '45m' },
    { name: 'Math', accuracy: getSectionAccuracy('Math'), questions: 60, time: '60m' },
    { name: 'Reading', accuracy: getSectionAccuracy('Reading'), questions: 40, time: '35m' },
    { name: 'Science', accuracy: getSectionAccuracy('Science'), questions: 40, time: '35m' },
  ];

  // Dynamic Pacing Details for Pacing Scatter Analysis
  const pacingData = selectedStudent === 'all'
    ? DEFAULT_PACING
    : (PACING_MOCKS[selectedStudent] ?? DEFAULT_PACING);

  // Time Management Pacing Metrics Computation
  const pacingMetrics = useMemo(() => {
    const totalTime = pacingData.reduce((a, q) => a + q.timeSpent, 0);
    const avgTimePerQuestion = Math.round(totalTime / pacingData.length);
    
    // Inefficient solved indices (Got Stuck: spent >= 90 seconds)
    const stuckQuestions = pacingData.filter(q => q.timeSpent >= 90);
    
    // Rushed solved indices (Rushed: spent < 20 seconds)
    const rushedQuestions = pacingData.filter(q => q.timeSpent < 20);

    // Dynamic Time Efficiency score calculation
    const pacingDeviation = pacingData.reduce((sum, q) => sum + Math.abs(q.timeSpent - 45), 0) / pacingData.length;
    const timeEfficiencyScore = Math.max(40, Math.min(98, Math.round(100 - (pacingDeviation * 0.7) - (stuckQuestions.length * 3))));

    return {
      avgTimePerQuestion,
      stuckCount: stuckQuestions.length,
      rushedCount: rushedQuestions.length,
      timeEfficiencyScore,
      stuckQuestions
    };
  }, [pacingData]);

  // Section Time comparison for bar charts
  const sectionTimingData = useMemo(() => {
    const targets = { English: 36, Math: 60, Reading: 52, Science: 52 };
    
    return ['English', 'Math', 'Reading', 'Science'].map(secName => {
      let actual = 45;
      if (selectedStudent !== 'all') {
        const hash = selectedStudent.charCodeAt(0) + secName.charCodeAt(0);
        actual = 35 + (hash % 30);
      } else {
        actual = targets[secName as keyof typeof targets] + 2;
      }
      return {
        section: secName,
        'Target time (sec)': targets[secName as keyof typeof targets],
        'Actual time (sec)': actual
      };
    });
  }, [selectedStudent]);

  // Render colorful dot for Scatter Plot
  const renderDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined || !payload) return null;
    const isStuck = payload.timeSpent >= 90;
    const isRush = payload.timeSpent < 20;
    const color = isStuck ? '#ef4444' : isRush ? '#f59e0b' : '#3b82f6';
    return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#ffffff" strokeWidth={1} />;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header Panel */}
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

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Focus Group" value={selectedStudent === 'all' ? activeStudents.length : 1} subtitle="Active Cohort size" icon={<Users size={20} />} color="blue" />
        <StatCard title="Avg ACT Score" value={selectedStudent === 'all' ? avgScore : (currentStudentProfile?.avgScore || '—')} subtitle="Standard Scale Score" icon={<TrendingUp size={20} />} color="emerald" trend={{ value: 2.4, positive: true }} />
        <StatCard title="Practice Tests" value={selectedStudent === 'all' ? totalTests : (currentStudentProfile?.testsAttempted || 0)} subtitle="Attempts completed" icon={<Clock size={20} />} color="purple" />
        <StatCard title="Target Score Status" value={selectedStudent === 'all' ? `${onTrackCount}/${activeStudents.length}` : `${currentStudentProfile?.avgScore ?? 0}/${currentStudentProfile?.targetScore ?? 36}`} subtitle={selectedStudent === 'all' ? 'On track for target' : 'Current vs Target Score'} icon={<Award size={20} />} color="amber" />
      </div>

      {/* DETAILED TIME-MANAGEMENT & PACING DIAGNOSTICS DASHBOARD */}
      <Card className="border border-slate-100 shadow-sm p-4 md:p-5 bg-white overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-100 pb-3 mb-4 gap-2">
          <div>
            <h3 className="font-bold text-slate-850 text-sm flex items-center gap-2">
              <Timer className="text-blue-500 w-5 h-5" /> 
              Time-Management & Pacing Diagnostics
            </h3>
            <p className="text-[11px] text-slate-400">
              Pacing deviation, stuck-question detection, and solving efficiency metrics for {selectedStudent === 'all' ? 'Class cohort' : currentStudentProfile?.name}
            </p>
          </div>
          <Badge variant="info" className="bg-blue-50 text-blue-700 border-blue-100 font-bold text-[9px] uppercase tracking-wider flex items-center gap-1">
            <Gauge size={10} /> PACING ENGINE
          </Badge>
        </div>

        {/* Pacing Diagnostic Summary Scores */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <div className="bg-slate-50/50 p-3 border border-slate-100 rounded-xl text-center shadow-xs">
            <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Pacing Efficiency</p>
            <p className="text-xl font-black text-blue-600 mt-1">{pacingMetrics.timeEfficiencyScore}%</p>
            <span className="text-[9px] text-slate-400 font-medium">Optimal solving pace</span>
          </div>

          <div className="bg-slate-50/50 p-3 border border-slate-100 rounded-xl text-center shadow-xs">
            <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Avg Time/Question</p>
            <p className="text-xl font-black text-slate-850 mt-1">{pacingMetrics.avgTimePerQuestion}s</p>
            <span className="text-[9px] text-slate-400 font-medium">Target: 45-60s</span>
          </div>

          <div className="bg-red-50/20 p-3 border border-red-50 rounded-xl text-center shadow-xs">
            <p className="text-[9px] text-red-500 uppercase font-bold tracking-wider">Stuck Questions</p>
            <p className={`text-xl font-black mt-1 ${pacingMetrics.stuckCount > 0 ? 'text-red-600' : 'text-slate-650'}`}>
              {pacingMetrics.stuckCount} Qs
            </p>
            <span className="text-[9px] text-red-500/80 font-medium">Spent ≥90 seconds</span>
          </div>

          <div className="bg-amber-50/20 p-3 border border-amber-50 rounded-xl text-center shadow-xs">
            <p className="text-[9px] text-amber-600 uppercase font-bold tracking-wider">Rushed Solves</p>
            <p className={`text-xl font-black mt-1 ${pacingMetrics.rushedCount > 0 ? 'text-amber-600' : 'text-slate-650'}`}>
              {pacingMetrics.rushedCount} Qs
            </p>
            <span className="text-[9px] text-amber-500/80 font-medium">Solved &lt;20 seconds</span>
          </div>

          <div className="bg-slate-50/50 p-3 border border-slate-100 rounded-xl text-center shadow-xs col-span-2 md:col-span-1">
            <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Pacing Profile</p>
            <Badge 
              variant={pacingMetrics.timeEfficiencyScore >= 80 ? 'success' : pacingMetrics.timeEfficiencyScore >= 65 ? 'warning' : 'danger'}
              className="mt-2.5 text-[9px] font-extrabold uppercase px-2"
            >
              {pacingMetrics.timeEfficiencyScore >= 80 ? 'Optimal Pace' : pacingMetrics.timeEfficiencyScore >= 65 ? 'Inconsistent' : 'Severe Lag'}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
          {/* Scatter Chart: Question Pacing Analysis (2/3 width) */}
          <div className="lg:col-span-2 bg-slate-50/30 p-3 border border-slate-100 rounded-xl shadow-xs">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Activity size={12} className="text-blue-500" /> 
                  Pacing Analysis Scatter Plot
                </h4>
                <p className="text-[10px] text-slate-400">Time spent on individual questions. Hover points for diagnostic details.</p>
              </div>
              <span className="text-[9px] text-slate-400 font-semibold bg-white border border-slate-150 px-2 py-0.5 rounded shadow-xs">
                Question Pacing Matrix
              </span>
            </div>

            <div className="h-[200px] w-full bg-white border border-slate-100 rounded-lg p-2 relative">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: -5, left: -15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                  <XAxis type="number" dataKey="qNum" name="Question #" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis type="number" dataKey="timeSpent" name="TimeSpent" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} unit="s" />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }} 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '11px' }}
                    formatter={(value: any, name: any) => {
                      if (name === 'TimeSpent') return [`${value} seconds`, 'Time Spent'];
                      if (name === 'Question #') return [`Question ${value}`, 'Question'];
                      return [value, name];
                    }}
                  />
                  <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Target Max Pace (60s)', fill: '#d97706', fontSize: 8, position: 'top' }} />
                  <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Stuck Threshold (90s)', fill: '#dc2626', fontSize: 8, position: 'top' }} />
                  <Scatter name="Solve Pacing" data={pacingData} fill="#3b82f6" shape={renderDot} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Time Mismanagement Log & Inefficient Questions */}
          <div className="bg-slate-50/30 p-3 border border-slate-100 rounded-xl shadow-xs flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                <AlertOctagon size={12} className="text-red-500" /> 
                Pacing Anomalies
              </h4>
              <p className="text-[10px] text-slate-400 mb-3">Questions where student got stuck or lost valuable test time:</p>
              
              <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
                {pacingMetrics.stuckQuestions.map((q) => (
                  <div key={q.qNum} className="p-2 bg-white border border-red-50 rounded-lg flex items-center justify-between shadow-xs">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 block">Q{q.qNum}: {q.topic}</span>
                      <span className="text-[9px] text-slate-400 block uppercase font-bold">{q.correct ? 'Correct' : 'Incorrect'} Solution</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-red-600 block">{q.timeSpent}s</span>
                      <Badge variant="danger" className="text-[7px] font-extrabold px-1 py-0 border-red-150">Got Stuck</Badge>
                    </div>
                  </div>
                ))}
                {pacingMetrics.stuckQuestions.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg bg-white">
                    <CheckCircle2 size={16} className="text-emerald-500 mx-auto mb-2" />
                    Pacing is optimal! No stuck solving patterns detected.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-150 flex items-center gap-1.5 bg-blue-50/50 p-2 border border-blue-100 rounded-lg">
              <AlertCircle size={14} className="text-blue-500 flex-shrink-0" />
              <p className="text-[9.5px] text-blue-700 leading-tight">
                <strong>Tutor Action:</strong> Suggest targeted focus practice in <strong>{pacingMetrics.stuckQuestions[0]?.topic || 'Trigonometry'}</strong> to reduce question lag time.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Heatmaps & Weak Topics Section Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Section Accuracy Heatmaps */}
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

          {/* Section timing allocated vs actual bar chart */}
          <div className="bg-white rounded-xl border border-slate-100 p-4 md:p-5 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">ACT Section Timing Comparisons</h3>
              <p className="text-[11px] text-slate-400 mb-4">Comparison of target question time vs student actual average solving speeds</p>
            </div>
            
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sectionTimingData} barSize={12} barGap={4} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                <XAxis dataKey="section" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} unit="s" />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="Target time (sec)" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Actual time (sec)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weak vs Strong Syllabus Concept cards */}
        <div className="space-y-4">
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

      {/* Class Performance Overview Table */}
      <Card padding="none" className="border border-slate-100 shadow-sm overflow-hidden bg-white">
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
                    <td className="px-4 py-3 font-extrabold text-slate-850 text-xs">{s.avgScore ?? '—'} pts</td>
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
