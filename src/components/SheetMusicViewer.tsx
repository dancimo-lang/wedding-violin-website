'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

async function openPdf(data: Uint8Array): Promise<PDFDocumentProxy> {
  try {
    const pdfjs = await import('pdfjs-dist/webpack.mjs');
    return await pdfjs.getDocument({ data }).promise;
  } catch {
    // The bundled worker can fail to load on a protected preview. The legacy
    // build parses the same bytes without that separate request.
    const legacy = await import('pdfjs-dist/legacy/build/pdf.mjs');
    return await legacy.getDocument({ data: data.slice(), isEvalSupported: false }).promise;
  }
}
import { goldButtonClass, outlineButtonClass } from '@/components/public-button';

export default function SheetMusicViewer({ fileUrl, title }: { fileUrl: string; title: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const renderRef = useRef<RenderTask | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch(fileUrl, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('The sheet music could not be loaded.');
      const data = new Uint8Array(await response.arrayBuffer());
      if (data.length < 5 || data[0] !== 0x25 || data[1] !== 0x50 || data[2] !== 0x44 || data[3] !== 0x46) {
        throw new Error('The sheet music was not a PDF.');
      }
      const loaded = await openPdf(data);
      if (cancelled) {
        await loaded.destroy();
        return;
      }
      documentRef.current = loaded;
      setPageCount(loaded.numPages);
      setStatus('ready');
    }

    load().catch(() => {
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
      renderRef.current?.cancel();
      renderRef.current = null;
      const current = documentRef.current;
      documentRef.current = null;
      void current?.destroy().catch(() => undefined);
    };
  }, [fileUrl]);

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  useEffect(() => {
    const doc = documentRef.current;
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (status !== 'ready' || !doc || !frame || !canvas) return;

    let cancelled = false;
    let frameId = 0;
    let lastWidth = 0;

    const draw = async () => {
      const width = frame.clientWidth;
      if (width < 32) return;
      if (Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
      const pageObject = await doc.getPage(page);
      if (cancelled) return;
      const base = pageObject.getViewport({ scale: 1 });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
      const viewport = pageObject.getViewport({ scale: (width / base.width) * pixelRatio });
      const context = canvas.getContext('2d');
      if (!context) return;
      renderRef.current?.cancel();
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      const task = pageObject.render({ canvasContext: context, viewport });
      renderRef.current = task;
      try {
        await task.promise;
      } catch {
        // A newer page or size replaced this render.
      }
    };

    const schedule = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        void draw();
      });
    };

    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(frame);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      renderRef.current?.cancel();
    };
  }, [expanded, page, status]);

  const frameClass = expanded
    ? 'fixed inset-0 z-[80] flex flex-col overflow-auto bg-cream p-3 sm:p-6'
    : 'relative bg-cream';

  return (
    <div ref={frameRef} className={frameClass}>
      <div className={`${expanded ? 'sticky top-0 z-10 bg-cream/95 backdrop-blur-sm' : ''} flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between`}>
        <button type="button" className={goldButtonClass} onClick={() => setExpanded((value) => !value)}>
          {expanded ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
          {expanded ? 'Close' : 'Full screen'}
        </button>
        {pageCount > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
            <button
              type="button"
              className={outlineButtonClass}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Previous page
            </button>
            <p className="min-w-24 text-center text-sm text-ink-body">
              Page {page} of {pageCount}
            </p>
            <button
              type="button"
              className={outlineButtonClass}
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              disabled={page >= pageCount}
            >
              Next page
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      {status === 'loading' ? (
        <p className="py-16 text-center text-ink-body">Loading sheet music…</p>
      ) : null}
      {status === 'error' ? (
        <p className="py-16 text-center text-ink-body">
          The sheet music could not be shown here. Use Open PDF to view it in a new tab.
        </p>
      ) : null}
      <canvas
        ref={canvasRef}
        className={status === 'ready' ? 'mx-auto block h-auto w-full bg-white shadow-sm' : 'hidden'}
        role="img"
        aria-label={pageCount > 1 ? `${title} sheet music, page ${page} of ${pageCount}` : `${title} sheet music`}
      />
    </div>
  );
}
