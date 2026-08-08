import { useEffect, useMemo, useState } from 'react';
import { Search, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from './Button';
import { Modal } from './Modal';
import { StarRating } from './StarRating';
import { api, type ClassProgressEntry, type ClassProgressInput } from '../../lib/api';
import { isHW, isEnglish, isMath } from '../../lib/testCategorize';
import {
  SUBJECTS, STATUSES, ENGAGEMENTS, HW_SUBFILTERS, SESSION_TYPES, SESSION_TYPE_DEFAULT_DURATION,
  topicsForSubject, toLines, emptySessionForm, type DbTest,
} from '../../lib/sessionLog';

export interface SavedSessionEntry extends ClassProgressEntry {
  studentId: string;
  studentName: string;
  tutorId: string;
  tutorName: string;
}

interface LogSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  authorName: string;
  publishedTests: DbTest[];
  onSaved: (entry: SavedSessionEntry) => void;
  /** Fixes the tutor to this ID and hides the tutor picker — for a tutor logging their own session. */
  fixedTutorId?: string;
  /** Only needed when fixedTutorId isn't set, so admin/super-admin can pick who they're logging for. */
  tutors?: { id: string; name: string }[];
  /** tutorId -> that tutor's students. For fixedTutorId mode this only needs one entry. */
  studentsByTutor: Map<string, { id: string; name: string }[]>;
}

// Shared "Log a Session" form — used both by a tutor logging their own session and by
// admin/super-admin logging one on a tutor's behalf (with a tutor picker added).
export function LogSessionModal({
  isOpen, onClose, authorName, publishedTests, onSaved, fixedTutorId, tutors, studentsByTutor,
}: LogSessionModalProps) {
  const [selectedTutorId, setSelectedTutorId] = useState(fixedTutorId ?? '');
  const [form, setForm] = useState(emptySessionForm);
  const [hwSearch, setHwSearch] = useState('');
  const [hwSubFilter, setHwSubFilter] = useState<typeof HW_SUBFILTERS[number]>('HW');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedTutorId(fixedTutorId ?? '');
    setForm({ ...emptySessionForm });
    setHwSearch('');
    setHwSubFilter('HW');
  }, [isOpen, fixedTutorId]);

  const tutorId = fixedTutorId ?? selectedTutorId;
  const students = studentsByTutor.get(tutorId) ?? [];

  const topicOptions = useMemo(() => topicsForSubject(form.subject), [form.subject]);
  const selectedTopicLines = useMemo(() => toLines(form.topic), [form.topic]);
  const isNoShow = form.status.startsWith('No Show');

  const toggleTopic = (topic: string) => {
    setForm((f) => {
      const lines = toLines(f.topic);
      const next = lines.includes(topic) ? lines.filter((l) => l !== topic) : [...lines, topic];
      return { ...f, topic: next.join('\n') };
    });
  };

  const toggleHomeworkTest = (testId: string) => {
    setForm((f) => ({
      ...f,
      homeworkTestIds: f.homeworkTestIds.includes(testId)
        ? f.homeworkTestIds.filter((id) => id !== testId)
        : [...f.homeworkTestIds, testId],
    }));
  };

  const homeworkOptions = useMemo(() => {
    return publishedTests
      .filter((t) => (t.category ?? 'Other') === 'Practice Sheet')
      .filter((t) => {
        if (hwSubFilter === 'All') return true;
        if (hwSubFilter === 'HW') return isHW(t);
        if (hwSubFilter === 'English') return isEnglish(t);
        if (hwSubFilter === 'Maths') return isMath(t);
        return true;
      })
      .filter((t) => !hwSearch.trim() || t.title.toLowerCase().includes(hwSearch.trim().toLowerCase()));
  }, [publishedTests, hwSubFilter, hwSearch]);

  const canSave = !!tutorId && !!form.studentId && (isNoShow || !!form.topic.trim()) && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const homeworkTitles = form.homeworkTestIds
        .map((id) => publishedTests.find((t) => t.id === id)?.title)
        .filter((t): t is string => Boolean(t));

      if (form.homeworkTestIds.length > 0) {
        await Promise.all(
          form.homeworkTestIds.map((testId) => api.createTestAssignments({ testId, studentIds: [form.studentId] }))
        );
      }

      const body: ClassProgressInput = {
        // No topics are covered on a no-show — fall back to the status itself so the
        // session log still has something meaningful to show in the "Topic" column.
        topic: form.topic.trim() || (isNoShow ? form.status : ''),
        homework: homeworkTitles.join('\n') || undefined,
        notes: form.notes.trim() || undefined,
        classDate: form.classDate,
        author: authorName,
        startTime: form.startTime || undefined,
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined,
        actualDurationMinutes: form.actualDurationMinutes ? Number(form.actualDurationMinutes) : undefined,
        subject: form.subject,
        status: form.status,
        sessionType: form.sessionType,
        understanding: form.understanding || undefined,
        attendance: form.attendance,
        engagement: form.engagement,
        nextSessionGoal: form.nextSessionGoal.trim() || undefined,
        nextSessionAt: form.nextSessionAt || undefined,
      };
      const { entry } = await api.addClassProgress(tutorId, form.studentId, body);
      const studentName = students.find((s) => s.id === form.studentId)?.name ?? 'Student';
      const tutorName = fixedTutorId ? authorName : (tutors?.find((t) => t.id === tutorId)?.name ?? 'Tutor');
      onSaved({ ...entry, studentId: form.studentId, studentName, tutorId, tutorName });
      toast.success(form.homeworkTestIds.length > 0 ? 'Session logged and homework assigned.' : 'Session logged.');
      onClose();
    } catch {
      toast.error('Failed to log session.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log a Session" size="md"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={!canSave}>
            {saving ? 'Saving...' : 'Save Session'}
          </Button>
        </div>
      }>
      <div className="space-y-4">
        {!fixedTutorId && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tutor</label>
            <select value={selectedTutorId}
              onChange={(e) => { setSelectedTutorId(e.target.value); setForm((f) => ({ ...f, studentId: '' })); }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option value="">Select tutor…</option>
              {(tutors ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Student</label>
            <select value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
              disabled={!tutorId}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400">
              <option value="">{tutorId ? 'Select student…' : 'Select a tutor first'}</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
            <select value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100">
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Session Type</label>
          <div className="flex flex-wrap gap-1.5">
            {SESSION_TYPES.map((t) => (
              <button key={t} type="button"
                onClick={() => setForm((f) => ({ ...f, sessionType: t, durationMinutes: String(SESSION_TYPE_DEFAULT_DURATION[t]) }))}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  form.sessionType === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
            <input type="date" value={form.classDate} onChange={(e) => setForm((f) => ({ ...f, classDate: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Start Time</label>
            <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Scheduled Duration (min)</label>
            <input type="number" min={0} value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Actual Duration (min)</label>
            <input type="number" min={0} value={form.actualDurationMinutes} onChange={(e) => setForm((f) => ({ ...f, actualDurationMinutes: e.target.value }))}
              placeholder="How long the session actually ran"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button key={s} type="button"
                onClick={() => setForm((f) => ({
                  ...f, status: s,
                  // Keep attendance consistent with whichever side didn't show —
                  // it's hidden from the form for a no-show, so it can't be corrected by hand.
                  attendance: s === 'No Show - Student' ? 'Absent' : s === 'No Show - Tutor' ? 'Present' : f.attendance,
                }))}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  form.status === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {isNoShow ? (
          // Nothing was taught on a no-show — swap the topics UI for a single
          // remarks box (e.g. why they missed it, any follow-up plan).
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Remarks</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Reason for the no-show, any follow-up plan..." rows={3} autoFocus
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none" />
          </div>
        ) : (
          <>
            {topicOptions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-600">Topics Covered</label>
                  {selectedTopicLines.length > 0 && (
                    <span className="text-xs font-semibold text-blue-600">{selectedTopicLines.length} selected</span>
                  )}
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto divide-y divide-slate-50">
                  {topicOptions.map((topic) => {
                    const isSelected = selectedTopicLines.includes(topic);
                    return (
                      <label key={topic}
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleTopic(topic)} className="sr-only" />
                        {isSelected ? <CheckSquare size={14} className="text-blue-600 flex-shrink-0" /> : <Square size={14} className="text-slate-300 flex-shrink-0" />}
                        <span className="text-sm text-slate-700 flex-1">{topic}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {topicOptions.length > 0 ? 'Topics Covered (one per line — checked items above are added here automatically)' : 'Topics Covered (one per line)'}
              </label>
              <textarea value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                placeholder={'Linear equations in one variable\nWord problems using equations'} rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none" autoFocus={topicOptions.length === 0} />
            </div>
          </>
        )}

        {!isNoShow && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-600">Homework Assigned (from Test Builder, optional)</label>
                {form.homeworkTestIds.length > 0 && (
                  <span className="text-xs font-semibold text-blue-600">{form.homeworkTestIds.length} selected</span>
                )}
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-50 border-b border-slate-200">
                  <div className="flex gap-1">
                    {HW_SUBFILTERS.map((f) => (
                      <button key={f} type="button" onClick={() => setHwSubFilter(f)}
                        className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                          hwSubFilter === f ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}>
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="relative flex-1 min-w-[140px]">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input type="text" value={hwSearch} onChange={(e) => setHwSearch(e.target.value)}
                      placeholder="Search worksheets…"
                      className="w-full pl-6 pr-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100" />
                  </div>
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-50">
                  {homeworkOptions.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No published worksheets match.</p>
                  ) : homeworkOptions.map((t) => {
                    const isSelected = form.homeworkTestIds.includes(t.id);
                    return (
                      <label key={t.id}
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleHomeworkTest(t.id)} className="sr-only" />
                        {isSelected ? <CheckSquare size={14} className="text-blue-600 flex-shrink-0" /> : <Square size={14} className="text-slate-300 flex-shrink-0" />}
                        <span className="text-sm text-slate-700 truncate flex-1">{t.title}</span>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">{(t.sections as unknown[]).length} sections</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tutor Remarks (optional)</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Student showed good improvement..." rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none" />
            </div>

            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Understanding</label>
                <StarRating value={form.understanding} onChange={(v) => setForm((f) => ({ ...f, understanding: v }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Attendance</label>
                <div className="flex gap-1.5">
                  {['Present', 'Absent'].map((a) => (
                    <button key={a} type="button" onClick={() => setForm((f) => ({ ...f, attendance: a }))}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                        form.attendance === a ? (a === 'Absent' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white') : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Engagement</label>
                <select value={form.engagement} onChange={(e) => setForm((f) => ({ ...f, engagement: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100">
                  {ENGAGEMENTS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Next Session Goal (optional)</label>
            <input type="text" value={form.nextSessionGoal} onChange={(e) => setForm((f) => ({ ...f, nextSessionGoal: e.target.value }))}
              placeholder="Finish Module 2 & start inequalities"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Next Session (optional)</label>
            <input type="datetime-local" value={form.nextSessionAt} onChange={(e) => setForm((f) => ({ ...f, nextSessionAt: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
        </div>
      </div>
    </Modal>
  );
}
