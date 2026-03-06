import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { saveAs } from 'file-saver';

export type RepairKind =
  | 'relinearizacao'
  | 'recuperacao_renderizacao';

export interface RepairResult {
  blob: Blob;
  repairs: RepairKind[];
  pageCount: number;
}

/**
 * Converte data URL PNG em Uint8Array para embed no pdf-lib.
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  if (!base64) throw new Error('Data URL inválida');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Tenta reparar o PDF re-escrevendo a estrutura (pdf-lib load + save).
 * Corrige muitos casos de corrupção leve (xref, trailer, linearização).
 */
async function tryRelinearizacao(file: File): Promise<RepairResult | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const pageCount = pdf.getPageCount();
    const pdfBytes = await pdf.save({ addDefaultPage: false });
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    return {
      blob,
      repairs: ['relinearizacao'],
      pageCount,
    };
  } catch {
    return null;
  }
}

/**
 * Recupera o PDF renderizando cada página com PDF.js e reconstruindo com pdf-lib.
 * Usado quando o pdf-lib não consegue carregar o arquivo.
 */
async function recuperarPorRenderizacao(file: File): Promise<RepairResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const newPdf = await PDFDocument.create();

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 }); // 2x para qualidade

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Contexto de canvas indisponível');

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    const dataUrl = canvas.toDataURL('image/png');
    const pngBytes = dataUrlToUint8Array(dataUrl);
    const image = await newPdf.embedPng(pngBytes);

    const [w, h] = [viewport.width, viewport.height];
    const pdfPage = newPdf.addPage([w, h]);
    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: w,
      height: h,
    });
  }

  const pdfBytes = await newPdf.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  return {
    blob,
    repairs: ['recuperacao_renderizacao'],
    pageCount: numPages,
  };
}

/**
 * Repara um PDF corrompido ou danificado.
 * Tenta primeiro re-linearização (rápida); se falhar, recupera por renderização (mais lenta).
 * Retorna o blob reparado e a lista de reparos aplicados.
 */
export async function repairPDF(file: File): Promise<RepairResult> {
  const relinearizado = await tryRelinearizacao(file);
  if (relinearizado) return relinearizado;

  return recuperarPorRenderizacao(file);
}

const REPAIR_LABELS: Record<RepairKind, string> = {
  relinearizacao: 'Estrutura do PDF reescrita (re-linearização)',
  recuperacao_renderizacao: 'Recuperação por renderização das páginas (PDF reconstruído)',
};

export function getRepairLabel(kind: RepairKind): string {
  return REPAIR_LABELS[kind];
}

export async function downloadRepairedPDF(
  result: RepairResult,
  fileName: string = 'pdf-reparado.pdf'
): Promise<void> {
  saveAs(result.blob, fileName);
}
