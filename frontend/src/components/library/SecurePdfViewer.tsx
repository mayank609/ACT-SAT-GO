import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ZoomIn, ZoomOut, Loader2, Download, Printer, Lock, Maximize2, Minimize2, Calculator, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { api, type LibraryDocument } from '../../lib/api';
import { DesmosCalculator } from '../calculator/DesmosCalculator';

/** A clickable link found on a PDF page: a web address, or a jump to another page. */
type PdfLink = { url: string } | { dest: unknown };

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [desmosOpen, setDesmosOpen] = useState(false);
  const [webLink, setWebLink] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Phones: open the document fitted to the screen width instead of at 125%.
  useEffect(() => {
    if (!pdf || !window.matchMedia('(max-width: 767px)').matches) return;
    let cancelled = false;
    pdf.getPage(1).then((page) => {
      if (cancelled) return;
      const w = page.getViewport({ scale: 1 }).width;
      if (w > 0) setScale(Math.min(1.25, Math.max(0.4, +((window.innerWidth - 16) / w).toFixed(2))));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [pdf]);

  // Browser full screen for the reader itself (DESMOS and link panels live inside it).
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else rootRef.current?.requestFullscreen?.().catch(() => toast.error('Full screen is not available in this browser'));
  };

  const close = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onClose();
  };

  const goToPage = (pageNumber: number) => {
    pagesRef.current?.querySelector(`[data-page="${pageNumber}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Links inside the PDF: page jumps scroll the reader, portal addresses open that
  // portal page, and any other web address opens in a panel inside the portal.
  const openLink = useCallback(async (link: PdfLink) => {
    if ('url' in link) {
      let target: URL;
      try { target = new URL(link.url, window.location.href); } catch { return; }
      if (target.protocol === 'mailto:' || target.protocol === 'tel:') { window.location.href = target.href; return; }
      if (target.protocol !== 'http:' && target.protocol !== 'https:') return;
      if (target.origin === window.location.origin) {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        onClose();
        navigate(target.pathname + target.search + target.hash);
        return;
      }
      setWebLink(target.href);
      return;
    }
    if (!pdf) return;
    try {
      const dest = typeof link.dest === 'string' ? await pdf.getDestination(link.dest) : link.dest;
      if (!Array.isArray(dest) || dest.length === 0) return;
      const ref = dest[0];
      const index = typeof ref === 'number' ? ref : await pdf.getPageIndex(ref);
      goToPage(index + 1);
    } catch {
      // A broken link inside the PDF does nothing, like in a normal PDF viewer.
    }
  }, [pdf, navigate, onClose]);

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
    <div ref={rootRef} className="fixed inset-0 z-[70] flex flex-col bg-slate-800/95" onContextMenu={canPrint ? undefined : (e) => e.preventDefault()}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 max-md:gap-1 max-md:px-2 bg-slate-900 text-white shadow">
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
        <span className="w-12 max-md:w-9 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))} className="p-2 rounded-lg hover:bg-slate-700" title="Zoom in">
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => setDesmosOpen((o) => !o)}
          className={`flex items-center gap-1.5 px-3 py-1.5 max-md:px-2 rounded-lg text-xs font-semibold border ${desmosOpen ? 'bg-white text-slate-900 border-white' : 'border-slate-500 hover:bg-slate-700'}`}
          title="DESMOS calculator"
        >
          <Calculator size={15} /> <span className="hidden sm:inline">DESMOS</span>
        </button>
        <button onClick={toggleFullscreen} className="p-2 rounded-lg hover:bg-slate-700 max-md:hidden" title={isFullscreen ? 'Exit full screen' : 'Full screen'}>
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
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
        <button onClick={close} className="p-2 rounded-lg hover:bg-slate-700" title="Close">
          <X size={18} />
        </button>
      </div>

      {/* Pages */}
      <div ref={pagesRef} className="flex-1 overflow-auto py-6 max-md:py-2" style={{ userSelect: 'none' }}>
        {error ? (
          <p className="mt-20 text-center text-sm text-red-300">{error}</p>
        ) : !pdf ? (
          <div className="mt-20 flex items-center justify-center gap-2 text-slate-300 text-sm">
            <Loader2 size={18} className="animate-spin" /> Opening document…
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {Array.from({ length: pdf.numPages }, (_, i) => (
              <PdfPage key={i} pdf={pdf} pageNumber={i + 1} scale={scale} watermark={canPrint ? undefined : watermark} onLink={openLink} />
            ))}
          </div>
        )}
      </div>

      {webLink && <WebLinkPanel url={webLink} onClose={() => setWebLink(null)} />}
      <DesmosCalculator open={desmosOpen} onClose={() => setDesmosOpen(false)} />
    </div>
  );
}

/** A web page opened from a PDF link, shown inside the portal over the document. */
function WebLinkPanel({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-[80] flex flex-col bg-slate-900/80 p-4 sm:p-8">
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
          <p className="min-w-0 flex-1 truncate text-xs text-slate-600" title={url}>{url}</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
            title="Some websites don't allow being shown inside the portal. Use this if the page stays blank."
          >
            <ExternalLink size={14} /> Open in new tab
          </a>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" title="Back to the document">
            <X size={16} />
          </button>
        </div>
        <iframe src={url} title={url} className="w-full flex-1 border-0" referrerPolicy="no-referrer" />
      </div>
    </div>
  );
}

/** One page, rendered only once it scrolls near the viewport. */
function PdfPage({ pdf, pageNumber, scale, watermark, onLink }: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  watermark?: string;
  onLink: (link: PdfLink) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [links, setLinks] = useState<Array<{ left: number; top: number; width: number; height: number; link: PdfLink }>>([]);

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

      // Clickable areas for the page's links, placed over the drawn page.
      page.getAnnotations({ intent: 'display' }).then((annots) => {
        if (cancelled) return;
        const found: typeof links = [];
        for (const a of annots as Array<Record<string, unknown>>) {
          if (a.subtype !== 'Link' || !Array.isArray(a.rect)) continue;
          const url = (a.url || a.unsafeUrl) as string | undefined;
          const link: PdfLink | null = url ? { url } : a.dest ? { dest: a.dest } : null;
          if (!link) continue;
          const [x1, y1, x2, y2] = vp.convertToViewportRectangle(a.rect as number[]);
          found.push({ left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), link });
        }
        setLinks(found);
      }).catch(() => {});
    });
    return () => { cancelled = true; task?.cancel(); };
  }, [visible, pdf, pageNumber, scale]);

  return (
    <div
      ref={wrapRef}
      data-page={pageNumber}
      className="relative bg-white shadow-lg"
      style={{ width: size?.w ?? 600, height: size?.h ?? 800 }}
    >
      <canvas ref={canvasRef} className="block" draggable={false} />
      {watermark && <Watermark text={watermark} />}
      {links.map((l, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onLink(l.link)}
          className="absolute z-10 cursor-pointer rounded-sm hover:bg-blue-400/20"
          style={{ left: l.left, top: l.top, width: l.width, height: l.height }}
          title={'url' in l.link ? l.link.url : 'Go to page'}
          aria-label={'url' in l.link ? `Open ${l.link.url}` : 'Go to linked page'}
        />
      ))}
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
