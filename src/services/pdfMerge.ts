import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { MergedPage } from '../types';

export const mergePDFs = async (files: File[]): Promise<Blob> => {
  if (files.length === 0) {
    throw new Error('Nenhum arquivo PDF fornecido');
  }

  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      
      pages.forEach((page) => {
        mergedPdf.addPage(page);
      });
    } catch (error) {
      console.error(`Erro ao processar ${file.name}:`, error);
      throw new Error(`Erro ao processar o arquivo ${file.name}. Verifique se é um PDF válido.`);
    }
  }

  const pdfBytes = await mergedPdf.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
};

export const mergePDFsFromPages = async (pages: MergedPage[]): Promise<Blob> => {
  if (pages.length === 0) {
    throw new Error('Nenhuma página fornecida');
  }

  const mergedPdf = await PDFDocument.create();
  const fileMap = new Map<string, PDFDocument>();

  // Carregar PDFs uma vez
  for (const page of pages) {
    if (!fileMap.has(page.fileId)) {
      const arrayBuffer = await page.file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      fileMap.set(page.fileId, pdf);
    }
  }

  // Adicionar páginas na ordem especificada
  for (const page of pages) {
    const pdf = fileMap.get(page.fileId);
    if (pdf) {
      const pageIndex = page.originalPageNumber - 1;
      const [copiedPage] = await mergedPdf.copyPages(pdf, [pageIndex]);
      mergedPdf.addPage(copiedPage);
    }
  }

  const pdfBytes = await mergedPdf.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
};

export const downloadMergedPDF = async (files: File[], fileName: string = 'pdf-merged.pdf') => {
  try {
    const blob = await mergePDFs(files);
    saveAs(blob, fileName);
  } catch (error) {
    console.error('Erro ao fazer download do PDF mesclado:', error);
    throw error;
  }
};

export const downloadMergedPDFFromPages = async (
  pages: MergedPage[],
  fileName: string = 'pdf-mesclado.pdf'
) => {
  try {
    const blob = await mergePDFsFromPages(pages);
    saveAs(blob, fileName);
  } catch (error) {
    console.error('Erro ao fazer download do PDF mesclado:', error);
    throw error;
  }
};
