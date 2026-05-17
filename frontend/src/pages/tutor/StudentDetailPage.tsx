import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Clock, Target, BookOpen, MessageSquare, PlusCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { StatCard } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { MOCK_STUDENTS, MOCK_ANALYTICS, MOCK_TRENDS, MOCK_TESTS } from '../../data/mockData';
import { useAuthStore } from '../../store/useAuthStore';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar, Legend
} from 'recharts';

interface Note {
  id: string;
  text: string;
  createdAt: string;
  author: string;
}

const topicRadarData = [
  { topic: 'Algebra', score: 87 },
  { topic: 'Grammar', score: 82 },
  { topic: 'Reading', score: 77 },
  { topic: 'Science', score: 73 },
  { topic: 'Geometry', score: 65 },
  { topic: 'Trig', score: 60 },
];

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const student = MOCK_STUDENTS.find((s) => s.id === id) ?? MOCK_STUDENTS[0];
  const gap = (student.targetScore || 36) - (student.avgScore || 0);
  const pct = Math.min(100, ((student.avgScore || 0) / (student.targetScore || 36)) * 100);

  // Assign test state
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState('');
  const [assignedIds, setAssignedIds] = useState<string[]>(
    MOCK_TESTS.filter((t) => t.assignedStudentIds?.includes(student.id)).map((t) => t.id)
  );
  const [assignSuccess, setAssignSuccess] = useState('');

  // Notes state
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState<Note[]>([
    { id: '1', text: 'Strong in algebra but struggles with science reasoning. Focus on passage-based questions.', createdAt: '2024-02-10', author: user?.name ?? 'Tutor' },
  ]);

  const publishedTests = MOCK_TESTS.filter((t) => t.status === 'published');

  const handleAssign = () => {
    if (!selectedTestId) return;
    const test = publishedTests.find((t) => t.id === selectedTestId);
    if (!test) return;
    setAssignedIds((prev) => [...new Set([...prev, selectedTestId])]);
    setAssignSuccess(`"${test.title}" assigned successfully.`);
    setSelectedTestId('');
    setTimeout(() => { setAssignSuccess(''); setAssignOpen(false); }, 1800);
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    const note: Note = {
      id: Date.now().toString(),
      text: noteText.trim(),
      createdAt: new Date().toISOString().split('T')[0],
      author: user?.name ?? 'Tutor',
    };
    setNotes((prev) => [note, ...prev]);
    setNoteText('');
    setNoteOpen(false);
  };

  const sectionData = MOCK_ANALYTICS.sections.map((s) => ({
    name: s.sectionName,
    accuracy: s.accuracy,
    timeEfficiency: Math.round((s.timeUsed / s.timeAllocated) * 100),
  }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 self-start transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-slate-900 truncate">{student.name}</h1>
          <p className="text-slate-400 text-sm">{student.email}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<MessageSquare size={13} />} onClick={() => setNoteOpen(true)}>
            Add Note
          </Button>
          <Button size="sm" icon={<BookOpen size={13} />} onClick={() => setAssignOpen(true)}>
            Assign Test
          </Button>
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold flex-shrink-0">
            {student.name.charAt(0)}
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Current Score', value: student.avgScore ?? '—', color: 'text-slate-900' },
              { label: 'Target Score', value: student.targetScore ?? '—', color: 'text-blue-600' },
              { label: 'Gap', value: gap > 0 ? `+${gap}` : String(gap), color: gap > 0 ? 'text-amber-600' : 'text-emerald-600' },
              { label: 'Tests Done', value: student.testsAttempted ?? 0, color: 'text-slate-900' },
              { label: 'Assigned', value: assignedIds.length, color: 'text-slate-900' },
            ].map((s) => (
              <div key={s.label} className="bg-slate-50 rounded-lg p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Progress to target</span>
            <Badge variant={pct >= 85 ? 'success' : pct >= 70 ? 'warning' : 'danger'} size="sm">
              {pct >= 85 ? 'On Track' : pct >= 70 ? 'Progressing' : 'Needs Help'}
            </Badge>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${pct >= 85 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Overall Accuracy" value={`${MOCK_ANALYTICS.overallAccuracy}%`} icon={<TrendingUp size={16} />} trend={{ value: 5, positive: true }} />
        <StatCard title="Time Mgmt" value="93%" subtitle="Used vs allocated" icon={<Clock size={16} />} />
        <StatCard title="Percentile" value={`${MOCK_ANALYTICS.percentile}th`} icon={<Target size={16} />} />
        <StatCard title="Last Score" value="28" subtitle="ACT composite" icon={<BookOpen size={16} />} trend={{ value: 4, positive: true }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Score trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5">
          <p className="font-medium text-slate-900 text-sm mb-1">Score Progress</p>
          <p className="text-xs text-slate-400 mb-4">Test-by-test improvement</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={MOCK_TRENDS}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
              <YAxis domain={[20, 36]} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px', boxShadow: 'none' }} />
              <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} name="Score" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Radar */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <p className="font-medium text-slate-900 text-sm mb-1">Skill Profile</p>
          <p className="text-xs text-slate-400 mb-4">Strength by topic</p>
          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={topicRadarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="topic" tick={{ fontSize: 9, fill: '#94a3b8' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={1.5} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Section analysis */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <p className="font-medium text-slate-900 text-sm mb-1">Section Analysis</p>
        <p className="text-xs text-slate-400 mb-4">Accuracy and time efficiency per section</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={sectionData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px', boxShadow: 'none' }} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Bar dataKey="accuracy" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Accuracy %" barSize={20} />
            <Bar dataKey="timeEfficiency" fill="#10b981" radius={[3, 3, 0, 0]} name="Time Used %" barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Assigned tests */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <p className="font-medium text-slate-900 text-sm">Assigned Tests</p>
          <button onClick={() => setAssignOpen(true)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
            <PlusCircle size={12} /> Assign more
          </button>
        </div>
        <div className="divide-y divide-slate-50">
          {assignedIds.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">No tests assigned yet.</p>
          ) : (
            MOCK_TESTS.filter((t) => assignedIds.includes(t.id)).map((test) => (
              <div key={test.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                  <BookOpen size={13} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 truncate">{test.title}</p>
                  <p className="text-xs text-slate-400">
                    {test.sections.reduce((a, s) => a + s.questions.length, 0)} questions · {test.sections.length} sections
                  </p>
                </div>
                <Badge variant={test.status === 'published' ? 'success' : 'warning'} size="sm">
                  {test.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Test history */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="px-5 py-3.5 border-b border-slate-50">
          <p className="font-medium text-slate-900 text-sm">Test History</p>
        </div>
        <div className="divide-y divide-slate-50">
          {MOCK_TRENDS.map((trend, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <BookOpen size={13} className="text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 truncate">{trend.testTitle}</p>
                <p className="text-xs text-slate-400">{trend.date}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base font-semibold text-slate-900">{trend.score}</p>
                <p className="text-xs text-slate-400">/ 36</p>
              </div>
              <div className="hidden sm:block w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(trend.score / 36) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Focus areas */}
      {MOCK_ANALYTICS.sections.some((s) => s.topicBreakdown.some((t) => t.accuracy < 75)) && (
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="px-5 py-3.5 border-b border-slate-50 flex items-center gap-2">
            <p className="font-medium text-slate-900 text-sm">Focus Areas</p>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md font-medium">Needs Attention</span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MOCK_ANALYTICS.sections.flatMap((s) =>
              s.topicBreakdown.filter((t) => t.accuracy < 75).map((t) => (
                <div key={t.topic} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center text-red-600 text-xs font-bold flex-shrink-0">
                    {t.accuracy.toFixed(0)}%
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{t.topic}</p>
                    <p className="text-xs text-slate-400">{s.sectionName} · {t.correct}/{t.total} correct</p>
                  </div>
                  <Badge variant="danger" size="sm">Weak</Badge>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tutor Notes */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <p className="font-medium text-slate-900 text-sm">Tutor Notes</p>
          <button
            onClick={() => setNoteOpen(true)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <PlusCircle size={12} /> Add note
          </button>
        </div>
        {notes.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400">No notes yet. Add one to track observations.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {notes.map((note) => (
              <div key={note.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-slate-600">{note.author}</p>
                  <p className="text-xs text-slate-400">{note.createdAt}</p>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{note.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign Test Modal */}
      <Modal
        isOpen={assignOpen}
        onClose={() => { setAssignOpen(false); setSelectedTestId(''); setAssignSuccess(''); }}
        title="Assign Test"
        size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAssign} disabled={!selectedTestId}>
              Assign
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Select a published test to assign to <strong>{student.name}</strong>.</p>
          {assignSuccess && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg text-emerald-700 text-sm">
              <CheckCircle2 size={14} /> {assignSuccess}
            </div>
          )}
          <div className="space-y-2">
            {publishedTests.map((test) => {
              const alreadyAssigned = assignedIds.includes(test.id);
              return (
                <label
                  key={test.id}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    alreadyAssigned
                      ? 'border-emerald-200 bg-emerald-50 opacity-70 cursor-not-allowed'
                      : selectedTestId === test.id
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="test"
                    value={test.id}
                    checked={selectedTestId === test.id}
                    disabled={alreadyAssigned}
                    onChange={() => setSelectedTestId(test.id)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{test.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {test.sections.reduce((a, s) => a + s.questions.length, 0)}q · {test.sections.length} sections
                    </p>
                  </div>
                  {alreadyAssigned && (
                    <span className="text-xs text-emerald-600 font-medium flex-shrink-0">Assigned</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Add Note Modal */}
      <Modal
        isOpen={noteOpen}
        onClose={() => { setNoteOpen(false); setNoteText(''); }}
        title="Add Tutor Note"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim()}>Save Note</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Note for <strong>{student.name}</strong> — visible only to tutors and admins.
          </p>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Observations, focus areas, session notes..."
            rows={5}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
            autoFocus
          />
          <p className="text-xs text-slate-400">{noteText.length}/500</p>
        </div>
      </Modal>
    </div>
  );
}
