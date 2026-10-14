import { useAuthStore } from '../../store/useAuthStore';
import { MistakesView } from '../../components/mistakes/MistakesView';

// ─── Page ────────────────────────────────────────────────────────────────────

export function MistakesPage() {
  const { dbId } = useAuthStore();

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Review Mistakes</h1>
        <p className="text-sm text-slate-500">Wrong and unattempted questions from all your submitted tests.</p>
      </div>

      <MistakesView studentId={dbId} canEditDoubt />
    </div>
  );
}
