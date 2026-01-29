import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';

export interface PageOrder {
  pageIndex: number;
  sourceIndex?: number; // Para páginas de outros PDFs
}

export const organizePDF = async (
  sourceFile: File,
  pageOrder: PageOrder[],
  additionalFiles?: File[]
): Promise<Blob> => {
  const organizedPdf = await PDFDocument.create();

  // Carregar PDFs adicionais se houver
  const additionalPdfs: PDFDocument[] = [];
  if (additionalFiles && additionalFiles.length > 0) {
    for (const file of additionalFiles) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      additionalPdfs.push(pdf);
    }
  }

  // Carregar PDF principal
  const sourceArrayBuffer = await sourceFile.arrayBuffer();
  const sourcePdf = await PDFDocument.load(sourceArrayBuffer);
  const sourcePages = sourcePdf.getPages();

  // Organizar páginas conforme a ordem especificada
  for (const order of pageOrder) {
    if (order.sourceIndex !== undefined && additionalPdfs[order.sourceIndex]) {
      // Página de um PDF adicional
      const additionalPdf = additionalPdfs[order.sourceIndex];
      const pages = additionalPdf.getPages();
      if (pages[order.pageIndex]) {
        const [copiedPage] = await organizedPdf.copyPages(additionalPdf, [order.pageIndex]);
        organizedPdf.addPage(copiedPage);
      }
    } else {
      // Página do PDF principal
      if (sourcePages[order.pageIndex]) {
        const [copiedPage] = await organizedPdf.copyPages(sourcePdf, [order.pageIndex]);
        organizedPdf.addPage(copiedPage);
      }
    }
  }

  const pdfBytes = await organizedPdf.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
};

export const downloadOrganizedPDF = async (
  sourceFile: File,
  pageOrder: PageOrder[],
  fileName: string = 'pdf-organizado.pdf',
  additionalFiles?: File[]
) => {
  try {
    const blob = await organizePDF(sourceFile, pageOrder, additionalFiles);
    saveAs(blob, fileName);
  } catch (error) {
    console.error('Erro ao fazer download do PDF organizado:', error);
    throw error;
  }
};
