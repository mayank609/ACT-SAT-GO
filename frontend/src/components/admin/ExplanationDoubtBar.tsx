import { useEffect, useState } from 'react';
import { CheckCircle, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { RichContentRenderer } from './RichContentRenderer';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';

type DoubtStatus = 'doubt' | 'cleared' | null;

/**
 * Collapsed "Explanation" dropdown; Still Doubt / Cleared appear beside it once it is opened. For the
 * inline (non-fullscreen) Question Wise Report. Works for every question
 * (correct, incorrect or omitted); the choice is saved on the attempt so it
 * shows up under the Still Doubt / Cleared filters and in My Doubts.
 */
export function ExplanationDoubtBar({
  attemptId,
  questionId,
  explanation,
  doubtStatus,
  onDoubtChange,
}: {
  attemptId: string;
  questionId: string;
  explanation: string | null | undefined;
  doubtStatus: DoubtStatus;
  onDoubtChange?: (questionId: string, status: DoubtStatus) => void;
}) {
  // Students and admins can change Still Doubt / Cleared; tutors only see it.
  const readOnly = useAuthStore((s) => s.user?.role) === 'tutor';
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<DoubtStatus>(doubtStatus);
  const [saving, setSaving] = useState(false);

  // New question: close the dropdown and show its own saved choice.
  useEffect(() => { setOpen(false); }, [questionId]);
  useEffect(() => { setStatus(doubtStatus); }, [questionId, doubtStatus]);

  const choose = async (next: 'doubt' | 'cleared') => {
    if (readOnly) return;
    const prev = status;
    setStatus(next);
    setSaving(true);
    try {
      await api.setDoubtStatus(attemptId, questionId, next);
      onDoubtChange?.(questionId, next);
    } catch (err) {
      console.error('Failed to set doubt status', err);
      setStatus(prev);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 text-left">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            open ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
          }`}
        >
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Explanation
        </button>
        {/* Still Doubt / Cleared sit beside Explanation, once it is opened */}
        {open && (
          <span className="flex flex-wrap items-center gap-2 asg-fade-in">
        {(!readOnly || status === 'doubt') && (
        <button
          type="button"
          onClick={() => choose('doubt')}
          disabled={saving || readOnly}
          title={readOnly ? 'Only the student or an admin can change this' : undefined}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${readOnly ? 'cursor-not-allowed' : 'disabled:opacity-50'} ${
            status === 'doubt' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
          }`}
        >
          <HelpCircle size={14} /> Still Doubt
        </button>
        )}
        {(!readOnly || status === 'cleared') && (
        <button
          type="button"
          onClick={() => choose('cleared')}
          disabled={saving || readOnly}
          title={readOnly ? 'Only the student or an admin can change this' : undefined}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${readOnly ? 'cursor-not-allowed' : 'disabled:opacity-50'} ${
            status === 'cleared' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
          }`}
        >
          <CheckCircle size={14} /> Cleared
        </button>
        )}
          </span>
        )}
      </div>

      {open && (
        <div className="mt-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100/80">
          {explanation ? (
            <div className="text-sm text-slate-700 leading-relaxed">
              <RichContentRenderer content={explanation} variant="question" className="prose-sm" />
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No explanation available for this question.</p>
          )}
        </div>
      )}

    </div>
  );
}
