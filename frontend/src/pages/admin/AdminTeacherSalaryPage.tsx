import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Banknote, Calendar, Clock, Download, ChevronLeft, ChevronRight,
  Search, Users, AlertCircle, Edit3, Eye, CheckCircle2, RotateCcw,
  X, Save, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { api, type DbUser } from '../../lib/api';
import { statusVariant, toLines, sortSessionEntries } from '../../lib/sessionLog';
import { useAuthStore } from '../../store/useAuthStore';
import { formatDate } from '../../lib/utils';

interface AttendanceEntry {
  id: string;
  tutorId: string;
  tutorName: string;
  studentId: string;
  studentName: string;
  topic: string;
  homework: string;
  notes: string;
  classDate: string;
  author: string;
  createdAt: string;
  subject?: string;
  sessionType?: string;
  durationMinutes?: number;
  actualDurationMinutes?: number;
  status?: string;
}

interface TutorMonthSalary {
  tutorId: string;
  tutorName: string;
  tutorEmail: string;
  specializations: string[];
  hourlyRate: number | null;
  daysTaught: number;
  completedSessions: number;
  skippedSessions: number;
  studentsCovered: number;
  totalMinutesTaught: number;
  totalSalary: number | null;
  sessions: AttendanceEntry[];
}

const fmtDate = (d: string) => formatDate(d);
const fmtHours = (m: number) => {
  if (m === 0) return '0h 0m';
  const hrs = Math.floor(m / 60);
  const mins = m % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
};
const fmtAmount = (n: number | null) => {
  if (n == null) return '—';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

// Helper: Get month name like "September 2026"
function formatMonthLabel(yyyyMm: string): string {
  if (!yyyyMm || !yyyyMm.includes('-')) return yyyyMm;
  const [year, month] = yyyyMm.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Helper: Adjust YYYY-MM by offset months
function offsetMonth(yyyyMm: string, offset: number): string {
  const [year, month] = yyyyMm.split('-').map(Number);
  const d = new Date(year, month - 1 + offset, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function AdminTeacherSalaryPage() {
  const { user } = useAuthStore();

  if (user && user.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const currentMonthStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [tutors, setTutors] = useState<DbUser[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & View Mode
  const [search, setSearch] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('all');
  const [rateFilter, setRateFilter] = useState<'all' | 'set' | 'missing' | 'active'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [viewMode, setViewMode] = useState<'month' | 'matrix'>('month');

  // Payment Status persistence
  const [paidRecords, setPaidRecords] = useState<Record<string, { isPaid: boolean; paidAt?: string; note?: string }>>(() => {
    try {
      const saved = localStorage.getItem('act_sat_go_teacher_salary_paid');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const isTutorPaid = (tutorId: string, month: string): boolean => {
    return !!paidRecords[`${tutorId}_${month}`]?.isPaid;
  };

  const getPaidInfo = (tutorId: string, month: string) => {
    return paidRecords[`${tutorId}_${month}`];
  };

  const togglePaymentStatus = (tutorId: string, month: string, tutorName?: string) => {
    const key = `${tutorId}_${month}`;
    const current = paidRecords[key]?.isPaid ?? false;
    const next = !current;
    const nextRecords = {
      ...paidRecords,
      [key]: {
        isPaid: next,
        paidAt: next ? new Date().toISOString() : undefined,
      },
    };
    setPaidRecords(nextRecords);
    try {
      localStorage.setItem('act_sat_go_teacher_salary_paid', JSON.stringify(nextRecords));
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }
    toast.success(
      next
        ? `Marked ${tutorName || 'Teacher'} as Paid for ${formatMonthLabel(month)}`
        : `Marked ${tutorName || 'Teacher'} as Unpaid for ${formatMonthLabel(month)}`,
      { icon: next ? '✅' : '⏳' }
    );
  };

  // Quick Hourly Rate Edit Modal
  const [editRateTutor, setEditRateTutor] = useState<DbUser | null>(null);
  const [rateInput, setRateInput] = useState('');
  const [rateSaving, setRateSaving] = useState(false);

  // Session Breakdown Slide-Over
  const [selectedBreakdown, setSelectedBreakdown] = useState<TutorMonthSalary | null>(null);

  // Load all data
  const loadData = async () => {
    setLoading(true);
    try {
      const [tutorsRes, assignmentsRes] = await Promise.all([
        api.getUsersByRole('TUTOR'),
        api.getTutorAssignments(),
      ]);

      const tutorUsers = tutorsRes.users || [];
      setTutors(tutorUsers);

      const tutorNameMap = new Map(tutorUsers.map((u) => [u.id, u.name]));
      const assignments = assignmentsRes.assignments || [];

      const sessionLists = await Promise.all(
        assignments.map((a) =>
          api.getClassProgress(a.tutorId, a.studentId)
            .then((r) =>
              r.entries.map((e) => ({
                ...e,
                homework: e.homework ?? '',
                tutorId: a.tutorId,
                tutorName: tutorNameMap.get(a.tutorId) || a.tutor?.name || 'Tutor',
                studentId: a.studentId,
                studentName: a.student?.name || 'Student',
              }))
            )
            .catch(() => [] as AttendanceEntry[])
        )
      );

      setEntries(sortSessionEntries(sessionLists.flat()));
    } catch (e) {
      console.error('Failed to load salary data:', e);
      toast.error('Failed to load teacher salary records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Discover all months available in entries
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthStr);
    for (const e of entries) {
      if (e.classDate && e.classDate.length >= 7) {
        set.add(e.classDate.slice(0, 7));
      }
    }
    return Array.from(set).sort().reverse();
  }, [entries, currentMonthStr]);

  // Unique specializations for filtering
  const allSpecializations = useMemo(() => {
    const specs = new Set<string>();
    for (const t of tutors) {
      if (Array.isArray(t.specialization)) {
        t.specialization.forEach((s) => specs.add(s));
      }
    }
    return Array.from(specs).sort();
  }, [tutors]);

  // Calculate salary breakdown for the currently selected month
  const monthTutorSalaries: TutorMonthSalary[] = useMemo(() => {
    const tutorMap = new Map<string, TutorMonthSalary>();

    // Initialize map for all tutors
    for (const t of tutors) {
      tutorMap.set(t.id, {
        tutorId: t.id,
        tutorName: t.name,
        tutorEmail: t.email,
        specializations: (t.specialization as string[]) || [],
        hourlyRate: t.hourlyRate ?? null,
        daysTaught: 0,
        completedSessions: 0,
        skippedSessions: 0,
        studentsCovered: 0,
        totalMinutesTaught: 0,
        totalSalary: null,
        sessions: [],
      });
    }

    // Filter sessions matching selected month
    const monthSessions = entries.filter((e) => e.classDate && e.classDate.startsWith(selectedMonth));

    // Group sessions by tutor
    for (const s of monthSessions) {
      let rec = tutorMap.get(s.tutorId);
      if (!rec) {
        // In case tutor user record wasn't returned in tutors list
        rec = {
          tutorId: s.tutorId,
          tutorName: s.tutorName,
          tutorEmail: '',
          specializations: [],
          hourlyRate: null,
          daysTaught: 0,
          completedSessions: 0,
          skippedSessions: 0,
          studentsCovered: 0,
          totalMinutesTaught: 0,
          totalSalary: null,
          sessions: [],
        };
        tutorMap.set(s.tutorId, rec);
      }
      rec.sessions.push(s);
    }

    // Aggregate statistics for each tutor
    return Array.from(tutorMap.values()).map((rec) => {
      const taught = rec.sessions.filter((e) => (e.status ?? 'Completed') === 'Completed');
      const skipped = rec.sessions.filter((e) => (e.status ?? 'Completed') !== 'Completed');
      const totalMinutes = taught.reduce(
        (sum, e) => sum + (e.actualDurationMinutes ?? e.durationMinutes ?? 0),
        0
      );
      const totalSalary = rec.hourlyRate != null ? (totalMinutes / 60) * rec.hourlyRate : null;

      return {
        ...rec,
        daysTaught: new Set(taught.map((e) => e.classDate)).size,
        completedSessions: taught.length,
        skippedSessions: skipped.length,
        studentsCovered: new Set(taught.map((e) => e.studentId)).size,
        totalMinutesTaught: totalMinutes,
        totalSalary,
        sessions: rec.sessions,
      };
    }).sort((a, b) => {
      // Sort by active hours first, then name
      if (b.totalMinutesTaught !== a.totalMinutesTaught) {
        return b.totalMinutesTaught - a.totalMinutesTaught;
      }
      return a.tutorName.localeCompare(b.tutorName);
    });
  }, [tutors, entries, selectedMonth]);

  // Filtered list based on search and filters
  const filteredSalaries = useMemo(() => {
    return monthTutorSalaries.filter((item) => {
      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = item.tutorName.toLowerCase().includes(q);
        const matchesEmail = item.tutorEmail.toLowerCase().includes(q);
        const matchesSpec = item.specializations.some((s) => s.toLowerCase().includes(q));
        if (!matchesName && !matchesEmail && !matchesSpec) return false;
      }

      // Specialization filter
      if (specializationFilter !== 'all') {
        if (!item.specializations.includes(specializationFilter)) return false;
      }

      // Rate status filter
      if (rateFilter === 'set' && item.hourlyRate == null) return false;
      if (rateFilter === 'missing' && item.hourlyRate != null) return false;
      if (rateFilter === 'active' && item.completedSessions === 0) return false;

      // Payment status filter
      if (paymentFilter === 'paid' && !isTutorPaid(item.tutorId, selectedMonth)) return false;
      if (paymentFilter === 'unpaid' && isTutorPaid(item.tutorId, selectedMonth)) return false;

      return true;
    });
  }, [monthTutorSalaries, search, specializationFilter, rateFilter, paymentFilter, paidRecords, selectedMonth]);

  // High-level KPI metrics for the selected month
  const kpiStats = useMemo(() => {
    const activeTutors = monthTutorSalaries.filter((s) => s.completedSessions > 0);
    const totalMinutes = monthTutorSalaries.reduce((sum, s) => sum + s.totalMinutesTaught, 0);
    const totalSessions = monthTutorSalaries.reduce((sum, s) => sum + s.completedSessions, 0);
    const totalPayout = monthTutorSalaries.reduce((sum, s) => sum + (s.totalSalary || 0), 0);
    const missingRatesCount = activeTutors.filter((s) => s.hourlyRate == null).length;

    const paidTutors = monthTutorSalaries.filter((s) => s.totalSalary != null && isTutorPaid(s.tutorId, selectedMonth));
    const unpaidTutors = monthTutorSalaries.filter((s) => s.totalSalary != null && !isTutorPaid(s.tutorId, selectedMonth));
    const paidPayout = paidTutors.reduce((sum, s) => sum + (s.totalSalary || 0), 0);
    const unpaidPayout = unpaidTutors.reduce((sum, s) => sum + (s.totalSalary || 0), 0);

    const totalPaidTutorsCount = monthTutorSalaries.filter((s) => isTutorPaid(s.tutorId, selectedMonth)).length;
    const totalUnpaidTutorsCount = monthTutorSalaries.filter((s) => !isTutorPaid(s.tutorId, selectedMonth)).length;

    return {
      totalPayout,
      paidPayout,
      unpaidPayout,
      paidTutorsCount: totalPaidTutorsCount,
      unpaidTutorsCount: totalUnpaidTutorsCount,
      totalHours: totalMinutes / 60,
      totalMinutes,
      totalSessions,
      activeTutorsCount: activeTutors.length,
      totalTutorsCount: monthTutorSalaries.length,
      missingRatesCount,
    };
  }, [monthTutorSalaries, paidRecords, selectedMonth]);

  // Multi-month comparison matrix data
  const matrixData = useMemo<{
    months: string[];
    rows: Array<{
      tutorId: string;
      tutorName: string;
      hourlyRate: number | null;
      monthlyData: Record<string, { minutes: number; amount: number | null; sessions: number }>;
      totalMinutesYear: number;
      totalAmountYear: number | null;
    }>;
    monthTotals: Record<string, { minutes: number; amount: number }>;
  }>(() => {
    if (viewMode !== 'matrix') return { months: [], rows: [], monthTotals: {} };

    // Select the last 6 months
    const monthsToShow = availableMonths.slice(0, 6).reverse();

    const rows = tutors.map((tutor) => {
      const tutorSessions = entries.filter((e) => e.tutorId === tutor.id);
      const monthlyData: Record<string, { minutes: number; amount: number | null; sessions: number }> = {};
      let totalMinutesYear = 0;
      let totalAmountYear = 0;

      for (const m of monthsToShow) {
        const taught = tutorSessions.filter(
          (e) => e.classDate && e.classDate.startsWith(m) && (e.status ?? 'Completed') === 'Completed'
        );
        const mins = taught.reduce((sum, e) => sum + (e.actualDurationMinutes ?? e.durationMinutes ?? 0), 0);
        const amt = tutor.hourlyRate != null ? (mins / 60) * tutor.hourlyRate : null;

        monthlyData[m] = { minutes: mins, amount: amt, sessions: taught.length };
        totalMinutesYear += mins;
        if (amt != null) totalAmountYear += amt;
      }

      return {
        tutorId: tutor.id,
        tutorName: tutor.name,
        hourlyRate: tutor.hourlyRate ?? null,
        monthlyData,
        totalMinutesYear,
        totalAmountYear: tutor.hourlyRate != null ? totalAmountYear : null,
      };
    }).sort((a, b) => (b.totalAmountYear || 0) - (a.totalAmountYear || 0));

    // Summary totals per month
    const monthTotals: Record<string, { minutes: number; amount: number }> = {};
    for (const m of monthsToShow) {
      monthTotals[m] = { minutes: 0, amount: 0 };
      for (const r of rows) {
        const cell = r.monthlyData[m];
        if (cell) {
          monthTotals[m].minutes += cell.minutes;
          if (cell.amount) monthTotals[m].amount += cell.amount;
        }
      }
    }

    return { months: monthsToShow, rows, monthTotals };
  }, [viewMode, availableMonths, tutors, entries]);

  // Quick edit hourly rate handler
  const openRateEditor = (tutor: DbUser | TutorMonthSalary) => {
    const tutorId: string = ('tutorId' in tutor ? tutor.tutorId : tutor.id) || '';
    const tutorName: string = ('tutorName' in tutor ? tutor.tutorName : tutor.name) || 'Tutor';
    const found = tutors.find((t) => t.id === tutorId);
    const target: DbUser = found || {
      id: tutorId,
      name: tutorName,
      email: ('tutorEmail' in tutor ? tutor.tutorEmail : tutor.email) || '',
      role: 'TUTOR',
      createdAt: '',
      hourlyRate: tutor.hourlyRate ?? null,
    };
    setEditRateTutor(target);
    setRateInput(target.hourlyRate != null ? String(target.hourlyRate) : '');
  };

  const saveHourlyRate = async () => {
    if (!editRateTutor) return;
    setRateSaving(true);
    try {
      const parsed = rateInput.trim() ? Number(rateInput.trim()) : null;
      if (parsed != null && (isNaN(parsed) || parsed < 0)) {
        toast.error('Please enter a valid positive number for hourly rate');
        return;
      }

      await api.updateUser(editRateTutor.id, {
        hourlyRate: parsed,
      });

      setTutors((prev) =>
        prev.map((t) => (t.id === editRateTutor.id ? { ...t, hourlyRate: parsed } : t))
      );

      toast.success(`Updated hourly rate for ${editRateTutor.name}`);
      setEditRateTutor(null);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to update hourly rate');
    } finally {
      setRateSaving(false);
    }
  };

  // CSV Export
  const exportToCSV = () => {
    const monthLabel = formatMonthLabel(selectedMonth);
    const headers = [
      'Tutor Name',
      'Email',
      'Specialization',
      'Hourly Rate (INR)',
      'Month',
      'Days Taught',
      'Completed Sessions',
      'Skipped Sessions',
      'Students Covered',
      'Total Hours Taught',
      'Total Minutes Taught',
      'Calculated Salary (INR)',
      'Payment Status',
      'Paid Timestamp',
    ];

    const rows = filteredSalaries.map((s) => {
      const isPaid = isTutorPaid(s.tutorId, selectedMonth);
      const paidInfo = getPaidInfo(s.tutorId, selectedMonth);
      return [
        `"${s.tutorName.replace(/"/g, '""')}"`,
        `"${s.tutorEmail}"`,
        `"${s.specializations.join(', ')}"`,
        s.hourlyRate != null ? s.hourlyRate : 'Not Set',
        `"${monthLabel}"`,
        s.daysTaught,
        s.completedSessions,
        s.skippedSessions,
        s.studentsCovered,
        (s.totalMinutesTaught / 60).toFixed(2),
        s.totalMinutesTaught,
        s.totalSalary != null ? Math.round(s.totalSalary) : 'N/A',
        isPaid ? 'Paid' : 'Unpaid',
        paidInfo?.paidAt ? `"${paidInfo.paidAt}"` : '—',
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Teacher_Salaries_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported salary report for ${monthLabel}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 space-y-3">
        <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full" />
        <p className="text-sm text-slate-500 font-medium">Calculating teacher salaries from session logs…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Banknote size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Teacher Salaries</h1>
              <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                Month-Wise
              </Badge>
            </div>
            <p className="text-slate-500 text-xs mt-0.5">
              Automated monthly salary calculation based on verified session logs and hourly rates.
            </p>
          </div>
        </div>

        {/* View mode toggle & Export button */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200/80">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                viewMode === 'month'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar size={13} /> Monthly View
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                viewMode === 'matrix'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers size={13} /> Multi-Month Matrix
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={13} />}
            onClick={exportToCSV}
            title="Download CSV report for current selection"
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Month Navigator Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedMonth((m) => offsetMonth(m, -1))}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="pl-3 pr-8 py-1.5 text-sm font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)} {m === currentMonthStr ? ' (Current)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setSelectedMonth((m) => offsetMonth(m, 1))}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              title="Next Month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {selectedMonth !== currentMonthStr && (
            <button
              onClick={() => setSelectedMonth(currentMonthStr)}
              className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-semibold flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-lg"
            >
              <RotateCcw size={11} /> Jump to Current Month
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium w-full md:w-auto justify-end">
          <span className="flex items-center gap-1 text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <Clock size={12} className="text-blue-600" />
            Active Period: <strong className="text-slate-900">{formatMonthLabel(selectedMonth)}</strong>
          </span>
        </div>
      </div>

      {/* KPI Cards for Selected Month */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card padding="sm" className="border-l-4 border-l-emerald-500 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <Banknote size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500 font-medium truncate">Total Payout ({formatMonthLabel(selectedMonth).split(' ')[0]})</p>
              <p className="text-lg md:text-xl font-bold text-slate-900">{fmtAmount(kpiStats.totalPayout)}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[10px]">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Paid: {fmtAmount(kpiStats.paidPayout)} ({kpiStats.paidTutorsCount})
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Unpaid: {fmtAmount(kpiStats.unpaidPayout)} ({kpiStats.unpaidTutorsCount})
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card padding="sm" className="border-l-4 border-l-blue-500 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
              <Clock size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium truncate">Total Time Taught</p>
              <p className="text-lg md:text-xl font-bold text-slate-900">{fmtHours(kpiStats.totalMinutes)}</p>
            </div>
          </div>
        </Card>

        <Card padding="sm" className="border-l-4 border-l-indigo-500 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium truncate">Completed Sessions</p>
              <p className="text-lg md:text-xl font-bold text-slate-900">{kpiStats.totalSessions}</p>
            </div>
          </div>
        </Card>

        <Card padding="sm" className="border-l-4 border-l-purple-500 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0">
              <Users size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium truncate">Active Tutors</p>
              <p className="text-lg md:text-xl font-bold text-slate-900">
                {kpiStats.activeTutorsCount} <span className="text-xs text-slate-400 font-normal">/ {kpiStats.totalTutorsCount} total</span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alert if any active tutor is missing hourly rate */}
      {kpiStats.missingRatesCount > 0 && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-amber-900">
            <p className="font-bold text-amber-950">
              {kpiStats.missingRatesCount} active tutor{kpiStats.missingRatesCount > 1 ? 's do' : ' does'} not have an hourly rate configured
            </p>
            <p className="mt-0.5 text-amber-800">
              Salaries for these tutors cannot be calculated until their hourly rates are set. Click the edit icon next to their name in the table below to set a rate on the fly.
            </p>
          </div>
        </div>
      )}

      {/* MONTHLY VIEW */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Filters Bar */}
          <div className="p-3.5 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-50/40">
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <div className="relative flex-1 sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search tutor, email, subject…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <select
                value={specializationFilter}
                onChange={(e) => setSpecializationFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700"
              >
                <option value="all">All Specializations</option>
                {allSpecializations.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={rateFilter}
                onChange={(e) => setRateFilter(e.target.value as typeof rateFilter)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700"
              >
                <option value="all">All Tutors ({monthTutorSalaries.length})</option>
                <option value="active">Active This Month ({kpiStats.activeTutorsCount})</option>
                <option value="set">Rate Configured</option>
                <option value="missing">Missing Rate</option>
              </select>

              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as typeof paymentFilter)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700 font-medium"
              >
                <option value="all">All Statuses ({monthTutorSalaries.length})</option>
                <option value="paid">Paid ({kpiStats.paidTutorsCount})</option>
                <option value="unpaid">Unpaid ({kpiStats.unpaidTutorsCount})</option>
              </select>

              {(search || specializationFilter !== 'all' || rateFilter !== 'all' || paymentFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearch('');
                    setSpecializationFilter('all');
                    setRateFilter('all');
                    setPaymentFilter('all');
                  }}
                  className="text-xs text-blue-600 hover:underline px-2 py-1"
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing <strong>{filteredSalaries.length}</strong> tutor{filteredSalaries.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Teacher Salary Table */}
          {filteredSalaries.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">
              No teachers match the selected filters for {formatMonthLabel(selectedMonth)}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide bg-slate-50/80 border-b border-slate-200">
                    <th className="px-4 py-3">Tutor</th>
                    <th className="px-4 py-3">Specialization</th>
                    <th className="px-4 py-3 text-center">Hourly Rate</th>
                    <th className="px-4 py-3 text-center">Days Taught</th>
                    <th className="px-4 py-3 text-center">Sessions</th>
                    <th className="px-4 py-3 text-center">Students</th>
                    <th className="px-4 py-3 text-center">Time Taught</th>
                    <th className="px-4 py-3 text-right">Calculated Salary</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSalaries.map((item) => {
                    const isPaid = isTutorPaid(item.tutorId, selectedMonth);
                    const paidInfo = getPaidInfo(item.tutorId, selectedMonth);
                    return (
                      <tr
                        key={item.tutorId}
                        className={`hover:bg-blue-50/30 transition-colors ${
                          item.completedSessions > 0 ? 'bg-white' : 'bg-slate-50/30 opacity-75'
                        }`}
                      >
                        {/* Tutor name & avatar */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold flex-shrink-0 border border-emerald-200">
                              {item.tutorName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 text-sm truncate">{item.tutorName}</p>
                              <p className="text-xs text-slate-400 truncate">{item.tutorEmail || '—'}</p>
                            </div>
                          </div>
                        </td>

                        {/* Specializations */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[160px]">
                            {item.specializations.slice(0, 2).map((s) => (
                              <Badge key={s} variant="default" className="bg-slate-100 text-slate-700 text-[11px] font-normal">
                                {s}
                              </Badge>
                            ))}
                            {item.specializations.length > 2 && (
                              <Badge variant="default" className="bg-slate-100 text-slate-500 text-[10px]">
                                +{item.specializations.length - 2}
                              </Badge>
                            )}
                            {item.specializations.length === 0 && <span className="text-slate-300 text-xs">—</span>}
                          </div>
                        </td>

                        {/* Hourly Rate */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            {item.hourlyRate != null ? (
                              <span className="font-semibold text-slate-800 text-sm">
                                ₹{item.hourlyRate.toLocaleString('en-IN')}<span className="text-slate-400 font-normal text-xs">/hr</span>
                              </span>
                            ) : (
                              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-medium">
                                Not Set
                              </span>
                            )}
                            <button
                              onClick={() => openRateEditor(item)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit Hourly Rate"
                            >
                              <Edit3 size={13} />
                            </button>
                          </div>
                        </td>

                        {/* Days Taught */}
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold text-sm ${item.daysTaught > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                            {item.daysTaught}
                          </span>
                        </td>

                        {/* Completed / Skipped Sessions */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className="font-medium text-slate-800">{item.completedSessions}</span>
                          {item.skippedSessions > 0 && (
                            <span className="text-xs text-slate-400 ml-1" title={`${item.skippedSessions} skipped/cancelled`}>
                              ({item.skippedSessions} skip)
                            </span>
                          )}
                        </td>

                        {/* Students covered */}
                        <td className="px-4 py-3 text-center text-slate-600">
                          {item.studentsCovered}
                        </td>

                        {/* Time Taught */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                            <Clock size={12} className="text-slate-400" />
                            {fmtHours(item.totalMinutesTaught)}
                          </span>
                        </td>

                        {/* Calculated Salary */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {item.totalSalary != null ? (
                            <span className="font-bold text-emerald-700 text-base">
                              {fmtAmount(item.totalSalary)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 font-normal italic">
                              Rate required
                            </span>
                          )}
                        </td>

                        {/* Payment Status Toggle */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePaymentStatus(item.tutorId, selectedMonth, item.tutorName);
                            }}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border shadow-xs cursor-pointer select-none ${
                              isPaid
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
                                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 hover:border-amber-400'
                            }`}
                            title={`Click to toggle Paid / Unpaid for ${formatMonthLabel(selectedMonth)}${
                              paidInfo?.paidAt ? ` (Marked paid on ${fmtDate(paidInfo.paidAt)})` : ''
                            }`}
                          >
                            <span
                              className={`w-7 h-4 flex items-center rounded-full p-0.5 transition-colors duration-200 ${
                                isPaid ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                              }`}
                            >
                              <span className="bg-white w-3 h-3 rounded-full shadow-sm transform transition-transform" />
                            </span>
                            <span>{isPaid ? 'Paid' : 'Unpaid'}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setSelectedBreakdown(item)}
                            disabled={item.sessions.length === 0}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                              item.sessions.length > 0
                                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                            }`}
                            title={item.sessions.length > 0 ? 'View all session logs for this month' : 'No sessions logged in this month'}
                          >
                            <Eye size={12} /> Log Details ({item.sessions.length})
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MULTI-MONTH MATRIX VIEW */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <p className="font-bold text-slate-900 text-sm">Historical Monthly Payouts Matrix</p>
              <p className="text-xs text-slate-400 mt-0.5">Month-by-month salary and hours comparison for all teachers</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 sticky left-0 bg-slate-50 z-10">Tutor</th>
                  <th className="px-4 py-3 text-center">Rate</th>
                  {matrixData.months.map((m) => (
                    <th key={m} className={`px-4 py-3 text-center ${m === selectedMonth ? 'bg-blue-50/80 text-blue-900 font-bold' : ''}`}>
                      {formatMonthLabel(m).split(' ')[0]} <span className="text-[10px] text-slate-400 font-normal">{m.split('-')[0]}</span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right bg-slate-100/70 font-bold text-slate-800">Total Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrixData.rows.map((row) => (
                  <tr key={row.tutorId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-100">
                      {row.tutorName}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap text-xs text-slate-600">
                      {row.hourlyRate != null ? `₹${row.hourlyRate}/hr` : <span className="text-amber-600">Unset</span>}
                    </td>
                    {matrixData.months.map((m) => {
                      const cell = row.monthlyData[m];
                      return (
                        <td
                          key={m}
                          className={`px-4 py-3 text-center whitespace-nowrap ${
                            m === selectedMonth ? 'bg-blue-50/30 font-semibold' : ''
                          }`}
                        >
                          {cell && cell.minutes > 0 ? (
                            <div>
                              <p className="font-bold text-emerald-700 text-xs">{fmtAmount(cell.amount)}</p>
                              <p className="text-[10px] text-slate-400">{fmtHours(cell.minutes)} ({cell.sessions}s)</p>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-emerald-800 bg-slate-50/50">
                      {fmtAmount(row.totalAmountYear)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-xs text-slate-900 border-t-2 border-slate-200">
                  <td className="px-4 py-3 sticky left-0 bg-slate-100 z-10 uppercase">Month Total Payout</td>
                  <td className="px-4 py-3 text-center">—</td>
                  {matrixData.months.map((m) => (
                    <td key={m} className={`px-4 py-3 text-center ${m === selectedMonth ? 'bg-blue-100/60' : ''}`}>
                      <p className="text-sm font-extrabold text-emerald-800">{fmtAmount(matrixData.monthTotals[m]?.amount || 0)}</p>
                      <p className="text-[10px] text-slate-500 font-normal">{fmtHours(matrixData.monthTotals[m]?.minutes || 0)}</p>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right text-sm font-extrabold text-emerald-900 bg-slate-200/60">
                    {fmtAmount(Object.values(matrixData.monthTotals).reduce((a, b) => a + b.amount, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* SESSION BREAKDOWN SLIDE-OVER DRAWER */}
      {selectedBreakdown && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedBreakdown(null)}
          />
          <div className="relative bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col z-10">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-base">
                  {selectedBreakdown.tutorName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {selectedBreakdown.tutorName} — {formatMonthLabel(selectedMonth)}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Rate: {selectedBreakdown.hourlyRate != null ? `₹${selectedBreakdown.hourlyRate}/hr` : 'Not set'} • Total: {fmtHours(selectedBreakdown.totalMinutesTaught)} • Payout: <strong className="text-emerald-700">{fmtAmount(selectedBreakdown.totalSalary)}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBreakdown(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Payment Status Bar in Drawer */}
            {(() => {
              const isPaid = isTutorPaid(selectedBreakdown.tutorId, selectedMonth);
              const paidInfo = getPaidInfo(selectedBreakdown.tutorId, selectedMonth);
              return (
                <div
                  className={`mx-5 mt-4 p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                    isPaid ? 'bg-emerald-50/80 border-emerald-200' : 'bg-amber-50/80 border-amber-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Payment Status:
                      </span>
                      <span
                        className={`text-xs font-extrabold px-2 py-0.5 rounded-full border ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        {isPaid ? 'PAID' : 'UNPAID'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      {isPaid
                        ? `Marked as paid${paidInfo?.paidAt ? ` on ${fmtDate(paidInfo.paidAt)}` : ''}`
                        : 'Salary settlement is currently pending for this active period.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      togglePaymentStatus(
                        selectedBreakdown.tutorId,
                        selectedMonth,
                        selectedBreakdown.tutorName
                      )
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-xs cursor-pointer select-none ${
                      isPaid
                        ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                        : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-100'
                    }`}
                  >
                    {isPaid ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                    {isPaid ? 'Mark as Unpaid' : 'Mark as Paid'}
                  </button>
                </div>
              );
            })()}

            {/* Drawer Body - Session List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedBreakdown.sessions.length === 0 ? (
                <p className="text-center py-10 text-slate-400 text-sm">No session logs found for this month.</p>
              ) : (
                selectedBreakdown.sessions.map((sess) => {
                  const isCompleted = (sess.status ?? 'Completed') === 'Completed';
                  const duration = sess.actualDurationMinutes ?? sess.durationMinutes ?? 0;
                  const sessionPay =
                    isCompleted && selectedBreakdown.hourlyRate != null
                      ? (duration / 60) * selectedBreakdown.hourlyRate
                      : null;

                  return (
                    <div
                      key={sess.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isCompleted
                          ? 'bg-white border-slate-200 hover:border-blue-300'
                          : 'bg-slate-50/70 border-slate-200 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="text-xs font-bold text-slate-900">{fmtDate(sess.classDate)}</span>
                          <span className="text-xs text-slate-500 ml-2 font-medium">• Student: <strong className="text-blue-700">{sess.studentName}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={statusVariant(sess.status)} size="sm">
                            {sess.status ?? 'Completed'}
                          </Badge>
                          {sessionPay != null && (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              {fmtAmount(sessionPay)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg mb-2">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase">Subject</span>
                          <span className="font-semibold text-slate-800">{sess.subject || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase">Type</span>
                          <span className="font-semibold text-slate-800">{sess.sessionType || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase">Duration</span>
                          <span className="font-semibold text-slate-800">{sess.durationMinutes ? `${sess.durationMinutes} min` : '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase">Actual</span>
                          <span className="font-semibold text-slate-800">{sess.actualDurationMinutes ? `${sess.actualDurationMinutes} min` : '—'}</span>
                        </div>
                      </div>

                      {sess.topic && (
                        <div className="text-xs text-slate-600 mt-1">
                          <strong className="text-slate-700">Topic:</strong> {toLines(sess.topic).join(', ')}
                        </div>
                      )}
                      {sess.notes && (
                        <div className="text-xs text-slate-500 mt-1 italic">
                          "{sess.notes}"
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Completed Sessions: <strong className="text-slate-900">{selectedBreakdown.completedSessions}</strong></p>
                <p className="text-xs text-slate-500">Total Minutes: <strong className="text-slate-900">{selectedBreakdown.totalMinutesTaught} min</strong> ({fmtHours(selectedBreakdown.totalMinutesTaught)})</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase font-semibold">Total Payable</p>
                <p className="text-lg font-bold text-emerald-700">{fmtAmount(selectedBreakdown.totalSalary)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK HOURLY RATE EDIT MODAL */}
      <Modal
        isOpen={!!editRateTutor}
        onClose={() => setEditRateTutor(null)}
        title={editRateTutor ? `Set Hourly Rate — ${editRateTutor.name}` : ''}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditRateTutor(null)}>
              Cancel
            </Button>
            <Button size="sm" icon={<Save size={14} />} loading={rateSaving} onClick={saveHourlyRate}>
              Save Rate
            </Button>
          </div>
        }
      >
        {editRateTutor && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Set the compensation rate per teaching hour for <strong>{editRateTutor.name}</strong>. All month-wise salary calculations will automatically update based on logged session duration.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hourly Rate (₹ INR)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                <input
                  type="number"
                  min={0}
                  step={10}
                  placeholder="e.g. 600"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  autoFocus
                />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default AdminTeacherSalaryPage;
