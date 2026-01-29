import { useState } from 'react';
import { downloadPDFAsWord } from '../services/pdfToWord';
import FileUpload from '../components/common/FileUpload';
import FloatingUploadButton from '../components/common/FloatingUploadButton';
import DownloadButton from '../components/common/DownloadButton';
import LoadingOverlay from '../components/common/LoadingOverlay';
import PDFPagesPreview from '../components/PDFViewer/PDFPagesPreview';
import { useCounter } from '../contexts/CounterContext';
import './PageStyles.css';
import './PDFToWord.css';

const PDFToWord = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { increment } = useCounter();

  const handleFileSelected = async (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setError(null);
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
      const fileName = `documento-${Date.now()}.docx`;
      await downloadPDFAsWord(file, fileName);
      // Incrementar contador no download
      await increment();
    } catch (err) {
      setError(
        err instanceof Error 
          ? err.message 
          : 'Erro ao converter PDF para Word.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>PDF para Word</h1>
        <p>Converta seus PDFs para documentos Word editáveis (DOCX) com preservação de estrutura e formatação</p>
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
            <div className="word-controls">
              <button className="btn-secondary" onClick={() => setFile(null)}>
                Trocar PDF
              </button>
              <div className="file-info">
                <p><strong>Arquivo:</strong> {file.name}</p>
                <p><strong>Tamanho:</strong> {(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>

            <div className="word-preview-section">
              <h3>Preview do PDF</h3>
              <div className="word-preview-wrapper">
                <PDFPagesPreview
                  file={file}
                  showActions={false}
                  scale={0.6}
                  maxPages={1}
                />
              </div>
            </div>

            {error && (
              <div className="error-message">
                <span>{error}</span>
              </div>
            )}

            <div className="action-section">
              <DownloadButton
                onClick={handleDownload}
                disabled={isProcessing || !file}
                fileName="Documento Word"
              />
            </div>
          </>
        )}
      </div>

      <LoadingOverlay
        isVisible={isProcessing}
        message="Convertendo para Word..."
        showProgress={false}
      />
    </div>
  );
};

export default PDFToWord;
