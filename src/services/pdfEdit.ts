import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
} from 'pdf-lib';
import { saveAs } from 'file-saver';

/** Ordem das páginas no PDF editado: array de números 1-based (páginas originais na ordem desejada). */
export type PageOrder = number[];

/** Rotações por página original (1-based): 0, 90, 180 ou 270 graus. */
export type PageRotations = Record<number, 0 | 90 | 180 | 270>;

export type TextAlign = 'left' | 'center' | 'right';

export interface TextAddition {
  /** Número da página original (1-based). */
  pageNumber: number;
  text: string;
  /** X em pontos (origem canto inferior esquerdo). Se omitido, usa align para posição. */
  x?: number;
  /** Y em pontos. Se omitido, centralizado. */
  y?: number;
  fontSize?: number;
  opacity?: number;
  /** Negrito (usa Helvetica-Bold). */
  bold?: boolean;
  /** Cor RGB 0–1. */
  color?: { r: number; g: number; b: number };
  /** Alinhamento horizontal (quando x é omitido ou como referência do ponto x). */
  align?: TextAlign;
}

export interface ImageAddition {
  /** Número da página original (1-based). */
  pageNumber: number;
  imageFile: File;
  /** X em pontos. Se omitido, centralizado. */
  x?: number;
  /** Y em pontos. Se omitido, centralizado. */
  y?: number;
  /** Largura em pontos. Se omitido, escala mantendo proporção. */
  width?: number;
  /** Altura em pontos. Se omitido, escala mantendo proporção. */
  height?: number;
}

/** Ponto normalizado (0–1) para desenho. */
export interface DrawPoint {
  x: number;
  y: number;
}

/** Traço de caneta ou marca-texto (coordenadas normalizadas 0–1). */
export interface DrawStroke {
  tool: 'pen' | 'highlighter';
  color: string;
  lineWidth: number;
  points: DrawPoint[];
}

export interface EditPDFOptions {
  /** Páginas a manter, na ordem desejada (1-based). Ex: [2, 1, 3] = primeira página do resultado é a original 2. */
  pageOrder: number[];
  /** Rotações por página original (1-based). */
  pageRotations?: PageRotations;
  /** Textos a adicionar. */
  textAdditions?: TextAddition[];
  /** Imagens a adicionar. */
  imageAdditions?: ImageAddition[];
  /** Desenhos por página original (1-based). Coordenadas normalizadas 0–1. */
  drawAdditions?: Record<number, DrawStroke[]>;
}

const DEFAULT_FONT_SIZE = 12;
const DEFAULT_TEXT_OPACITY = 1;
const MARGIN = 40;
const HIGHLIGHTER_OPACITY = 0.35;
const DRAW_IMAGE_SCALE = 2;

/**
 * Renderiza traços (caneta/marca-texto) em uma imagem PNG.
 * Coordenadas dos pontos são normalizadas (0–1). Retorna bytes PNG para embed no PDF.
 */
async function renderStrokesToPng(
  widthPt: number,
  heightPt: number,
  strokes: DrawStroke[]
): Promise<Uint8Array> {
  if (typeof document === 'undefined') {
    return new Uint8Array(0);
  }
  const canvas = document.createElement('canvas');
  const w = Math.round(widthPt * DRAW_IMAGE_SCALE);
  const h = Math.round(heightPt * DRAW_IMAGE_SCALE);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Uint8Array(0);

  ctx.clearRect(0, 0, w, h);
  strokes.forEach((stroke) => {
    if (stroke.points.length < 2) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.lineWidth * DRAW_IMAGE_SCALE;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (stroke.tool === 'highlighter') {
      ctx.globalAlpha = HIGHLIGHTER_OPACITY;
    }
    ctx.beginPath();
    const x0 = stroke.points[0].x * w;
    const y0 = (1 - stroke.points[0].y) * h;
    ctx.moveTo(x0, y0);
    stroke.points.slice(1).forEach((p) => {
      ctx.lineTo(p.x * w, (1 - p.y) * h);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  if (!base64) return new Uint8Array(0);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Aplica todas as edições ao PDF: ordem das páginas, rotações, textos e imagens.
 * Retorna o blob do PDF editado.
 */
export async function applyPDFEdits(pdfFile: File, options: EditPDFOptions): Promise<Blob> {
  const {
    pageOrder,
    pageRotations = {},
    textAdditions = [],
    imageAdditions = [],
    drawAdditions = {},
  } = options;
  if (pageOrder.length === 0) {
    throw new Error('Selecione ao menos uma página para manter.');
  }

  const arrayBuffer = await pdfFile.arrayBuffer();
  const sourceDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalSource = sourceDoc.getPageCount();

  const indicesToCopy = pageOrder
    .filter((p) => p >= 1 && p <= totalSource)
    .map((p) => p - 1);

  if (indicesToCopy.length === 0) {
    throw new Error('Nenhuma página válida para copiar.');
  }

  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(sourceDoc, indicesToCopy);
  copiedPages.forEach((p) => newDoc.addPage(p));

  const font = await newDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await newDoc.embedFont(StandardFonts.HelveticaBold);

  for (let i = 0; i < copiedPages.length; i++) {
    const newPage = newDoc.getPage(i);
    const originalPageNum = pageOrder[i];
    const rotation = pageRotations[originalPageNum] ?? 0;
    if (rotation !== 0) {
      newPage.setRotation(degrees(rotation));
    }
  }

  for (const add of textAdditions) {
    const newIndex = pageOrder.indexOf(add.pageNumber);
    if (newIndex === -1) continue;
    const page = newDoc.getPage(newIndex);
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const fontSize = add.fontSize ?? DEFAULT_FONT_SIZE;
    const useFont = add.bold ? fontBold : font;
    const textWidth = useFont.widthOfTextAtSize(add.text, fontSize);
    const textHeight = fontSize * 1.2;
    const align = add.align ?? 'left';
    let x: number;
    if (add.x != null) {
      if (align === 'center') x = add.x - textWidth / 2;
      else if (align === 'right') x = add.x - textWidth;
      else x = add.x;
    } else {
      if (align === 'left') x = MARGIN;
      else if (align === 'right') x = Math.max(MARGIN, pageWidth - MARGIN - textWidth);
      else x = Math.max(MARGIN, (pageWidth - textWidth) / 2);
    }
    const y = add.y ?? Math.max(MARGIN, (pageHeight - textHeight) / 2);
    const colorRgb = add.color
      ? rgb(add.color.r, add.color.g, add.color.b)
      : rgb(0, 0, 0);
    page.drawText(add.text, {
      x,
      y,
      size: fontSize,
      font: useFont,
      color: colorRgb,
      opacity: Math.max(0.1, Math.min(1, add.opacity ?? DEFAULT_TEXT_OPACITY)),
    });
  }

  for (const add of imageAdditions) {
    const newIndex = pageOrder.indexOf(add.pageNumber);
    if (newIndex === -1) continue;
    const page = newDoc.getPage(newIndex);
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const imageBytes = await add.imageFile.arrayBuffer();
    const isPng = add.imageFile.type === 'image/png' || /\.png$/i.test(add.imageFile.name);
    const embedded = isPng
      ? await newDoc.embedPng(imageBytes)
      : await newDoc.embedJpg(imageBytes);
    const dims = embedded.scaleToFit(
      add.width ?? Math.min(200, pageWidth - 2 * MARGIN),
      add.height ?? Math.min(200, pageHeight - 2 * MARGIN)
    );
    const width = add.width ?? dims.width;
    const height = add.height ?? dims.height;
    const x = add.x ?? (pageWidth - width) / 2;
    const y = add.y ?? (pageHeight - height) / 2;
    page.drawImage(embedded, { x, y, width, height });
  }

  for (let i = 0; i < copiedPages.length; i++) {
    const originalPageNum = pageOrder[i];
    const strokes = drawAdditions[originalPageNum];
    if (!strokes?.length) continue;
    const page = newDoc.getPage(i);
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const pngBytes = await renderStrokesToPng(pageWidth, pageHeight, strokes);
    if (pngBytes.length === 0) continue;
    const embedded = await newDoc.embedPng(pngBytes);
    page.drawImage(embedded, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  }

  const pdfBytes = await newDoc.save({ addDefaultPage: false });
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

/**
 * Faz o download do PDF editado.
 */
export async function downloadEditedPDF(blob: Blob, fileName: string): Promise<void> {
  const name = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  saveAs(blob, name);
}
