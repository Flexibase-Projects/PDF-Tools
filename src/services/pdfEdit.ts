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

export interface TextAddition {
  /** Número da página original (1-based). */
  pageNumber: number;
  text: string;
  /** X em pontos (origem canto inferior esquerdo). Se omitido, centralizado. */
  x?: number;
  /** Y em pontos. Se omitido, centralizado. */
  y?: number;
  fontSize?: number;
  opacity?: number;
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

export interface EditPDFOptions {
  /** Páginas a manter, na ordem desejada (1-based). Ex: [2, 1, 3] = primeira página do resultado é a original 2. */
  pageOrder: number[];
  /** Rotações por página original (1-based). */
  pageRotations?: PageRotations;
  /** Textos a adicionar. */
  textAdditions?: TextAddition[];
  /** Imagens a adicionar. */
  imageAdditions?: ImageAddition[];
}

const DEFAULT_FONT_SIZE = 12;
const DEFAULT_TEXT_OPACITY = 1;
const MARGIN = 40;

/**
 * Aplica todas as edições ao PDF: ordem das páginas, rotações, textos e imagens.
 * Retorna o blob do PDF editado.
 */
export async function applyPDFEdits(pdfFile: File, options: EditPDFOptions): Promise<Blob> {
  const { pageOrder, pageRotations = {}, textAdditions = [], imageAdditions = [] } = options;
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
    const textWidth = font.widthOfTextAtSize(add.text, fontSize);
    const textHeight = fontSize * 1.2;
    const x = add.x ?? Math.max(MARGIN, (pageWidth - textWidth) / 2);
    const y = add.y ?? Math.max(MARGIN, (pageHeight - textHeight) / 2);
    page.drawText(add.text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
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
