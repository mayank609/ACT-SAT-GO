import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, EyeOff, Loader2, Lock, Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, type MaterialDetail } from '../../lib/api';
import { Button } from '../../components/common/Button';

// Protected PDF viewer. Pages arrive as watermarked images rendered on the
// server (the PDF itself is never sent to view-only readers) and are drawn on
// <canvas>, with copying, saving, printing, dragging and right-click blocked.
// View-only readers also get the page hidden while the window is in the
// background, which defeats most "snip" screenshot tools.

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const MAX_FIT_WIDTH = 900;
const BLOCKED_KEYS = new Set(['s', 'p', 'c', 'x', 'a', 'u']);

function useContentProtection(hideWhenAway: boolean) {
  const [away, setAway] = useState(false);
  useEffect(() => {
    let lastToast = 0;
    const warn = (what: string) => {
      if (Date.now() - lastToast < 2500) return;
      lastToast = Date.now();
      toast(`${what} is turned off for this material`, { icon: '🔒' });
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && BLOCKED_KEYS.has(k)) {
        e.preventDefault();
        e.stopPropagation();
        warn(k === 'p' ? 'Printing' : k === 's' ? 'Saving' : 'Copying');
      }
      if (e.key === 'PrintScreen') {
        navigator.clipboard?.writeText('').catch(() => {});
        warn('Screenshots');
      }
    };
    const block = (e: Event) => { e.preventDefault(); };
    const onCopy = (e: ClipboardEvent) => { e.preventDefault(); e.clipboardData?.setData('text/plain', ''); warn('Copying'); };
    const onPrint = () => warn('Printing');
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    document.addEventListener('contextmenu', block);
    document.addEventListener('dragstart', block);
    document.addEventListener('selectstart', block);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    window.addEventListener('beforeprint', onPrint);

    // Printing: hide everything (Ctrl+P is blocked, but the browser menu isn't).
    const style = document.createElement('style');
    style.textContent = '@media print { body { display: none !important; } }';
    document.head.appendChild(style);

    const onBlur = () => hideWhenAway && setAway(true);
    const onVis = () => hideWhenAway && document.visibilityState === 'hidden' && setAway(true);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('dragstart', block);
      document.removeEventListener('selectstart', block);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      window.removeEventListener('beforeprint', onPrint);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
      style.remove();
    };
  }, [hideWhenAway]);
  return { away, resume: () => setAway(false) };
}

/** One page: loads its image when near the viewport and frees it when far away. */
function PageCanvas({ materialId, page, aspect, renderWidth, onError }: {
  materialId: string; page: number; aspect: number; renderWidth: number; onError: (msg: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '1500px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!near) {
      if (c) { c.width = 0; c.height = 0; } // release the bitmap memory
      setState('idle');
      return;
    }
    const ctrl = new AbortController();
    setState('loading');
    api.getMaterialPage(materialId, page, renderWidth, ctrl.signal)
      .then((blob) => createImageBitmap(blob))
      .then((bmp) => {
        if (ctrl.signal.aborted || !c) { bmp.close(); return; }
        c.width = bmp.width;
        c.height = bmp.height;
        c.getContext('2d')?.drawImage(bmp, 0, 0);
        bmp.close();
        setState('ready');
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setState('error');
        onError((e as Error).message);
      });
    return () => ctrl.abort();
  }, [near, materialId, page, renderWidth, onError]);

  return (
    <div ref={wrap} data-page={page} className="relative w-full bg-white shadow-sm ring-1 ring-slate-200 rounded-sm overflow-hidden" style={{ aspectRatio: `1 / ${aspect}` }}>
      <canvas ref={canvas} className="absolute inset-0 h-full w-full pointer-events-none" aria-label={`Page ${page}`} role="img" />
      {state !== 'ready' && (
        <div className="absolute inset-0 grid place-items-center text-slate-300">
          {state === 'error' ? <span className="text-xs text-red-500">Page {page} could not be loaded</span> : <Loader2 size={20} className="animate-spin" />}
        </div>
      )}
    </div>
  );
}

export function MaterialViewerPage() {
  const { materialId } = useParams<{ materialId: string }>();
  const navigate = useNavigate();
  const [m, setM] = useState<MaterialDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [boxWidth, setBoxWidth] = useState(0);
  const [current, setCurrent] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const zoomAnchor = useRef<number | null>(null);
  const viewOnly = !!m && !m.canDownload;
  const { away, resume } = useContentProtection(viewOnly);

  useEffect(() => {
    if (!materialId) return;
    api.getMaterial(materialId).then((r) => setM(r.material)).catch((e) => setError(e.message || 'Could not open this material'));
  }, [materialId]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [m]);

  // Which page is in the middle of the screen.
  useEffect(() => {
    const root = pagesRef.current;
    if (!root || !m) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setCurrent(Number((e.target as HTMLElement).dataset.page));
    }, { rootMargin: '-45% 0px -45% 0px' });
    root.querySelectorAll('[data-page]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [m, boxWidth, zoom]);

  // Reopen where the reader stopped last time.
  useEffect(() => {
    if (!m || restored.current || !boxWidth) return;
    restored.current = true;
    if (m.lastPage && m.lastPage > 1) {
      requestAnimationFrame(() => pagesRef.current?.querySelector(`[data-page="${m.lastPage}"]`)?.scrollIntoView({ block: 'start' }));
    }
  }, [m, boxWidth]);

  // Zooming keeps the reader on the page they were looking at.
  useLayoutEffect(() => {
    const p = zoomAnchor.current;
    if (p == null) return;
    zoomAnchor.current = null;
    pagesRef.current?.querySelector(`[data-page="${p}"]`)?.scrollIntoView({ block: 'start' });
  }, [zoom]);

  // Remember where the reader is (recipients only), so it reopens there next time.
  useEffect(() => {
    if (!m || m.canManage || current < 1) return;
    const t = setTimeout(() => { api.saveMaterialProgress(m.id, current).catch(() => {}); }, 1500);
    return () => clearTimeout(t);
  }, [m, current]);

  const onPageError = useCallback((msg: string) => console.warn('[viewer]', msg), []);

  if (error) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <p className="text-slate-700 font-medium">{error}</p>
        <Button className="mt-4" variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => navigate('/materials')}>Back to study materials</Button>
      </div>
    );
  }
  if (!m) return <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>;

  const fitWidth = Math.min(boxWidth || MAX_FIT_WIDTH, MAX_FIT_WIDTH);
  const cssWidth = Math.round(fitWidth * zoom);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const renderWidth = cssWidth * dpr <= 800 ? 800 : cssWidth * dpr <= 1200 ? 1200 : 1600;
  const zi = ZOOMS.indexOf(zoom);
  const changeZoom = (z: number) => { zoomAnchor.current = current; setZoom(z); };
  const goTo = (p: number) => pagesRef.current?.querySelector(`[data-page="${Math.min(Math.max(p, 1), m.pageCount)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });

  const download = async () => {
    setDownloading(true);
    try { await api.downloadMaterial(m.id, m.fileName || `${m.title}.pdf`); } catch (e) { toast.error((e as Error).message); } finally { setDownloading(false); }
  };

  return (
    <div className="select-none" style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}>
      <div className="flex items-start gap-3 mb-4">
        <button onClick={() => navigate('/materials')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Back to study materials" aria-label="Back to study materials">
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div className="min-w-0 flex-1">
          {m.subject && <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">{m.subject}</p>}
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">{m.title}</h1>
          <p className="mt-1 text-xs text-slate-500">{m.pageCount} page{m.pageCount === 1 ? '' : 's'}{m.createdByName ? ` · from ${m.createdByName}` : ''}</p>
          {m.description && <p className="mt-2 max-w-3xl text-sm text-slate-600">{m.description}</p>}
        </div>
        {m.canDownload
          ? <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={download} loading={downloading}>Download PDF</Button>
          : <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"><Lock size={12} /> View only</span>}
      </div>

      {/* Toolbar */}
      <div className="sticky top-0 z-10 -mx-1 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
        <div className="flex items-center gap-1 text-sm text-slate-600">
          <button type="button" className="rounded-lg px-2 py-1 hover:bg-slate-100 disabled:opacity-30" onClick={() => goTo(current - 1)} disabled={current <= 1} aria-label="Previous page">‹</button>
          <span className="tabular-nums" aria-live="polite">Page <strong className="text-slate-900">{current}</strong> of {m.pageCount}</span>
          <button type="button" className="rounded-lg px-2 py-1 hover:bg-slate-100 disabled:opacity-30" onClick={() => goTo(current + 1)} disabled={current >= m.pageCount} aria-label="Next page">›</button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30" onClick={() => changeZoom(ZOOMS[zi - 1])} disabled={zi <= 0} aria-label="Zoom out"><Minus size={15} /></button>
          <span className="w-12 text-center text-xs font-semibold tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
          <button type="button" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30" onClick={() => changeZoom(ZOOMS[zi + 1])} disabled={zi >= ZOOMS.length - 1} aria-label="Zoom in"><Plus size={15} /></button>
          <button type="button" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" onClick={() => changeZoom(1)} aria-label="Fit to width" title="Fit to width">
            {zoom === 1 ? <Maximize2 size={15} /> : <RotateCcw size={15} />}
          </button>
        </div>
      </div>

      <div ref={box} className="relative w-full">
        <div ref={pagesRef} className={`overflow-x-auto pb-6 transition-[filter] ${away ? 'blur-xl' : ''}`} onContextMenu={(e) => e.preventDefault()}>
          <div className="mx-auto space-y-4" style={{ width: cssWidth || undefined, maxWidth: zoom <= 1 ? '100%' : undefined }}>
            {m.pageSizes.map(([w, h], i) => (
              <PageCanvas key={`${i}-${renderWidth}`} materialId={m.id} page={i + 1} aspect={h / w} renderWidth={renderWidth} onError={onPageError} />
            ))}
          </div>
        </div>
        {away && (
          <button type="button" onClick={resume}
            className="fixed inset-0 z-20 grid place-items-center bg-slate-900/10 text-center">
            <span className="rounded-2xl bg-white px-6 py-5 shadow-xl">
              <EyeOff size={26} className="mx-auto text-slate-400" />
              <span className="mt-2 block font-semibold text-slate-800">Paused</span>
              <span className="mt-1 block text-sm text-slate-500">The page is hidden while you’re away. Click to keep reading.</span>
            </span>
          </button>
        )}
      </div>
      {viewOnly && (
        <p className="mt-2 text-center text-[11px] text-slate-400">This material is view-only. Pages are watermarked with your name.</p>
      )}
    </div>
  );
}
