import { useState, useCallback, useMemo } from 'react';
import { PDFFile, MergedPage } from '../types';
import { generateId } from '../utils/fileUtils';
import FileUpload from '../components/common/FileUpload';
import FloatingUploadButton from '../components/common/FloatingUploadButton';
import DownloadButton from '../components/common/DownloadButton';
import LoadingOverlay from '../components/common/LoadingOverlay';
import MergedPagesPreview from '../components/PDFViewer/MergedPagesPreview';
import { downloadMergedPDFFromPages } from '../services/pdfMerge';
import { useCounter } from '../contexts/CounterContext';
import { FiX, FiUploadCloud, FiGrid, FiDownload } from 'react-icons/fi';
import './PageStyles.css';
import './MergePDF.css';

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

const getFileColor = (index: number): string => {
  return PDF_COLORS[index % PDF_COLORS.length];
};

const MergePDF = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [mergedPages, setMergedPages] = useState<MergedPage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { increment } = useCounter();

  const handleFilesSelected = async (selectedFiles: File[]) => {
    // Incrementar contador no upload
    if (selectedFiles.length > 0) {
      await increment();
    }
    // #region agent log
    fetch('http://127.0.0.1:7248/ingest/6c3d1188-3daf-49fd-8b7a-e5fe63eb0bac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MergePDF.tsx:38',message:'handleFilesSelected called',data:{fileCount:selectedFiles.length,fileNames:selectedFiles.map(f=>f.name)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    const newFiles: PDFFile[] = selectedFiles.map((file) => ({
      id: generateId(),
      file,
      name: file.name,
      size: file.size,
    }));

    // #region agent log
    fetch('http://127.0.0.1:7248/ingest/6c3d1188-3daf-49fd-8b7a-e5fe63eb0bac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MergePDF.tsx:46',message:'About to setFiles',data:{newFilesCount:newFiles.length,existingFilesCount:files.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    setFiles((prev) => [...prev, ...newFiles]);
    setError(null);
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
    // Remover páginas do arquivo removido
    setMergedPages((prev) => prev.filter((page) => page.fileId !== id));
  };

  const handlePagesChange = useCallback((pages: MergedPage[]) => {
    setMergedPages(pages);
  }, []);

  const handlePageRemove = (pageId: string) => {
    // A remoção já é feita no componente, apenas atualizamos o estado
    setMergedPages((prev) => {
      const newPages = prev.filter((p) => p.id !== pageId);
      return newPages.map((page, index) => ({
        ...page,
        displayPageNumber: index + 1,
      }));
    });
  };

  const handleDownload = async () => {
    if (mergedPages.length === 0) {
      setError('Adicione pelo menos uma página');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const fileName = `pdf-mesclado-${Date.now()}.pdf`;
      await downloadMergedPDFFromPages(mergedPages, fileName);
      // Incrementar contador no download
      await increment();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao mesclar PDFs');
    } finally {
      setIsProcessing(false);
    }
  };

  // Memoizar o array de files para evitar loop infinito no useEffect
  const filesForPreview = useMemo(() => {
    return files.map((f) => ({ id: f.id, file: f.file, name: f.name }));
  }, [files]);

  return (
    <div className="page-container merge-page">
      <div className="page-content merge-page-content">
        {files.length === 0 ? (
          <div className="merge-empty-state">
            <div className="merge-header-compact">
              <h2 className="merge-tutorial-title">Como juntar e organizar seus PDFs</h2>
              <p className="merge-tutorial-subtitle">
                Simples em 3 passos. Seus arquivos não saem do seu navegador.
              </p>
            </div>
            <div className="merge-tutorial-cards">
              <div className="merge-tutorial-card">
                <div className="merge-tutorial-card-icon merge-tutorial-card-icon--upload">
                  <FiUploadCloud size={20} />
                </div>
                <span className="merge-tutorial-card-step">Passo 1</span>
                <h3 className="merge-tutorial-card-title">Envie os PDFs</h3>
                <p className="merge-tutorial-card-desc">
                  Arraste ou clique para adicionar um ou vários arquivos. Tudo processado no seu dispositivo.
                </p>
              </div>
              <div className="merge-tutorial-card-arrow" aria-hidden="true">→</div>
              <div className="merge-tutorial-card">
                <div className="merge-tutorial-card-icon merge-tutorial-card-icon--order">
                  <FiGrid size={20} />
                </div>
                <span className="merge-tutorial-card-step">Passo 2</span>
                <h3 className="merge-tutorial-card-title">Organize as páginas</h3>
                <p className="merge-tutorial-card-desc">
                  Arraste as miniaturas para definir a ordem. Remova páginas passando o mouse e clicando no X.
                </p>
              </div>
              <div className="merge-tutorial-card-arrow" aria-hidden="true">→</div>
              <div className="merge-tutorial-card">
                <div className="merge-tutorial-card-icon merge-tutorial-card-icon--download">
                  <FiDownload size={20} />
                </div>
                <span className="merge-tutorial-card-step">Passo 3</span>
                <h3 className="merge-tutorial-card-title">Baixe o resultado</h3>
                <p className="merge-tutorial-card-desc">
                  Gere um único PDF mesclado e baixe direto no seu computador.
                </p>
              </div>
            </div>
            <div className="merge-upload-wrapper">
              <p className="merge-upload-label">Comece enviando seus arquivos</p>
              <FileUpload
                onFilesSelected={handleFilesSelected}
                multiple={true}
                className="page-upload merge-upload-zone"
              />
            </div>
          </div>
        ) : (
          <FloatingUploadButton
            onFilesSelected={handleFilesSelected}
            multiple={true}
          />
        )}

        {files.length > 0 && (
          <>
            <div className="merge-steps">
              <div className="merge-step merge-step-done">
                <span className="merge-step-num">1</span>
                <span>Arquivos</span>
              </div>
              <div className="merge-step-divider" />
              <div className={`merge-step ${mergedPages.length > 0 ? 'merge-step-done' : 'merge-step-current'}`}>
                <span className="merge-step-num">2</span>
                <span>Ordenar páginas</span>
              </div>
              <div className="merge-step-divider" />
              <div className={`merge-step ${mergedPages.length > 0 ? 'merge-step-current' : 'merge-step-pending'}`}>
                <span className="merge-step-num">3</span>
                <span>Baixar</span>
              </div>
            </div>
            {/* #region agent log */}
            {(() => {
              fetch('http://127.0.0.1:7248/ingest/6c3d1188-3daf-49fd-8b7a-e5fe63eb0bac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MergePDF.tsx:110',message:'Render condition check',data:{filesLength:files.length,isLoadingPages,mergedPagesLength:mergedPages.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
              return null;
            })()}
            {/* #endregion */}
            {!isLoadingPages && mergedPages.length > 0 && (
              <div className="files-section">
                <div className="files-header">
                  <div>
                    <h2>Arquivos selecionados ({files.length})</h2>
                    <p className="section-hint">
                      Arraste as páginas para reordená-las. Passe o mouse sobre uma página para excluí-la.
                    </p>
                  </div>
                  <div className="files-list-header">
                    {files.map((file) => (
                      <div key={file.id} className="file-header-item">
                        <span
                          className="file-color-indicator"
                          style={{
                            backgroundColor: getFileColor(files.findIndex((f) => f.id === file.id)),
                          }}
                        />
                        <span className="file-name" title={file.name}>
                          {file.name}
                        </span>
                        <button
                          className="file-remove-header"
                          onClick={() => handleRemoveFile(file.id)}
                          aria-label={`Remover ${file.name}`}
                        >
                          <FiX />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="merge-preview-section">
              {/* #region agent log */}
              {(() => {
                fetch('http://127.0.0.1:7248/ingest/6c3d1188-3daf-49fd-8b7a-e5fe63eb0bac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MergePDF.tsx:152',message:'Rendering MergedPagesPreview',data:{filesLength:files.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                return null;
              })()}
              {/* #endregion */}
              <MergedPagesPreview
                files={filesForPreview}
                onPagesChange={handlePagesChange}
                onPageRemove={handlePageRemove}
                onLoadingChange={setIsLoadingPages}
                scale={0.25}
              />
            </div>
          </>
        )}

        {error && (
          <div className="error-message">
            <span>{error}</span>
          </div>
        )}

        {mergedPages.length > 0 && (
          <div className="action-section">
            <DownloadButton
              onClick={handleDownload}
              disabled={isProcessing || mergedPages.length === 0}
              fileName="PDF Processado"
            />
          </div>
        )}
      </div>

      <LoadingOverlay
        isVisible={isProcessing}
        message="Processando PDF..."
        showProgress={false}
      />
    </div>
  );
};

export default MergePDF;
