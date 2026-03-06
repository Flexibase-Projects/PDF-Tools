import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { FiFile } from 'react-icons/fi';
import './PDFPreview.css';

// Worker do PDF.js a partir do pacote (Vite ?url) — evita falha do CDN e garante mesma versão
// @ts-expect-error - Vite resolve ?url para o asset em node_modules
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
if (typeof window !== 'undefined' && typeof pdfWorkerUrl === 'string') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
} else if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface PDFPreviewProps {
  file: File;
  pageNumber?: number;
  scale?: number;
  className?: string;
}

const PDFPreview = ({ 
  file, 
  pageNumber = 1, 
  scale = 1.5,
  className = '' 
}: PDFPreviewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);

  const runIdRef = useRef(0);

  useEffect(() => {
    const runId = ++runIdRef.current;
    let cancelled = false;

    const renderPDF = async () => {
      setLoading(true);
      setError(null);

      const canvas = canvasRef.current;
      if (!canvas) {
        if (runId === runIdRef.current) setLoading(false);
        return;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        if (cancelled || runId !== runIdRef.current) return;

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled || runId !== runIdRef.current) return;

        setTotalPages(pdf.numPages);

        const page = await pdf.getPage(Math.min(pageNumber, pdf.numPages));
        if (cancelled || runId !== runIdRef.current) return;

        const viewport = page.getViewport({ scale });

        const currentCanvas = canvasRef.current;
        if (!currentCanvas || cancelled || runId !== runIdRef.current) return;

        const context = currentCanvas.getContext('2d');
        if (!context) {
          throw new Error('Não foi possível obter contexto do canvas');
        }

        currentCanvas.height = viewport.height;
        currentCanvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await Promise.race([
          renderTask.promise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout ao renderizar PDF')), 15000)
          ),
        ]);

        if (cancelled || runId !== runIdRef.current) return;
        renderTaskRef.current = null;
        setLoading(false);
      } catch (err) {
        if (cancelled || runId !== runIdRef.current) return;
        console.error('Erro ao renderizar PDF:', err);
        setError('Erro ao carregar preview do PDF');
        setLoading(false);
      } finally {
        if (runId === runIdRef.current && cancelled) {
          renderTaskRef.current = null;
        }
      }
    };

    renderPDF();

    return () => {
      cancelled = true;
      const task = renderTaskRef.current;
      if (task && typeof (task as { cancel?: () => void }).cancel === 'function') {
        (task as { cancel: () => void }).cancel();
      }
      renderTaskRef.current = null;
    };
  }, [file, pageNumber, scale]);

  if (error) {
    return (
      <div className={`pdf-preview error ${className}`}>
        <FiFile />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className={`pdf-preview ${className}`}>
      {loading && (
        <div className="pdf-preview-loading">
          <div className="spinner" />
          <p>Carregando preview...</p>
        </div>
      )}
      <canvas ref={canvasRef} className="pdf-canvas" />
      {totalPages > 0 && (
        <div className="pdf-preview-info">
          Página {pageNumber} de {totalPages}
        </div>
      )}
    </div>
  );
};

export default PDFPreview;
