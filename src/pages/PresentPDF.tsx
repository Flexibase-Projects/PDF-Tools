import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as pdfjsLib from 'pdfjs-dist';
import { FiChevronLeft, FiChevronRight, FiEdit3, FiDroplet, FiX } from 'react-icons/fi';
import FileUpload from '../components/common/FileUpload';
import './PageStyles.css';
import './PresentPDF.css';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

type DrawTool = 'pen' | 'highlighter';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  tool: DrawTool;
  color: string;
  lineWidth: number;
  points: Point[];
}

const ANNOTATION_COLORS = [
  { name: 'Preto', value: '#1a1a1a' },
  { name: 'Vermelho', value: '#e53935' },
  { name: 'Azul', value: '#1e88e5' },
  { name: 'Verde', value: '#43a047' },
  { name: 'Amarelo', value: '#fdd835' },
];

const PEN_WIDTH = 2.5;
const HIGHLIGHTER_WIDTH = 18;
const HIGHLIGHTER_OPACITY = 0.35;

function PresentPDF() {
  const [file, setFile] = useState<File | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<DrawTool>('pen');
  const [color, setColor] = useState(ANNOTATION_COLORS[0].value);
  const [strokesByPage, setStrokesByPage] = useState<Record<number, Stroke[]>>({});
  const [isDrawing, setIsDrawing] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const currentStrokeRef = useRef<Point[]>([]);
  const strokesByPageRef = useRef<Record<number, Stroke[]>>({});
  strokesByPageRef.current = strokesByPage;

  const loadPdf = useCallback(async (pdfFile: File): Promise<void> => {
    setError(null);
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      pdfDocRef.current = pdf;
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar o PDF.');
      throw err;
    }
  }, []);

  const renderPdfPage = useCallback(
    async (pageNum: number) => {
      const pdf = pdfDocRef.current;
      const canvas = pdfCanvasRef.current;
      if (!pdf || !canvas || stageSize.width <= 0 || stageSize.height <= 0) return;

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min(
        stageSize.width / viewport.width,
        stageSize.height / viewport.height,
        2.5
      );
      const scaledViewport = page.getViewport({ scale });
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      await page.render({
        canvasContext: ctx,
        viewport: scaledViewport,
      }).promise;

      redrawOverlay(pageNum, scaledViewport.width, scaledViewport.height);
    },
    [stageSize]
  );

  const redrawOverlay = useCallback(
    (pageNum: number, width?: number, height?: number) => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const w = width ?? overlay.width;
      const h = height ?? overlay.height;
      overlay.width = w;
      overlay.height = h;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, w, h);
      const strokes = strokesByPageRef.current[pageNum] ?? [];
      strokes.forEach((stroke) => {
        if (stroke.points.length < 2) return;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (stroke.tool === 'highlighter') {
          ctx.globalAlpha = HIGHLIGHTER_OPACITY;
        }
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        stroke.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    },
    []
  );

  useEffect(() => {
    if (!isPresenting || !file || totalPages === 0) return;
    renderPdfPage(currentPage);
  }, [currentPage, isPresenting, totalPages, file, renderPdfPage]);

  useEffect(() => {
    if (!isPresenting || !stageRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      setStageSize({ width, height });
    });
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [isPresenting]);

  useEffect(() => {
    if (!isPresenting || stageSize.width === 0) return;
    renderPdfPage(currentPage);
  }, [stageSize, isPresenting, currentPage, renderPdfPage]);

  const getCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const overlay = overlayRef.current;
      if (!overlay) return null;
      const rect = overlay.getBoundingClientRect();
      const scaleX = overlay.width / rect.width;
      const scaleY = overlay.height / rect.height;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const pos = getCoords(e);
      if (!pos) return;
      e.preventDefault();
      currentStrokeRef.current = [pos];
      setIsDrawing(true);
    },
    [getCoords]
  );

  const handlePointerMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const pos = getCoords(e);
      if (!pos) return;
      e.preventDefault();
      const overlay = overlayRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;

      currentStrokeRef.current.push(pos);
      const lineWidth = tool === 'highlighter' ? HIGHLIGHTER_WIDTH : PEN_WIDTH;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (tool === 'highlighter') ctx.globalAlpha = HIGHLIGHTER_OPACITY;
      if (currentStrokeRef.current.length >= 2) {
        const prev = currentStrokeRef.current[currentStrokeRef.current.length - 2];
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    [isDrawing, getCoords, tool, color]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawing || currentStrokeRef.current.length === 0) {
      setIsDrawing(false);
      return;
    }
    const lineWidth = tool === 'highlighter' ? HIGHLIGHTER_WIDTH : PEN_WIDTH;
    const stroke: Stroke = {
      tool,
      color,
      lineWidth,
      points: [...currentStrokeRef.current],
    };
    setStrokesByPage((prev) => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] ?? []), stroke],
    }));
    currentStrokeRef.current = [];
    setIsDrawing(false);
  }, [isDrawing, tool, color, currentPage]);

  const clearPageAnnotations = useCallback(() => {
    setStrokesByPage((prev) => {
      const next = { ...prev };
      delete next[currentPage];
      return next;
    });
    const overlay = overlayRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
    }
  }, [currentPage]);

  const goPrev = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const goNext = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  }, []);

  const handleExitPresentation = useCallback(() => {
    setIsPresenting(false);
    setFile(null);
    pdfDocRef.current = null;
    setStrokesByPage({});
    setCurrentPage(1);
    setTotalPages(0);
  }, []);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setError(null);
    setIsLoadingPdf(true);
    loadPdf(file)
      .then(() => {
        if (!cancelled) {
          setIsPresenting(true);
          setIsLoadingPdf(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoadingPdf(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file, loadPdf]);

  useEffect(() => {
    if (!isPresenting) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleExitPresentation();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPresenting, handleExitPresentation, goPrev, goNext]);

  const presentationContent = (
    <div className="present-fullscreen" role="presentation">
        <div className="present-stage" ref={stageRef}>
          {totalPages === 0 && !error && (
            <div className="present-loading">
              <div className="present-loading-spinner" />
              <p>Carregando PDF...</p>
            </div>
          )}
          {totalPages > 0 && (
          <div className="present-canvas-wrap">
            <canvas ref={pdfCanvasRef} className="present-pdf-canvas" />
            <canvas
              ref={overlayRef}
              className="present-overlay-canvas"
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
              onTouchCancel={handlePointerUp}
              style={{ touchAction: 'none' }}
              aria-label="Área para anotações sobre o PDF"
            />
          </div>
          )}
        </div>
        <div className="present-toolbar">
          <div className="present-nav">
            <button
              type="button"
              className="present-toolbar-btn"
              onClick={goPrev}
              disabled={currentPage <= 1}
              title="Página anterior"
              aria-label="Página anterior"
            >
              <FiChevronLeft size={22} />
            </button>
            <span className="present-page-info">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="present-toolbar-btn"
              onClick={goNext}
              disabled={currentPage >= totalPages}
              title="Próxima página"
              aria-label="Próxima página"
            >
              <FiChevronRight size={22} />
            </button>
          </div>
          <div className="present-draw-tools">
            <button
              type="button"
              className={`present-toolbar-btn ${tool === 'pen' ? 'active' : ''}`}
              onClick={() => setTool('pen')}
              title="Caneta"
              aria-pressed={tool === 'pen'}
            >
              <FiEdit3 size={20} />
              <span>Caneta</span>
            </button>
            <button
              type="button"
              className={`present-toolbar-btn ${tool === 'highlighter' ? 'active' : ''}`}
              onClick={() => setTool('highlighter')}
              title="Marcador"
              aria-pressed={tool === 'highlighter'}
            >
              <FiDroplet size={20} />
              <span>Marcador</span>
            </button>
            <div className="present-colors">
              {ANNOTATION_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className="present-color-btn"
                  style={{ backgroundColor: c.value }}
                  onClick={() => setColor(c.value)}
                  title={c.name}
                  aria-label={`Cor ${c.name}`}
                  aria-pressed={color === c.value}
                />
              ))}
            </div>
            <button
              type="button"
              className="present-toolbar-btn"
              onClick={clearPageAnnotations}
              title="Limpar anotações da página"
            >
              Limpar
            </button>
          </div>
          <div className="present-actions">
            <button
              type="button"
              className="present-toolbar-btn present-exit"
              onClick={handleExitPresentation}
              title="Sair da apresentação"
              aria-label="Sair da apresentação"
            >
              <FiX size={22} />
              Sair
            </button>
          </div>
        </div>
      </div>
  );

  return (
    <>
      {isPresenting && createPortal(presentationContent, document.body)}
      <div className="page-container">
      <div className="page-header">
        <h1>Apresentar PDF</h1>
        <p>
          Visualize o PDF em tela cheia, passe as páginas e faça anotações em cima (caneta ou
          marcador) para apresentações e treinamentos.
        </p>
      </div>
      <div className="page-content">
        <FileUpload
          onFilesSelected={(files) => {
            setFile(files[0] ?? null);
            setError(null);
          }}
          multiple={false}
        />
        {isLoadingPdf && (
          <p className="present-preparing">Preparando apresentação...</p>
        )}
        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
    </>
  );
}

export default PresentPDF;
