import { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, Loader2, Download, Printer, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { api, type LibraryDocument } from '../../lib/api';

interface SecurePdfViewerProps {
  document: LibraryDocument;
  /** Admins may download and print; students and tutors only read in the app. */
  canPrint: boolean;
  /** Shown faintly across every page for students and tutors. */
  watermark?: string;
  onClose: () => void;
}

/**
 * Full-screen, in-app PDF reader for the ASG Library.
 *
 * Pages are drawn onto <canvas> with pdf.js, so there is no browser PDF viewer
 * (and no built-in download/print toolbar). For students and tutors it also
 * blocks Ctrl/Cmd+P and Ctrl/Cmd+S, the right-click menu, and printing through
 * the browser menu (print CSS blanks the page). No web page can stop a
 * screenshot; the watermark carries the viewer's name for that case.
 */
export function SecurePdfViewer({ document: doc, canPrint, watermark, onClose }: SecurePdfViewerProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.25);

  // Load the PDF bytes (auth-checked server route) and parse them.
  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const data = await api.getLibraryFile(doc.id);
        // The "legacy" build: the modern one calls Map.getOrInsertComputed, which
        // only the newest browsers have, so older Chrome/Safari fail to open PDFs.
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).href;
        // pdf.js transfers the buffer it is given, so keep our own copy for admin download/print.
        if (canPrint) setBytes(data.slice(0));
        loaded = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) { loaded.destroy(); return; }
        setPdf(loaded);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Could not open the document');
      }
    })();
    return () => { cancelled = true; loaded?.destroy(); };
  }, [doc.id, canPrint]);

  // Print/save protection for students and tutors while the viewer is open.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    if (canPrint) return () => { document.body.style.overflow = ''; };

    const style = document.createElement('style');
    style.setAttribute('data-asg-library-noprint', '');
    style.textContent = `@media print {
      body * { display: none !important; }
      body::before { content: "Printing is disabled for ASG Library documents."; display: block; padding: 48px; font: 16px sans-serif; }
    }`;
    document.head.appendChild(style);

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === 'p' || k === 's')) {
        e.preventDefault();
        e.stopPropagation();
        toast.error(k === 'p' ? 'Printing is disabled for this document' : 'Saving is disabled for this document');
      }
    };
    window.addEventListener('keydown', onKey, true);

    const originalPrint = window.print;
    window.print = () => { toast.error('Printing is disabled for this document'); };

    return () => {
      document.body.style.overflow = '';
      style.remove();
      window.removeEventListener('keydown', onKey, true);
      window.print = originalPrint;
    };
  }, [canPrint]);

  const download = () => {
    if (!bytes) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.fileName || `${doc.title}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  // Admin print: load the original PDF in a hidden frame and print that.
  const print = () => {
    if (!bytes) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    frame.src = url;
    frame.onload = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60_000);
    };
    document.body.appendChild(frame);
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-800/95" onContextMenu={canPrint ? undefined : (e) => e.preventDefault()}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900 text-white shadow">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{doc.title}</p>
          <p className="text-[11px] text-slate-400">
            {pdf ? `${pdf.numPages} page${pdf.numPages !== 1 ? 's' : ''}` : 'Loading…'}
            {!canPrint && (
              <span className="ml-2 inline-flex items-center gap-1"><Lock size={10} /> View only</span>
            )}
          </p>
        </div>
        <button onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))} className="p-2 rounded-lg hover:bg-slate-700" title="Zoom out">
          <ZoomOut size={18} />
        </button>
        <span className="w-12 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))} className="p-2 rounded-lg hover:bg-slate-700" title="Zoom in">
          <ZoomIn size={18} />
        </button>
        {canPrint && (
          <>
            <button onClick={download} disabled={!bytes} className="p-2 rounded-lg hover:bg-slate-700 disabled:opacity-40" title="Download">
              <Download size={18} />
            </button>
            <button onClick={print} disabled={!bytes} className="p-2 rounded-lg hover:bg-slate-700 disabled:opacity-40" title="Print">
              <Printer size={18} />
            </button>
          </>
        )}
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700" title="Close">
          <X size={18} />
        </button>
      </div>

      {/* Pages */}
      <div className="flex-1 overflow-auto py-6" style={{ userSelect: 'none' }}>
        {error ? (
          <p className="mt-20 text-center text-sm text-red-300">{error}</p>
        ) : !pdf ? (
          <div className="mt-20 flex items-center justify-center gap-2 text-slate-300 text-sm">
            <Loader2 size={18} className="animate-spin" /> Opening document…
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {Array.from({ length: pdf.numPages }, (_, i) => (
              <PdfPage key={i} pdf={pdf} pageNumber={i + 1} scale={scale} watermark={canPrint ? undefined : watermark} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** One page, rendered only once it scrolls near the viewport. */
function PdfPage({ pdf, pageNumber, scale, watermark }: { pdf: PDFDocumentProxy; pageNumber: number; scale: number; watermark?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // Page size up front, so the scroll height is right before pages render.
  useEffect(() => {
    let cancelled = false;
    pdf.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      const vp = page.getViewport({ scale });
      setSize({ w: vp.width, h: vp.height });
    });
    return () => { cancelled = true; };
  }, [pdf, pageNumber, scale]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    let cancelled = false;
    pdf.getPage(pageNumber).then((page) => {
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      const vp = page.getViewport({ scale });
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(vp.width * ratio);
      canvas.height = Math.floor(vp.height * ratio);
      canvas.style.width = `${vp.width}px`;
      canvas.style.height = `${vp.height}px`;
      task = page.render({ canvas, viewport: vp, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined });
      task.promise.catch(() => {});
    });
    return () => { cancelled = true; task?.cancel(); };
  }, [visible, pdf, pageNumber, scale]);

  return (
    <div
      ref={wrapRef}
      className="relative bg-white shadow-lg"
      style={{ width: size?.w ?? 600, height: size?.h ?? 800 }}
    >
      <canvas ref={canvasRef} className="block" draggable={false} />
      {watermark && <Watermark text={watermark} />}
    </div>
  );
}

function Watermark({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -inset-1/2 flex flex-wrap content-center justify-center gap-x-24 gap-y-28 rotate-[-30deg]">
        {Array.from({ length: 30 }, (_, i) => (
          <span key={i} className="whitespace-nowrap text-lg font-semibold text-slate-900/10">{text}</span>
        ))}
      </div>
    </div>
  );
}
