import { useEffect, useState } from 'react';
import { RotateCcw, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from './Modal';
import { Button } from './Button';
import { api, type DbUser } from '../../lib/api';

interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: 'TUTOR' | 'STUDENT';
  entityLabel: string;
  /** Called after a restore or a permanent delete, so the caller can refresh its active list. */
  onChanged: () => void;
}

const fmtDeletedAt = (iso?: string | null) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export function TrashModal({ isOpen, onClose, role, entityLabel, onChanged }: TrashModalProps) {
  const [items, setItems] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmPermanent, setConfirmPermanent] = useState<DbUser | null>(null);
  const [permDeleteLoading, setPermDeleteLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.getUsersByRole(role, { deleted: true })
      .then((r) => setItems(r.users ?? []))
      .catch(() => toast.error('Failed to load trash'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (isOpen) load(); }, [isOpen, role]);

  const handleRestore = async (user: DbUser) => {
    setRestoringId(user.id);
    try {
      await api.restoreUser(user.id);
      setItems((list) => list.filter((u) => u.id !== user.id));
      toast.success(`${user.name} restored`);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to restore');
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!confirmPermanent) return;
    setPermDeleteLoading(true);
    try {
      await api.deleteUser(confirmPermanent.id, { permanent: true });
      setItems((list) => list.filter((u) => u.id !== confirmPermanent.id));
      toast.success(`${confirmPermanent.name} permanently deleted`);
      setConfirmPermanent(null);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to permanently delete');
    } finally {
      setPermDeleteLoading(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`${entityLabel} Trash`} size="md">
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Deleted {entityLabel.toLowerCase()}s land here first. Restore them any time, or delete permanently to erase them for good.
          </p>
          {loading ? (
            <div className="py-10 text-center text-slate-400 text-sm">Loading…</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">Trash is empty.</div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
              {items.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold flex-shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{u.name}</p>
                      <p className="text-xs text-slate-400 truncate">{u.email}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Deleted {fmtDeletedAt(u.deletedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button size="sm" variant="secondary" icon={<RotateCcw size={13} />} onClick={() => handleRestore(u)} disabled={restoringId === u.id}>
                      {restoringId === u.id ? 'Restoring…' : 'Restore'}
                    </Button>
                    <button onClick={() => setConfirmPermanent(u)} title="Delete permanently"
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-200">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
          </div>
        </div>
      </Modal>

      {/* Permanent delete confirmation — a second, more serious step than moving to trash. */}
      <Modal isOpen={!!confirmPermanent} onClose={() => setConfirmPermanent(null)} title="Delete Permanently" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmPermanent(null)}>Cancel</Button>
            <Button size="sm" onClick={handlePermanentDelete} disabled={permDeleteLoading}
              className="bg-red-600 hover:bg-red-700 text-white border-red-600">
              {permDeleteLoading ? 'Deleting…' : 'Delete Permanently'}
            </Button>
          </div>
        }>
        {confirmPermanent && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                This erases <span className="font-semibold text-red-900">{confirmPermanent.name}</span> and everything tied to them —
                test attempts, session logs, tutor/student links — for good. This cannot be undone.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
