import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { FiFile } from 'react-icons/fi';
import './PDFPreview.css';

// Configurar worker do PDF.js
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface PDFPreviewProps {
  file: File;
  pageNumber?: number;
  scale?: number;
  className?: string;
}

const PDFPreview = ({ 
  file, 
  pageNumber = 1, 
  scale = 1.5,
  className = '' 
}: PDFPreviewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const renderPDF = async () => {
      if (!canvasRef.current) return;

      setLoading(true);
      setError(null);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        setTotalPages(pdf.numPages);

        const page = await pdf.getPage(Math.min(pageNumber, pdf.numPages));
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
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
        setLoading(false);
      } catch (err) {
        console.error('Erro ao renderizar PDF:', err);
        setError('Erro ao carregar preview do PDF');
        setLoading(false);
      }
    };

    renderPDF();
  }, [file, pageNumber, scale]);

  if (error) {
    return (
      <div className={`pdf-preview error ${className}`}>
        <FiFile />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className={`pdf-preview ${className}`}>
      {loading && (
        <div className="pdf-preview-loading">
          <div className="spinner" />
          <p>Carregando preview...</p>
        </div>
      )}
      <canvas ref={canvasRef} className="pdf-canvas" />
      {totalPages > 0 && (
        <div className="pdf-preview-info">
          Página {pageNumber} de {totalPages}
        </div>
      )}
    </div>
  );
};

export default PDFPreview;
