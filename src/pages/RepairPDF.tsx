import { useState } from 'react';
import FileUpload from '../components/common/FileUpload';
import FloatingUploadButton from '../components/common/FloatingUploadButton';
import DownloadButton from '../components/common/DownloadButton';
import LoadingOverlay from '../components/common/LoadingOverlay';
import {
  repairPDF,
  getRepairLabel,
  downloadRepairedPDF,
  type RepairResult,
  type RepairKind,
} from '../services/pdfRepair';
import { useCounter } from '../contexts/CounterContext';
import { formatFileSize } from '../utils/fileUtils';
import './PageStyles.css';
import './RepairPDF.css';

const RepairPDF = () => {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<RepairResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { increment } = useCounter();

  const handleFileSelected = async (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setResult(null);
      setError(null);
      await increment();
    }
  };

  const handleRepair = async () => {
    if (!file) {
      setError('Adicione um arquivo PDF');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const repairResult = await repairPDF(file);
      setResult(repairResult);
      await increment();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível reparar o PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    await downloadRepairedPDF(result, `pdf-reparado-${Date.now()}.pdf`);
    await increment();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Reparar PDF</h1>
        <p>Repare PDFs corrompidos ou danificados. O reparo aplicado é exibido após o processamento.</p>
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
            <div className="repair-controls">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setError(null);
                }}
              >
                Trocar PDF
              </button>
            </div>

            <div className="repair-file-info">
              <span className="repair-file-name">{file.name}</span>
              <span className="repair-file-size">{formatFileSize(file.size)}</span>
            </div>

            {result && (
              <div className="repair-feedback">
                <h3>Reparos aplicados</h3>
                <ul className="repair-list">
                  {result.repairs.map((kind: RepairKind) => (
                    <li key={kind}>{getRepairLabel(kind)}</li>
                  ))}
                </ul>
                <p className="repair-meta">
                  {result.pageCount} página(s) no PDF reparado.
                </p>
              </div>
            )}

            {error && (
              <div className="error-message">
                <span>{error}</span>
              </div>
            )}

            <div className="action-section repair-actions">
              {!result ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleRepair}
                  disabled={isProcessing || !file}
                >
                  Reparar PDF
                </button>
              ) : (
                <DownloadButton
                  onClick={handleDownload}
                  disabled={isProcessing}
                  fileName="PDF reparado"
                />
              )}
            </div>
          </>
        )}
      </div>

      <LoadingOverlay
        isVisible={isProcessing}
        message="Reparando PDF..."
        showProgress={false}
      />
    </div>
  );
};

export default RepairPDF;
