import { useEffect, useState } from 'react';
import { loadPDFPages } from '../../utils/pdfUtils';
import { MergedPage } from '../../types';
import { generateId } from '../../utils/fileUtils';
import { FiFile, FiX } from 'react-icons/fi';
import LDRSLoader from '../common/LDRSLoader';
import './MergedPagesPreview.css';

interface MergedPagesPreviewProps {
  files: Array<{ id: string; file: File; name: string }>;
  onPagesChange?: (pages: MergedPage[]) => void;
  onPageRemove?: (pageId: string) => void;
  onLoadingChange?: (loading: boolean) => void;
  scale?: number;
}

// Cores para diferentes PDFs
const PDF_COLORS = [
  '#1e40af', // Blue Dark
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
];

const MergedPagesPreview = ({
  files,
  onPagesChange,
  onPageRemove,
  onLoadingChange,
  scale = 0.25,
}: MergedPagesPreviewProps) => {
  const [pages, setPages] = useState<MergedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [hoveredPageId, setHoveredPageId] = useState<string | null>(null);

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7248/ingest/6c3d1188-3daf-49fd-8b7a-e5fe63eb0bac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MergedPagesPreview.tsx:43',message:'useEffect triggered',data:{filesLength:files.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const loadAllPages = async () => {
      if (files.length === 0) {
        setPages([]);
        setLoading(false);
        return;
      }

      // #region agent log
      fetch('http://127.0.0.1:7248/ingest/6c3d1188-3daf-49fd-8b7a-e5fe63eb0bac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MergedPagesPreview.tsx:51',message:'Starting to load pages',data:{filesCount:files.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      setLoading(true);
      setError(null);
      onLoadingChange?.(true);

      try {
        const allPages: MergedPage[] = [];
        let displayPageNumber = 1;

        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
          const fileData = files[fileIndex];
          const loadedPages = await loadPDFPages(fileData.file, scale);

          for (const page of loadedPages) {
            allPages.push({
              id: generateId(),
              fileId: fileData.id,
              fileIndex,
              originalPageNumber: page.pageNumber,
              displayPageNumber: displayPageNumber++,
              thumbnail: page.thumbnail,
              file: fileData.file,
            });
          }
        }

        // #region agent log
        fetch('http://127.0.0.1:7248/ingest/6c3d1188-3daf-49fd-8b7a-e5fe63eb0bac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MergedPagesPreview.tsx:76',message:'Pages loaded successfully',data:{pagesCount:allPages.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        setPages(allPages);
      } catch (err) {
        // #region agent log
        fetch('http://127.0.0.1:7248/ingest/6c3d1188-3daf-49fd-8b7a-e5fe63eb0bac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MergedPagesPreview.tsx:78',message:'Error loading pages',data:{error:err instanceof Error ? err.message : String(err)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        console.error('Erro ao carregar páginas:', err);
        setError('Erro ao carregar preview das páginas');
      } finally {
        setLoading(false);
        onLoadingChange?.(false);
        // #region agent log
        fetch('http://127.0.0.1:7248/ingest/6c3d1188-3daf-49fd-8b7a-e5fe63eb0bac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MergedPagesPreview.tsx:85',message:'Loading finished',data:{pagesCount:pages.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
      }
    };

    loadAllPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, scale]);

  // Notificar mudanças nas páginas após setPages
  useEffect(() => {
    if (!loading && pages.length > 0) {
      onPagesChange?.(pages);
    }
  }, [pages, loading, onPagesChange]);

  const handleDragStart = (pageId: string) => {
    setDraggedPageId(pageId);
  };

  const handleDragOver = (e: React.DragEvent, targetPageId: string) => {
    e.preventDefault();
    if (draggedPageId === null || draggedPageId === targetPageId) return;

    setPages((prev) => {
      const newPages = [...prev];
      const draggedIndex = newPages.findIndex((p) => p.id === draggedPageId);
      const targetIndex = newPages.findIndex((p) => p.id === targetPageId);

      if (draggedIndex === -1 || targetIndex === -1) return prev;

      const [removed] = newPages.splice(draggedIndex, 1);
      newPages.splice(targetIndex, 0, removed);

      // Atualizar displayPageNumber
      const updatedPages = newPages.map((page, index) => ({
        ...page,
        displayPageNumber: index + 1,
      }));

      onPagesChange?.(updatedPages);
      return updatedPages;
    });
  };

  const handleDragEnd = () => {
    setDraggedPageId(null);
  };

  const handleRemovePage = (pageId: string) => {
    setPages((prev) => {
      const newPages = prev.filter((p) => p.id !== pageId);
      const updatedPages = newPages.map((page, index) => ({
        ...page,
        displayPageNumber: index + 1,
      }));
      onPagesChange?.(updatedPages);
      onPageRemove?.(pageId);
      return updatedPages;
    });
  };

  const getPageColor = (fileIndex: number): string => {
    return PDF_COLORS[fileIndex % PDF_COLORS.length];
  };

  if (loading) {
    return (
      <div className="merged-pages-preview-loading">
        <LDRSLoader type="tailspin" size={48} color="var(--primary-color)" />
        <p>Carregando páginas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="merged-pages-preview-error">
        <FiFile />
        <p>{error}</p>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="merged-pages-preview-empty">
        <p>Nenhuma página encontrada</p>
      </div>
    );
  }

  return (
    <div className="merged-pages-preview">
      <div className="pages-grid">
        {pages.map((page) => {
          const isDragging = draggedPageId === page.id;
          const isHovered = hoveredPageId === page.id;
          const pageColor = getPageColor(page.fileIndex);

          return (
            <div
              key={page.id}
              className={`page-thumbnail ${isDragging ? 'dragging' : ''}`}
              draggable
              onDragStart={() => handleDragStart(page.id)}
              onDragOver={(e) => handleDragOver(e, page.id)}
              onDragEnd={handleDragEnd}
              onMouseEnter={() => setHoveredPageId(page.id)}
              onMouseLeave={() => setHoveredPageId(null)}
            >
              <div
                className="page-thumbnail-number"
                style={{ backgroundColor: pageColor }}
              >
                {page.displayPageNumber}
              </div>
              {page.thumbnail ? (
                <img
                  src={page.thumbnail}
                  alt={`Página ${page.displayPageNumber}`}
                  className="page-thumbnail-image"
                />
              ) : (
                <div className="page-thumbnail-placeholder">
                  <FiFile />
                </div>
              )}
              {isHovered && (
                <div className="page-thumbnail-actions">
                  <button
                    className="page-action-btn"
                    onClick={() => handleRemovePage(page.id)}
                    aria-label={`Remover página ${page.displayPageNumber}`}
                  >
                    <FiX />
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

export default MergedPagesPreview;
