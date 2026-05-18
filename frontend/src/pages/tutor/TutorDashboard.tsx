import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, AlertTriangle, ChevronRight, Target, Shield, Eye, RefreshCw, AlertCircle, Clock, Zap, BookOpen, Activity } from 'lucide-react';
import { StatCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { api, type DbUser } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

export function TutorDashboard() {
  const { user, dbId } = useAuthStore();
  const navigate = useNavigate();
  const [myStudents, setMyStudents] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'anticheating'>('overview');
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);

  useEffect(() => {
    if (!dbId) {
      setLoading(false);
      return;
    }
    api.getTutorAssignments({ tutorId: dbId })
      .then((r) => {
        if (r && r.assignments) {
          const students = r.assignments
            .map((a) => a.student as DbUser)
            .filter((s): s is DbUser => s !== null && s !== undefined);
          setMyStudents(students);
        } else {
          setMyStudents([]);
        }
      })
      .catch(() => setMyStudents([]))
      .finally(() => setLoading(false));
  }, [dbId]);

  const fetchAttempts = () => {
    setLoadingAttempts(true);
    api.getAttempts()
      .then((r) => setAttempts(r.attempts ?? []))
      .catch(() => {})
      .finally(() => setLoadingAttempts(false));
  };

  useEffect(() => {
    if (activeTab === 'anticheating') {
      fetchAttempts();
    }
  }, [activeTab]);

  const avgScore = myStudents.length
    ? myStudents.reduce((a, s) => a + (s?.avgScore ?? 0), 0) / myStudents.length
    : 0;
  const totalTests = myStudents.reduce((a, s) => a + (s?.testsAttempted ?? 0), 0);

  const studentCompareData = myStudents.map((s) => ({
    name: s?.name?.split(' ')[0] ?? 'Student',
    score: s?.avgScore ?? 0,
    target: (s?.targetScore as number | null) ?? 32,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-sm">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Tutor Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Welcome back, {user?.name?.split(' ')[0]} · {myStudents.length} students assigned
          </p>
        </div>

        {/* Refresh button visible in anti-cheating view */}
        {activeTab === 'anticheating' && (
          <button 
            onClick={fetchAttempts} 
            disabled={loadingAttempts}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition-colors disabled:opacity-60"
          >
            <RefreshCw size={13} className={loadingAttempts ? 'animate-spin' : ''} />
            Sync Live Telemetry
          </button>
        )}
      </div>

      {/* Tabs Selector Navigation */}
      <div className="flex border-b border-slate-100 gap-2">
        <button 
          onClick={() => setActiveTab('overview')} 
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'overview' 
              ? 'border-blue-600 text-blue-600 font-bold' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users size={16} />
            Overview & Progress
          </div>
        </button>
        
        <button 
          onClick={() => setActiveTab('anticheating')} 
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'anticheating' 
              ? 'border-red-500 text-red-600 font-bold' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield size={16} />
            Live Anti-Cheating Monitor
          </div>
        </button>
      </div>

      {activeTab === 'overview' ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <StatCard title="My Students" value={myStudents.length} subtitle="enrolled" icon={<Users size={20} />} color="blue" />
            <StatCard title="Avg. Score" value={avgScore > 0 ? avgScore.toFixed(1) : '—'} subtitle="composite" icon={<TrendingUp size={20} />} color="emerald" />
            <StatCard title="Tests Taken" value={totalTests} subtitle="all students" icon={<Target size={20} />} color="purple" />
            <StatCard title="Need Help" value={myStudents.filter(s => {
              const pct = ((s.avgScore ?? 0) / ((s.targetScore as number | null) ?? 32)) * 100;
              return pct < 70;
            }).length} subtitle="below target" icon={<AlertTriangle size={20} />} color="amber" />
          </div>

          {myStudents.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 p-4 md:p-6">
              <h3 className="font-semibold text-slate-900 mb-1">Scores vs Targets</h3>
              <p className="text-sm text-slate-500 mb-4">Current average vs target score</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={studentCompareData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 36]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Current" barSize={20} />
                  <Bar dataKey="target" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Target" barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h3 className="font-semibold text-slate-900">My Students</h3>
              <button onClick={() => navigate('/my-students')} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                View all <ChevronRight size={14} />
              </button>
            </div>

            {myStudents.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-100 p-8 text-center">
                <p className="text-slate-400 text-sm">No students assigned yet.</p>
                <p className="text-slate-400 text-xs mt-1">Ask an admin to assign students to you.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                {myStudents.slice(0, 4).map((student) => {
                  const target = (student.targetScore as number | null) ?? 32;
                  const gap = target - (student.avgScore ?? 0);
                  const pct = Math.min(100, ((student.avgScore ?? 0) / target) * 100);
                  const isOnTrack = pct >= 85;
                  const needsWork = pct < 70;

                  return (
                    <div
                      key={student.id}
                      onClick={() => navigate(`/student/${student.id}`)}
                      className="bg-white rounded-xl border border-slate-100 p-4 md:p-5 hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                            {student.name?.charAt(0).toUpperCase() ?? 'S'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 text-sm truncate">{student.name ?? 'Unnamed Student'}</p>
                            <p className="text-xs text-slate-500">{student.testsAttempted ?? 0} tests</p>
                          </div>
                        </div>
                        <Badge variant={isOnTrack ? 'success' : needsWork ? 'danger' : 'warning'} className="flex-shrink-0">
                          {isOnTrack ? 'On Track' : needsWork ? 'Help' : 'Progress'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                          { label: 'Score', value: student.avgScore ?? '—' },
                          { label: 'Target', value: target },
                          { label: 'Gap', value: gap > 0 ? `+${gap}` : gap, color: gap > 0 ? 'text-amber-600' : 'text-emerald-600' },
                        ].map((s) => (
                          <div key={s.label} className="text-center bg-slate-50 rounded-lg p-2">
                            <p className={`text-base font-bold ${s.color || 'text-slate-900'}`}>{s.value}</p>
                            <p className="text-xs text-slate-500">{s.label}</p>
                          </div>
                        ))}
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>To target</span><span>{pct.toFixed(0)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isOnTrack ? 'bg-emerald-500' : needsWork ? 'bg-red-400' : 'bg-amber-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Live Anti-Cheating Control Panel View */
        (() => {
          const assignedStudentIds = new Set(myStudents.filter(Boolean).map(s => s.id));
          const relevantAttempts = (attempts ?? []).filter(att => att && att.studentId && assignedStudentIds.has(att.studentId));

          const allLogs = relevantAttempts.flatMap(att => 
            (att?.cheatingLogs ?? []).map((log: any) => ({
              ...log,
              studentName: att?.studentName ?? 'Student',
              testTitle: att?.testTitle ?? 'Test',
              attemptId: att?.id
            }))
          ).filter(Boolean).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          const totalTabSwitches = relevantAttempts.reduce((sum, a) => sum + (a?.tabSwitches ?? 0), 0);
          const activeTakers = relevantAttempts.filter(a => a?.status === 'in_progress').length;
          const flaggedCount = relevantAttempts.filter(a => (a?.tabSwitches ?? 0) >= 3 || (a?.cheatingLogs?.length ?? 0) >= 3).length;

          if (loadingAttempts) {
            return (
              <div className="flex flex-col items-center justify-center h-64 gap-2">
                <RefreshCw size={24} className="text-blue-600 animate-spin" />
                <p className="text-slate-400 text-sm">Syncing live cheat logs...</p>
              </div>
            );
          }

          return (
            <div className="space-y-6">
              {/* Telemetry Metric Badges */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 flex-shrink-0 animate-pulse">
                    <Activity size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Active Test Takers</p>
                    <p className="text-xl font-bold text-slate-800">{activeTakers}</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 flex-shrink-0">
                    <RefreshCw size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Tab Switch Count</p>
                    <p className="text-xl font-bold text-slate-800">{totalTabSwitches}</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-red-50 text-red-500 flex-shrink-0">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Suspicion Alerts</p>
                    <p className="text-xl font-bold text-slate-800">{allLogs.length}</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600 flex-shrink-0">
                    <Shield size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Flagged Students</p>
                    <p className="text-xl font-bold text-red-600">{flaggedCount}</p>
                  </div>
                </div>
              </div>

              {relevantAttempts.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
                  <Shield size={32} className="text-slate-350 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No testing activity found</p>
                  <p className="text-slate-400 text-xs mt-1">None of your assigned students have test attempts yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Assigned Student Attempts Monitoring */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white rounded-xl border border-slate-100 p-4 md:p-5">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50">
                        <h4 className="font-bold text-slate-800 text-sm">Assigned Student Live-Sessions</h4>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total: {relevantAttempts.length}</span>
                      </div>

                      <div className="space-y-3">
                        {relevantAttempts.map((att) => {
                          const switches = att.tabSwitches ?? 0;
                          const logsCount = att.cheatingLogs?.length ?? 0;
                          const isHighRisk = switches >= 3 || logsCount >= 3;
                          
                          return (
                            <div 
                              key={att.id} 
                              onClick={() => navigate(`/student/${att.studentId}`)}
                              className="group border border-slate-100 hover:border-blue-200 bg-slate-50/30 hover:bg-white rounded-xl p-4 transition-all duration-200 cursor-pointer flex flex-col md:flex-row justify-between gap-4"
                            >
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-slate-900 text-sm">{att.studentName}</p>
                                  <Badge variant={att.status === 'in_progress' ? 'warning' : 'success'} size="sm">
                                    {att.status === 'in_progress' ? 'Taking Test' : 'Submitted'}
                                  </Badge>
                                </div>
                                <p className="text-xs text-slate-500 font-medium">
                                  {att.testTitle} · {att.sectionName}
                                </p>
                                
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] text-slate-450 font-bold">
                                    <span>Section Progress</span>
                                    <span>{att.progress}%</span>
                                  </div>
                                  <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-300 ${att.status === 'in_progress' ? 'bg-amber-400' : 'bg-emerald-500'}`} 
                                      style={{ width: `${att.progress}%` }}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-row md:flex-col justify-between md:justify-center items-end gap-2 md:pl-4 md:border-l border-slate-100">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-slate-400 font-bold">Tab Switches:</span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-black border ${
                                    switches === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                    switches < 3 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                    'bg-red-50 text-red-700 border-red-200 animate-pulse'
                                  }`}>
                                    {switches}
                                  </span>
                                </div>

                                {isHighRisk && (
                                  <Badge variant="danger" size="sm" className="flex items-center gap-1 bg-red-50 border-red-150 animate-bounce">
                                    <AlertTriangle size={10} /> Highly Suspicious
                                  </Badge>
                                )}

                                <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  View Student <ChevronRight size={10} />
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Live Security Event Logs Feed */}
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-slate-100 p-4 md:p-5">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50">
                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <Eye className="text-red-500" size={16} />
                          Security Audit Log
                        </h4>
                        <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold">LIVE STREAM</span>
                      </div>

                      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                        {allLogs.length === 0 ? (
                          <div className="py-8 text-center text-slate-400 text-xs">
                            No security violation alerts detected so far.
                          </div>
                        ) : (
                          allLogs.map((log: any) => {
                            let typeBadge = <Badge variant="secondary" size="sm">EVENT</Badge>;
                            if (log.eventType === 'TAB_SWITCH') {
                              typeBadge = <Badge variant="warning" size="sm" className="bg-amber-50 text-amber-700 border-amber-200">TAB SWITCH</Badge>;
                            } else if (log.eventType === 'FULLSCREEN_EXIT') {
                              typeBadge = <Badge variant="danger" size="sm" className="bg-red-50 text-red-700 border-red-200">FULLSCREEN EXIT</Badge>;
                            } else if (log.eventType === 'INACTIVITY') {
                              typeBadge = <Badge variant="warning" size="sm" className="bg-orange-50 text-orange-700 border-orange-200">INACTIVE</Badge>;
                            } else if (log.eventType === 'SUSPICIOUS') {
                              typeBadge = <Badge variant="danger" size="sm" className="bg-purple-50 text-purple-700 border-purple-200 font-bold">SUSPICIOUS</Badge>;
                            }

                            return (
                              <div key={log.id} className="p-3 border border-slate-50 rounded-xl bg-slate-50/20 space-y-1.5 text-xs">
                                <div className="flex items-center justify-between">
                                  <p className="font-bold text-slate-800 truncate max-w-[120px]">{log.studentName}</p>
                                  {typeBadge}
                                </div>
                                <p className="text-[10px] text-slate-450 truncate font-semibold">
                                  {log.testTitle}
                                </p>
                                <div className="bg-white p-2 rounded-lg border border-slate-100 text-[10px] text-slate-600 font-medium">
                                  {log.metadata?.details ?? log.metadata?.reason ?? 'Switched focused window/tab detected'}
                                </div>
                                <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold pt-0.5">
                                  <span className="flex items-center gap-1"><Clock size={9} /> {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                  <span>{new Date(log.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()
      )}
    </div>
  );
}
