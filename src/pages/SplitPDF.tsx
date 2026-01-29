import { useState, useEffect, useMemo } from 'react';
import { PDFDocument } from 'pdf-lib';
import { SplitOptions, downloadSplitPDFs } from '../services/pdfSplit';
import FileUpload from '../components/common/FileUpload';
import FloatingUploadButton from '../components/common/FloatingUploadButton';
import DownloadButton from '../components/common/DownloadButton';
import LoadingOverlay from '../components/common/LoadingOverlay';
import PDFPagesPreview from '../components/PDFViewer/PDFPagesPreview';
import { useCounter } from '../contexts/CounterContext';
import { FiX } from 'react-icons/fi';
import './PageStyles.css';
import './SplitPDF.css';

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

const SplitPDF = () => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [mode, setMode] = useState<SplitOptions['mode']>('range');
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const [singlePage, setSinglePage] = useState(1);
  const [downloadAsZip, setDownloadAsZip] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { increment } = useCounter();

  const loadPDFInfo = async (pdfFile: File) => {
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const pageCount = pdf.getPageCount();
      
      setTotalPages(pageCount);
      setEndPage(pageCount);
      setSinglePage(1);
      setError(null);
    } catch (err) {
      setError('Erro ao carregar PDF. Verifique se o arquivo é válido.');
      console.error(err);
    }
  };

  const handleFileSelected = async (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      loadPDFInfo(files[0]);
      // Incrementar contador no upload
      await increment();
    }
  };

  const handleDownload = async () => {
    if (!file) {
      setError('Adicione um arquivo PDF');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const options: SplitOptions = {
        mode,
        startPage: mode === 'range' ? startPage : undefined,
        endPage: mode === 'range' ? endPage : undefined,
        pageNumber: mode === 'single' ? singlePage : undefined,
      };

      await downloadSplitPDFs(file, options, downloadAsZip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao dividir PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (file && totalPages > 0) {
      if (endPage > totalPages) setEndPage(totalPages);
      if (startPage > totalPages) setStartPage(totalPages);
      if (singlePage > totalPages) setSinglePage(totalPages);
    }
  }, [totalPages, file, endPage, startPage, singlePage]);

  // Calcular páginas destacadas baseado no modo selecionado
  const highlightPages = useMemo(() => {
    if (!file || totalPages === 0) return [];
    
    if (mode === 'single' && singlePage) {
      return [singlePage];
    } else if (mode === 'range' && startPage && endPage) {
      return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
    } else if (mode === 'all') {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    return [];
  }, [mode, startPage, endPage, singlePage, totalPages, file]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Dividir PDF</h1>
        <p>Selecione um intervalo de páginas, separe uma página ou converta cada página em um PDF independente</p>
      </div>

      <div className="page-content">
        {!file ? (
          <FileUpload
            onFilesSelected={handleFileSelected}
            multiple={false}
            className="page-upload"
          />
        ) : (
          <>
            <FloatingUploadButton
              onFilesSelected={handleFileSelected}
              multiple={false}
            />

            {file && (
              <div className="files-section">
                <div className="files-header">
                  <div>
                    <h2>Arquivo selecionado</h2>
                    <p className="section-hint">
                      Selecione um intervalo de páginas, separe uma página ou converta cada página em um PDF independente.
                    </p>
                  </div>
                  <div className="files-list-header">
                    <div className="file-header-item">
                      <span
                        className="file-color-indicator"
                        style={{
                          backgroundColor: getFileColor(0),
                        }}
                      />
                      <span className="file-name" title={file.name}>
                        {file.name}
                      </span>
                      <span className="pdf-info">({totalPages} páginas)</span>
                      <button
                        className="file-remove-header"
                        onClick={() => setFile(null)}
                        aria-label={`Remover ${file.name}`}
                      >
                        <FiX />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="split-modes">
              <div className="mode-selector">
                <label className="mode-option">
                  <input
                    type="radio"
                    name="splitMode"
                    value="range"
                    checked={mode === 'range'}
                    onChange={() => setMode('range')}
                  />
                  <span>Intervalo de páginas</span>
                </label>
                <label className="mode-option">
                  <input
                    type="radio"
                    name="splitMode"
                    value="single"
                    checked={mode === 'single'}
                    onChange={() => setMode('single')}
                  />
                  <span>Página única</span>
                </label>
                <label className="mode-option">
                  <input
                    type="radio"
                    name="splitMode"
                    value="all"
                    checked={mode === 'all'}
                    onChange={() => setMode('all')}
                  />
                  <span>Todas as páginas</span>
                </label>
              </div>

              {mode === 'range' && (
                <div className="range-controls">
                  <div className="input-group">
                    <label>Página inicial:</label>
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={startPage}
                      onChange={(e) => setStartPage(Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1)))}
                    />
                  </div>
                  <div className="input-group">
                    <label>Página final:</label>
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={endPage}
                      onChange={(e) => setEndPage(Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1)))}
                    />
                  </div>
                </div>
              )}

              {mode === 'single' && (
                <div className="single-controls">
                  <div className="input-group">
                    <label>Número da página:</label>
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={singlePage}
                      onChange={(e) => setSinglePage(Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1)))}
                    />
                  </div>
                </div>
              )}

              {mode === 'all' && (
                <div className="all-info">
                  <p>Serão criados {totalPages} arquivos PDF, um para cada página.</p>
                </div>
              )}

              {(mode === 'all' || (mode === 'range' && endPage - startPage + 1 > 1)) && (
                <div className="zip-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={downloadAsZip}
                      onChange={(e) => setDownloadAsZip(e.target.checked)}
                    />
                    <span>Baixar como arquivo ZIP</span>
                  </label>
                </div>
              )}
            </div>

            {file && (
              <div className="split-preview-section">
                <h3>Preview de todas as páginas:</h3>
                <p className="section-hint">
                  {mode === 'single' && `Página ${singlePage} será extraída`}
                  {mode === 'range' && `Páginas ${startPage} a ${endPage} serão extraídas`}
                  {mode === 'all' && 'Todas as páginas serão separadas em arquivos individuais'}
                </p>
                <div className="preview-content">
                  <PDFPagesPreview
                    file={file}
                    showActions={false}
                    highlightPages={highlightPages}
                    scale={0.25}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="error-message">
                <span>{error}</span>
              </div>
            )}

            <div className="action-section">
              <DownloadButton
                onClick={handleDownload}
                disabled={isProcessing || !file}
                fileName="PDF Dividido"
              />
            </div>
          </>
        )}
      </div>

      <LoadingOverlay
        isVisible={isProcessing}
        message="Dividindo PDF..."
        showProgress={false}
      />
    </div>
  );
};

export default SplitPDF;
