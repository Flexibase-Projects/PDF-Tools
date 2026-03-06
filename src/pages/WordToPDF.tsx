import { useState } from 'react';
import { downloadWordAsPdf } from '../services/wordToPdf';
import { validateWordFile } from '../utils/fileUtils';
import FileUpload from '../components/common/FileUpload';
import FloatingUploadButton from '../components/common/FloatingUploadButton';
import DownloadButton from '../components/common/DownloadButton';
import LoadingOverlay from '../components/common/LoadingOverlay';
import { useCounter } from '../contexts/CounterContext';
import './PageStyles.css';
import './PDFToWord.css';

const ACCEPT_WORD = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const WordToPDF = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { increment } = useCounter();

  const handleFileSelected = async (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setError(null);
      await increment();
    }
  };

  const handleDownload = async () => {
    if (!file) {
      setError('Adicione um arquivo Word (DOCX)');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const baseName = file.name.replace(/\.docx?$/i, '');
      const fileName = `${baseName || 'documento'}-${Date.now()}.pdf`;
      await downloadWordAsPdf(file, fileName);
      await increment();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao converter Word para PDF.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Word para PDF</h1>
        <p>
          Converta documentos Word (DOCX) para PDF. Mantenha a formatação e o
          layout.
        </p>
      </div>

      <div className="page-content">
        {!file ? (
          <FileUpload
            onFilesSelected={handleFileSelected}
            multiple={false}
            className="page-upload"
            accept={ACCEPT_WORD}
            validateFile={validateWordFile}
            uploadText={{
              main: 'Clique ou arraste um arquivo Word (DOCX) aqui',
              hint: 'Selecione um arquivo .docx (máx. 50MB)',
            }}
          />
        ) : (
          <>
            <FloatingUploadButton
              onFilesSelected={handleFileSelected}
              multiple={false}
              accept={ACCEPT_WORD}
              validateFile={validateWordFile}
              label="Trocar arquivo"
              title="Clique ou arraste outro DOCX"
            />
            <div className="word-controls">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => {
                  setFile(null);
                  setError(null);
                }}
              >
                Trocar arquivo
              </button>
              <div className="file-info">
                <p>
                  <strong>Arquivo:</strong> {file.name}
                </p>
                <p>
                  <strong>Tamanho:</strong>{' '}
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
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
                fileName="PDF"
              />
            </div>
          </>
        )}
      </div>

      <LoadingOverlay
        isVisible={isProcessing}
        message="Convertendo Word para PDF..."
        showProgress={false}
      />
    </div>
  );
};

export default WordToPDF;
