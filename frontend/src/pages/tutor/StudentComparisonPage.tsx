import { useState, useEffect, useMemo } from 'react';
import { Users, TrendingUp, Target, Award, Clock, ArrowLeft, ArrowRightLeft, UserCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, type DbUser } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface StudentAnalytics {
  id: string;
  student: DbUser;
  trend: Array<{ date: string; score: number; testTitle: string; attemptId: string }>;
  sectionStats: Array<{
    sectionId: string;
    sectionName: string;
    totalQuestions: number;
    correct: number;
    incorrect: number;
    skipped: number;
    accuracy: number;
    timeAllocated: number;
    timeUsed: number;
  }>;
  overallAccuracy: number;
  totalAttempts: number;
  latestScore: number;
  avgScore: number;
}

export function StudentComparisonPage() {
  const { dbId, user } = useAuthStore();
  const [students, setStudents] = useState<DbUser[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyticsMap, setAnalyticsMap] = useState<Record<string, StudentAnalytics>>({});
  const [fetchingAnalytics, setFetchingAnalytics] = useState(false);

  // Load students depending on user role
  useEffect(() => {
    if (!dbId) return;
    setLoading(true);
    
    const fetchStudentsPromise = user?.role === 'tutor' 
      ? api.getTutorAssignments({ tutorId: dbId }).then(r => r.assignments.map(a => a.student as DbUser))
      : api.getUsersByRole('STUDENT').then(r => r.users ?? []);

    fetchStudentsPromise
      .then((studs) => {
        const validStuds = studs.filter((s): s is DbUser => s !== null && s !== undefined);
        setStudents(validStuds);
        // Automatically select the first 2 students if available
        if (validStuds.length >= 2) {
          setSelectedStudentIds([validStuds[0].id, validStuds[1].id]);
        } else if (validStuds.length === 1) {
          setSelectedStudentIds([validStuds[0].id]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dbId, user?.role]);

  // Fetch analytics for selected students
  useEffect(() => {
    const fetchSelectedAnalytics = async () => {
      const missingIds = selectedStudentIds.filter(id => !analyticsMap[id]);
      if (missingIds.length === 0) return;

      setFetchingAnalytics(true);
      try {
        const results = await Promise.all(
          missingIds.map(async (id) => {
            const student = students.find(s => s.id === id);
            if (!student) return null;
            const analytics = await api.getStudentAnalytics(id);
            return {
              id,
              student,
              ...analytics
            } as StudentAnalytics;
          })
        );

        setAnalyticsMap(prev => {
          const next = { ...prev };
          results.forEach(res => {
            if (res) next[res.id] = res;
          });
          return next;
        });
      } catch {
      } finally {
        setFetchingAnalytics(false);
      }
    };

    if (selectedStudentIds.length > 0) {
      fetchSelectedAnalytics();
    }
  }, [selectedStudentIds, students, analyticsMap]);

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 4) {
        alert('You can compare up to 4 students simultaneously.');
        return prev;
      }
      return [...prev, id];
    });
  };

  const activeAnalytics = useMemo(() => {
    return selectedStudentIds
      .map(id => analyticsMap[id])
      .filter((x): x is StudentAnalytics => x !== undefined);
  }, [selectedStudentIds, analyticsMap]);

  // Side-by-side performance data for Recharts Bar Chart
  const compareBarData = useMemo(() => {
    return activeAnalytics.map((aa) => ({
      name: aa.student.name.split(' ')[0],
      'Average Score': aa.avgScore || 0,
      'Latest Score': aa.latestScore || 0,
      'Target Score': (aa.student.targetScore as number | null) || 32,
      'Accuracy %': aa.overallAccuracy || 0,
    }));
  }, [activeAnalytics]);

  // Radar/Section comparison data
  const compareSectionData = useMemo(() => {
    const sectionsSet = new Set<string>();
    activeAnalytics.forEach(aa => {
      aa.sectionStats.forEach(s => sectionsSet.add(s.sectionName));
    });
    const sections = Array.from(sectionsSet);

    return sections.map(secName => {
      const dataPoint: Record<string, any> = { subject: secName };
      activeAnalytics.forEach(aa => {
        const stat = aa.sectionStats.find(s => s.sectionName === secName);
        dataPoint[aa.student.name.split(' ')[0]] = stat ? stat.accuracy : 0;
      });
      return dataPoint;
    });
  }, [activeAnalytics]);

  // Colors for multiple students
  const studentColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
  const studentFades = ['rgba(59, 130, 246, 0.2)', 'rgba(16, 185, 129, 0.2)', 'rgba(245, 158, 11, 0.2)', 'rgba(139, 92, 246, 0.2)'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <Clock className="animate-spin text-blue-500" size={24} />
          <span className="text-sm font-semibold">Configuring Student Matrix...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="text-blue-600" size={24} />
            Side-by-Side Student Comparison
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Compare target scores, composite progress, pacing strengths, and conceptual accuracy across up to 4 students.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5 text-xs text-blue-700 font-bold">
          <Users size={14} /> Active Cohort: {students.length} students
        </div>
      </div>

      {students.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl bg-white">
          No active students found to compare.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          
          {/* Left Column: Student Selection Matrix */}
          <div className="xl:col-span-1 space-y-4">
            <div className="bg-white border border-slate-100 rounded-2xl p-4 md:p-5 shadow-sm">
              <h3 className="font-extrabold text-slate-800 text-sm mb-3">Select Cohort Members</h3>
              <p className="text-xs text-slate-400 mb-4">Click to select/deselect students to compare (max 4):</p>
              
              <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                {students.map((stud) => {
                  const isSelected = selectedStudentIds.includes(stud.id);
                  const colorIndex = selectedStudentIds.indexOf(stud.id);
                  const selectedColor = isSelected ? studentColors[colorIndex] : '';
                  
                  return (
                    <div 
                      key={stud.id}
                      onClick={() => toggleStudentSelection(stud.id)}
                      className={`p-3 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-slate-50 shadow-xs border-slate-300 font-bold' 
                          : 'bg-white hover:bg-slate-50/50 border-slate-150'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white ${
                            isSelected ? '' : 'bg-slate-400'
                          }`} style={{ backgroundColor: selectedColor }}>
                            {stud.name.charAt(0).toUpperCase()}
                          </div>
                          {isSelected && (
                            <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black border border-white">
                              {colorIndex + 1}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-slate-800 block truncate">{stud.name}</span>
                          <span className="text-[10px] text-slate-400 block truncate">Target: {stud.targetScore ?? '—'} pts</span>
                        </div>
                      </div>
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${
                        isSelected ? 'text-blue-600' : 'text-slate-400'
                      }`}>
                        {isSelected ? 'Selected' : 'Compare'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Comparative Metrics & Charts */}
          <div className="xl:col-span-3 space-y-6">
            {selectedStudentIds.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-150 p-12 text-center shadow-xs">
                <Users size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Select students to begin comparison</p>
                <p className="text-slate-455 text-xs mt-1">Use the panel on the left to add students to the active comparison slate.</p>
              </div>
            ) : (
              <>
                {/* Metric Summary Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {activeAnalytics.map((aa, idx) => (
                    <div 
                      key={aa.id} 
                      className="bg-white border rounded-2xl p-5 shadow-xs relative overflow-hidden transition-all"
                      style={{ borderTop: `4px solid ${studentColors[idx]}` }}
                    >
                      <span 
                        className="absolute top-2 right-2 text-[9px] font-black text-white w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: studentColors[idx] }}
                      >
                        {idx + 1}
                      </span>
                      <p className="text-xs font-bold text-slate-500 truncate">{aa.student.name}</p>
                      <p className="text-3xl font-black text-slate-900 mt-3 tracking-tight">
                        {aa.avgScore || '—'}
                        <span className="text-xs font-bold text-slate-400 ml-1">avg</span>
                      </p>
                      
                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-50 text-[10px] text-slate-455 font-bold">
                        <div>
                          <span className="block text-slate-400">Target Score:</span>
                          <span className="text-xs font-black text-slate-800">{(aa.student.targetScore as number | null) ?? '—'}</span>
                        </div>
                        <div>
                          <span className="block text-slate-400">Accuracy:</span>
                          <span className="text-xs font-black text-emerald-600">{aa.overallAccuracy}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Fill empty spots */}
                  {Array.from({ length: 4 - activeAnalytics.length }).map((_, i) => (
                    <div 
                      key={`empty-${i}`} 
                      className="bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center text-center py-8 text-slate-400"
                    >
                      <Users size={20} className="text-slate-300 mb-1" />
                      <p className="text-[10px] font-bold">Slot {activeAnalytics.length + i + 1} Open</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Select another student</p>
                    </div>
                  ))}
                </div>

                {fetchingAnalytics && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 font-bold bg-blue-50/50 p-3 border border-blue-150 rounded-xl">
                    <Clock size={12} className="animate-spin" /> Syncing comparative analytics...
                  </div>
                )}

                {activeAnalytics.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Bar Chart Comparison */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 md:p-6 shadow-sm">
                      <h3 className="font-extrabold text-slate-900 text-sm mb-4">Overall Metric Comparison</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={compareBarData} margin={{ left: -15, right: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            <Bar dataKey="Average Score" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                            <Bar dataKey="Latest Score" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                            <Bar dataKey="Target Score" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={20} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Section Radar Comparison */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 md:p-6 shadow-sm">
                      <h3 className="font-extrabold text-slate-900 text-sm mb-4">Subject Mastery Radar</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={compareSectionData}>
                            <PolarGrid stroke="#f1f5f9" />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                            {activeAnalytics.map((aa, idx) => (
                              <Radar 
                                key={aa.id}
                                name={aa.student.name.split(' ')[0]} 
                                dataKey={aa.student.name.split(' ')[0]} 
                                stroke={studentColors[idx]} 
                                fill={studentColors[idx]} 
                                fillOpacity={0.15} 
                              />
                            ))}
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                {/* Side-by-side mastery table */}
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-extrabold text-slate-900 text-sm">Subject Section Accuracy Matrix</h3>
                    <Badge variant="info" className="bg-blue-50 text-blue-700 border-blue-150 font-bold text-[9px] uppercase tracking-wider">Concept Grid</Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50/40 border-b border-slate-100 text-slate-500 font-bold">
                          <th className="px-5 py-3 text-left">Subject Section</th>
                          {activeAnalytics.map((aa, idx) => (
                            <th key={aa.id} className="px-5 py-3 text-center border-l border-slate-100">
                              <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: studentColors[idx] }} />
                              {aa.student.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-medium">
                        {['English', 'Mathematics', 'Reading', 'Science'].map((secName) => (
                          <tr key={secName} className="hover:bg-slate-50/20">
                            <td className="px-5 py-3.5 font-bold text-slate-800 text-xs">{secName} Section</td>
                            {activeAnalytics.map((aa) => {
                              const s = aa.sectionStats.find(x => x.sectionName.toLowerCase() === secName.toLowerCase() || x.sectionName.includes(secName));
                              const accuracy = s ? s.accuracy : 0;
                              return (
                                <td key={aa.id} className="px-5 py-3.5 text-center border-l border-slate-100">
                                  {s ? (
                                    <div className="flex items-center justify-center gap-2">
                                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${accuracy}%` }} />
                                      </div>
                                      <span className="font-black text-slate-850">{accuracy}%</span>
                                      <span className="text-[10px] text-slate-400">({s.correct}/{s.totalQuestions} Qs)</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
