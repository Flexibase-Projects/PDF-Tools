import * as pdfjsLib from 'pdfjs-dist';

// Configurar worker do PDF.js
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export interface PDFPageData {
  pageNumber: number;
  thumbnail?: string;
  width: number;
  height: number;
}

/**
 * Obtém o número total de páginas de um arquivo PDF
 */
export const getPDFPageCount = async (file: File): Promise<number> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  } catch (error) {
    console.error('Erro ao obter contagem de páginas:', error);
    throw new Error('Erro ao ler o arquivo PDF');
  }
};

/**
 * Gera uma thumbnail (imagem base64) de uma página específica do PDF
 */
export const generateThumbnail = async (
  file: File,
  pageNumber: number,
  scale: number = 1.0
): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    // Criar canvas temporário
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Não foi possível obter contexto do canvas');
    }

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
    
    // Converter para base64
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Erro ao gerar thumbnail:', error);
    throw new Error(`Erro ao gerar thumbnail da página ${pageNumber}`);
  }
};

/**
 * Gera uma thumbnail comprimida (imagem base64 JPEG) de uma página específica do PDF
 * com qualidade ajustável para simular compressão
 */
export const generateCompressedThumbnail = async (
  file: File,
  pageNumber: number,
  quality: number, // 0-100
  scale: number = 1.0
): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    // Criar canvas temporário
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Não foi possível obter contexto do canvas');
    }

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
    
    // Converter para JPEG com qualidade baseada no parâmetro
    // Mapear qualidade 0-100 para 0.1-0.95 (JPEG aceita 0-1, mas valores muito baixos são ruins)
    const jpegQuality = Math.max(0.1, Math.min(0.95, quality / 100));
    
    // Se qualidade for muito baixa, reduzir também a resolução
    let finalCanvas = canvas;
    if (quality < 50) {
      const reductionFactor = 0.5 + (quality / 100) * 0.5; // 0.5 a 1.0
      const compressedCanvas = document.createElement('canvas');
      compressedCanvas.width = canvas.width * reductionFactor;
      compressedCanvas.height = canvas.height * reductionFactor;
      const compressedContext = compressedCanvas.getContext('2d');
      
      if (compressedContext) {
        compressedContext.drawImage(canvas, 0, 0, compressedCanvas.width, compressedCanvas.height);
        finalCanvas = compressedCanvas;
      }
    }
    
    // Converter para JPEG com qualidade ajustada
    return finalCanvas.toDataURL('image/jpeg', jpegQuality);
  } catch (error) {
    console.error('Erro ao gerar thumbnail comprimida:', error);
    throw new Error(`Erro ao gerar thumbnail comprimida da página ${pageNumber}`);
  }
};

/**
 * Carrega dados de todas as páginas de um PDF (com thumbnails)
 */
export const loadPDFPages = async (
  file: File,
  thumbnailScale: number = 0.5
): Promise<PDFPageData[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;

    const pages: PDFPageData[] = [];

    // Carregar páginas em lotes para melhor performance
    const batchSize = 5;
    for (let i = 1; i <= numPages; i += batchSize) {
      const batch = [];
      for (let j = i; j < Math.min(i + batchSize, numPages + 1); j++) {
        batch.push(
          (async () => {
            const page = await pdf.getPage(j);
            const viewport = page.getViewport({ scale: thumbnailScale });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            if (!context) {
              throw new Error('Não foi possível obter contexto do canvas');
            }

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
              canvasContext: context,
              viewport: viewport,
            }).promise;

            const thumbnail = canvas.toDataURL('image/png');

            return {
              pageNumber: j,
              thumbnail,
              width: viewport.width,
              height: viewport.height,
            };
          })()
        );
      }

      const batchResults = await Promise.all(batch);
      pages.push(...batchResults);
    }

    return pages;
  } catch (error) {
    console.error('Erro ao carregar páginas do PDF:', error);
    throw new Error('Erro ao carregar páginas do PDF');
  }
};

/**
 * Carrega apenas metadados das páginas (sem thumbnails) - mais rápido
 */
export const loadPDFPagesMetadata = async (file: File): Promise<PDFPageData[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;

    const pages: PDFPageData[] = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      
      pages.push({
        pageNumber: i,
        width: viewport.width,
        height: viewport.height,
      });
    }

    return pages;
  } catch (error) {
    console.error('Erro ao carregar metadados das páginas:', error);
    throw new Error('Erro ao carregar metadados das páginas');
  }
};
