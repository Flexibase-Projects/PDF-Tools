import { useState, useEffect } from 'react';
import { downloadCompressedPDF, CompressOptions } from '../services/pdfCompress';
import FileUpload from '../components/common/FileUpload';
import FloatingUploadButton from '../components/common/FloatingUploadButton';
import DownloadButton from '../components/common/DownloadButton';
import LoadingOverlay from '../components/common/LoadingOverlay';
import ComparisonPreview from '../components/PDFViewer/ComparisonPreview';
import { useCounter } from '../contexts/CounterContext';
import { formatFileSize, isFileReadPermissionError, FILE_READ_ERROR_USER_MESSAGE } from '../utils/fileUtils';
import './PageStyles.css';
import './CompressPDF.css';

const CompressPDF = () => {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(80);
  const [originalSize, setOriginalSize] = useState(0);
  const [estimatedSize, setEstimatedSize] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFileReadError, setIsFileReadError] = useState(false);
  const { increment } = useCounter();

  useEffect(() => {
    if (file) {
      setOriginalSize(file.size);
      // Estimativa baseada na qualidade (aproximada)
      const compressionRatio = quality / 100;
      setEstimatedSize(Math.round(file.size * compressionRatio * 0.7)); // Fator de 0.7 para estimativa realista
    }
  }, [file, quality]);

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
    setIsFileReadError(false);

    try {
      const options: CompressOptions = { quality };
      const fileName = `pdf-comprimido-${Date.now()}.pdf`;
      await downloadCompressedPDF(file, options, fileName);
      // Incrementar contador no download
      await increment();
    } catch (err) {
      const isFileRead = isFileReadPermissionError(err);
      setError(isFileRead ? FILE_READ_ERROR_USER_MESSAGE : (err instanceof Error ? err.message : 'Erro ao comprimir PDF'));
      setIsFileReadError(isFileRead);
    } finally {
      setIsProcessing(false);
    }
  };

  const getQualityLabel = (value: number): string => {
    if (value >= 80) return 'Alta qualidade';
    if (value >= 50) return 'Qualidade média';
    if (value >= 30) return 'Qualidade baixa';
    return 'Máxima compressão';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Comprimir PDF</h1>
        <p>Diminua o tamanho do seu arquivo PDF, mantendo a melhor qualidade possível</p>
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
            <div className="compress-controls">
              <button className="btn-secondary" onClick={() => setFile(null)}>
                Trocar PDF
              </button>
            </div>

            <div className="compress-preview-section">
              <h3>Comparação de Qualidade</h3>
              <p className="section-hint">
                Compare a qualidade original com a versão comprimida. Passe o mouse sobre as imagens para ver detalhes ampliados.
              </p>
              <div className="compress-preview-wrapper">
                <ComparisonPreview
                  file={file}
                  quality={quality}
                  scale={1.0}
                />
              </div>
            </div>

            <div className="size-comparison">
              <div className="size-item">
                <span className="size-label">Tamanho original:</span>
                <span className="size-value">{formatFileSize(originalSize)}</span>
              </div>
              <div className="size-item estimated">
                <span className="size-label">Tamanho estimado:</span>
                <span className="size-value">{formatFileSize(estimatedSize)}</span>
              </div>
              <div className="size-item reduction">
                <span className="size-label">Redução estimada:</span>
                <span className="size-value">
                  {Math.round(((originalSize - estimatedSize) / originalSize) * 100)}%
                </span>
              </div>
            </div>

            <div className="quality-control">
              <div className="quality-header">
                <label htmlFor="quality-slider">Nível de compressão:</label>
                <span className="quality-value">{getQualityLabel(quality)}</span>
              </div>
              <input
                id="quality-slider"
                type="range"
                min="10"
                max="100"
                value={quality}
                onChange={(e) => setQuality(parseInt(e.target.value))}
                className="quality-slider"
              />
              <div className="quality-labels">
                <span>Máxima compressão</span>
                <span>Alta qualidade</span>
              </div>
            </div>

            <div className="compress-info">
              <p>
                <strong>Nota:</strong> A compressão no navegador tem limitações. 
                Para melhor compressão, considere usar ferramentas server-side especializadas.
              </p>
            </div>

            {error && (
              <div className={isFileReadError ? 'file-read-error-message' : 'error-message'}>
                {isFileReadError ? <p>{error}</p> : <span>{error}</span>}
              </div>
            )}

            <div className="action-section">
              <DownloadButton
                onClick={handleDownload}
                disabled={isProcessing || !file}
                fileName="PDF Comprimido"
              />
            </div>
          </>
        )}
      </div>

      <LoadingOverlay
        isVisible={isProcessing}
        message="Comprimindo PDF..."
        showProgress={false}
      />
    </div>
  );
};

export default CompressPDF;
