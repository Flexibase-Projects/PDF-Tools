import {
  PDFDocument,
  StandardFonts,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  toDegrees,
} from 'pdf-lib';
import { saveAs } from 'file-saver';

export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface TextWatermarkOptions {
  text: string;
  position: WatermarkPosition;
  opacity: number; // 0–1
  fontSize: number;
  rotation?: number; // graus 0–360, padrão 0
}

export interface ImageWatermarkOptions {
  position: WatermarkPosition;
  rotation: number; // graus 0–360
  scale: number; // 0.1–2, proporção do tamanho na página
}

const MARGIN = 40;

/** Garante que (x, y) mantém o conteúdo dentro dos limites da página (evita erro e marca fora da folha). */
function clampToPage(
  x: number,
  y: number,
  contentWidth: number,
  contentHeight: number,
  pageWidth: number,
  pageHeight: number
): { x: number; y: number } {
  const maxX = Math.max(0, pageWidth - contentWidth);
  const maxY = Math.max(0, pageHeight - contentHeight);
  return {
    x: Math.max(0, Math.min(maxX, x)),
    y: Math.max(0, Math.min(maxY, y)),
  };
}

/**
 * Converte coordenadas do espaço "visível" (como o usuário vê a página após rotação)
 * para coordenadas do media box do PDF (sempre não rotacionado).
 * getSize() retorna dimensões do media box; com rotação 90/270 o que o usuário vê
 * tem largura/altura trocadas, e a posição calculada sem esse ajuste fica errada.
 */
function visibleToMediaCoords(
  vx: number,
  vy: number,
  _contentWidth: number,
  _contentHeight: number,
  pageWidth: number,
  pageHeight: number,
  pageRotationDeg: number
): { x: number; y: number } {
  const norm = ((pageRotationDeg % 360) + 360) % 360;
  if (norm === 90) {
    // 90° CW: canto inferior esquerdo visível = (pageWidth, 0) no media box → (mx, my) = (pageWidth - vy, vx)
    return { x: pageWidth - vy, y: vx };
  }
  if (norm === 270) {
    // 270° CW: canto inferior esquerdo visível = (0, pageHeight) no media box → (mx, my) = (vy, pageHeight - vx)
    return { x: vy, y: pageHeight - vx };
  }
  if (norm === 180) {
    return { x: pageWidth - vx - _contentWidth, y: pageHeight - vy - _contentHeight };
  }
  // 0°
  return { x: vx, y: vy };
}

function getTextPosition(
  pageWidth: number,
  pageHeight: number,
  textWidth: number,
  textHeight: number,
  position: WatermarkPosition,
  pageRotationDeg: number = 0
): { x: number; y: number } {
  // Dimensões "visíveis": com 90/270 o que o usuário vê tem largura/altura trocadas
  const is90or270 = pageRotationDeg === 90 || pageRotationDeg === 270;
  const visW = is90or270 ? pageHeight : pageWidth;
  const visH = is90or270 ? pageWidth : pageHeight;

  const cx = (visW - textWidth) / 2;
  const cy = (visH - textHeight) / 2;
  const left = MARGIN;
  const right = visW - MARGIN - textWidth;
  const top = visH - MARGIN - textHeight;
  const bottom = MARGIN;

  let vx: number;
  let vy: number;
  switch (position) {
    case 'top-left':
      vx = left;
      vy = top;
      break;
    case 'top-center':
      vx = cx;
      vy = top;
      break;
    case 'top-right':
      vx = right;
      vy = top;
      break;
    case 'middle-left':
      vx = left;
      vy = cy;
      break;
    case 'center':
      vx = cx;
      vy = cy;
      break;
    case 'middle-right':
      vx = right;
      vy = cy;
      break;
    case 'bottom-left':
      vx = left;
      vy = bottom;
      break;
    case 'bottom-center':
      vx = cx;
      vy = bottom;
      break;
    case 'bottom-right':
      vx = right;
      vy = bottom;
      break;
    default:
      vx = cx;
      vy = cy;
  }

  const { x, y } = visibleToMediaCoords(
    vx,
    vy,
    textWidth,
    textHeight,
    pageWidth,
    pageHeight,
    pageRotationDeg
  );
  return clampToPage(x, y, textWidth, textHeight, pageWidth, pageHeight);
}

function getImagePosition(
  pageWidth: number,
  pageHeight: number,
  imgWidth: number,
  imgHeight: number,
  position: WatermarkPosition,
  pageRotationDeg: number = 0
): { x: number; y: number } {
  const is90or270 = pageRotationDeg === 90 || pageRotationDeg === 270;
  const visW = is90or270 ? pageHeight : pageWidth;
  const visH = is90or270 ? pageWidth : pageHeight;

  const cx = (visW - imgWidth) / 2;
  const cy = (visH - imgHeight) / 2;
  const left = MARGIN;
  const right = visW - MARGIN - imgWidth;
  const top = visH - MARGIN - imgHeight;
  const bottom = MARGIN;

  let vx: number;
  let vy: number;
  switch (position) {
    case 'top-left':
      vx = left;
      vy = top;
      break;
    case 'top-center':
      vx = cx;
      vy = top;
      break;
    case 'top-right':
      vx = right;
      vy = top;
      break;
    case 'middle-left':
      vx = left;
      vy = cy;
      break;
    case 'center':
      vx = cx;
      vy = cy;
      break;
    case 'middle-right':
      vx = right;
      vy = cy;
      break;
    case 'bottom-left':
      vx = left;
      vy = bottom;
      break;
    case 'bottom-center':
      vx = cx;
      vy = bottom;
      break;
    case 'bottom-right':
      vx = right;
      vy = bottom;
      break;
    default:
      vx = cx;
      vy = cy;
  }

  const { x, y } = visibleToMediaCoords(
    vx,
    vy,
    imgWidth,
    imgHeight,
    pageWidth,
    pageHeight,
    pageRotationDeg
  );
  return clampToPage(x, y, imgWidth, imgHeight, pageWidth, pageHeight);
}

export async function applyTextWatermark(
  pdfFile: File,
  options: TextWatermarkOptions
): Promise<Blob> {
  const { text, position, opacity, fontSize, rotation = 0 } = options;
  if (!text.trim()) {
    throw new Error('Informe o texto da marca d\'água.');
  }

  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  // CSS rotate() é no sentido horário; pdf-lib usa anti-horário. Negar para igualar ao preview.
  const rotationRad = rotation !== 0 ? (-rotation * Math.PI) / 180 : 0;

  for (const page of pages) {
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const pageRotationDeg = Math.round(toDegrees(page.getRotation())) % 360;
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = fontSize * 1.2;
    const { x, y } = getTextPosition(
      pageWidth,
      pageHeight,
      textWidth,
      textHeight,
      position,
      pageRotationDeg
    );

    const drawOptions = {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity: Math.max(0.1, Math.min(1, opacity)),
    };

    if (rotationRad !== 0) {
      // Rotação em torno do centro do texto para manter a posição fiel ao preview
      const centerX = x + textWidth / 2;
      const centerY = y + textHeight / 2;
      const cos = Math.cos(rotationRad);
      const sin = Math.sin(rotationRad);
      const e = centerX * (1 - cos) + centerY * sin;
      const f = centerY * (1 - cos) - centerX * sin;
      page.pushOperators(
        pushGraphicsState(),
        concatTransformationMatrix(cos, sin, -sin, cos, e, f)
      );
      page.drawText(text, { ...drawOptions });
      page.pushOperators(popGraphicsState());
    } else {
      page.drawText(text, drawOptions);
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

export async function applyImageWatermark(
  pdfFile: File,
  imageFile: File,
  options: ImageWatermarkOptions
): Promise<Blob> {
  const { position, rotation, scale } = options;
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);

  const imageBytes = await imageFile.arrayBuffer();
  const isPng = imageFile.type === 'image/png' || /\.png$/i.test(imageFile.name);
  const embeddedImage = isPng
    ? await pdfDoc.embedPng(imageBytes)
    : await pdfDoc.embedJpg(imageBytes);

  const pages = pdfDoc.getPages();
  // CSS rotate() é no sentido horário; pdf-lib usa anti-horário. Negar para igualar ao preview.
  const rotationRad = (-rotation * Math.PI) / 180;

  for (const page of pages) {
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const pageRotationDeg = Math.round(toDegrees(page.getRotation())) % 360;
    const maxW = pageWidth * 0.4 * scale;
    const maxH = pageHeight * 0.4 * scale;
    const dims = embeddedImage.scaleToFit(maxW, maxH);
    const imgWidth = dims.width;
    const imgHeight = dims.height;

    const { x, y } = getImagePosition(
      pageWidth,
      pageHeight,
      imgWidth,
      imgHeight,
      position,
      pageRotationDeg
    );

    if (rotation !== 0 && rotation !== 360) {
      const centerX = x + imgWidth / 2;
      const centerY = y + imgHeight / 2;
      const cos = Math.cos(rotationRad);
      const sin = Math.sin(rotationRad);
      const e = centerX * (1 - cos) + centerY * sin;
      const f = centerY * (1 - cos) - centerX * sin;
      page.pushOperators(
        pushGraphicsState(),
        concatTransformationMatrix(cos, sin, -sin, cos, e, f)
      );
      page.drawImage(embeddedImage, {
        x,
        y,
        width: imgWidth,
        height: imgHeight,
      });
      page.pushOperators(popGraphicsState());
    } else {
      page.drawImage(embeddedImage, {
        x,
        y,
        width: imgWidth,
        height: imgHeight,
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

export async function downloadWatermarkedPDF(
  blob: Blob,
  baseName: string = 'pdf-marca-dagua'
) {
  const fileName = `${baseName}-${Date.now()}.pdf`;
  saveAs(blob, fileName);
}
