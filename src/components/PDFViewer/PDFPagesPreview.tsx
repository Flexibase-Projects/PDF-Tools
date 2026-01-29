import { useEffect, useState } from 'react';
import { PDFPageData, loadPDFPages } from '../../utils/pdfUtils';
import { FiFile } from 'react-icons/fi';
import LDRSLoader from '../common/LDRSLoader';
import './PDFPagesPreview.css';

interface PDFPagesPreviewProps {
  file: File;
  showActions?: boolean;
  onPageAction?: (pageNumber: number, action: string) => void;
  scale?: number;
  onPagesLoaded?: (pages: PDFPageData[]) => void;
  selectedPages?: number[];
  highlightPages?: number[];
  maxPages?: number; // Limitar número de páginas a exibir
}

const PDFPagesPreview = ({ 
  file,
  showActions = false,
  onPageAction,
  scale = 0.3,
  onPagesLoaded,
  selectedPages = [],
  highlightPages = [],
  maxPages
}: PDFPagesPreviewProps) => {
  const [pages, setPages] = useState<PDFPageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPages = async () => {
      setLoading(true);
      setError(null);

      try {
        let loadedPages = await loadPDFPages(file, scale);
        
        // Limitar número de páginas se maxPages estiver definido
        if (maxPages && maxPages > 0) {
          loadedPages = loadedPages.slice(0, maxPages);
        }
        
        setPages(loadedPages);
        onPagesLoaded?.(loadedPages);
      } catch (err) {
        console.error('Erro ao carregar páginas:', err);
        setError('Erro ao carregar preview das páginas');
      } finally {
        setLoading(false);
      }
    };

    if (file) {
      loadPages();
    }
  }, [file, scale, maxPages, onPagesLoaded]);

  if (loading) {
    return (
      <div className="pdf-pages-preview-loading">
        <LDRSLoader type="tailspin" size={48} color="var(--primary-color)" />
        <p>Carregando páginas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdf-pages-preview-error">
        <FiFile />
        <p>{error}</p>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="pdf-pages-preview-empty">
        <p>Nenhuma página encontrada</p>
      </div>
    );
  }

  return (
    <div className="pdf-pages-preview">
      <div className="pages-grid">
        {pages.map((page) => {
          const isSelected = selectedPages.includes(page.pageNumber);
          const isHighlighted = highlightPages.includes(page.pageNumber);
          
          return (
            <div
              key={page.pageNumber}
              className={`page-thumbnail ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
            >
              <div className="page-thumbnail-number">
                {page.pageNumber}
              </div>
              {page.thumbnail ? (
                <img 
                  src={page.thumbnail} 
                  alt={`Página ${page.pageNumber}`}
                  className="page-thumbnail-image"
                />
              ) : (
                <div className="page-thumbnail-placeholder">
                  <FiFile />
                </div>
              )}
              {showActions && onPageAction && (
                <div className="page-thumbnail-actions">
                  <button
                    className="page-action-btn"
                    onClick={() => onPageAction(page.pageNumber, 'remove')}
                    aria-label={`Remover página ${page.pageNumber}`}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PDFPagesPreview;
