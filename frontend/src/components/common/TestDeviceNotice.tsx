import { useNavigate } from 'react-router-dom';
import { Laptop, X } from 'lucide-react';
import { TEST_DEVICE_MESSAGE } from '../../lib/testDevice';

const HINT = 'Open Score π Go on a laptop or desktop to start or continue this test. You can still read articles, study vocabulary and review finished test reports on your phone.';

/** Small dialog shown when a test's Start/Continue button is tapped on a phone. */
export function TestDeviceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="test-device-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 text-center">
        <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
          <X size={16} />
        </button>
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-blue-50 text-[#1b3d6e] flex items-center justify-center">
          <Laptop size={24} />
        </div>
        <h2 id="test-device-title" className="text-base font-semibold text-slate-900">{TEST_DEVICE_MESSAGE}</h2>
        <p className="mt-2 text-sm text-slate-500">{HINT}</p>
        <button onClick={onClose} className="mt-4 w-full bg-[#1b3d6e] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#15305a]">
          OK, got it
        </button>
      </div>
    </div>
  );
}

/** Full-page notice rendered instead of a test route on phones. */
export function TestDeviceBlockedPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-white border border-slate-100 rounded-2xl shadow-sm p-6 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-blue-50 text-[#1b3d6e] flex items-center justify-center">
          <Laptop size={28} />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">{TEST_DEVICE_MESSAGE}</h1>
        <p className="mt-2 text-sm text-slate-500">{HINT}</p>
        <button onClick={() => navigate('/my-tests', { replace: true })}
          className="mt-5 w-full bg-[#1b3d6e] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#15305a]">
          Back to My Tests
        </button>
        <button onClick={() => navigate('/dashboard', { replace: true })}
          className="mt-2 w-full text-sm font-medium text-slate-500 py-2 hover:text-slate-700">
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
