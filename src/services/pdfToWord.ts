// Conversão de PDF para Word usando biblioteca docx para criar DOCX real
// Extrai texto, estrutura e imagens do PDF de forma eficiente

import { saveAs } from 'file-saver';
import * as pdfjsLib from 'pdfjs-dist';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

// Configurar worker do PDF.js
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
  fontSize?: number;
}

interface ExtractedContent {
  paragraphs: Paragraph[];
  images: ArrayBuffer[];
}

export const convertPDFToWord = async (file: File): Promise<Blob> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;

    const extractedContent: ExtractedContent = {
      paragraphs: [],
      images: []
    };

    // Extrair conteúdo de todas as páginas
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });

      // Extrair texto com informações de posição e formatação
      const textItems: TextItem[] = textContent.items.map((item: any) => ({
        str: item.str || '',
        x: item.transform?.[4] || 0,
        y: item.transform?.[5] || 0,
        width: item.width || 0,
        height: item.height || 0,
        fontName: item.fontName,
        fontSize: item.height || 12
      }));

      // Processar texto em parágrafos
      const paragraphs = processTextItems(textItems, viewport.width);
      extractedContent.paragraphs.push(...paragraphs);

      // Adicionar quebra de página (exceto na última página)
      if (i < numPages) {
        extractedContent.paragraphs.push(
          new Paragraph({
            text: '',
            spacing: { after: 400 }
          })
        );
      }

      // Tentar extrair imagens da página (opcional, não bloqueia a conversão)
      try {
        const images = await extractImagesFromPage(page);
        if (images.length > 0) {
          extractedContent.images.push(...images);
        }
      } catch (imgError) {
        // Se não conseguir extrair imagens, continua sem elas (não é crítico)
        // console.warn(`Não foi possível extrair imagens da página ${i}:`, imgError);
      }
    }

    // Criar documento DOCX com parágrafos extraídos
    // Nota: Imagens são extraídas mas não incluídas no DOCX por enquanto
    // pois requerem processamento adicional para o formato docx
    const doc = new Document({
      sections: [{
        properties: {},
        children: extractedContent.paragraphs
      }]
    });

    // Gerar arquivo DOCX
    const blob = await Packer.toBlob(doc);
    return blob;
  } catch (error) {
    console.error('Erro ao converter PDF para Word:', error);
    throw new Error(`Erro ao converter PDF para Word: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
};

// Processar itens de texto em parágrafos formatados
function processTextItems(items: TextItem[], _pageWidth: number): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let currentParagraph: TextRun[] = [];
  let lastY = -1;
  const lineThreshold = 5; // Distância em pixels para considerar mesma linha

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    if (!item.str || item.str.trim() === '') {
      continue;
    }

    // Detectar quebra de parágrafo (mudança significativa na posição Y)
    const isNewLine = lastY !== -1 && Math.abs(item.y - lastY) > lineThreshold;
    
    if (isNewLine && currentParagraph.length > 0) {
      // Finalizar parágrafo atual
      paragraphs.push(createParagraphFromRuns(currentParagraph, item.fontSize || 12));
      currentParagraph = [];
    }

    // Adicionar texto ao parágrafo atual
    const textRun = new TextRun({
      text: item.str + (i < items.length - 1 ? ' ' : ''),
      size: Math.round((item.fontSize || 12) * 2), // docx usa half-points
      font: item.fontName || 'Arial'
    });

    currentParagraph.push(textRun);
    lastY = item.y;
  }

  // Adicionar último parágrafo
  if (currentParagraph.length > 0) {
    paragraphs.push(createParagraphFromRuns(currentParagraph, 12));
  }

  // Se não houver parágrafos, criar um com todo o texto
  if (paragraphs.length === 0) {
    const allText = items.map(item => item.str).join(' ');
    paragraphs.push(new Paragraph({
      children: [new TextRun(allText)]
    }));
  }

  return paragraphs;
}

// Criar parágrafo a partir de runs de texto
function createParagraphFromRuns(runs: TextRun[], defaultSize: number): Paragraph {
  // Detectar se é um título (texto maior ou em negrito)
  const avgSize = runs.reduce((sum, run) => sum + ((run as { options?: { size?: number } }).options?.size ?? defaultSize * 2), 0) / runs.length;
  const isHeading = avgSize > defaultSize * 2.5;

  return new Paragraph({
    children: runs,
    heading: isHeading ? HeadingLevel.HEADING_2 : undefined,
    spacing: { after: 200 },
    alignment: AlignmentType.LEFT
  });
}

// Extrair imagens de uma página do PDF
// Nota: A extração de imagens do PDF é complexa e pode não funcionar para todos os PDFs
// Esta função tenta extrair, mas não é crítica para a conversão
async function extractImagesFromPage(
  page: pdfjsLib.PDFPageProxy
): Promise<ArrayBuffer[]> {
  const images: ArrayBuffer[] = [];
  
  try {
    // Renderizar página como imagem e converter para ArrayBuffer
    // Esta é uma abordagem mais simples e confiável
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');
    
    if (!context) {
      return images;
    }

    await page.render({
      canvasContext: context as any,
      viewport: viewport
    }).promise;

    // Converter canvas para ArrayBuffer
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          blob.arrayBuffer().then(buffer => {
            resolve([buffer]);
          }).catch(() => resolve([]));
        } else {
          resolve([]);
        }
      }, 'image/png', 0.95);
    });
  } catch (error) {
    // Se falhar, retornar array vazio (não é crítico)
    return [];
  }
}

export const downloadPDFAsWord = async (
  file: File,
  fileName: string = 'documento.docx'
) => {
  try {
    // Garantir extensão .docx
    const finalFileName = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
    
    const blob = await convertPDFToWord(file);
    saveAs(blob, finalFileName);
  } catch (error) {
    console.error('Erro ao fazer download do arquivo Word:', error);
    throw error;
  }
};
