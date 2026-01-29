import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';

export interface CompressOptions {
  quality: number; // 0-100, onde 100 é melhor qualidade
}

export const compressPDF = async (
  file: File,
  options: CompressOptions
): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);

  // A compressão no pdf-lib é limitada, mas podemos otimizar removendo recursos desnecessários
  // Para uma compressão mais eficiente, seria necessário usar bibliotecas server-side
  // ou APIs especializadas. Aqui fazemos o melhor possível no client-side.

  const pdfBytes = await pdf.save({
    useObjectStreams: options.quality < 50, // Usar object streams para menor tamanho
    addDefaultPage: false,
  });

  // Se a qualidade for muito baixa, tentamos reduzir ainda mais
  // Nota: Isso pode afetar a qualidade visual
  if (options.quality < 30) {
    // Recarregar e salvar novamente com mais otimizações
    const optimizedPdf = await PDFDocument.load(pdfBytes);
    const optimizedBytes = await optimizedPdf.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });
    return new Blob([new Uint8Array(optimizedBytes)], { type: 'application/pdf' });
  }

  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
};

export const downloadCompressedPDF = async (
  file: File,
  options: CompressOptions,
  fileName: string = 'pdf-comprimido.pdf'
) => {
  try {
    const blob = await compressPDF(file, options);
    saveAs(blob, fileName);
  } catch (error) {
    console.error('Erro ao fazer download do PDF comprimido:', error);
    throw error;
  }
};
