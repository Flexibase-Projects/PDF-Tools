import { useState, useEffect } from 'react';
import { PDFFile } from '../../types';
import { getPDFPageCount } from '../../utils/pdfUtils';
import { formatFileSize } from '../../utils/fileUtils';
import PDFPagesPreview from './PDFPagesPreview';
import { FiX, FiFile } from 'react-icons/fi';
import './PDFFilePreview.css';

interface PDFFilePreviewProps {
  file: PDFFile;
  onRemove?: () => void;
  showAllPages?: boolean;
  showActions?: boolean;
  onPageAction?: (pageNumber: number, action: string) => void;
  selectedPages?: number[];
  highlightPages?: number[];
}

const PDFFilePreview = ({
  file,
  onRemove,
  showAllPages = true,
  showActions = true,
  onPageAction,
  selectedPages = [],
  highlightPages = []
}: PDFFilePreviewProps) => {
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPageCount = async () => {
      try {
        const count = await getPDFPageCount(file.file);
        setTotalPages(count);
      } catch (error) {
        console.error('Erro ao carregar contagem de páginas:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPageCount();
  }, [file.file]);

  return (
    <div className="pdf-file-preview">
      <div className="pdf-file-header">
        <div className="pdf-file-info">
          <div className="pdf-file-icon">
            <FiFile />
          </div>
          <div className="pdf-file-details">
            <h3 className="pdf-file-name" title={file.name}>
              {file.name}
            </h3>
            <div className="pdf-file-meta">
              <span>{formatFileSize(file.size)}</span>
              {totalPages !== null && (
                <>
                  <span className="separator">•</span>
                  <span>{totalPages} página{totalPages !== 1 ? 's' : ''}</span>
                </>
              )}
            </div>
          </div>
        </div>
        {onRemove && (
          <button
            className="pdf-file-remove"
            onClick={onRemove}
            aria-label="Remover arquivo"
          >
            <FiX />
          </button>
        )}
      </div>

      {loading ? (
        <div className="pdf-file-loading">
          <div className="spinner" />
          <p>Carregando informações...</p>
        </div>
      ) : showAllPages ? (
        <PDFPagesPreview
          file={file.file}
          showActions={showActions}
          onPageAction={onPageAction}
          selectedPages={selectedPages}
          highlightPages={highlightPages}
        />
      ) : (
        <div className="pdf-file-single-preview">
          <PDFPagesPreview
            file={file.file}
            showActions={false}
            scale={0.6}
          />
        </div>
      )}
    </div>
  );
};

export default PDFFilePreview;
