import { useState, useRef, useEffect } from 'react';
import { FiAlertCircle, FiCopy } from 'react-icons/fi';
import FileUpload from '../components/common/FileUpload';
import FloatingUploadButton from '../components/common/FloatingUploadButton';
import DownloadButton from '../components/common/DownloadButton';
import LoadingOverlay from '../components/common/LoadingOverlay';
import SignaturePad, { type SignaturePadRef } from '../components/common/SignaturePad';
import SignaturePlacementPreview, {
  type SignaturePlacement,
  SIGNATURE_BASE_WIDTH_PERCENT,
  SIGNATURE_BASE_HEIGHT_PERCENT,
} from '../components/PDFViewer/SignaturePlacementPreview';
import { signPDF, downloadSignedPDF } from '../services/pdfSign';
import { useCounter } from '../contexts/CounterContext';
import { formatFileSize } from '../utils/fileUtils';
import { loadPDFPagesMetadata } from '../utils/pdfUtils';
import './PageStyles.css';
import './SignPDF.css';

type SignMode = 'now' | 'send-link';

const DEFAULT_PLACEMENT: SignaturePlacement = {
  leftPercent: 70,
  topPercent: 78,
  sizeScale: 1,
};

const SignPDF = () => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedPage, setSelectedPage] = useState(1);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [placement, setPlacement] = useState<SignaturePlacement>(DEFAULT_PLACEMENT);
  const [signMode, setSignMode] = useState<SignMode>('now');
  const [signedBlob, setSignedBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const signaturePadRef = useRef<SignaturePadRef>(null);
  const { increment } = useCounter();

  const [pagesMetadata, setPagesMetadata] = useState<Array<{ width: number; height: number }>>([]);

  useEffect(() => {
    if (!file) {
      setTotalPages(0);
      setSelectedPage(1);
      setPagesMetadata([]);
      setPageDimensions(null);
      return;
    }
    let cancelled = false;
    loadPDFPagesMetadata(file)
      .then((pages) => {
        if (cancelled) return;
        setTotalPages(pages.length);
        setSelectedPage(1);
        setPagesMetadata(pages.map((p) => ({ width: p.width, height: p.height })));
        if (pages[0]) setPageDimensions({ width: pages[0].width, height: pages[0].height });
      })
      .catch(() => {
        if (!cancelled) setPageDimensions(null);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    if (pagesMetadata.length === 0) return;
    const page = pagesMetadata[selectedPage - 1];
    setPageDimensions(page ? { width: page.width, height: page.height } : null);
  }, [pagesMetadata, selectedPage]);

  const handleFileSelected = async (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setSignedBlob(null);
      setError(null);
      setPlacement(DEFAULT_PLACEMENT);
      await increment();
    }
  };

  const handleSignNow = async () => {
    if (!file || !signaturePadRef.current || !pageDimensions) return;
    const dataUrl = signaturePadRef.current.getDataUrl();
    if (!dataUrl || signaturePadRef.current.isEmpty()) {
      setError('Desenhe sua assinatura no espaço indicado antes de continuar.');
      return;
    }

    const widthPercent = Math.min(100, SIGNATURE_BASE_WIDTH_PERCENT * placement.sizeScale);
    const heightPercent = Math.min(100, SIGNATURE_BASE_HEIGHT_PERCENT * placement.sizeScale);
    const signatureX = (placement.leftPercent / 100) * pageDimensions.width;
    const signatureY =
      pageDimensions.height -
      ((placement.topPercent + heightPercent) / 100) * pageDimensions.height;

    setIsProcessing(true);
    setError(null);
    setSignedBlob(null);

    try {
      const blob = await signPDF(file, dataUrl, {
        pageIndex: selectedPage - 1,
        signatureX,
        signatureY,
        signatureWidth: (widthPercent / 100) * pageDimensions.width,
        signatureHeight: (heightPercent / 100) * pageDimensions.height,
      });
      setSignedBlob(blob);
      await increment();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível assinar o PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!signedBlob) return;
    const baseName = file?.name?.replace(/\.pdf$/i, '') ?? 'documento';
    await downloadSignedPDF(signedBlob, `${baseName}-assinado.pdf`);
    await increment();
  };

  const signRequestLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/sign/request?token=${file?.name ? encodeURIComponent(file.name) : 'doc'}`
      : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(signRequestLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      setError('Não foi possível copiar o link.');
    }
  };

  return (
    <div className="page-container">
      <div className="sign-disclaimer">
        <FiAlertCircle size={20} aria-hidden />
        <div>
          <strong>Uso interno Flexibase</strong>
          <p>
            Este sistema de assinatura funciona apenas dentro do ambiente Flexibase. As assinaturas
            têm valor de registro interno e não substituem certificados digitais (ICP-Brasil).
          </p>
        </div>
      </div>

      <div className="page-header">
        <h1>Assinar PDF</h1>
        <p>
          Assine documentos PDF com sua assinatura desenhada. Você pode assinar agora ou enviar um
          link para outra pessoa assinar (uso interno).
        </p>
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
            <FloatingUploadButton onFilesSelected={handleFileSelected} multiple={false} />

            <div className="sign-controls">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setFile(null);
                  setSignedBlob(null);
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

            <div className="sign-page-section">
              <h3 className="sign-section-title">Página e posição da assinatura</h3>
              <p className="sign-section-hint">
                Selecione a página e arraste o quadro para definir onde a assinatura aparecerá.
              </p>
              {totalPages > 0 && (
                <div className="sign-page-selector">
                  <label htmlFor="sign-page-select" className="sign-page-label">
                    Página a assinar:
                  </label>
                  <select
                    id="sign-page-select"
                    className="sign-page-select"
                    value={selectedPage}
                    onChange={(e) => setSelectedPage(Number(e.target.value))}
                  >
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        Página {n}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {pageDimensions && (
                <>
                  <SignaturePlacementPreview
                    file={file}
                    pageNumber={selectedPage}
                    pageWidth={pageDimensions.width}
                    pageHeight={pageDimensions.height}
                    placement={placement}
                    onPlacementChange={setPlacement}
                    signatureDataUrl={signatureDataUrl}
                    className="sign-placement-preview"
                  />
                  <div className="sign-size-control">
                    <label htmlFor="sign-size-slider" className="sign-size-label">
                      Tamanho da assinatura: {Math.round(placement.sizeScale * 100)}%
                    </label>
                    <input
                      id="sign-size-slider"
                      type="range"
                      min={50}
                      max={200}
                      value={Math.round(placement.sizeScale * 100)}
                      onChange={(e) =>
                        setPlacement((p) => ({ ...p, sizeScale: Number(e.target.value) / 100 }))
                      }
                      className="sign-size-slider"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="sign-type-note">
              <span>Assinatura:</span>
              <span>
                Desenho na tela (uso interno). Para assinatura eletrônica validada por certificado
                digital, utilize ferramentas específicas fora deste ambiente.
              </span>
            </div>

            <SignaturePad
              ref={signaturePadRef}
              onSignatureChange={setHasSignature}
              onSignatureDataUrlChange={setSignatureDataUrl}
              className="sign-pad-section"
            />

            <div className="sign-mode-tabs">
              <button
                type="button"
                className={`sign-mode-tab ${signMode === 'now' ? 'active' : ''}`}
                onClick={() => setSignMode('now')}
              >
                Assinar agora
              </button>
              <button
                type="button"
                className={`sign-mode-tab ${signMode === 'send-link' ? 'active' : ''}`}
                onClick={() => setSignMode('send-link')}
              >
                Enviar link para assinatura
              </button>
            </div>

            {signMode === 'now' && (
              <div className="action-section sign-actions">
                {!signedBlob ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleSignNow}
                    disabled={isProcessing || !hasSignature}
                  >
                    Aplicar assinatura no PDF
                  </button>
                ) : (
                  <DownloadButton
                    onClick={handleDownload}
                    disabled={isProcessing}
                    fileName="PDF assinado"
                  />
                )}
              </div>
            )}

            {signMode === 'send-link' && (
              <div className="sign-link-section">
                <p className="sign-link-hint">
                  O link abaixo abre a tela de assinatura para outra pessoa (ambiente interno
                  Flexibase). Copie e envie por e-mail ou mensagem.
                </p>
                <div className="sign-link-box">
                  <code className="sign-link-url">{signRequestLink}</code>
                  <button
                    type="button"
                    className="btn-secondary sign-link-copy"
                    onClick={handleCopyLink}
                    title="Copiar link"
                  >
                    <FiCopy size={18} />
                    {linkCopied ? 'Copiado!' : 'Copiar link'}
                  </button>
                </div>
                <p className="sign-link-disclaimer">
                  A funcionalidade de assinatura via link depende de integração interna. Por enquanto,
                  o destinatário pode acessar esta mesma ferramenta e assinar o documento que você
                  enviar por outro meio.
                </p>
              </div>
            )}

            {error && (
              <div className="error-message">
                <span>{error}</span>
              </div>
            )}
          </>
        )}
      </div>

      <LoadingOverlay
        isVisible={isProcessing}
        message="Aplicando assinatura..."
        showProgress={false}
      />
    </div>
  );
};

export default SignPDF;
