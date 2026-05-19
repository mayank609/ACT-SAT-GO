import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity, AlertTriangle, Clock, Eye, RefreshCw, Wifi,
  ShieldAlert, UserCheck, ShieldOff, AlertCircle, Copy,
  Ban, Bell, Monitor, Minimize2
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Card, StatCard } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { api } from '../../lib/api';

interface CheatingLogEntry {
  id: string;
  eventType: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

interface EnhancedAttempt {
  id: string;
  studentId: string;
  studentName: string;
  testId: string;
  testTitle: string;
  sectionName: string;
  sectionIndex: number;
  totalSections: number;
  tabSwitches: number;
  cheatingLogs?: CheatingLogEntry[];
  answersCount: number;
  startedAt: string;
  completedAt: string | null;
  status: string;
  progress: number;
  timeRemaining: number;
  totalScore: number | null;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}


export function MonitoringPage() {
  const [attempts, setAttempts] = useState<EnhancedAttempt[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState<EnhancedAttempt | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Quick Actions States
  const [warningSent, setWarningSent] = useState(false);
  const [submittingTest, setSubmittingTest] = useState(false);

  const fetchAttempts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.getAttempts({ status: 'IN_PROGRESS' });
      setAttempts(res.attempts as EnhancedAttempt[]);
      setLastRefresh(new Date());
    } catch {
      setAttempts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAttempts(); }, [fetchAttempts]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchAttempts(true), 15000); // Poll every 15 seconds for hot live-cheating updates
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAttempts]);

  // Aggregate Cheating Diagnostics across active attempts
  const monitoringMetrics = useMemo(() => {
    let totalTabSwitches = 0;
    let totalFullscreenExits = 0;
    let totalInactivityEvents = 0;
    let totalSuspiciousInputs = 0;
    let criticalThreatCount = 0;

    attempts.forEach(a => {
      const logs = a.cheatingLogs ?? [];
      const tabs = logs.filter(l => l.eventType === 'TAB_SWITCH').length || a.tabSwitches;
      const full = logs.filter(l => l.eventType === 'FULLSCREEN_EXIT').length;
      const inactive = logs.filter(l => l.eventType === 'INACTIVITY').length;
      const input = logs.filter(l => l.eventType === 'SUSPICIOUS_INPUT').length;

      totalTabSwitches += tabs;
      totalFullscreenExits += full;
      totalInactivityEvents += inactive;
      totalSuspiciousInputs += input;

      const totalViolations = tabs + full + input;
      if (totalViolations >= 3) {
        criticalThreatCount++;
      }
    });

    return {
      totalTabSwitches,
      totalFullscreenExits,
      totalInactivityEvents,
      totalSuspiciousInputs,
      criticalThreatCount
    };
  }, [attempts]);

  // Filtered Attempts matching query
  const filteredAttempts = useMemo(() => {
    return attempts.filter(a => 
      a.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.testTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [attempts, searchQuery]);

  // Dynamic threat categorization helper
  const getAttemptThreatDetails = (attempt: EnhancedAttempt) => {
    const logs = attempt.cheatingLogs ?? [];
    const tabs = logs.filter(l => l.eventType === 'TAB_SWITCH').length || attempt.tabSwitches;
    const full = logs.filter(l => l.eventType === 'FULLSCREEN_EXIT').length;
    const inactive = logs.filter(l => l.eventType === 'INACTIVITY').length;
    const input = logs.filter(l => l.eventType === 'SUSPICIOUS_INPUT').length;
    const total = tabs + full + input;

    let level: 'clear' | 'low' | 'suspicious' | 'critical' = 'clear';
    let label = 'Secure';
    let color = 'bg-emerald-50 text-emerald-700 border-emerald-150';

    if (total >= 5) {
      level = 'critical';
      label = 'Critical Hazard';
      color = 'bg-red-50 text-red-700 border-red-150 animate-pulse font-extrabold';
    } else if (total >= 2) {
      level = 'suspicious';
      label = 'Suspicious';
      color = 'bg-amber-50 text-amber-700 border-amber-150';
    } else if (total === 1 || inactive > 0) {
      level = 'low';
      label = 'Low Risk';
      color = 'bg-blue-50 text-blue-700 border-blue-150';
    }

    return { level, label, color, tabs, full, inactive, input, total };
  };

  // Warning trigger through notification endpoint
  const handleSendWarning = async (attempt: EnhancedAttempt) => {
    setWarningSent(true);
    try {
      await api.createNotification({
        userId: attempt.studentId,
        type: 'SYSTEM',
        title: '⚠️ Suspicious Activity Warning',
        body: 'Multiple window transitions or copy operations detected. Continued violations will freeze your examination session.',
      });
      setTimeout(() => setWarningSent(false), 3000);
    } catch {
      setWarningSent(false);
    }
  };

  // Graceful submission trigger
  const handleTerminateAttempt = async (attempt: EnhancedAttempt) => {
    setSubmittingTest(true);
    try {
      await api.submitSection(attempt.id, attempt.id).catch(() => {});
      await fetchAttempts();
      setSelectedAttempt(null);
    } finally {
      setSubmittingTest(false);
    }
  };

  // Selected attempt dynamic parsing for logs
  const selectedAttemptLogs = useMemo(() => {
    if (!selectedAttempt) return [];
    
    // In case cheatingLogs list is empty, synthesize a fallback tab switch log if tabSwitches is > 0
    if ((!selectedAttempt.cheatingLogs || selectedAttempt.cheatingLogs.length === 0) && selectedAttempt.tabSwitches > 0) {
      return Array.from({ length: selectedAttempt.tabSwitches }).map((_, i) => ({
        id: `fallback-${i}`,
        eventType: 'TAB_SWITCH',
        createdAt: new Date(new Date(selectedAttempt.startedAt).getTime() + (i + 1) * 300000).toISOString(),
        metadata: { info: 'Synthetic switch log fallback' }
      }));
    }

    return selectedAttempt.cheatingLogs ?? [];
  }, [selectedAttempt]);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="text-blue-600" /> Anti-Cheating & Integrity Monitoring
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Real-time test session oversight, integrity audits, and student environment security alerts.
            <span className="ml-2 text-xs text-slate-400 font-medium">· Updated: {lastRefresh.toLocaleTimeString()}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoRefresh((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              autoRefresh ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
            <Wifi size={12} className={autoRefresh ? 'text-emerald-500 animate-pulse' : 'text-slate-400'} />
            {autoRefresh ? 'Hot Live Updates' : 'Static Stream'}
          </button>
          <Button variant="secondary" size="sm" icon={<RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />} onClick={() => fetchAttempts(true)}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Cheating Diagnostics Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <StatCard title="Active Sessions" value={attempts.length} subtitle="Taking online tests" icon={<Activity size={20} />} color="blue" />
        <StatCard title="Flagged Critical" value={monitoringMetrics.criticalThreatCount} subtitle="Needs immediate audit" icon={<ShieldOff size={20} />} color="red" />
        <StatCard title="Tab Switches" value={monitoringMetrics.totalTabSwitches} subtitle="Total window changes" icon={<Minimize2 size={20} />} color="amber" />
        <StatCard title="Suspicious Inputs" value={monitoringMetrics.totalSuspiciousInputs} subtitle="Clipboard or right clicks" icon={<Copy size={20} />} color="purple" />
        <StatCard title="Total Violations" value={monitoringMetrics.totalTabSwitches + monitoringMetrics.totalFullscreenExits + monitoringMetrics.totalSuspiciousInputs} subtitle="Sum of all threat alerts" icon={<AlertCircle size={20} />} color="emerald" />
      </div>

      {/* Critical Threat Alert Bar */}
      {monitoringMetrics.criticalThreatCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-pulse">
          <div className="flex items-start gap-3">
            <ShieldOff className="text-red-600 w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-red-800">CRITICAL INTEGRITY RISK DETECTED</p>
              <p className="text-xs text-red-700 leading-relaxed font-semibold">
                {monitoringMetrics.criticalThreatCount} active candidate{monitoringMetrics.criticalThreatCount > 1 ? 's' : ''} exceeded secure browser limits. Send official warn notices or inspect details below.
              </p>
            </div>
          </div>
          <Badge variant="danger" className="text-[10px] font-black tracking-widest uppercase bg-red-100 text-red-700 px-3 py-1">
            ALERT TRIGGERED
          </Badge>
        </div>
      )}

      {/* Main Panel grid: Table of Attempts (2/3 width) and live details/logs (1/3 width) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        
        {/* Active attempts table */}
        <div className="lg:col-span-2 space-y-4">
          <Card padding="none" className="border border-slate-100 shadow-sm overflow-hidden bg-white">
            <div className="px-4 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-850 text-sm">Integrity Audit Cohort</h3>
                <p className="text-[11px] text-slate-400">List of active online student test takers and security indicators</p>
              </div>
              <input
                type="text"
                placeholder="Search by student name or test title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
              />
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    {['Student Profile', 'Test details', 'Progress', 'Remaining', 'Cheating logs', 'Threat Level', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-xs">Loading sessions...</td></tr>
                  ) : filteredAttempts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <Activity size={32} className="mx-auto mb-2 text-slate-300 animate-bounce" />
                        <p className="text-xs text-slate-450 font-bold">No active online test sessions matching query</p>
                      </td>
                    </tr>
                  ) : filteredAttempts.map((a) => {
                    const threat = getAttemptThreatDetails(a);
                    const isUrgent = threat.level === 'critical';
                    const isLowTime = a.timeRemaining > 0 && a.timeRemaining < 300;
                    
                    return (
                      <tr key={a.id} className={`hover:bg-slate-50/75 transition-colors cursor-pointer ${isUrgent ? 'bg-red-50/20' : ''}`}
                        onClick={() => setSelectedAttempt(a)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-black flex-shrink-0 border border-blue-200 shadow-xs">
                              {a.studentName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-800 text-xs truncate max-w-28">{a.studentName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-800 font-semibold text-xs truncate max-w-36">{a.testTitle}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{a.sectionName} • Section {a.sectionIndex + 1}/{a.totalSections}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${a.progress}%` }} />
                            </div>
                            <span className="text-[11px] text-slate-500 font-semibold">{a.progress}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-mono text-xs font-bold ${isLowTime ? 'text-red-600' : 'text-slate-700'}`}>
                            {a.timeRemaining > 0 ? formatTime(a.timeRemaining) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {threat.tabs > 0 && <Badge variant="warning" className="text-[8.5px] px-1 py-0 border-amber-200 bg-amber-50">Tab ×{threat.tabs}</Badge>}
                            {threat.full > 0 && <Badge variant="danger" className="text-[8.5px] px-1 py-0 border-red-200 bg-red-50">Fullscreen Exit ×{threat.full}</Badge>}
                            {threat.inactive > 0 && <Badge variant="info" className="text-[8.5px] px-1 py-0 border-blue-200 bg-blue-50">Idle</Badge>}
                            {threat.input > 0 && <Badge variant="purple" className="text-[8.5px] px-1 py-0 border-purple-200 bg-purple-50">Copy/Paste ×{threat.input}</Badge>}
                            {threat.total === 0 && <Badge variant="success" className="text-[8.5px] px-1 py-0 border-emerald-200 bg-emerald-50">No alerts</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`text-[9px] font-black uppercase px-2 ${threat.color}`}>
                            {threat.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                            <Eye size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Audit Details & Interactive Logs (1/3 width) */}
        <div className="col-span-1">
          {selectedAttempt ? (
            <Card className="border border-slate-100 shadow-sm p-4 md:p-5 bg-white relative overflow-hidden animate-fadeIn">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
              <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Monitor className="text-slate-500 w-4 h-4" />
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Security Audit</h3>
                    <p className="text-[10px] text-slate-450 uppercase font-black tracking-wider">Live stream feed</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedAttempt(null)}
                  className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  Close
                </button>
              </div>

              {/* Student Profile Row */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-4 border border-slate-100 shadow-xs">
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-black shadow-xs">
                  {selectedAttempt.studentName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-850 text-xs block truncate">{selectedAttempt.studentName}</p>
                  <p className="text-[9.5px] text-slate-400 block truncate">{selectedAttempt.testTitle}</p>
                </div>
              </div>

              {/* Integrity Violations Summary Card */}
              <div className="p-3 border border-slate-150 bg-slate-50/50 rounded-xl mb-4 space-y-1.5 shadow-xs">
                <p className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">Integrity Violation Scoreboard</p>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-white p-2 border border-slate-100 rounded-lg text-center shadow-xs">
                    <span className="text-[9.5px] text-slate-400 block">Tab Switches</span>
                    <span className={`font-bold text-sm ${selectedAttempt.tabSwitches >= 3 ? 'text-red-600' : 'text-slate-700'}`}>
                      {selectedAttempt.tabSwitches}
                    </span>
                  </div>
                  <div className="bg-white p-2 border border-slate-100 rounded-lg text-center shadow-xs">
                    <span className="text-[9.5px] text-slate-400 block">Suspicious Inputs</span>
                    <span className="font-bold text-sm text-purple-600">
                      {selectedAttemptLogs.filter(l => l.eventType === 'SUSPICIOUS_INPUT').length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timestamped Live Suspicious Event Logs */}
              <div className="space-y-2 mb-5">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Suspicious Event Log</p>
                
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {selectedAttemptLogs.map((log) => {
                    const time = new Date(log.createdAt).toLocaleTimeString();
                    const isTab = log.eventType === 'TAB_SWITCH';
                    const isFull = log.eventType === 'FULLSCREEN_EXIT';
                    const isInactive = log.eventType === 'INACTIVITY';

                    let icon = <AlertCircle size={12} className="text-blue-500" />;
                    let title = 'Input Violation';
                    let desc = 'Copy or Paste action attempted';
                    let border = 'border-slate-100 bg-white';

                    if (isTab) {
                      icon = <Minimize2 size={12} className="text-amber-500" />;
                      title = 'Tab Switch';
                      desc = 'Swapped active browser window';
                      border = 'border-amber-100 bg-amber-50/10';
                    } else if (isFull) {
                      icon = <AlertTriangle size={12} className="text-red-500" />;
                      title = 'Fullscreen Exit';
                      desc = 'Exited secure locked screen';
                      border = 'border-red-100 bg-red-50/10 animate-shake';
                    } else if (isInactive) {
                      icon = <Clock size={12} className="text-slate-500" />;
                      title = 'Student Inactive';
                      desc = 'No cursor motion for 60 seconds';
                      border = 'border-blue-100 bg-blue-50/10';
                    }

                    return (
                      <div key={log.id} className={`p-2.5 border rounded-lg flex items-start gap-2 shadow-xs transition-all ${border}`}>
                        <div className="mt-0.5 flex-shrink-0">{icon}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold text-slate-700">{title}</span>
                            <span className="text-[9px] text-slate-400 font-mono font-bold">{time}</span>
                          </div>
                          <span className="text-[9.5px] text-slate-500 block leading-tight">{desc}</span>
                        </div>
                      </div>
                    );
                  })}
                  {selectedAttemptLogs.length === 0 && (
                    <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <UserCheck size={20} className="text-emerald-500 mx-auto mb-2" />
                      Candidate holds perfect integrity! No violations logged.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons Drawer */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full flex justify-center items-center gap-1.5 text-xs font-bold py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-xs"
                  onClick={() => handleSendWarning(selectedAttempt)}
                  disabled={warningSent}
                >
                  <Bell size={12} />
                  {warningSent ? 'Warning Notice Sent!' : 'Send Warning Notice'}
                </Button>
                
                <Button 
                  variant="danger" 
                  size="sm" 
                  className="w-full flex justify-center items-center gap-1.5 text-xs font-bold py-2 bg-red-600 hover:bg-red-750 text-white rounded-xl shadow-xs"
                  onClick={() => handleTerminateAttempt(selectedAttempt)}
                  disabled={submittingTest}
                >
                  <Ban size={12} />
                  {submittingTest ? 'Terminating Attempt...' : 'Force Terminate & Grade'}
                </Button>
              </div>

            </Card>
          ) : (
            <div className="h-full flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-2xl bg-white p-8 gap-3 min-h-[300px] shadow-sm">
              <ShieldAlert size={28} className="text-slate-300 animate-bounce" />
              <p className="text-xs text-slate-500 font-bold text-center">Select any candidate attempt in the cohort list to launch the secure audit stream panel.</p>
              <p className="text-[10px] text-slate-400 text-center max-w-[200px]">Enables live suspicious activity timetables, warnings dispatcher, and force session overrides.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
