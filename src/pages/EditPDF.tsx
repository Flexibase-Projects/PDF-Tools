import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import FileUpload from '../components/common/FileUpload';
import LoadingOverlay from '../components/common/LoadingOverlay';
import { loadPDFPages, generateThumbnail, type PDFPageData } from '../utils/pdfUtils';
import {
  applyPDFEdits,
  downloadEditedPDF,
  type EditPDFOptions,
  type PageRotations,
  type TextAddition,
  type TextAlign,
  type ImageAddition,
} from '../services/pdfEdit';
import { validateImageFile } from '../utils/fileUtils';
import { useCounter } from '../contexts/CounterContext';
import {
  FiTrash2,
  FiChevronUp,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiType,
  FiImage,
  FiEye,
  FiBold,
  FiInfo,
  FiPenTool,
} from 'react-icons/fi';
import './PageStyles.css';
import './EditPDF.css';

type DrawTool = 'pen' | 'highlighter';

interface DrawPoint {
  x: number;
  y: number;
}

interface DrawStroke {
  tool: DrawTool;
  color: string;
  lineWidth: number;
  points: DrawPoint[];
}

const DRAW_COLORS = [
  { name: 'Preto', value: '#1a1a1a' },
  { name: 'Vermelho', value: '#e53935' },
  { name: 'Azul', value: '#1e88e5' },
  { name: 'Verde', value: '#43a047' },
];

const PEN_WIDTH = 2.5;
const HIGHLIGHTER_WIDTH = 18;
const HIGHLIGHTER_OPACITY = 0.35;

/** Margem (px) nas bordas da imagem para ativar o cursor de redimensionar */
const RESIZE_EDGE_MARGIN = 10;
const MAX_UNDO = 50;

interface EditSnapshot {
  textAdditions: TextAddition[];
  imageAdditions: ImageAddition[];
  strokesByPage: Record<number, DrawStroke[]>;
}

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

function getResizeHandle(
  relX: number,
  relY: number,
  width: number,
  height: number,
  margin: number
): ResizeHandle | null {
  if (width <= 0 || height <= 0) return null;
  const left = relX < margin;
  const right = relX > width - margin;
  const top = relY < margin;
  const bottom = relY > height - margin;
  if (top && left) return 'nw';
  if (top && right) return 'ne';
  if (bottom && left) return 'sw';
  if (bottom && right) return 'se';
  if (top) return 'n';
  if (bottom) return 's';
  if (left) return 'w';
  if (right) return 'e';
  return null;
}

const RESIZE_CURSORS: Record<ResizeHandle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  sw: 'nesw-resize',
};

const THUMBNAIL_SCALE = 0.35;
/** Escala da preview central (alta qualidade). */
const PREVIEW_SCALE = 2;
const ZOOM_OPTIONS = [75, 93, 100, 125, 150];

const ROTATION_OPTIONS: { value: 0 | 90 | 180 | 270; label: string }[] = [
  { value: 0, label: '0°' },
  { value: 90, label: '90°' },
  { value: 180, label: '180°' },
  { value: 270, label: '270°' },
];

const ALIGN_OPTIONS: { value: TextAlign; label: string }[] = [
  { value: 'left', label: 'Esq' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Dir' },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const rr = Math.round(Math.max(0, Math.min(1, r)) * 255);
  const gg = Math.round(Math.max(0, Math.min(1, g)) * 255);
  const bb = Math.round(Math.max(0, Math.min(1, b)) * 255);
  return `#${(rr << 16 | gg << 8 | bb).toString(16).padStart(6, '0')}`;
}

const EditPDF = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [pageRotations, setPageRotations] = useState<PageRotations>({});
  const [pagesData, setPagesData] = useState<PDFPageData[]>([]);
  const [textAdditions, setTextAdditions] = useState<TextAddition[]>([]);
  const [imageAdditions, setImageAdditions] = useState<ImageAddition[]>([]);
  const [addTextPage, setAddTextPage] = useState(1);
  const [addTextValue, setAddTextValue] = useState('');
  const [addTextSize, setAddTextSize] = useState(12);
  const [addTextBold, setAddTextBold] = useState(false);
  const [addTextColor, setAddTextColor] = useState('#000000');
  const [addTextAlign, setAddTextAlign] = useState<TextAlign>('left');
  const [addImagePage, setAddImagePage] = useState(1);
  const [addImageFile, setAddImageFile] = useState<File | null>(null);
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [previewHighResImage, setPreviewHighResImage] = useState<string | null>(null);
  const [previewHighResLoading, setPreviewHighResLoading] = useState(false);
  const previewPageRef = useRef<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  /** Clique no preview para digitar texto no local: posição em PDF e em pixels para o input. */
  const [inlineTextPlacement, setInlineTextPlacement] = useState<{
    pageNumber: number;
    xPdf: number;
    yPdf: number;
    leftPx: number;
    topPx: number;
  } | null>(null);
  const [inlineTextValue, setInlineTextValue] = useState('');
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef<{ scrollLeft: number; scrollTop: number } | null>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const [draggingTextIndex, setDraggingTextIndex] = useState<number | null>(null);
  const [draggingImageIndex, setDraggingImageIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewMode, setPreviewMode] = useState<'text' | 'draw'>('text');
  const [strokesByPage, setStrokesByPage] = useState<Record<number, DrawStroke[]>>({});
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0].value);
  const [isDrawing, setIsDrawing] = useState(false);

  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const currentStrokeRef = useRef<DrawPoint[]>([]);
  const strokesByPageRef = useRef<Record<number, DrawStroke[]>>({});
  strokesByPageRef.current = strokesByPage;
  const dragImageOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragImageStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const imageAdditionsRef = useRef<typeof imageAdditions>([]);
  imageAdditionsRef.current = imageAdditions;
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [resizingState, setResizingState] = useState<{ index: number; handle: ResizeHandle } | null>(
    null
  );
  const [hoverResizeHandle, setHoverResizeHandle] = useState<{
    imageIdx: number;
    handle: ResizeHandle;
  } | null>(null);
  const [editingTextIndex, setEditingTextIndex] = useState<number | null>(null);
  const [showRemoveAllConfirm, setShowRemoveAllConfirm] = useState(false);
  const dragTextStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const textAdditionsRef = useRef<typeof textAdditions>([]);
  textAdditionsRef.current = textAdditions;
  const pastStatesRef = useRef<EditSnapshot[]>([]);
  const isRestoringRef = useRef(false);
  const hasPushedForTextDragRef = useRef(false);
  const hasPushedForImageDragRef = useRef(false);
  const hasPushedForResizeRef = useRef(false);

  const pushToHistory = useCallback(() => {
    if (isRestoringRef.current) return;
    const snap: EditSnapshot = {
      textAdditions: textAdditionsRef.current.map((t) => ({
        ...t,
        color: t.color ? { ...t.color } : undefined,
      })),
      imageAdditions: imageAdditionsRef.current.map((i) => ({ ...i })),
      strokesByPage: JSON.parse(JSON.stringify(strokesByPageRef.current)),
    };
    pastStatesRef.current.push(snap);
    if (pastStatesRef.current.length > MAX_UNDO) pastStatesRef.current.shift();
  }, []);

  const restoreFromHistory = useCallback(() => {
    if (pastStatesRef.current.length === 0) return;
    isRestoringRef.current = true;
    const snap = pastStatesRef.current.pop()!;
    setTextAdditions(snap.textAdditions);
    setImageAdditions(snap.imageAdditions);
    setStrokesByPage(snap.strokesByPage);
    setTimeout(() => {
      isRestoringRef.current = false;
    }, 0);
  }, []);

  const { increment } = useCounter();

  const removeAllEdits = () => {
    setTextAdditions([]);
    setImageAdditions([]);
    setStrokesByPage({});
    setError(null);
  };

  const pageMap = Object.fromEntries(pagesData.map((p) => [p.pageNumber, p]));
  const previewPageData = previewPage ? pageMap[previewPage] ?? null : null;
  const previewRotation = previewPage ? (pageRotations[previewPage] ?? 0) : 0;

  previewPageRef.current = previewPage;

  useEffect(() => {
    if (pageOrder.length > 0 && (previewPage === null || !pageOrder.includes(previewPage))) {
      setPreviewPage(pageOrder[0]);
    }
  }, [pageOrder, previewPage]);

  useEffect(() => {
    if (!pdfFile || !previewPage) {
      setPreviewHighResImage(null);
      setPreviewHighResLoading(false);
      return;
    }
    const requestedPage = previewPage;
    setPreviewHighResImage(null);
    setPreviewHighResLoading(true);
    generateThumbnail(pdfFile, requestedPage, PREVIEW_SCALE)
      .then((dataUrl) => {
        if (previewPageRef.current === requestedPage) {
          setPreviewHighResImage(dataUrl);
        }
      })
      .catch(() => {
        if (previewPageRef.current === requestedPage) {
          setPreviewHighResImage(null);
        }
      })
      .finally(() => {
        if (previewPageRef.current === requestedPage) {
          setPreviewHighResLoading(false);
        }
      });
  }, [pdfFile, previewPage]);

  const loadPages = useCallback(async (file: File) => {
    const pages = await loadPDFPages(file, THUMBNAIL_SCALE);
    setPagesData(pages);
    const order = pages.map((p) => p.pageNumber);
    setPageOrder(order);
    setPageRotations({});
    setPreviewPage(order[0] ?? null);
  }, []);

  const handlePdfSelected = useCallback(
    async (files: File[]) => {
      if (files.length > 0) {
        setPdfFile(files[0]);
        setTextAdditions([]);
        setImageAdditions([]);
        setError(null);
        await loadPages(files[0]);
        await increment();
      }
    },
    [loadPages, increment]
  );

  const removePage = (originalPageNum: number) => {
    setPageOrder((prev) => prev.filter((n) => n !== originalPageNum));
  };

  const movePage = (index: number, direction: 'up' | 'down') => {
    setPageOrder((prev) => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const setRotation = (pageNum: number, rotation: 0 | 90 | 180 | 270) => {
    setPageRotations((prev) => ({ ...prev, [pageNum]: rotation }));
  };

  const addText = () => {
    if (!addTextValue.trim() || !pdfFile) return;
    pushToHistory();
    const maxPage = pagesData.length;
    if (addTextPage < 1 || addTextPage > maxPage) return;
    const pageData = pageMap[addTextPage];
    const pageWidthPt = pageData ? pageData.width / THUMBNAIL_SCALE : 400;
    const pageHeightPt = pageData ? pageData.height / THUMBNAIL_SCALE : 600;
    setTextAdditions((prev) => [
      ...prev,
      {
        pageNumber: addTextPage,
        text: addTextValue.trim(),
        fontSize: addTextSize,
        bold: addTextBold,
        color: hexToRgb(addTextColor),
        align: addTextAlign,
        x: pageWidthPt / 2,
        y: pageHeightPt / 2,
      },
    ]);
    setAddTextValue('');
  };

  /** Converte coordenadas de clique (tela) para pontos PDF. Y do PDF é de baixo para cima. */
  const getPdfCoordsFromClick = useCallback(
    (clientX: number, clientY: number): { xPdf: number; yPdf: number; leftPx: number; topPx: number } | null => {
      if (!previewPageData || !previewWrapRef.current) return null;
      const img = previewWrapRef.current.querySelector('.edit-pdf-preview-thumb') as HTMLImageElement | null;
      if (!img) return null;
      const imgRect = img.getBoundingClientRect();
      const wrapRect = previewWrapRef.current.getBoundingClientRect();
      if (
        clientX < imgRect.left ||
        clientX > imgRect.right ||
        clientY < imgRect.top ||
        clientY > imgRect.bottom
      ) {
        return null;
      }
      const xRatio = (clientX - imgRect.left) / imgRect.width;
      const yRatio = (imgRect.bottom - clientY) / imgRect.height;
      const pageWidthPt = previewPageData.width / THUMBNAIL_SCALE;
      const pageHeightPt = previewPageData.height / THUMBNAIL_SCALE;
      const xPdf = xRatio * pageWidthPt;
      const yPdf = yRatio * pageHeightPt;
      const leftPx = clientX - wrapRect.left;
      const topPx = clientY - wrapRect.top;
      return { xPdf, yPdf, leftPx, topPx };
    },
    [previewPageData]
  );

  const handlePreviewClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (previewMode !== 'text') return;
      if (inlineTextPlacement || !previewPage) return;
      if (previewRotation !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('.edit-pdf-inline-text-input-wrap')) return;
      if (target.closest('.edit-pdf-preview-text-overlay')) return;
      if (target.closest('.edit-pdf-preview-image-overlay')) return;
      const coords = getPdfCoordsFromClick(e.clientX, e.clientY);
      if (!coords) return;
      const area = previewAreaRef.current;
      if (area) savedScrollRef.current = { scrollLeft: area.scrollLeft, scrollTop: area.scrollTop };
      setInlineTextPlacement({
        pageNumber: previewPage,
        xPdf: coords.xPdf,
        yPdf: coords.yPdf,
        leftPx: coords.leftPx,
        topPx: coords.topPx,
      });
      setInlineTextValue('');
      setTimeout(() => inlineInputRef.current?.focus(), 0);
    },
    [previewMode, inlineTextPlacement, previewPage, previewRotation, getPdfCoordsFromClick]
  );

  const redrawOverlay = useCallback(
    (pageNum: number, width: number, height: number) => {
      const overlay = overlayCanvasRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      const strokes = strokesByPageRef.current[pageNum] ?? [];
      strokes.forEach((stroke) => {
        if (stroke.points.length < 2) return;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (stroke.tool === 'highlighter') ctx.globalAlpha = HIGHLIGHTER_OPACITY;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
        stroke.points.slice(1).forEach((p) => ctx.lineTo(p.x * width, p.y * height));
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    },
    []
  );

  const getDrawCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const overlay = overlayCanvasRef.current;
      if (!overlay) return null;
      const rect = overlay.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height,
      };
    },
    []
  );

  const handleDrawPointerDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const pos = getDrawCoords(e);
      if (!pos || !previewPage) return;
      e.preventDefault();
      currentStrokeRef.current = [pos];
      setIsDrawing(true);
    },
    [getDrawCoords, previewPage]
  );

  const handleDrawPointerMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const pos = getDrawCoords(e);
      if (!pos) return;
      e.preventDefault();
      const overlay = overlayCanvasRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      const lineWidth = drawTool === 'highlighter' ? HIGHLIGHTER_WIDTH : PEN_WIDTH;
      currentStrokeRef.current.push(pos);
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (drawTool === 'highlighter') ctx.globalAlpha = HIGHLIGHTER_OPACITY;
      if (currentStrokeRef.current.length >= 2) {
        const prev = currentStrokeRef.current[currentStrokeRef.current.length - 2];
        ctx.beginPath();
        ctx.moveTo(prev.x * overlay.width, prev.y * overlay.height);
        ctx.lineTo(pos.x * overlay.width, pos.y * overlay.height);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    [isDrawing, getDrawCoords, drawTool, drawColor]
  );

  const handleDrawPointerUp = useCallback(() => {
    if (!isDrawing || currentStrokeRef.current.length === 0 || !previewPage) {
      setIsDrawing(false);
      return;
    }
    pushToHistory();
    const lineWidth = drawTool === 'highlighter' ? HIGHLIGHTER_WIDTH : PEN_WIDTH;
    const stroke: DrawStroke = {
      tool: drawTool,
      color: drawColor,
      lineWidth,
      points: [...currentStrokeRef.current],
    };
    setStrokesByPage((prev) => ({
      ...prev,
      [previewPage]: [...(prev[previewPage] ?? []), stroke],
    }));
    currentStrokeRef.current = [];
    setIsDrawing(false);
  }, [isDrawing, drawTool, drawColor, previewPage, pushToHistory]);

  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    const img = previewWrapRef.current?.querySelector('.edit-pdf-preview-thumb') as HTMLImageElement | null;
    if (!overlay || !img || !previewPage) return;
    const w = img.offsetWidth;
    const h = img.offsetHeight;
    if (w <= 0 || h <= 0) return;
    if (overlay.width !== w || overlay.height !== h) {
      overlay.width = w;
      overlay.height = h;
    }
    redrawOverlay(previewPage, w, h);
  }, [previewPage, previewHighResImage, strokesByPage, redrawOverlay]);

  const submitInlineText = useCallback(() => {
    if (!inlineTextPlacement || !pdfFile) return;
    const text = inlineTextValue.trim();
    if (text || editingTextIndex !== null) pushToHistory();
    if (editingTextIndex !== null) {
      if (text) {
        setTextAdditions((prev) =>
          prev.map((item, i) =>
            i === editingTextIndex
              ? {
                  ...item,
                  text,
                  fontSize: addTextSize,
                  bold: addTextBold,
                  color: hexToRgb(addTextColor),
                  align: addTextAlign,
                }
              : item
          )
        );
      }
      setEditingTextIndex(null);
    } else if (text) {
      setTextAdditions((prev) => [
        ...prev,
        {
          pageNumber: inlineTextPlacement.pageNumber,
          text,
          fontSize: addTextSize,
          x: inlineTextPlacement.xPdf,
          y: inlineTextPlacement.yPdf,
          bold: addTextBold,
          color: hexToRgb(addTextColor),
          align: addTextAlign,
        },
      ]);
    }
    setInlineTextPlacement(null);
    setInlineTextValue('');
  }, [inlineTextPlacement, inlineTextValue, pdfFile, addTextSize, addTextBold, addTextColor, addTextAlign, editingTextIndex, pushToHistory]);

  const cancelInlineText = useCallback(() => {
    setEditingTextIndex(null);
    setInlineTextPlacement(null);
    setInlineTextValue('');
  }, []);

  const openEditTextByIndex = useCallback(
    (index: number) => {
      const item = textAdditions[index];
      if (!item) return;
      const area = previewAreaRef.current;
      if (area) savedScrollRef.current = { scrollLeft: area.scrollLeft, scrollTop: area.scrollTop };
      setPreviewPage(item.pageNumber);
      setEditingTextIndex(index);
      const x = item.x ?? 0;
      const y = item.y ?? 0;
      setInlineTextPlacement({
        pageNumber: item.pageNumber,
        xPdf: x,
        yPdf: y,
        leftPx: 0,
        topPx: 0,
      });
      setInlineTextValue(item.text);
      setAddTextSize(item.fontSize ?? 12);
      setAddTextBold(item.bold ?? false);
      setAddTextColor(
        item.color ? rgbToHex(item.color.r, item.color.g, item.color.b) : '#000000'
      );
      setAddTextAlign(item.align ?? 'left');
      setTimeout(() => inlineInputRef.current?.focus(), 100);
    },
    [textAdditions]
  );

  const moveTextAddition = useCallback((index: number, xPdf: number, yPdf: number) => {
    setTextAdditions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, x: xPdf, y: yPdf } : item))
    );
  }, []);

  useEffect(() => {
    if (draggingTextIndex === null || !previewPageData) return;
    hasPushedForTextDragRef.current = false;
    const onMove = (e: MouseEvent) => {
      if (!hasPushedForTextDragRef.current) {
        pushToHistory();
        hasPushedForTextDragRef.current = true;
      }
      const coords = getPdfCoordsFromClick(e.clientX, e.clientY);
      if (coords) moveTextAddition(draggingTextIndex, coords.xPdf, coords.yPdf);
    };
    const onUp = (e: MouseEvent) => {
      const dist = Math.hypot(
        e.clientX - dragTextStartRef.current.x,
        e.clientY - dragTextStartRef.current.y
      );
      if (dist < 8) {
        const item = textAdditionsRef.current[draggingTextIndex];
        if (item && item.x != null && item.y != null) {
          const area = previewAreaRef.current;
          if (area) savedScrollRef.current = { scrollLeft: area.scrollLeft, scrollTop: area.scrollTop };
          const pageWidthPt = previewPageData.width / THUMBNAIL_SCALE;
          const pageHeightPt = previewPageData.height / THUMBNAIL_SCALE;
          setInlineTextPlacement({
            pageNumber: item.pageNumber,
            xPdf: item.x,
            yPdf: item.y,
            leftPx: 0,
            topPx: 0,
          });
          setInlineTextValue(item.text);
          setAddTextSize(item.fontSize ?? 12);
          setAddTextBold(item.bold ?? false);
          setAddTextColor(
            item.color ? rgbToHex(item.color.r, item.color.g, item.color.b) : '#000000'
          );
          setAddTextAlign(item.align ?? 'left');
          setEditingTextIndex(draggingTextIndex);
          setTimeout(() => inlineInputRef.current?.focus(), 0);
        }
      }
      setDraggingTextIndex(null);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [draggingTextIndex, previewPageData, getPdfCoordsFromClick, moveTextAddition, pushToHistory]);

  const moveImageAddition = useCallback((index: number, xPdf: number, yPdf: number) => {
    setImageAdditions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, x: xPdf, y: yPdf } : item))
    );
  }, []);

  const updateImageSize = useCallback((index: number, width?: number, height?: number) => {
    setImageAdditions((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              ...(width != null && { width }),
              ...(height != null && { height }),
            }
          : item
      )
    );
  }, []);

  const updateImageBox = useCallback(
    (index: number, box: { x?: number; y?: number; width?: number; height?: number }) => {
      setImageAdditions((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, ...box } : item
        )
      );
    },
    []
  );

  useEffect(() => {
    if (draggingImageIndex === null || !previewPageData) return;
    hasPushedForImageDragRef.current = false;
    const onMove = (e: MouseEvent) => {
      if (!hasPushedForImageDragRef.current) {
        pushToHistory();
        hasPushedForImageDragRef.current = true;
      }
      const coords = getPdfCoordsFromClick(e.clientX, e.clientY);
      if (coords) {
        const { x: ox, y: oy } = dragImageOffsetRef.current;
        moveImageAddition(draggingImageIndex, coords.xPdf - ox, coords.yPdf - oy);
      }
    };
    const onUp = (e: MouseEvent) => {
      const dist = Math.hypot(
        e.clientX - dragImageStartRef.current.x,
        e.clientY - dragImageStartRef.current.y
      );
      if (dist < 8) setSelectedImageIndex(draggingImageIndex);
      setDraggingImageIndex(null);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [draggingImageIndex, previewPageData, getPdfCoordsFromClick, moveImageAddition, pushToHistory]);

  useEffect(() => {
    if (resizingState === null || !previewPageData) return;
    const { index: idx, handle } = resizingState;
    const pageWidthPt = previewPageData.width / THUMBNAIL_SCALE;
    const MARGIN = 10;
    const MAX_W = Math.max(100, pageWidthPt - MARGIN);
    const MAX_H = 800;
    const MIN = 20;

    const onMove = (e: MouseEvent) => {
      const coords = getPdfCoordsFromClick(e.clientX, e.clientY);
      if (!coords) return;
      const img = imageAdditionsRef.current[idx];
      if (!img || img.x == null || img.y == null) return;
      const x0 = img.x;
      const y0 = img.y;
      const w0 = img.width ?? 100;
      const h0 = img.height ?? 100;
      let x = x0;
      let y = y0;
      let w = w0;
      let h = h0;
      switch (handle) {
        case 'se':
          w = Math.min(MAX_W, Math.max(MIN, coords.xPdf - x0));
          h = Math.min(MAX_H, Math.max(MIN, coords.yPdf - y0));
          break;
        case 'sw':
          x = coords.xPdf;
          w = Math.min(MAX_W, Math.max(MIN, x0 + w0 - coords.xPdf));
          h = Math.min(MAX_H, Math.max(MIN, coords.yPdf - y0));
          break;
        case 'ne':
          y = coords.yPdf;
          w = Math.min(MAX_W, Math.max(MIN, coords.xPdf - x0));
          h = Math.min(MAX_H, Math.max(MIN, y0 + h0 - coords.yPdf));
          break;
        case 'nw':
          x = coords.xPdf;
          y = coords.yPdf;
          w = Math.min(MAX_W, Math.max(MIN, x0 + w0 - coords.xPdf));
          h = Math.min(MAX_H, Math.max(MIN, y0 + h0 - coords.yPdf));
          break;
        case 'e':
          w = Math.min(MAX_W, Math.max(MIN, coords.xPdf - x0));
          break;
        case 'w':
          x = coords.xPdf;
          w = Math.min(MAX_W, Math.max(MIN, x0 + w0 - coords.xPdf));
          break;
        case 'n':
          y = coords.yPdf;
          h = Math.min(MAX_H, Math.max(MIN, y0 + h0 - coords.yPdf));
          break;
        case 's':
          h = Math.min(MAX_H, Math.max(MIN, coords.yPdf - y0));
          break;
      }
      updateImageBox(idx, { x, y, width: w, height: h });
    };
    const onUp = () => {
      hasPushedForResizeRef.current = false;
      setResizingState(null);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [resizingState, previewPageData, getPdfCoordsFromClick, updateImageBox]);

  const removeTextAddition = (index: number) => {
    pushToHistory();
    setTextAdditions((prev) => prev.filter((_, i) => i !== index));
  };

  const removeImageAddition = (index: number) => {
    pushToHistory();
    setImageAdditions((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        restoreFromHistory();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [restoreFromHistory]);

  /* Mantém o PDF estático ao abrir o editor de texto: restaura scroll após foco no input */
  useEffect(() => {
    if (inlineTextPlacement == null && editingTextIndex == null) return;
    const saved = savedScrollRef.current;
    if (!saved) return;
    const restore = () => {
      const area = previewAreaRef.current;
      if (area) {
        area.scrollLeft = saved.scrollLeft;
        area.scrollTop = saved.scrollTop;
      }
      savedScrollRef.current = null;
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(restore);
    });
  }, [inlineTextPlacement, editingTextIndex]);

  const handleDownload = async () => {
    if (!pdfFile || pageOrder.length === 0) {
      setError('Adicione um PDF e mantenha ao menos uma página.');
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const hasDrawings = Object.keys(strokesByPage).some(
        (k) => (strokesByPage[Number(k)]?.length ?? 0) > 0
      );
      const options: EditPDFOptions = {
        pageOrder,
        pageRotations,
        textAdditions: textAdditions.length ? textAdditions : undefined,
        imageAdditions: imageAdditions.length ? imageAdditions : undefined,
        drawAdditions: hasDrawings ? strokesByPage : undefined,
      };
      const blob = await applyPDFEdits(pdfFile, options);
      const baseName = pdfFile.name.replace(/\.pdf$/i, '') || 'documento';
      await downloadEditedPDF(blob, `${baseName}-editado.pdf`);
      await increment();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao editar PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const canDownload = pdfFile && pageOrder.length > 0;
  const previewTexts = useMemo(
    () => (previewPage ? textAdditions.filter((t) => t.pageNumber === previewPage) : []),
    [previewPage, textAdditions]
  );
  const previewImages = useMemo(
    () => (previewPage ? imageAdditions.filter((i) => i.pageNumber === previewPage) : []),
    [previewPage, imageAdditions]
  );
  const previewImageUrls = useMemo(
    () => previewImages.map((a) => URL.createObjectURL(a.imageFile)),
    [previewImages]
  );
  useEffect(() => () => previewImageUrls.forEach((u) => URL.revokeObjectURL(u)), [previewImageUrls]);

  useEffect(() => {
    if (pdfFile && pagesData.length > 0) {
      const max = Math.max(...pagesData.map((p) => p.pageNumber));
      if (addTextPage > max) setAddTextPage(max);
      if (addImagePage > max) setAddImagePage(max);
    }
  }, [pdfFile, pagesData, addTextPage, addImagePage]);

  return (
    <div className="page-container edit-pdf-page">
      <div className="page-header">
        <h1>Editar PDF</h1>
        <p>Remova, reordene e rotacione páginas. Adicione texto ou imagens.</p>
      </div>
      <div className="page-content">
        {!pdfFile ? (
          <>
            <div className="page-upload">
              <FileUpload
                onFilesSelected={handlePdfSelected}
                accept=".pdf,application/pdf"
                multiple={false}
              />
            </div>
            <p className="edit-pdf-empty-hint">Envie um PDF para começar a editar.</p>
          </>
        ) : (
          <div className="edit-pdf-layout">
            {/* ESQUERDA: páginas em ordem (scroll ou setas) */}
            <aside className="edit-pdf-sidebar-left" aria-label="Páginas do documento">
              <h2 className="edit-pdf-sidebar-left-title">Páginas</h2>
              <div className="edit-pdf-sidebar-left-arrows">
                <button
                  type="button"
                  className="edit-pdf-sidebar-arrow-btn"
                  onClick={() => {
                    const idx = pageOrder.indexOf(previewPage ?? 0);
                    if (idx > 0) setPreviewPage(pageOrder[idx - 1] ?? null);
                  }}
                  disabled={!previewPage || pageOrder.indexOf(previewPage) <= 0}
                  aria-label="Página anterior"
                >
                  <FiChevronUp size={18} />
                </button>
                <button
                  type="button"
                  className="edit-pdf-sidebar-arrow-btn"
                  onClick={() => {
                    const idx = pageOrder.indexOf(previewPage ?? 0);
                    if (idx >= 0 && idx < pageOrder.length - 1)
                      setPreviewPage(pageOrder[idx + 1] ?? null);
                  }}
                  disabled={
                    !previewPage || pageOrder.indexOf(previewPage) >= pageOrder.length - 1
                  }
                  aria-label="Próxima página"
                >
                  <FiChevronDown size={18} />
                </button>
              </div>
              <div className="edit-pdf-thumb-list">
                {pageOrder.map((originalNum, index) => {
                  const data = pageMap[originalNum];
                  const isPreview = previewPage === originalNum;
                  return (
                    <div
                      key={`${originalNum}-${index}`}
                      className={`edit-pdf-thumb-item ${isPreview ? 'edit-pdf-thumb-item-active' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setPreviewPage(originalNum)}
                      onKeyDown={(e) => e.key === 'Enter' && setPreviewPage(originalNum)}
                      aria-label={`Página ${originalNum}${isPreview ? ', selecionada' : ''}`}
                    >
                      <div className="edit-pdf-thumb-img-wrap">
                        {data?.thumbnail ? (
                          <img src={data.thumbnail} alt="" />
                        ) : (
                          <span>Pág. {originalNum}</span>
                        )}
                        <span className="edit-pdf-thumb-num">{index + 1}</span>
                      </div>
                      <div className="edit-pdf-thumb-actions" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={pageRotations[originalNum] ?? 0}
                          onChange={(e) =>
                            setRotation(originalNum, Number(e.target.value) as 0 | 90 | 180 | 270)
                          }
                          aria-label={`Rotação pág. ${originalNum}`}
                        >
                          {ROTATION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="edit-pdf-thumb-remove"
                          onClick={() => removePage(originalNum)}
                          aria-label={`Remover página ${originalNum}`}
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* CENTRO: preview em alta qualidade */}
            <main ref={previewAreaRef} className="edit-pdf-preview-area" aria-label="Visualização do PDF">
              {error && <div className="error-message edit-pdf-error-inline">{error}</div>}
              {previewPageData && (
                <>
                  <h2 className="edit-pdf-preview-area-label">Visualização</h2>
                  <div className="edit-pdf-preview-mode-toolbar">
                    <span className="edit-pdf-preview-mode-label">Modo:</span>
                    <button
                      type="button"
                      className={`edit-pdf-mode-btn ${previewMode === 'text' ? 'active' : ''}`}
                      onClick={() => setPreviewMode('text')}
                      aria-pressed={previewMode === 'text'}
                      title="Clique na página para adicionar texto"
                    >
                      <FiType size={16} aria-hidden />
                      Digitar
                    </button>
                    <button
                      type="button"
                      className={`edit-pdf-mode-btn ${previewMode === 'draw' ? 'active' : ''}`}
                      onClick={() => setPreviewMode('draw')}
                      aria-pressed={previewMode === 'draw'}
                      title="Desenhar ou destacar na página"
                    >
                      <FiPenTool size={16} aria-hidden />
                      Desenhar
                    </button>
                    {previewMode === 'text' && (
                      <>
                        <p className="edit-pdf-text-mode-hint" role="status">
                          Clique em um texto na página ou na lista à direita para editar. Clique em área vazia para adicionar novo texto.
                        </p>
                        <div className="edit-pdf-text-tools">
                        <label className="edit-pdf-text-tool-item">
                          <span className="edit-pdf-text-tool-label">Tamanho</span>
                          <input
                            type="number"
                            min={8}
                            max={72}
                            value={addTextSize}
                            onChange={(e) => setAddTextSize(Number(e.target.value) || 12)}
                            aria-label="Tamanho da fonte"
                          />
                        </label>
                        <button
                          type="button"
                          className={`edit-pdf-text-tool-btn ${addTextBold ? 'active' : ''}`}
                          onClick={() => setAddTextBold((b) => !b)}
                          title="Negrito"
                          aria-pressed={addTextBold}
                          aria-label="Negrito"
                        >
                          <FiBold size={18} />
                        </button>
                        <label className="edit-pdf-text-tool-item edit-pdf-text-tool-color">
                          <span className="edit-pdf-text-tool-label">Cor</span>
                          <input
                            type="color"
                            value={addTextColor}
                            onChange={(e) => setAddTextColor(e.target.value)}
                            aria-label="Cor do texto"
                          />
                        </label>
                      </div>
                      </>
                    )}
                    {previewMode === 'draw' && (
                      <div className="edit-pdf-draw-tools">
                        <div className="edit-pdf-draw-tool-btns">
                          <button
                            type="button"
                            className={drawTool === 'pen' ? 'active' : ''}
                            onClick={() => setDrawTool('pen')}
                            title="Caneta"
                          >
                            Caneta
                          </button>
                          <button
                            type="button"
                            className={drawTool === 'highlighter' ? 'active' : ''}
                            onClick={() => setDrawTool('highlighter')}
                            title="Marca-texto"
                          >
                            Marca-texto
                          </button>
                        </div>
                        <div className="edit-pdf-draw-colors">
                          {DRAW_COLORS.map((c) => (
                            <button
                              key={c.value}
                              type="button"
                              className="edit-pdf-draw-color-btn"
                              style={{ backgroundColor: c.value }}
                              onClick={() => setDrawColor(c.value)}
                              title={c.name}
                              aria-label={c.name}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div
                  className="edit-pdf-preview-center"
                  style={{
                    transform: `rotate(${previewRotation}deg) scale(${previewZoom / 100})`,
                    transformOrigin: 'top center',
                  }}
                >
                  <div
                    ref={previewWrapRef}
                    className={`edit-pdf-preview-page-wrap ${previewMode === 'text' ? 'edit-pdf-preview-page-wrap-clickable' : ''}`}
                    onClick={previewMode === 'text' ? handlePreviewClick : undefined}
                    aria-label={previewMode === 'text' ? 'Clique no PDF para adicionar texto no local desejado' : 'Área de visualização e desenho'}
                  >
                    {previewHighResLoading && (
                      <div className="edit-pdf-preview-loading" aria-hidden>
                        <span>Carregando...</span>
                      </div>
                    )}
                    <img
                      src={previewHighResImage ?? previewPageData.thumbnail ?? undefined}
                      alt={`Preview página ${previewPage}`}
                      className="edit-pdf-preview-thumb"
                    />
                    <canvas
                      ref={overlayCanvasRef}
                      className="edit-pdf-preview-overlay-canvas"
                      style={{
                        pointerEvents: previewMode === 'draw' ? 'auto' : 'none',
                        touchAction: previewMode === 'draw' ? 'none' : undefined,
                      }}
                      onMouseDown={previewMode === 'draw' ? handleDrawPointerDown : undefined}
                      onMouseMove={previewMode === 'draw' ? handleDrawPointerMove : undefined}
                      onMouseUp={previewMode === 'draw' ? handleDrawPointerUp : undefined}
                      onMouseLeave={previewMode === 'draw' ? handleDrawPointerUp : undefined}
                      onTouchStart={previewMode === 'draw' ? handleDrawPointerDown : undefined}
                      onTouchMove={previewMode === 'draw' ? handleDrawPointerMove : undefined}
                      onTouchEnd={previewMode === 'draw' ? handleDrawPointerUp : undefined}
                      onTouchCancel={previewMode === 'draw' ? handleDrawPointerUp : undefined}
                      aria-label="Área para desenhar sobre o PDF"
                    />
                    <div className="edit-pdf-preview-overlays">
                      {textAdditions.map((t, idx) => {
                        if (t.pageNumber !== previewPage) return null;
                        const pageWidthPt = previewPageData.width / THUMBNAIL_SCALE;
                        const pageHeightPt = previewPageData.height / THUMBNAIL_SCALE;
                        const hasPos = t.x != null && t.y != null;
                        const colorCss = t.color
                          ? `rgb(${Math.round(t.color.r * 255)}, ${Math.round(t.color.g * 255)}, ${Math.round(t.color.b * 255)})`
                          : undefined;
                        const align = t.align ?? 'left';
                        const translateX = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0';
                        const stackedIndex = textAdditions
                          .slice(0, idx)
                          .filter((x) => x.pageNumber === previewPage).length;
                        return (
                          <div
                            key={idx}
                            className={`edit-pdf-preview-text-overlay ${editingTextIndex === idx ? 'editing' : ''}`}
                            style={{
                              fontSize: Math.max(10, (t.fontSize ?? 12) * 0.8),
                              fontWeight: t.bold ? 'bold' : undefined,
                              color: colorCss,
                              pointerEvents: hasPos ? 'auto' : undefined,
                              cursor: hasPos ? (draggingTextIndex === idx ? 'grabbing' : 'grab') : undefined,
                              userSelect: hasPos && draggingTextIndex === idx ? 'none' : undefined,
                              ...(hasPos
                                ? {
                                    position: 'absolute',
                                    left: `${((t.x ?? 0) / pageWidthPt) * 100}%`,
                                    top: `${(1 - (t.y ?? 0) / pageHeightPt) * 100}%`,
                                    marginTop: 0,
                                    transform: `translate(${translateX}, -50%)`,
                                  }
                                : { marginTop: `${stackedIndex * 24}px` }),
                            }}
                            onMouseDown={
                              hasPos
                                ? (e) => {
                                    e.stopPropagation();
                                    dragTextStartRef.current = {
                                      x: e.clientX,
                                      y: e.clientY,
                                    };
                                    setDraggingTextIndex(idx);
                                  }
                                : undefined
                            }
                            title={hasPos ? 'Arraste para mover; clique para editar' : undefined}
                            role={hasPos ? 'button' : undefined}
                            aria-label={hasPos ? 'Mover texto' : undefined}
                          >
                            {t.text}
                          </div>
                        );
                      })}
                      {imageAdditions.map((img, idx) => {
                        if (img.pageNumber !== previewPage) return null;
                        const pageWidthPt = previewPageData.width / THUMBNAIL_SCALE;
                        const pageHeightPt = previewPageData.height / THUMBNAIL_SCALE;
                        const hasPos = img.x != null && img.y != null;
                        const imageUrlIndex = imageAdditions
                          .slice(0, idx)
                          .filter((i) => i.pageNumber === previewPage).length;
                        const stackedIndex = imageAdditions
                          .slice(0, idx)
                          .filter((i) => i.pageNumber === previewPage).length;
                        const imgW = img.width ?? 100;
                        const imgH = img.height ?? 100;
                        const isSelected = selectedImageIndex === idx;
                        const isResizing = resizingState?.index === idx;
                        const hoverHandle =
                          isSelected && hoverResizeHandle?.imageIdx === idx
                            ? hoverResizeHandle.handle
                            : null;
                        const cursor = hasPos
                          ? isResizing
                            ? RESIZE_CURSORS[resizingState!.handle]
                            : hoverHandle
                              ? RESIZE_CURSORS[hoverHandle]
                              : draggingImageIndex === idx
                                ? 'grabbing'
                                : 'grab'
                          : undefined;

                        return (
                          <div
                            key={idx}
                            className={`edit-pdf-preview-image-overlay ${isSelected ? 'selected' : ''}`}
                            style={{
                              pointerEvents: hasPos ? 'auto' : undefined,
                              cursor,
                              userSelect:
                                hasPos && (draggingImageIndex === idx || isResizing)
                                  ? 'none'
                                  : undefined,
                              ...(hasPos
                                ? {
                                    position: 'absolute',
                                    left: `${((img.x ?? 0) / pageWidthPt) * 100}%`,
                                    top: `${(1 - (img.y ?? 0) / pageHeightPt) * 100}%`,
                                    transform: 'translate(0, 100%)',
                                    marginTop: 0,
                                    width: `${(imgW / pageWidthPt) * 100}%`,
                                    height: `${(imgH / pageHeightPt) * 100}%`,
                                  }
                                : {
                                    marginTop: `${previewTexts.length * 24 + stackedIndex * 60}px`,
                                  }),
                            }}
                            onMouseMove={
                              hasPos && isSelected
                                ? (e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const relX = e.clientX - rect.left;
                                    const relY = e.clientY - rect.top;
                                    const handle = getResizeHandle(
                                      relX,
                                      relY,
                                      rect.width,
                                      rect.height,
                                      RESIZE_EDGE_MARGIN
                                    );
                                    setHoverResizeHandle(
                                      handle ? { imageIdx: idx, handle } : null
                                    );
                                  }
                                : undefined
                            }
                            onMouseLeave={
                              hasPos && isSelected
                                ? () => setHoverResizeHandle(null)
                                : undefined
                            }
                            onMouseDown={
                              hasPos
                                ? (e) => {
                                    setSelectedImageIndex(idx);
                                    if (hoverHandle) {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      if (!hasPushedForResizeRef.current) {
                                        pushToHistory();
                                        hasPushedForResizeRef.current = true;
                                      }
                                      setResizingState({ index: idx, handle: hoverHandle });
                                      return;
                                    }
                                    e.stopPropagation();
                                    dragImageStartRef.current = {
                                      x: e.clientX,
                                      y: e.clientY,
                                    };
                                    const coords = getPdfCoordsFromClick(e.clientX, e.clientY);
                                    if (coords) {
                                      dragImageOffsetRef.current = {
                                        x: coords.xPdf - (img.x ?? 0),
                                        y: coords.yPdf - (img.y ?? 0),
                                      };
                                      setDraggingImageIndex(idx);
                                    }
                                  }
                                : undefined
                            }
                            title={
                              hasPos
                                ? hoverHandle
                                  ? 'Arraste para redimensionar'
                                  : 'Arraste para mover; aproxime o cursor das bordas para redimensionar'
                                : undefined
                            }
                            role={hasPos ? 'button' : undefined}
                            aria-label={hasPos ? 'Mover ou redimensionar imagem' : undefined}
                          >
                            {previewImageUrls[imageUrlIndex] && (
                              <img
                                src={previewImageUrls[imageUrlIndex]}
                                alt=""
                                draggable={false}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {inlineTextPlacement &&
                      inlineTextPlacement.pageNumber === previewPage && (
                        <div
                          className="edit-pdf-inline-text-input-wrap"
                          role="region"
                          aria-label="Campo de edição de texto"
                          style={{
                            left: `${(inlineTextPlacement.xPdf / (previewPageData.width / THUMBNAIL_SCALE)) * 100}%`,
                            top: `${(1 - inlineTextPlacement.yPdf / (previewPageData.height / THUMBNAIL_SCALE)) * 100}%`,
                            transform: `translate(${addTextAlign === 'center' ? '-50%' : addTextAlign === 'right' ? '-100%' : '0'}, -50%)`,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="edit-pdf-inline-edit-hint">
                            {editingTextIndex != null ? 'Editando — Enter para salvar, Esc para cancelar' : 'Digite o texto — Enter para salvar, Esc para cancelar'}
                          </span>
                          <input
                            ref={inlineInputRef}
                            type="text"
                            className="edit-pdf-inline-text-input"
                            value={inlineTextValue}
                            spellCheck={false}
                            autoComplete="off"
                            onChange={(e) => setInlineTextValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                submitInlineText();
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelInlineText();
                              }
                            }}
                            onBlur={submitInlineText}
                            placeholder="Digite aqui..."
                            aria-label="Editar texto no PDF"
                            style={{
                              fontSize: Math.max(10, addTextSize * 0.8),
                              fontWeight: addTextBold ? 'bold' : undefined,
                              color: addTextColor,
                            }}
                          />
                        </div>
                      )}
                  </div>
                </div>
                </>
              )}
              {!previewPageData && (
                <p className="edit-pdf-preview-empty">Selecione uma página à esquerda.</p>
              )}
              {previewPageData && (
                <div className="edit-pdf-preview-toolbar">
                  <button
                    type="button"
                    className="edit-pdf-toolbar-btn"
                    onClick={() => {
                      const idx = pageOrder.indexOf(previewPage ?? 0);
                      if (idx > 0) setPreviewPage(pageOrder[idx - 1] ?? null);
                    }}
                    disabled={!previewPage || pageOrder.indexOf(previewPage) <= 0}
                    aria-label="Página anterior"
                  >
                    <FiChevronLeft size={20} />
                  </button>
                  <span className="edit-pdf-toolbar-pages">
                    {(pageOrder.indexOf(previewPage ?? 0) + 1) || 1} / {pageOrder.length}
                  </span>
                  <button
                    type="button"
                    className="edit-pdf-toolbar-btn"
                    onClick={() => {
                      const idx = pageOrder.indexOf(previewPage ?? 0);
                      if (idx >= 0 && idx < pageOrder.length - 1)
                        setPreviewPage(pageOrder[idx + 1] ?? null);
                    }}
                    disabled={
                      !previewPage ||
                      pageOrder.indexOf(previewPage) >= pageOrder.length - 1
                    }
                    aria-label="Próxima página"
                  >
                    <FiChevronRight size={20} />
                  </button>
                  <div className="edit-pdf-toolbar-zoom">
                    <button
                      type="button"
                      className="edit-pdf-toolbar-btn"
                      onClick={() =>
                        setPreviewZoom((z) =>
                          ZOOM_OPTIONS[Math.max(0, ZOOM_OPTIONS.indexOf(z) - 1)] ?? z
                        )
                      }
                      aria-label="Diminuir zoom"
                    >
                      −
                    </button>
                    <span className="edit-pdf-toolbar-zoom-value">{previewZoom}%</span>
                    <button
                      type="button"
                      className="edit-pdf-toolbar-btn"
                      onClick={() =>
                        setPreviewZoom((z) =>
                          ZOOM_OPTIONS[
                            Math.min(ZOOM_OPTIONS.length - 1, ZOOM_OPTIONS.indexOf(z) + 1)
                          ] ?? z
                        )
                      }
                      aria-label="Aumentar zoom"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </main>

            {/* DIREITA: painel de edição (cor, negrito, lista, salvar) */}
            <aside className="edit-pdf-sidebar-right" aria-label="Editar PDF">
              <h2 className="edit-pdf-sidebar-right-title">Editar PDF</h2>
              <div className="edit-pdf-info-banner">
                <FiInfo size={18} aria-hidden />
                <span>Reordenar os itens para movê-los para trás ou para a frente.</span>
              </div>
              {pageOrder.map((pageNum) => {
                const textsOnPage = textAdditions.filter((t) => t.pageNumber === pageNum);
                const imagesOnPage = imageAdditions.filter((i) => i.pageNumber === pageNum);
                if (textsOnPage.length === 0 && imagesOnPage.length === 0) return null;
                return (
                  <section key={pageNum} className="edit-pdf-elements-section">
                    <h3 className="edit-pdf-elements-section-title">Página {pageNum}</h3>
                    <ul className="edit-pdf-elements-list">
                      {textsOnPage.map((t, i) => {
                        const globalTextIdx = textAdditions.indexOf(t);
                        return (
                          <li key={`t-${pageNum}-${globalTextIdx}`} className="edit-pdf-element-item">
                            <FiType size={16} className="edit-pdf-element-icon" aria-hidden />
                            <span className="edit-pdf-element-label">Novo Texto {i + 1}</span>
                            <button
                              type="button"
                              className="edit-pdf-element-remove"
                              onClick={() => removeTextAddition(globalTextIdx)}
                              aria-label="Remover texto"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </li>
                        );
                      })}
                      {imagesOnPage.map((img, i) => {
                        const globalImageIdx = imageAdditions.indexOf(img);
                        const isSelected = selectedImageIndex === globalImageIdx;
                        return (
                          <li
                            key={`img-${pageNum}-${globalImageIdx}`}
                            className={`edit-pdf-element-item ${isSelected ? 'edit-pdf-element-item-selected' : ''}`}
                          >
                            <FiImage size={16} className="edit-pdf-element-icon" aria-hidden />
                            <span className="edit-pdf-element-label">{img.imageFile.name}</span>
                            <button
                              type="button"
                              className="edit-pdf-element-select"
                              onClick={() => setSelectedImageIndex(isSelected ? null : globalImageIdx)}
                              title={isSelected ? 'Desmarcar' : 'Selecionar para ajustar tamanho'}
                              aria-pressed={isSelected}
                            >
                              {isSelected ? '✓' : '⋯'}
                            </button>
                            <button
                              type="button"
                              className="edit-pdf-element-remove"
                              onClick={() => {
                                if (selectedImageIndex === globalImageIdx) setSelectedImageIndex(null);
                                removeImageAddition(globalImageIdx);
                              }}
                              aria-label="Remover imagem"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
              {selectedImageIndex != null &&
                imageAdditions[selectedImageIndex] &&
                (!previewPage || imageAdditions[selectedImageIndex].pageNumber === previewPage) && (
                  <section className="edit-pdf-section edit-pdf-image-size-section">
                    <h3 className="edit-pdf-image-size-title">Tamanho da imagem</h3>
                    <p className="edit-pdf-image-size-hint">
                      Aproxime o cursor das bordas na preview e arraste para redimensionar, ou ajuste pelos campos abaixo (em pontos).
                    </p>
                    <div className="edit-pdf-image-size-fields">
                      <label className="edit-pdf-image-size-label">
                        Largura
                        <input
                          type="number"
                          min={20}
                          max={
                            previewPageData
                              ? Math.max(100, Math.round(previewPageData.width / THUMBNAIL_SCALE - 10))
                              : 600
                          }
                          value={imageAdditions[selectedImageIndex].width ?? 100}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const maxW = previewPageData
                              ? previewPageData.width / THUMBNAIL_SCALE - 10
                              : 600;
                            updateImageSize(
                              selectedImageIndex,
                              val ? Math.min(val, maxW) : undefined,
                              undefined
                            );
                          }}
                          aria-label="Largura da imagem em pontos"
                        />
                      </label>
                      <label className="edit-pdf-image-size-label">
                        Altura
                        <input
                          type="number"
                          min={20}
                          max={800}
                          value={imageAdditions[selectedImageIndex].height ?? 100}
                          onChange={(e) =>
                            updateImageSize(
                              selectedImageIndex,
                              undefined,
                              Number(e.target.value) || undefined
                            )
                          }
                          aria-label="Altura da imagem em pontos"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      className="edit-pdf-image-size-close"
                      onClick={() => setSelectedImageIndex(null)}
                    >
                      Fechar
                    </button>
                  </section>
                )}
              <section className="edit-pdf-section">
              <div className="edit-pdf-add-row">
                <label>
                  Página
                  <select
                    value={addTextPage}
                    onChange={(e) => setAddTextPage(Number(e.target.value))}
                  >
                    {pageOrder.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Texto
                  <input
                    type="text"
                    value={addTextValue}
                    onChange={(e) => setAddTextValue(e.target.value)}
                    placeholder="Digite o texto"
                  />
                </label>
                <button type="button" className="edit-pdf-btn-add" onClick={addText}>
                  Adicionar texto
                </button>
              </div>
              {textAdditions.length > 0 && (
                <ul className="edit-pdf-add-list">
                  {textAdditions.map((a, i) => (
                    <li
                      key={i}
                      className={`edit-pdf-add-list-text-item ${editingTextIndex === i ? 'editing' : ''}`}
                    >
                      <button
                        type="button"
                        className="edit-pdf-edit-text-trigger"
                        onClick={() => openEditTextByIndex(i)}
                        title="Clique para editar o texto"
                      >
                        Pág. {a.pageNumber}: “{a.text}”
                      </button>
                      <button
                        type="button"
                        className="edit-pdf-remove-item"
                        onClick={() => removeTextAddition(i)}
                        aria-label="Remover"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="edit-pdf-section">
              <h2 className="edit-pdf-section-title">
                <FiImage /> Adicionar imagem
              </h2>
              <div className="edit-pdf-add-row">
                <label>
                  Página
                  <select
                    value={addImagePage}
                    onChange={(e) => setAddImagePage(Number(e.target.value))}
                  >
                    {pageOrder.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="edit-pdf-image-upload-label">
                  <span className="edit-pdf-image-upload-hint">Escolha a imagem para inserir na página (PNG ou JPEG, máx. 10MB). Ela será adicionada ao clicar.</span>
                  <span className="edit-pdf-image-upload-btn">
                    <FiImage size={18} aria-hidden />
                    Escolher imagem
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                      className="edit-pdf-image-input"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const ok = validateImageFile(f);
                          if (ok.valid && pdfFile) {
                            setError(null);
                            pushToHistory();
                            const maxPage = pagesData.length;
                            const page = addImagePage < 1 ? 1 : addImagePage > maxPage ? maxPage : addImagePage;
                            const pageData = pageMap[page];
                            const pageWidthPt = pageData ? pageData.width / THUMBNAIL_SCALE : 400;
                            const pageHeightPt = pageData ? pageData.height / THUMBNAIL_SCALE : 600;
                            setImageAdditions((prev) => [
                              ...prev,
                              {
                                pageNumber: page,
                                imageFile: f,
                                x: pageWidthPt / 2 - 50,
                                y: pageHeightPt / 2 - 50,
                                width: 100,
                                height: 100,
                              },
                            ]);
                          } else if (!ok.valid) {
                            setError(ok.error ?? 'Imagem inválida');
                          }
                        }
                        e.target.value = '';
                      }}
                    />
                  </span>
                </label>
              </div>
              <button
                type="button"
                className="edit-pdf-remove-all-btn"
                onClick={() => setShowRemoveAllConfirm(true)}
                disabled={
                  textAdditions.length === 0 &&
                  imageAdditions.length === 0 &&
                  !Object.keys(strokesByPage).some(
                    (k) => (strokesByPage[Number(k)]?.length ?? 0) > 0
                  )
                }
              >
                Remover tudo
              </button>
              {showRemoveAllConfirm && (
                <div className="edit-pdf-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-pdf-confirm-title">
                  <div className="edit-pdf-confirm-box">
                    <h3 id="edit-pdf-confirm-title" className="edit-pdf-confirm-title">Você tem certeza que deseja remover as alterações?</h3>
                    <div className="edit-pdf-confirm-actions">
                      <button
                        type="button"
                        className="edit-pdf-confirm-btn edit-pdf-confirm-yes"
                        onClick={() => {
                          removeAllEdits();
                          setShowRemoveAllConfirm(false);
                        }}
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        className="edit-pdf-confirm-btn edit-pdf-confirm-no"
                        onClick={() => setShowRemoveAllConfirm(false)}
                      >
                        Não
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <button
                type="button"
                className="edit-pdf-save-btn"
                onClick={handleDownload}
                disabled={!canDownload || isProcessing}
              >
                Salvar alterações
              </button>
              {imageAdditions.length > 0 && (
                <ul className="edit-pdf-add-list">
                  {imageAdditions.map((a, i) => (
                    <li key={i}>
                      Pág. {a.pageNumber}: {a.imageFile.name}
                      <button
                        type="button"
                        className="edit-pdf-remove-item"
                        onClick={() => removeImageAddition(i)}
                        aria-label="Remover"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            </aside>
          </div>
        )}

        {isProcessing && <LoadingOverlay message="Aplicando edições..." />}
      </div>
    </div>
  );
};

export default EditPDF;
