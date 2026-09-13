import { useEffect, useMemo, useState } from 'react';
import {
  Banknote, Calendar, Clock, Download,
  Search, Users, Edit3, Eye, CheckCircle2, RotateCcw,
  Save, Layers, Receipt, Check, History,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { api, type DbUser } from '../../lib/api';
import { sortSessionEntries } from '../../lib/sessionLog';
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

export interface SalarySettlement {
  id: string;
  tutorId?: string;
  tutorName?: string;
  amount: number;
  paidAt: string;
  note?: string;
  settledBy?: string;
  sessionIds?: string[];
  hours?: number;
}

export interface TutorSalaryLedger {
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
  totalEarned: number | null;
  totalPaid: number;
  remainingAmount: number | null;
  unpaidMinutes: number;
  unpaidSessionsCount: number;
  allSessions: AttendanceEntry[];
  unpaidSessions: AttendanceEntry[];
  paidSessions: AttendanceEntry[];
  settlements: SalarySettlement[];
  isFullySettled: boolean;
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
  if (!yyyyMm || yyyyMm === 'all') return 'All Time (Outstanding)';
  if (!yyyyMm.includes('-')) return yyyyMm;
  const [year, month] = yyyyMm.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}



export function AdminTeacherSalaryPage() {
  const { user } = useAuthStore();

  const currentMonthStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' (default outstanding ledger) or 'YYYY-MM'
  const [tutors, setTutors] = useState<DbUser[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & View Mode
  const [search, setSearch] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('all');
  const [rateFilter, setRateFilter] = useState<'all' | 'set' | 'missing' | 'active'>('all');
  const [viewTab, setViewTab] = useState<'pending' | 'all' | 'history' | 'matrix'>('pending');

  // Settlements & Paid Session IDs stored locally + synced to user permissions
  const [settlementsByTutor, setSettlementsByTutor] = useState<Record<string, SalarySettlement[]>>(() => {
    try {
      const saved = localStorage.getItem('act_sat_go_teacher_salary_settlements_v2');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [paidSessionIdsByTutor, setPaidSessionIdsByTutor] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('act_sat_go_teacher_paid_session_ids_v2');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Mark As Paid Modal State
  const [payModalTutor, setPayModalTutor] = useState<TutorSalaryLedger | null>(null);
  const [payAmountInput, setPayAmountInput] = useState('');
  const [payDateInput, setPayDateInput] = useState(() => new Date().toISOString().split('T')[0]);
  const [payNoteInput, setPayNoteInput] = useState('');
  const [paySaving, setPaySaving] = useState(false);

  // Quick Hourly Rate Edit Modal
  const [editRateTutor, setEditRateTutor] = useState<DbUser | null>(null);
  const [rateInput, setRateInput] = useState('');
  const [rateSaving, setRateSaving] = useState(false);

  // Session Breakdown Slide-Over
  const [selectedBreakdown, setSelectedBreakdown] = useState<TutorSalaryLedger | null>(null);

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

      // Hydrate settlements and paid sessions from server permissions if available
      const nextSettlements: Record<string, SalarySettlement[]> = { ...settlementsByTutor };
      const nextPaidSessions: Record<string, string[]> = { ...paidSessionIdsByTutor };
      for (const t of tutorUsers) {
        if (Array.isArray(t.salarySettlements) && t.salarySettlements.length > 0) {
          nextSettlements[t.id] = t.salarySettlements;
        }
        if (Array.isArray(t.paidSessionIds) && t.paidSessionIds.length > 0) {
          nextPaidSessions[t.id] = t.paidSessionIds;
        }
      }
      setSettlementsByTutor(nextSettlements);
      setPaidSessionIdsByTutor(nextPaidSessions);

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

  // Calculate Continuous Salary Ledger for all tutors
  const tutorLedgers: TutorSalaryLedger[] = useMemo(() => {
    const tutorMap = new Map<string, {
      tutorId: string;
      tutorName: string;
      tutorEmail: string;
      specializations: string[];
      hourlyRate: number | null;
      allSessions: AttendanceEntry[];
    }>();

    // Initialize map for all tutors
    for (const t of tutors) {
      tutorMap.set(t.id, {
        tutorId: t.id,
        tutorName: t.name,
        tutorEmail: t.email,
        specializations: (t.specialization as string[]) || [],
        hourlyRate: t.hourlyRate ?? null,
        allSessions: [],
      });
    }

    // Filter sessions (either all-time or matching selected month)
    const targetSessions = selectedMonth === 'all'
      ? entries
      : entries.filter((e) => e.classDate && e.classDate.startsWith(selectedMonth));

    for (const s of targetSessions) {
      let rec = tutorMap.get(s.tutorId);
      if (!rec) {
        rec = {
          tutorId: s.tutorId,
          tutorName: s.tutorName,
          tutorEmail: '',
          specializations: [],
          hourlyRate: null,
          allSessions: [],
        };
        tutorMap.set(s.tutorId, rec);
      }
      rec.allSessions.push(s);
    }

    return Array.from(tutorMap.values()).map((rec) => {
      const paidIdsSet = new Set(paidSessionIdsByTutor[rec.tutorId] || []);
      const tutorSettlements = settlementsByTutor[rec.tutorId] || [];

      const completed = rec.allSessions.filter((e) => (e.status ?? 'Completed') === 'Completed');
      const skipped = rec.allSessions.filter((e) => (e.status ?? 'Completed') !== 'Completed');

      const totalMinutes = completed.reduce(
        (sum, e) => sum + (e.actualDurationMinutes ?? e.durationMinutes ?? 0),
        0
      );

      const totalEarned = rec.hourlyRate != null ? (totalMinutes / 60) * rec.hourlyRate : null;

      // Paid sessions vs Unpaid sessions
      const paidSessions = completed.filter((e) => paidIdsSet.has(e.id));
      const unpaidSessions = completed.filter((e) => !paidIdsSet.has(e.id));

      const unpaidMinutes = unpaidSessions.reduce(
        (sum, e) => sum + (e.actualDurationMinutes ?? e.durationMinutes ?? 0),
        0
      );

      // Total paid is sum of recorded settlements
      const totalPaid = tutorSettlements.reduce((sum, st) => sum + (st.amount || 0), 0);

      // Remaining is unpaid sessions value (or totalEarned - totalPaid)
      let remainingAmount: number | null = null;
      if (rec.hourlyRate != null) {
        if (unpaidSessions.length > 0) {
          remainingAmount = (unpaidMinutes / 60) * rec.hourlyRate;
        } else if (totalEarned != null) {
          remainingAmount = Math.max(0, totalEarned - totalPaid);
        } else {
          remainingAmount = 0;
        }
      }

      const isFullySettled = (remainingAmount !== null && remainingAmount <= 0) || (completed.length > 0 && unpaidSessions.length === 0);

      return {
        tutorId: rec.tutorId,
        tutorName: rec.tutorName,
        tutorEmail: rec.tutorEmail,
        specializations: rec.specializations,
        hourlyRate: rec.hourlyRate,
        daysTaught: new Set(completed.map((e) => e.classDate)).size,
        completedSessions: completed.length,
        skippedSessions: skipped.length,
        studentsCovered: new Set(completed.map((e) => e.studentId)).size,
        totalMinutesTaught: totalMinutes,
        totalEarned,
        totalPaid,
        remainingAmount,
        unpaidMinutes,
        unpaidSessionsCount: unpaidSessions.length,
        allSessions: rec.allSessions,
        unpaidSessions,
        paidSessions,
        settlements: tutorSettlements,
        isFullySettled,
      };
    }).sort((a, b) => {
      // Prioritize tutors with outstanding balance, then total minutes
      const remA = a.remainingAmount || 0;
      const remB = b.remainingAmount || 0;
      if (remB !== remA) return remB - remA;
      if (b.totalMinutesTaught !== a.totalMinutesTaught) return b.totalMinutesTaught - a.totalMinutesTaught;
      return a.tutorName.localeCompare(b.tutorName);
    });
  }, [tutors, entries, selectedMonth, paidSessionIdsByTutor, settlementsByTutor]);

  // Filtered Ledgers
  const filteredLedgers = useMemo(() => {
    return tutorLedgers.filter((item) => {
      // View tab filter
      if (viewTab === 'pending') {
        // Only show tutors that have an unpaid balance or active sessions with missing rate
        const hasUnpaid = (item.remainingAmount != null && item.remainingAmount > 0) || item.unpaidSessionsCount > 0;
        const hasSessionsNoRate = item.hourlyRate == null && item.completedSessions > 0;
        if (!hasUnpaid && !hasSessionsNoRate) return false;
      }

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

      return true;
    });
  }, [tutorLedgers, viewTab, search, specializationFilter, rateFilter]);

  // Overall KPI metrics
  const kpiStats = useMemo(() => {
    const totalOutstandingPayout = tutorLedgers.reduce((sum, s) => sum + (s.remainingAmount || 0), 0);
    const totalLifetimePaid = Object.values(settlementsByTutor).flat().reduce((sum, s) => sum + (s.amount || 0), 0);
    const pendingTutorsCount = tutorLedgers.filter((s) => (s.remainingAmount != null && s.remainingAmount > 0) || s.unpaidSessionsCount > 0).length;
    const missingRatesCount = tutorLedgers.filter((s) => s.completedSessions > 0 && s.hourlyRate == null).length;
    const totalUnpaidMinutes = tutorLedgers.reduce((sum, s) => sum + s.unpaidMinutes, 0);

    return {
      totalOutstandingPayout,
      totalLifetimePaid,
      pendingTutorsCount,
      missingRatesCount,
      totalUnpaidHours: totalUnpaidMinutes / 60,
      totalTutorsCount: tutorLedgers.length,
    };
  }, [tutorLedgers, settlementsByTutor]);

  // All settlements history flat list
  const allSettlementHistory = useMemo(() => {
    const list: SalarySettlement[] = [];
    for (const [tutorId, sets] of Object.entries(settlementsByTutor)) {
      const tutor = tutors.find((t) => t.id === tutorId);
      for (const st of sets) {
        list.push({
          ...st,
          tutorId,
          tutorName: tutor?.name || 'Tutor',
        });
      }
    }
    return list.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
  }, [settlementsByTutor, tutors]);

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
    if (viewTab !== 'matrix') return { months: [], rows: [], monthTotals: {} };

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
  }, [viewTab, availableMonths, tutors, entries]);

  // Open Pay Modal
  const openPayModal = (ledger: TutorSalaryLedger) => {
    setPayModalTutor(ledger);
    const suggestedAmount = ledger.remainingAmount != null ? Math.round(ledger.remainingAmount) : 0;
    setPayAmountInput(suggestedAmount > 0 ? String(suggestedAmount) : '');
    setPayDateInput(new Date().toISOString().split('T')[0]);
    setPayNoteInput('');
  };

  // Submit Mark as Paid
  const handleConfirmPayment = async () => {
    if (!payModalTutor) return;
    const amt = Number(payAmountInput.trim());
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    setPaySaving(true);
    try {
      const tutorId = payModalTutor.tutorId;
      const settlementId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const unpaidIds = payModalTutor.unpaidSessions.map((s) => s.id);

      const newSettlement: SalarySettlement = {
        id: settlementId,
        tutorId,
        tutorName: payModalTutor.tutorName,
        amount: amt,
        paidAt: payDateInput || new Date().toISOString().split('T')[0],
        note: payNoteInput.trim() || 'Salary Settlement',
        settledBy: user?.name || 'Super Admin',
        sessionIds: unpaidIds,
        hours: payModalTutor.unpaidMinutes / 60,
      };

      const updatedSettlements = [...(settlementsByTutor[tutorId] || []), newSettlement];
      const existingPaidIds = new Set(paidSessionIdsByTutor[tutorId] || []);
      unpaidIds.forEach((id) => existingPaidIds.add(id));
      const updatedPaidIds = Array.from(existingPaidIds);

      // 1. Update local states
      const nextSettlementsMap = { ...settlementsByTutor, [tutorId]: updatedSettlements };
      const nextPaidIdsMap = { ...paidSessionIdsByTutor, [tutorId]: updatedPaidIds };
      setSettlementsByTutor(nextSettlementsMap);
      setPaidSessionIdsByTutor(nextPaidIdsMap);

      // 2. Persist to localStorage
      try {
        localStorage.setItem('act_sat_go_teacher_salary_settlements_v2', JSON.stringify(nextSettlementsMap));
        localStorage.setItem('act_sat_go_teacher_paid_session_ids_v2', JSON.stringify(nextPaidIdsMap));
      } catch {}

      // 3. Persist to Database on User model
      await api.updateUser(tutorId, {
        salarySettlements: updatedSettlements,
        paidSessionIds: updatedPaidIds,
      });

      toast.success(`Marked ${fmtAmount(amt)} as Paid for ${payModalTutor.tutorName}! Remaining amount updated.`, {
        icon: '✅',
        duration: 4000,
      });

      setPayModalTutor(null);
      if (selectedBreakdown && selectedBreakdown.tutorId === tutorId) {
        setSelectedBreakdown(null);
      }
    } catch (e) {
      console.error('Failed to record payment:', e);
      toast.error('Recorded locally. Failed to sync to server.');
      setPayModalTutor(null);
    } finally {
      setPaySaving(false);
    }
  };

  // Undo / Delete Settlement
  const handleDeleteSettlement = async (tutorId: string, settlementId: string) => {
    if (!confirm('Are you sure you want to remove this payment record and revert the remaining amount?')) return;
    try {
      const current = settlementsByTutor[tutorId] || [];
      const target = current.find((s) => s.id === settlementId);
      const updatedSettlements = current.filter((s) => s.id !== settlementId);

      // Remove session IDs associated with this settlement
      const removedSessionIds = new Set(target?.sessionIds || []);
      const currentPaidIds = paidSessionIdsByTutor[tutorId] || [];
      const updatedPaidIds = currentPaidIds.filter((id) => !removedSessionIds.has(id));

      const nextSettlementsMap = { ...settlementsByTutor, [tutorId]: updatedSettlements };
      const nextPaidIdsMap = { ...paidSessionIdsByTutor, [tutorId]: updatedPaidIds };

      setSettlementsByTutor(nextSettlementsMap);
      setPaidSessionIdsByTutor(nextPaidIdsMap);

      try {
        localStorage.setItem('act_sat_go_teacher_salary_settlements_v2', JSON.stringify(nextSettlementsMap));
        localStorage.setItem('act_sat_go_teacher_paid_session_ids_v2', JSON.stringify(nextPaidIdsMap));
      } catch {}

      await api.updateUser(tutorId, {
        salarySettlements: updatedSettlements,
        paidSessionIds: updatedPaidIds,
      });

      toast.success('Payment record removed. Balance restored.');
    } catch (e) {
      toast.error('Failed to remove settlement');
    }
  };

  // Toggle single session status inside Breakdown Modal
  const handleToggleSessionPaid = async (tutorId: string, sessionId: string) => {
    const currentPaidIds = new Set(paidSessionIdsByTutor[tutorId] || []);
    if (currentPaidIds.has(sessionId)) {
      currentPaidIds.delete(sessionId);
    } else {
      currentPaidIds.add(sessionId);
    }
    const updated = Array.from(currentPaidIds);
    const nextMap = { ...paidSessionIdsByTutor, [tutorId]: updated };
    setPaidSessionIdsByTutor(nextMap);

    try {
      localStorage.setItem('act_sat_go_teacher_paid_session_ids_v2', JSON.stringify(nextMap));
    } catch {}

    try {
      await api.updateUser(tutorId, { paidSessionIds: updated });
    } catch {}
  };

  // Quick edit hourly rate handler
  const openRateEditor = (tutor: DbUser | TutorSalaryLedger) => {
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
    const headers = [
      'Tutor Name',
      'Email',
      'Specialization',
      'Hourly Rate (INR)',
      'Total Sessions',
      'Unpaid Sessions',
      'Total Hours Taught',
      'Total Earned (INR)',
      'Total Paid (INR)',
      'Remaining to Pay (INR)',
      'Status',
    ];

    const rows = filteredLedgers.map((s) => [
      `"${s.tutorName.replace(/"/g, '""')}"`,
      `"${s.tutorEmail}"`,
      `"${s.specializations.join(', ')}"`,
      s.hourlyRate != null ? s.hourlyRate : 'Not Set',
      s.completedSessions,
      s.unpaidSessionsCount,
      (s.totalMinutesTaught / 60).toFixed(2),
      s.totalEarned != null ? Math.round(s.totalEarned) : 'N/A',
      Math.round(s.totalPaid),
      s.remainingAmount != null ? Math.round(s.remainingAmount) : 'N/A',
      s.isFullySettled ? 'Fully Settled' : 'Pending Payment',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Teacher_Salary_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported salary ledger CSV');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Banknote className="text-emerald-600" size={26} />
              Teacher Salary &amp; Payouts
            </h1>
            <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-emerald-200">
              Outstanding Ledger
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Track unbilled sessions, record teacher payouts, and manage real-time remaining balances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month / Scope selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs text-xs font-medium text-slate-700">
            <Calendar size={14} className="text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-0 font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">⚡ All Time (Total Outstanding)</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={13} />}
            onClick={exportToCSV}
            disabled={filteredLedgers.length === 0}
          >
            Export CSV
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={<RotateCcw size={13} />}
            onClick={loadData}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding Payout */}
        <Card padding="md" className="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50/40 via-white to-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                Total Outstanding Payout
              </p>
              <p className="text-2xl font-extrabold text-amber-950 mt-1">
                {fmtAmount(kpiStats.totalOutstandingPayout)}
              </p>
              <p className="text-xs text-amber-700 mt-1 font-medium">
                Across {kpiStats.pendingTutorsCount} tutor{kpiStats.pendingTutorsCount !== 1 ? 's' : ''} with pending balance
              </p>
            </div>
            <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
              <Banknote size={22} />
            </div>
          </div>
        </Card>

        {/* Total Unpaid Hours */}
        <Card padding="md" className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50/40 via-white to-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-800">
                Unsettled Hours Taught
              </p>
              <p className="text-2xl font-extrabold text-blue-950 mt-1">
                {kpiStats.totalUnpaidHours.toFixed(1)} <span className="text-sm font-semibold text-slate-500">hrs</span>
              </p>
              <p className="text-xs text-blue-600 mt-1 font-medium">
                From verified session logs
              </p>
            </div>
            <div className="p-2.5 bg-blue-100 text-blue-800 rounded-xl">
              <Clock size={22} />
            </div>
          </div>
        </Card>

        {/* Total Settled / Paid */}
        <Card padding="md" className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50/40 via-white to-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Total Settled Payouts
              </p>
              <p className="text-2xl font-extrabold text-emerald-950 mt-1">
                {fmtAmount(kpiStats.totalLifetimePaid)}
              </p>
              <p className="text-xs text-emerald-700 mt-1 font-medium">
                Recorded in payment history
              </p>
            </div>
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
              <CheckCircle2 size={22} />
            </div>
          </div>
        </Card>

        {/* Missing Rates Alert */}
        <Card padding="md" className={`border-l-4 ${kpiStats.missingRatesCount > 0 ? 'border-l-rose-500 bg-rose-50/30' : 'border-l-slate-400 bg-slate-50/30'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Hourly Rates Configured
              </p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {kpiStats.totalTutorsCount - kpiStats.missingRatesCount} / {kpiStats.totalTutorsCount}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {kpiStats.missingRatesCount > 0 ? (
                  <span className="text-rose-600 font-bold">{kpiStats.missingRatesCount} active tutors need rate set</span>
                ) : (
                  'All active tutors have rates set'
                )}
              </p>
            </div>
            <div className={`p-2.5 rounded-xl ${kpiStats.missingRatesCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'}`}>
              <Users size={22} />
            </div>
          </div>
        </Card>
      </div>

      {/* Main Ledger Card */}
      <Card padding="none" className="shadow-sm border border-slate-200 overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="p-4 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left View Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setViewTab('pending')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewTab === 'pending'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Banknote size={14} className={viewTab === 'pending' ? 'text-amber-600' : ''} />
              Outstanding Balance ({kpiStats.pendingTutorsCount})
            </button>
            <button
              onClick={() => setViewTab('all')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={14} />
              All Tutors Ledger ({tutorLedgers.length})
            </button>
            <button
              onClick={() => setViewTab('history')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewTab === 'history'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History size={14} />
              Payment History ({allSettlementHistory.length})
            </button>
            <button
              onClick={() => setViewTab('matrix')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewTab === 'matrix'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={14} />
              Monthly Comparison
            </button>
          </div>

          {/* Right search & filter */}
          {viewTab !== 'history' && viewTab !== 'matrix' && (
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tutor name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {allSpecializations.length > 0 && (
                <select
                  value={specializationFilter}
                  onChange={(e) => setSpecializationFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Subjects</option>
                  {allSpecializations.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}

              <select
                value={rateFilter}
                onChange={(e) => setRateFilter(e.target.value as 'all' | 'set' | 'missing' | 'active')}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="all">All Statuses</option>
                <option value="set">Rate Configured</option>
                <option value="missing">Missing Rate</option>
                <option value="active">Has Sessions</option>
              </select>
            </div>
          )}
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm">
            <div className="animate-spin w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3" />
            Calculating teacher compensation and unsettled sessions...
          </div>
        ) : viewTab === 'history' ? (
          /* Payment History Table */
          <div className="overflow-x-auto">
            {allSettlementHistory.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                <Receipt size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-slate-600">No payment settlements recorded yet</p>
                <p className="text-xs text-slate-400 mt-0.5">When you mark a teacher as paid, the record will appear here.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3">Date Paid</th>
                    <th className="px-4 py-3">Tutor</th>
                    <th className="px-4 py-3 text-right">Amount Paid</th>
                    <th className="px-4 py-3 text-center">Sessions Settled</th>
                    <th className="px-4 py-3">Reference / Note</th>
                    <th className="px-4 py-3">Settled By</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allSettlementHistory.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">
                        {fmtDate(st.paidAt)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {st.tutorName}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 whitespace-nowrap text-base">
                        {fmtAmount(st.amount)}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 text-xs">
                        {st.sessionIds?.length ? `${st.sessionIds.length} sessions` : 'Manual Payout'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs max-w-xs truncate">
                        {st.note || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {st.settledBy || 'Super Admin'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDeleteSettlement(st.tutorId!, st.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete payment record (revert balance)"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : viewTab === 'matrix' ? (
          /* Multi-Month Comparison Matrix */
          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                  <th className="p-2 text-left sticky left-0 bg-slate-100">Tutor</th>
                  <th className="p-2 text-center">Rate</th>
                  {matrixData.months.map((m) => (
                    <th key={m} className="p-2 text-center border-l border-slate-200">
                      {formatMonthLabel(m)}
                    </th>
                  ))}
                  <th className="p-2 text-right border-l border-slate-300 font-bold">Total Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrixData.rows.map((row) => (
                  <tr key={row.tutorId} className="hover:bg-slate-50">
                    <td className="p-2 font-medium text-slate-900 sticky left-0 bg-white">
                      {row.tutorName}
                    </td>
                    <td className="p-2 text-center text-slate-600">
                      {row.hourlyRate != null ? `₹${row.hourlyRate}/hr` : '—'}
                    </td>
                    {matrixData.months.map((m) => {
                      const cell = row.monthlyData[m];
                      return (
                        <td key={m} className="p-2 text-center border-l border-slate-100">
                          {cell && cell.minutes > 0 ? (
                            <div>
                              <p className="font-semibold text-slate-800">{fmtHours(cell.minutes)}</p>
                              <p className="text-[10px] text-emerald-700 font-bold">{fmtAmount(cell.amount)}</p>
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2 text-right border-l border-slate-300 font-bold text-emerald-700">
                      {fmtAmount(row.totalAmountYear)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Primary Salary Ledger Table (Pending or All) */
          <div className="overflow-x-auto">
            {filteredLedgers.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-500" />
                <p className="font-semibold text-slate-800 text-base">
                  {viewTab === 'pending' ? 'All Tutors Fully Settled!' : 'No tutors match the selected filters.'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {viewTab === 'pending'
                    ? 'There are currently no outstanding unpaid sessions. You are all caught up!'
                    : 'Try adjusting your search query or subject filters.'}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3">Tutor</th>
                    <th className="px-4 py-3">Specialization</th>
                    <th className="px-4 py-3 text-center">Hourly Rate</th>
                    <th className="px-4 py-3 text-center">Total Time</th>
                    <th className="px-4 py-3 text-right">Total Earned</th>
                    <th className="px-4 py-3 text-right">Total Paid</th>
                    <th className="px-4 py-3 text-right bg-amber-50/50 text-amber-900 border-l border-amber-200">
                      Remaining to Pay
                    </th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLedgers.map((item) => {
                    const hasRemaining = item.remainingAmount != null && item.remainingAmount > 0;
                    return (
                      <tr
                        key={item.tutorId}
                        className={`hover:bg-blue-50/30 transition-colors ${
                          hasRemaining ? 'bg-white' : 'bg-slate-50/30'
                        }`}
                      >
                        {/* Tutor details */}
                        <td className="px-4 py-3.5">
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
                        <td className="px-4 py-3.5">
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
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            {item.hourlyRate != null ? (
                              <span className="font-semibold text-slate-800 text-sm">
                                ₹{item.hourlyRate.toLocaleString('en-IN')}<span className="text-slate-400 font-normal text-xs">/hr</span>
                              </span>
                            ) : (
                              <span className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md font-semibold">
                                Missing Rate
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

                        {/* Total Time */}
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <div>
                            <p className="font-semibold text-slate-800">{fmtHours(item.totalMinutesTaught)}</p>
                            <p className="text-[11px] text-slate-400">{item.completedSessions} sessions</p>
                          </div>
                        </td>

                        {/* Total Earned */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap font-medium text-slate-700">
                          {fmtAmount(item.totalEarned)}
                        </td>

                        {/* Total Paid */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap font-medium text-emerald-700">
                          {fmtAmount(item.totalPaid)}
                        </td>

                        {/* Remaining to Pay */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap bg-amber-50/30 border-l border-amber-200">
                          {item.remainingAmount != null ? (
                            <div>
                              <span className={`text-base font-extrabold ${hasRemaining ? 'text-amber-700' : 'text-emerald-700'}`}>
                                {fmtAmount(item.remainingAmount)}
                              </span>
                              {hasRemaining && item.unpaidSessionsCount > 0 && (
                                <p className="text-[10px] text-amber-600 font-medium">
                                  {item.unpaidSessionsCount} pending session{item.unpaidSessionsCount !== 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Rate required</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          {item.isFullySettled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 size={12} className="text-emerald-600" /> Settled
                            </span>
                          ) : hasRemaining ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              <Clock size={12} className="text-amber-600" /> Pending Payment
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              No Activity
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Mark As Paid Button */}
                            {hasRemaining && (
                              <button
                                onClick={() => openPayModal(item)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                                title={`Mark ${fmtAmount(item.remainingAmount)} as Paid`}
                              >
                                <Check size={13} /> Mark as Paid
                              </button>
                            )}

                            {/* View Breakdown */}
                            <button
                              onClick={() => setSelectedBreakdown(item)}
                              disabled={item.allSessions.length === 0}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                                item.allSessions.length > 0
                                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-600'
                                  : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                              }`}
                              title="View session log breakdown"
                            >
                              <Eye size={13} /> Sessions
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Card>

      {/* ── MARK AS PAID MODAL ──────────────────────────────────────────────── */}
      {payModalTutor && (
        <Modal
          isOpen={!!payModalTutor}
          onClose={() => setPayModalTutor(null)}
          title={`Settle Payment for ${payModalTutor.tutorName}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Outstanding Balance</p>
                  <p className="text-2xl font-black text-emerald-950 mt-0.5">{fmtAmount(payModalTutor.remainingAmount)}</p>
                </div>
                <div className="text-right text-xs text-emerald-800">
                  <p><strong>{payModalTutor.unpaidSessionsCount}</strong> pending sessions</p>
                  <p><strong>{fmtHours(payModalTutor.unpaidMinutes)}</strong> total unpaid</p>
                  <p>Rate: ₹{payModalTutor.hourlyRate}/hr</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Amount to Pay (INR) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="1"
                    value={payAmountInput}
                    onChange={(e) => setPayAmountInput(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full pl-8 pr-3 py-2 text-sm font-semibold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={payDateInput}
                  onChange={(e) => setPayDateInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Payment Method / Reference Note
                </label>
                <input
                  type="text"
                  value={payNoteInput}
                  onChange={(e) => setPayNoteInput(e.target.value)}
                  placeholder="e.g. UPI / HDFC Bank Transfer / Batch 1 settlement"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
              💡 <strong>Instant Ledger Update:</strong> Marking this as paid will settle the {payModalTutor.unpaidSessionsCount} pending sessions. The remaining amount will immediately drop and only new future sessions will accrue on the ledger.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setPayModalTutor(null)} disabled={paySaving}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmPayment}
                disabled={paySaving || !payAmountInput}
                icon={<Check size={14} />}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {paySaving ? 'Recording...' : `Confirm Payment of ${fmtAmount(Number(payAmountInput) || 0)}`}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── SESSION BREAKDOWN MODAL ─────────────────────────────────────────── */}
      {selectedBreakdown && (
        <Modal
          isOpen={!!selectedBreakdown}
          onClose={() => setSelectedBreakdown(null)}
          title={`Session Log Breakdown: ${selectedBreakdown.tutorName}`}
          size="lg"
        >
          <div className="space-y-4">
            {/* Header summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Hourly Rate</p>
                <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                  {selectedBreakdown.hourlyRate != null ? `₹${selectedBreakdown.hourlyRate}/hr` : 'Not Set'}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total Earned</p>
                <p className="text-sm font-extrabold text-slate-900 mt-0.5">{fmtAmount(selectedBreakdown.totalEarned)}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total Paid</p>
                <p className="text-sm font-extrabold text-emerald-700 mt-0.5">{fmtAmount(selectedBreakdown.totalPaid)}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center">
                <p className="text-[10px] font-bold text-amber-800 uppercase">Remaining to Pay</p>
                <p className="text-sm font-extrabold text-amber-900 mt-0.5">{fmtAmount(selectedBreakdown.remainingAmount)}</p>
              </div>
            </div>

            {/* Quick Settle Banner */}
            {selectedBreakdown.remainingAmount != null && selectedBreakdown.remainingAmount > 0 && (
              <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div>
                  <p className="text-xs font-bold text-amber-900">
                    {selectedBreakdown.unpaidSessionsCount} Pending Sessions ({fmtHours(selectedBreakdown.unpaidMinutes)})
                  </p>
                  <p className="text-xs text-amber-700">Remaining to settle: <strong>{fmtAmount(selectedBreakdown.remainingAmount)}</strong></p>
                </div>
                <button
                  onClick={() => openPayModal(selectedBreakdown)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
                >
                  Mark as Paid ({fmtAmount(selectedBreakdown.remainingAmount)})
                </button>
              </div>
            )}

            {/* Sessions Table */}
            <div className="max-h-[350px] overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-2.5 text-left">Date</th>
                    <th className="p-2.5 text-left">Student</th>
                    <th className="p-2.5 text-left">Topic</th>
                    <th className="p-2.5 text-center">Duration</th>
                    <th className="p-2.5 text-right">Amount</th>
                    <th className="p-2.5 text-center">Payment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedBreakdown.allSessions.map((s) => {
                    const isPaid = (paidSessionIdsByTutor[selectedBreakdown.tutorId] || []).includes(s.id);
                    const mins = s.actualDurationMinutes ?? s.durationMinutes ?? 0;
                    const amt = selectedBreakdown.hourlyRate != null ? (mins / 60) * selectedBreakdown.hourlyRate : null;

                    return (
                      <tr key={s.id} className={isPaid ? 'bg-emerald-50/20' : 'bg-white'}>
                        <td className="p-2.5 font-medium whitespace-nowrap">{fmtDate(s.classDate)}</td>
                        <td className="p-2.5 font-semibold text-slate-800">{s.studentName}</td>
                        <td className="p-2.5 max-w-xs truncate">{s.topic}</td>
                        <td className="p-2.5 text-center font-medium">{fmtHours(mins)}</td>
                        <td className="p-2.5 text-right font-bold text-slate-800">{fmtAmount(amt)}</td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => handleToggleSessionPaid(selectedBreakdown.tutorId, s.id)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}
                            title="Click to toggle session payment status"
                          >
                            {isPaid ? <Check size={10} /> : <Clock size={10} />}
                            {isPaid ? 'Paid' : 'Unpaid'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedBreakdown(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── HOURLY RATE EDITOR MODAL ──────────────────────────────────────── */}
      {editRateTutor && (
        <Modal
          isOpen={!!editRateTutor}
          onClose={() => setEditRateTutor(null)}
          title={`Set Hourly Compensation Rate`}
          size="sm"
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">{editRateTutor.name}</p>
              <p className="text-xs text-slate-400">{editRateTutor.email}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Rate (INR per teaching hour)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  placeholder="e.g. 1000"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                All outstanding and future calculations will automatically update based on logged session duration.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setEditRateTutor(null)} disabled={rateSaving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveHourlyRate} disabled={rateSaving} icon={<Save size={14} />}>
                {rateSaving ? 'Saving...' : 'Save Rate'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default AdminTeacherSalaryPage;
