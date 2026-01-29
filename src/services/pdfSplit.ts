import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

export type SplitMode = 'range' | 'single' | 'all';

export interface SplitOptions {
  mode: SplitMode;
  startPage?: number;
  endPage?: number;
  pageNumber?: number;
}

export const splitPDF = async (
  file: File,
  options: SplitOptions
): Promise<Blob[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(arrayBuffer);
  const totalPages = sourcePdf.getPageCount();
  const results: Blob[] = [];

  if (options.mode === 'all') {
    // Criar um PDF para cada página
    for (let i = 0; i < totalPages; i++) {
      const newPdf = await PDFDocument.create();
      const [copiedPage] = await newPdf.copyPages(sourcePdf, [i]);
      newPdf.addPage(copiedPage);
      const pdfBytes = await newPdf.save();
      results.push(new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }));
    }
  } else if (options.mode === 'single' && options.pageNumber !== undefined) {
    // Extrair uma página específica
    const pageIndex = options.pageNumber - 1; // Converter para índice baseado em 0
    if (pageIndex >= 0 && pageIndex < totalPages) {
      const newPdf = await PDFDocument.create();
      const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex]);
      newPdf.addPage(copiedPage);
      const pdfBytes = await newPdf.save();
      results.push(new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }));
    }
  } else if (options.mode === 'range' && options.startPage !== undefined && options.endPage !== undefined) {
    // Extrair um intervalo de páginas
    const startIndex = Math.max(0, options.startPage - 1);
    const endIndex = Math.min(totalPages - 1, options.endPage - 1);
    
    if (startIndex <= endIndex) {
      const newPdf = await PDFDocument.create();
      const pageIndices = Array.from({ length: endIndex - startIndex + 1 }, (_, i) => startIndex + i);
      const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
      copiedPages.forEach((page) => newPdf.addPage(page));
      const pdfBytes = await newPdf.save();
      results.push(new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }));
    }
  }

  return results;
};

export const downloadSplitPDFs = async (
  file: File,
  options: SplitOptions,
  downloadAsZip: boolean = false
) => {
  try {
    const blobs = await splitPDF(file, options);

    if (downloadAsZip && blobs.length > 1) {
      // Criar um arquivo ZIP com todos os PDFs
      const zip = new JSZip();
      blobs.forEach((blob, index) => {
        const fileName = options.mode === 'single' 
          ? `pagina-${options.pageNumber}.pdf`
          : options.mode === 'range'
          ? `paginas-${options.startPage}-${options.endPage}.pdf`
          : `pagina-${index + 1}.pdf`;
        zip.file(fileName, blob);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `pdf-dividido-${Date.now()}.zip`);
    } else {
      // Baixar cada PDF individualmente
      blobs.forEach((blob, index) => {
        const fileName = options.mode === 'single'
          ? `pagina-${options.pageNumber}.pdf`
          : options.mode === 'range'
          ? `paginas-${options.startPage}-${options.endPage}.pdf`
          : `pagina-${index + 1}.pdf`;
        saveAs(blob, fileName);
      });
    }
  } catch (error) {
    console.error('Erro ao fazer download dos PDFs divididos:', error);
    throw error;
  }
};
