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

function getTextPosition(
  pageWidth: number,
  pageHeight: number,
  textWidth: number,
  textHeight: number,
  position: WatermarkPosition,
  pageRotationDeg: number = 0
): { x: number; y: number } {
  const cx = (pageWidth - textWidth) / 2;
  const cy = (pageHeight - textHeight) / 2;
  const left = MARGIN;
  const right = pageWidth - MARGIN - textWidth;
  // PDF: origem no canto inferior esquerdo, y sobe. Com Rotate 180° o visual fica invertido.
  let top = pageHeight - MARGIN - textHeight;
  let bottom = MARGIN;
  if (pageRotationDeg === 180) {
    [top, bottom] = [bottom, top];
  }

  switch (position) {
    case 'top-left':
      return { x: left, y: top };
    case 'top-center':
      return { x: cx, y: top };
    case 'top-right':
      return { x: right, y: top };
    case 'middle-left':
      return { x: left, y: cy };
    case 'center':
      return { x: cx, y: cy };
    case 'middle-right':
      return { x: right, y: cy };
    case 'bottom-left':
      return { x: left, y: bottom };
    case 'bottom-center':
      return { x: cx, y: bottom };
    case 'bottom-right':
      return { x: right, y: bottom };
    default:
      return { x: cx, y: cy };
  }
}

function getImagePosition(
  pageWidth: number,
  pageHeight: number,
  imgWidth: number,
  imgHeight: number,
  position: WatermarkPosition,
  pageRotationDeg: number = 0
): { x: number; y: number } {
  const cx = (pageWidth - imgWidth) / 2;
  const cy = (pageHeight - imgHeight) / 2;
  const left = MARGIN;
  const right = pageWidth - MARGIN - imgWidth;
  let top = pageHeight - MARGIN - imgHeight;
  let bottom = MARGIN;
  if (pageRotationDeg === 180) {
    [top, bottom] = [bottom, top];
  }

  switch (position) {
    case 'top-left':
      return { x: left, y: top };
    case 'top-center':
      return { x: cx, y: top };
    case 'top-right':
      return { x: right, y: top };
    case 'middle-left':
      return { x: left, y: cy };
    case 'center':
      return { x: cx, y: cy };
    case 'middle-right':
      return { x: right, y: cy };
    case 'bottom-left':
      return { x: left, y: bottom };
    case 'bottom-center':
      return { x: cx, y: bottom };
    case 'bottom-right':
      return { x: right, y: bottom };
    default:
      return { x: cx, y: cy };
  }
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

  const rotationRad = rotation !== 0 ? (rotation * Math.PI) / 180 : 0;

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
  const rotationRad = (rotation * Math.PI) / 180;

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
