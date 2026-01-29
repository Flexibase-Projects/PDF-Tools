// Configuração centralizada do PDF.js Worker
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  // Usar CDN para o worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export default pdfjsLib;
