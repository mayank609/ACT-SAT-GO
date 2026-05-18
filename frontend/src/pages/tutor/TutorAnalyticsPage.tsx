import { useState, useMemo } from 'react';
import { 
  TrendingUp, AlertTriangle, Clock, Users, ArrowUpRight, 
  CheckCircle2, Award, Compass, BarChart3, HelpCircle, 
  Search, SlidersHorizontal, Eye, EyeOff, Sparkles, RefreshCw, X
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Card, StatCard } from '../../components/common/Card';
import { MOCK_STUDENTS, MOCK_TUTORS } from '../../data/mockData';
import { useAuthStore } from '../../store/useAuthStore';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
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

const HISTORICAL_TRENDS = [
  { month: 'Oct', 'Alex Thompson': 22, 'Jordan Lee': 20, 'Morgan Davis': 18, 'Casey Wilson': 16 },
  { month: 'Nov', 'Alex Thompson': 24, 'Jordan Lee': 22, 'Morgan Davis': 21, 'Casey Wilson': 19 },
  { month: 'Dec', 'Alex Thompson': 25, 'Jordan Lee': 24, 'Morgan Davis': 23, 'Casey Wilson': 21 },
  { month: 'Jan', 'Alex Thompson': 27, 'Jordan Lee': 25, 'Morgan Davis': 24, 'Casey Wilson': 22 },
  { month: 'Feb', 'Alex Thompson': 28, 'Jordan Lee': 26, 'Morgan Davis': 27, 'Casey Wilson': 24 },
];

// Expanded mocks for scale testing
const EXTENDED_STUDENTS = [
  ...MOCK_STUDENTS,
  { id: 's-7', name: 'Devon Miller', email: 'devon@student.com', role: 'student', tutorId: 'tutor-1', grade: '11', targetScore: 33, testsAttempted: 6, avgScore: 30, lastActive: '2024-02-14' },
  { id: 's-8', name: 'Sam Brooks', email: 'sam@student.com', role: 'student', tutorId: 'tutor-1', grade: '10', targetScore: 28, testsAttempted: 4, avgScore: 23, lastActive: '2024-02-15' },
  { id: 's-9', name: 'Robin Foster', email: 'robin@student.com', role: 'student', tutorId: 'tutor-2', grade: '12', targetScore: 34, testsAttempted: 5, avgScore: 31, lastActive: '2024-02-13' },
];

type ViewMode = 'bar' | 'line' | 'radar';
type CompareMetric = 'section' | 'topic' | 'overall' | 'time';
type RangeFilter = 'all' | 'top' | 'focus';

export function TutorAnalyticsPage() {
  const { user } = useAuthStore();
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  
  // REDESIGNED Scalable Comparison State
  const [comparisonIds, setComparisonIds] = useState<string[]>(['s-1', 's-3']);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [comparisonMode, setComparisonMode] = useState<CompareMetric>('section');
  const [viewMode, setViewMode] = useState<ViewMode>('bar');
  const [hoveredStudent, setHoveredStudent] = useState<string | null>(null);
  const [hiddenStudentIds, setHiddenStudentIds] = useState<string[]>([]);
  const [showWarning, setShowWarning] = useState(false);

  // Advanced Filters for Student Selector
  const [filterGrade, setFilterGrade] = useState<string>('All');
  const [filterRange, setFilterRange] = useState<RangeFilter>('all');
  const [filterWeakTopic, setFilterWeakTopic] = useState<string>('All');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

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

  // REDESIGNED: Multi-mode scalable dataset computation
  const comparisonData = useMemo(() => {
    const activeCompareIds = comparisonIds.filter(id => !hiddenStudentIds.includes(id));
    
    if (comparisonMode === 'section') {
      return ['English', 'Math', 'Reading', 'Science'].map(secName => {
        const dataRow: Record<string, string | number> = { name: secName };
        activeCompareIds.forEach(id => {
          const student = activeStudents.find(s => s.id === id);
          if (student) {
            const studentTopics = STUDENT_TOPIC_DATA[id] ?? DEFAULT_TOPIC_DATA;
            const match = studentTopics.filter(t => t.category === secName);
            dataRow[student.name] = match.length ? Math.round(match.reduce((a, t) => a + t.accuracy, 0) / match.length) : 70;
          }
        });
        return dataRow;
      });
    }

    if (comparisonMode === 'topic') {
      return ['Grammar', 'Algebra', 'Data Analysis', 'Inference'].map(topicName => {
        const dataRow: Record<string, string | number> = { name: topicName };
        activeCompareIds.forEach(id => {
          const student = activeStudents.find(s => s.id === id);
          if (student) {
            const studentTopics = STUDENT_TOPIC_DATA[id] ?? DEFAULT_TOPIC_DATA;
            const match = studentTopics.find(t => t.topic === topicName);
            dataRow[student.name] = match ? match.accuracy : 70;
          }
        });
        return dataRow;
      });
    }

    if (comparisonMode === 'overall') {
      const dataRow: Record<string, string | number> = { name: 'Avg Scale ACT' };
      activeCompareIds.forEach(id => {
        const student = activeStudents.find(s => s.id === id);
        if (student) {
          dataRow[student.name] = student.avgScore ?? 0;
        }
      });
      return [dataRow];
    }

    // Time Management Mode (Allocated vs Used time efficiency ratio)
    return ['English', 'Math', 'Reading', 'Science'].map((secName, idx) => {
      const dataRow: Record<string, string | number> = { name: `${secName} Time %` };
      activeCompareIds.forEach((id, sIdx) => {
        const student = activeStudents.find(s => s.id === id);
        if (student) {
          // Mock time management efficiency ratio per section
          const hash = student.name.charCodeAt(0) + idx + sIdx;
          dataRow[student.name] = 75 + (hash % 25);
        }
      });
      return dataRow;
    });
  }, [comparisonIds, hiddenStudentIds, comparisonMode, activeStudents]);

  // Redesigned Autocomplete & Advanced filter logic for student list
  const filteredSelectorStudents = useMemo(() => {
    return activeStudents.filter(st => {
      const matchesSearch = st.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            st.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesGrade = filterGrade === 'All' || st.grade === filterGrade;
      
      const matchesRange = filterRange === 'all' || 
        (filterRange === 'top' && (st.avgScore ?? 0) >= 28) || 
        (filterRange === 'focus' && (st.avgScore ?? 0) < 24);

      // Filter by Weak Topic association using mock topic data
      let matchesWeakTopic = true;
      if (filterWeakTopic !== 'All') {
        const topics = STUDENT_TOPIC_DATA[st.id] ?? DEFAULT_TOPIC_DATA;
        const targetWeakTopic = topics.find(t => t.topic === filterWeakTopic);
        matchesWeakTopic = !!targetWeakTopic && targetWeakTopic.accuracy < 65;
      }

      return matchesSearch && matchesGrade && matchesRange && matchesWeakTopic;
    });
  }, [activeStudents, searchQuery, filterGrade, filterRange, filterWeakTopic]);

  // REDESIGNED Selection Limits (Max 4 students)
  const handleSelectStudent = (stId: string) => {
    if (comparisonIds.includes(stId)) {
      setComparisonIds(prev => prev.filter(x => x !== stId));
      setHiddenStudentIds(prev => prev.filter(x => x !== stId));
      setShowWarning(false);
    } else {
      if (comparisonIds.length >= 4) {
        setShowWarning(true);
        // Automatically hide warning banner after 4 seconds
        setTimeout(() => setShowWarning(false), 4000);
        return;
      }
      setComparisonIds(prev => [...prev, stId]);
      setShowWarning(false);
    }
  };

  const handleClearAllSelection = () => {
    setComparisonIds([]);
    setHiddenStudentIds([]);
    setShowWarning(false);
  };

  const handleToggleHide = (stId: string) => {
    setHiddenStudentIds(prev => 
      prev.includes(stId) 
        ? prev.filter(x => x !== stId) 
        : [...prev, stId]
    );
  };

  const activeCompareList = comparisonIds.map(id => activeStudents.find(s => s.id === id)).filter(Boolean) as typeof activeStudents;

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

      {/* REDESIGNED SCALABLE COMPARISON ANALYTICS SYSTEM */}
      <Card className="border border-slate-100 shadow-sm p-4 md:p-5 relative overflow-visible bg-white">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-slate-100 pb-4 mb-4 gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5"><BarChart3 size={15} className="text-blue-600" /> Student Comparison Analytics</h3>
            <p className="text-[11px] text-slate-400">Search and overlay up to 4 student performance profiles side-by-side</p>
          </div>
          
          {/* Comparison Graph Controls */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {(['bar', 'line', 'radar'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-bold transition-all ${
                    viewMode === mode ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Comparison Metrics Mode Toggle */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {[
                { key: 'section', label: 'Sections' },
                { key: 'topic', label: 'Topics' },
                { key: 'overall', label: 'Overall score' },
                { key: 'time', label: 'Time mgmt' }
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setComparisonMode(opt.key as CompareMetric)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                    comparisonMode === opt.key ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scalable Student Searcher and Advanced Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 items-start relative z-20">
          
          {/* Autocomplete Input Search Selector */}
          <div className="relative col-span-1 md:col-span-2">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-xs focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
              <Search size={14} className="text-slate-400 mr-2 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search students to compare (e.g. Alex, Sam)..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                className="w-full text-xs outline-none bg-transparent placeholder-slate-400 text-slate-700"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-0.5 hover:bg-slate-100 rounded-full">
                  <X size={12} className="text-slate-400" />
                </button>
              )}
            </div>

            {/* Redesigned Grouped Autocomplete Selector Dropdown */}
            {showDropdown && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowDropdown(false)} />
                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-40 max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                  <div className="p-2 bg-slate-50 flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase">
                    <span>Matching cohort ({filteredSelectorStudents.length})</span>
                    <button 
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <SlidersHorizontal size={10} /> Filters
                    </button>
                  </div>
                  
                  <div className="p-1 space-y-0.5">
                    {filteredSelectorStudents.map(st => {
                      const isSelected = comparisonIds.includes(st.id);
                      return (
                        <div
                          key={st.id}
                          onClick={() => handleSelectStudent(st.id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-blue-50/50 hover:bg-blue-50' 
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-[10px] font-bold">
                              {st.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-700 block truncate">{st.name}</span>
                              <span className="text-[9px] text-slate-400 block truncate">{st.email} • Grade {st.grade} • {st.avgScore} Avg</span>
                            </div>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            readOnly
                            className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 flex-shrink-0"
                          />
                        </div>
                      );
                    })}
                    {filteredSelectorStudents.length === 0 && (
                      <p className="text-xs text-slate-400 py-4 text-center">No students found matching filters.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Quick Stats & Controls Actions */}
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition-all ${
                showAdvancedFilters 
                  ? 'bg-blue-50 border-blue-200 text-blue-600' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal size={13} />
              Advanced Filters
            </button>
            <button 
              onClick={handleClearAllSelection}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 transition-colors"
            >
              Clear Comparison ({comparisonIds.length})
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 animate-fadeIn relative z-10">
            {/* Filter by Grade */}
            <div>
              <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Filter by Grade</label>
              <select 
                value={filterGrade} 
                onChange={(e) => setFilterGrade(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg outline-none text-slate-700"
              >
                <option value="All">All Grades</option>
                <option value="10">Grade 10</option>
                <option value="11">Grade 11</option>
                <option value="12">Grade 12</option>
              </select>
            </div>

            {/* Filter by Performance Range */}
            <div>
              <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Performance Bracket</label>
              <select 
                value={filterRange} 
                onChange={(e) => setFilterRange(e.target.value as RangeFilter)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg outline-none text-slate-700"
              >
                <option value="all">All Scores</option>
                <option value="top">Top Performers (≥28)</option>
                <option value="focus">Needs Focus (&lt;24)</option>
              </select>
            </div>

            {/* Filter by Weak Topic */}
            <div>
              <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Weak syllabus topic</label>
              <select 
                value={filterWeakTopic} 
                onChange={(e) => setFilterWeakTopic(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg outline-none text-slate-700"
              >
                <option value="All">All Topics</option>
                <option value="Trigonometry">Trigonometry</option>
                <option value="Geometry">Geometry</option>
                <option value="Inference">Inference</option>
              </select>
            </div>
          </div>
        )}

        {/* 4-Student Selection Warning Alert Banner */}
        {showWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex gap-2.5 items-center animate-shake">
            <AlertTriangle className="text-amber-500 w-5 h-5 flex-shrink-0" />
            <span className="text-xs text-amber-800 font-bold">
              Comparison limit reached! Redesign maps a maximum of 4 active students simultaneously to prevent chart overlap clutter.
            </span>
          </div>
        )}

        {/* Redesigned Dynamic Collapsible Student Legend Chips */}
        {activeCompareList.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 bg-slate-50/50 p-2 border border-slate-100 rounded-xl">
            {activeCompareList.map((st, idx) => {
              const isHidden = hiddenStudentIds.includes(st.id);
              const isHovered = hoveredStudent === st.name;
              
              return (
                <div 
                  key={st.id}
                  onMouseEnter={() => setHoveredStudent(st.name)}
                  onMouseLeave={() => setHoveredStudent(null)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 bg-white border rounded-lg text-xs transition-all shadow-xs cursor-pointer ${
                    isHovered ? 'ring-2 ring-blue-500 border-blue-300 scale-105' : 'border-slate-200 hover:border-slate-300'
                  } ${isHidden ? 'opacity-40' : 'opacity-100'}`}
                >
                  {/* Color Circle Indicator */}
                  <div 
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }} 
                  />
                  <span className="font-semibold text-slate-800">{st.name}</span>
                  
                  {/* Action controls */}
                  <div className="flex items-center gap-1 ml-2 border-l border-slate-100 pl-1.5">
                    <button 
                      onClick={() => handleToggleHide(st.id)}
                      className="p-0.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600"
                      title={isHidden ? "Show in Graph" : "Hide from Graph"}
                    >
                      {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                    <button 
                      onClick={() => handleSelectStudent(st.id)}
                      className="p-0.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-red-500"
                      title="Remove comparison"
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Scalable Chart Rendering */}
        <div className="relative z-10 w-full h-[220px]">
          {comparisonIds.filter(id => !hiddenStudentIds.includes(id)).length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 gap-2">
              <Users size={24} className="text-slate-300 animate-bounce" />
              <p className="text-xs text-slate-500 font-bold">No active student selected for comparison</p>
              <p className="text-[10px] text-slate-400">Search and check student records in the dropdown above to load data.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {/* Dynamic Switch Visualizations */}
              {viewMode === 'bar' ? (
                <BarChart data={comparisonData} barSize={10} barGap={3} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '11px' }} />
                  {activeCompareList.map((st, idx) => {
                    const isHidden = hiddenStudentIds.includes(st.id);
                    if (isHidden) return null;

                    const isAnyHovered = hoveredStudent !== null;
                    const isThisHovered = hoveredStudent === st.name;
                    const currentOpacity = isAnyHovered ? (isThisHovered ? 1.0 : 0.15) : 1.0;
                    
                    return (
                      <Bar 
                        key={st.id} 
                        dataKey={st.name} 
                        fill={COLORS[idx % COLORS.length]} 
                        opacity={currentOpacity}
                        radius={[3, 3, 0, 0]} 
                      />
                    );
                  })}
                </BarChart>
              ) : viewMode === 'line' ? (
                <LineChart data={comparisonData} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '11px' }} />
                  {activeCompareList.map((st, idx) => {
                    const isHidden = hiddenStudentIds.includes(st.id);
                    if (isHidden) return null;

                    const isAnyHovered = hoveredStudent !== null;
                    const isThisHovered = hoveredStudent === st.name;
                    const currentOpacity = isAnyHovered ? (isThisHovered ? 1.0 : 0.15) : 1.0;
                    
                    return (
                      <Line 
                        key={st.id} 
                        type="monotone"
                        dataKey={st.name} 
                        stroke={COLORS[idx % COLORS.length]} 
                        strokeWidth={isThisHovered ? 3.5 : 2}
                        opacity={currentOpacity}
                        dot={{ r: isThisHovered ? 4 : 3 }} 
                      />
                    );
                  })}
                </LineChart>
              ) : (
                <RadarChart data={comparisonData}>
                  <PolarGrid stroke="#f1f5f9" />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  {activeCompareList.map((st, idx) => {
                    const isHidden = hiddenStudentIds.includes(st.id);
                    if (isHidden) return null;

                    const isAnyHovered = hoveredStudent !== null;
                    const isThisHovered = hoveredStudent === st.name;
                    const currentOpacity = isAnyHovered ? (isThisHovered ? 1.0 : 0.15) : 1.0;
                    
                    return (
                      <Radar 
                        key={st.id} 
                        name={st.name}
                        dataKey={st.name} 
                        stroke={COLORS[idx % COLORS.length]} 
                        fill={COLORS[idx % COLORS.length]} 
                        fillOpacity={isThisHovered ? 0.3 : 0.05 * currentOpacity}
                        opacity={currentOpacity}
                        strokeWidth={2}
                      />
                    );
                  })}
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '11px' }} />
                </RadarChart>
              )}
            </ResponsiveContainer>
          )}
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

          {/* Historical Improvement Trends Line Graph */}
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
                    <Line key={st.id} type="monotone" dataKey={st.name} stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                  ))
                ) : (
                  <Line type="monotone" dataKey={currentStudentProfile?.name || ''} stroke="#3b82f6" strokeWidth={3} dot={{ r: 5 }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weak vs Strong Syllabus Concept cards */}
        <div className="space-y-4">
          {/* Strong Syllabus Topics */}
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

          {/* Weak Syllabus Topics */}
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

      {/* Skill Profile Radial Web */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm md:p-5">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5"><Compass className="text-blue-500 w-4 h-4" /> Core Syllabus Skill Profiler</h3>
            <p className="text-[11px] text-slate-400">Multi-axis radial comparison mapping overall proficiency percentages</p>
          </div>
        </div>
        
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={topicPerformance}>
              <PolarGrid stroke="#f1f5f9" />
              <PolarAngleAxis dataKey="topic" tick={{ fontSize: 9, fill: '#64748b' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Accuracy" dataKey="accuracy" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '11px' }} />
            </RadarChart>
          </ResponsiveContainer>
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
