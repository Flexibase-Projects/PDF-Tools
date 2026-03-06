import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';

const SIGNATURE_WIDTH = 180;
const SIGNATURE_HEIGHT = 70;
const MARGIN = 50;

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

export interface SignPDFOptions {
  /** Página onde colocar a assinatura (0-based). Padrão: 0 (primeira). */
  pageIndex?: number;
  /** Largura da assinatura no PDF (em pontos). */
  signatureWidth?: number;
  /** Altura da assinatura no PDF (em pontos). */
  signatureHeight?: number;
  /** Posição: 'bottom-right' | 'bottom-left' | 'bottom-center'. Usado só se x/y não forem informados. */
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  /** Posição X no PDF em pontos (canto inferior esquerdo da assinatura). Origem: canto inferior esquerdo da página. */
  signatureX?: number;
  /** Posição Y no PDF em pontos (canto inferior esquerdo da assinatura). Origem: canto inferior esquerdo da página. */
  signatureY?: number;
}

/**
 * Aplica a assinatura (imagem PNG em data URL) no PDF e retorna o blob do PDF assinado.
 * A assinatura é desenhada na página indicada, na parte inferior.
 */
export async function signPDF(
  pdfFile: File,
  signatureDataUrl: string,
  options: SignPDFOptions = {}
): Promise<Blob> {
  const {
    pageIndex = 0,
    signatureWidth = SIGNATURE_WIDTH,
    signatureHeight = SIGNATURE_HEIGHT,
    position = 'bottom-right',
    signatureX,
    signatureY,
  } = options;

  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const page = pages[pageIndex];
  if (!page) {
    throw new Error(`Página ${pageIndex + 1} não existe no PDF.`);
  }

  const { width: pageWidth, height: pageHeight } = page.getSize();
  const imgBytes = dataUrlToUint8Array(signatureDataUrl);
  const image = await pdfDoc.embedPng(imgBytes);
  const imgDims = image.scaleToFit(signatureWidth, signatureHeight);

  let x: number;
  let y: number;

  if (signatureX !== undefined && signatureY !== undefined) {
    x = signatureX;
    y = signatureY;
  } else {
    y = pageHeight - MARGIN - imgDims.height;
    switch (position) {
      case 'bottom-left':
        x = MARGIN;
        break;
      case 'bottom-center':
        x = (pageWidth - imgDims.width) / 2;
        break;
      default:
        x = pageWidth - MARGIN - imgDims.width;
    }
  }

  page.drawImage(image, {
    x,
    y,
    width: imgDims.width,
    height: imgDims.height,
  });

  const pdfBytes = await pdfDoc.save({ addDefaultPage: false });
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * Faz o download do PDF assinado.
 */
export async function downloadSignedPDF(blob: Blob, fileName: string): Promise<void> {
  const name = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  saveAs(blob, name);
}
