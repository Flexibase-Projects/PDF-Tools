import { useState, useCallback, useRef } from 'react';
import FileUpload from '../components/common/FileUpload';
import DownloadButton from '../components/common/DownloadButton';
import LoadingOverlay from '../components/common/LoadingOverlay';
import PDFPreview from '../components/PDFViewer/PDFPreview';
import {
  applyTextWatermark,
  applyImageWatermark,
  downloadWatermarkedPDF,
  type WatermarkPosition,
  type TextWatermarkOptions,
  type ImageWatermarkOptions,
} from '../services/pdfWatermark';
import { validateImageFile } from '../utils/fileUtils';
import { useCounter } from '../contexts/CounterContext';
import { FiType, FiImage, FiUploadCloud } from 'react-icons/fi';
import './PageStyles.css';
import './WatermarkPDF.css';

/** Grid 3×3: ordem visual (sup.esq → sup.dir, meio, inf.esq → inf.dir). label = texto curto, title = tooltip. */
const POSITION_OPTIONS: { value: WatermarkPosition; label: string; title: string }[] = [
  { value: 'top-left', label: '↖', title: 'Superior esquerdo' },
  { value: 'top-center', label: '↑', title: 'Superior centro' },
  { value: 'top-right', label: '↗', title: 'Superior direito' },
  { value: 'middle-left', label: '←', title: 'Meio esquerdo' },
  { value: 'center', label: '●', title: 'Centro' },
  { value: 'middle-right', label: '→', title: 'Meio direito' },
  { value: 'bottom-left', label: '↙', title: 'Inferior esquerdo' },
  { value: 'bottom-center', label: '↓', title: 'Inferior centro' },
  { value: 'bottom-right', label: '↘', title: 'Inferior direito' },
];

const WatermarkPDF = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [watermarkType, setWatermarkType] = useState<'text' | 'image' | null>(null);
  const [textOptions, setTextOptions] = useState<TextWatermarkOptions>({
    text: 'CONFIDENCIAL',
    position: 'center',
    opacity: 0.5,
    fontSize: 24,
    rotation: 0,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageOptions, setImageOptions] = useState<ImageWatermarkOptions>({
    position: 'center',
    rotation: 0,
    scale: 0.5,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const { increment } = useCounter();

  const handlePdfSelected = useCallback(
    async (files: File[]) => {
      if (files.length > 0) {
        setPdfFile(files[0]);
        setWatermarkType(null);
        setImageFile(null);
        setError(null);
        await increment();
      }
    },
    [increment]
  );

  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setImageError(validation.error ?? 'Arquivo inválido');
      setImageFile(null);
      return;
    }
    setImageError(null);
    setImageFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = async () => {
    if (!pdfFile) return;
    if (watermarkType === 'text') {
      if (!textOptions.text.trim()) {
        setError('Digite o texto da marca d\'água.');
        return;
      }
    } else if (watermarkType === 'image') {
      if (!imageFile) {
        setError('Selecione uma imagem para a marca d\'água.');
        return;
      }
    }

    setIsProcessing(true);
    setError(null);

    try {
      let blob: Blob;
      if (watermarkType === 'text') {
        blob = await applyTextWatermark(pdfFile, textOptions);
      } else if (watermarkType === 'image' && imageFile) {
        blob = await applyImageWatermark(pdfFile, imageFile, imageOptions);
      } else {
        setError('Configure a marca d\'água.');
        setIsProcessing(false);
        return;
      }
      await downloadWatermarkedPDF(blob);
      await increment();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aplicar marca d\'água.');
    } finally {
      setIsProcessing(false);
    }
  };

  const canDownload =
    pdfFile &&
    watermarkType &&
    (watermarkType === 'image' ? imageFile : textOptions.text.trim().length > 0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="page-container watermark-page">
      <div className="page-header">
        <h1>Marca D&apos;água</h1>
        <p>Adicione marca d&apos;água de texto ou imagem aos seus PDFs.</p>
      </div>

      <div className="page-content watermark-content">
        {!pdfFile ? (
          <div className="watermark-empty">
            <p className="watermark-empty-hint">Envie um PDF para começar.</p>
            <FileUpload
              onFilesSelected={handlePdfSelected}
              multiple={false}
              className="page-upload watermark-upload"
            />
          </div>
        ) : (
          <>
            <div className="watermark-file-info">
              <FiUploadCloud size={18} />
              <span title={pdfFile.name}>{pdfFile.name}</span>
            </div>

            {watermarkType === null ? (
              <div className="watermark-type-choice">
                <p className="watermark-type-label">Tipo de marca d&apos;água</p>
                <div className="watermark-type-buttons">
                  <button
                    type="button"
                    className="watermark-type-btn"
                    onClick={() => setWatermarkType('text')}
                  >
                    <FiType size={24} />
                    <span>Texto</span>
                  </button>
                  <button
                    type="button"
                    className="watermark-type-btn"
                    onClick={() => setWatermarkType('image')}
                  >
                    <FiImage size={24} />
                    <span>Imagem</span>
                  </button>
                </div>
              </div>
            ) : watermarkType === 'text' ? (
              <div className="watermark-config">
                <div className="watermark-preview-section">
                  <p className="watermark-preview-title">Preview</p>
                  <div className="watermark-preview-wrap">
                    <PDFPreview
                      key={`${pdfFile.name}-${pdfFile.lastModified}`}
                      file={pdfFile}
                      pageNumber={1}
                      scale={1.3}
                      className="watermark-preview-pdf"
                    />
                    <div
                      className={`watermark-preview-overlay watermark-pos-${textOptions.position}`}
                      style={{
                        opacity: textOptions.opacity,
                        fontSize: Math.min(textOptions.fontSize, 244),
                        transform: `rotate(${textOptions.rotation ?? 0}deg)`,
                      }}
                    >
                      {textOptions.text || 'Texto'}
                    </div>
                  </div>
                </div>
                <div className="watermark-form">
                  <label className="watermark-label">
                    Texto
                    <input
                      type="text"
                      className="watermark-input"
                      value={textOptions.text}
                      onChange={(e) =>
                        setTextOptions((o) => ({ ...o, text: e.target.value }))
                      }
                      placeholder="Ex: CONFIDENCIAL"
                    />
                  </label>
                  <label className="watermark-label watermark-label-compact">
                    <span className="watermark-label-text">Posição</span>
                    <div className="watermark-position-grid" role="group" aria-label="Posição da marca d&#39;água">
                      {POSITION_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`watermark-position-btn ${
                            textOptions.position === opt.value ? 'active' : ''
                          }`}
                          onClick={() =>
                            setTextOptions((o) => ({ ...o, position: opt.value }))
                          }
                          title={opt.title}
                          aria-pressed={textOptions.position === opt.value}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </label>
                  <label className="watermark-label">
                    Opacidade: {Math.round(textOptions.opacity * 100)}%
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={textOptions.opacity * 100}
                      onChange={(e) =>
                        setTextOptions((o) => ({
                          ...o,
                          opacity: Number(e.target.value) / 100,
                        }))
                      }
                      className="watermark-range"
                    />
                  </label>
                  <label className="watermark-label">
                    Tamanho da fonte: {textOptions.fontSize}
                    <input
                      type="range"
                      min="12"
                      max="244"
                      value={textOptions.fontSize}
                      onChange={(e) =>
                        setTextOptions((o) => ({
                          ...o,
                          fontSize: Number(e.target.value),
                        }))
                      }
                      className="watermark-range"
                    />
                  </label>
                  <label className="watermark-label">
                    Rotação do texto: {textOptions.rotation ?? 0}°
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={textOptions.rotation ?? 0}
                      onChange={(e) =>
                        setTextOptions((o) => ({
                          ...o,
                          rotation: Number(e.target.value),
                        }))
                      }
                      className="watermark-range"
                    />
                  </label>
                </div>
                {canDownload && (
                  <div className="watermark-action-footer action-section">
                    <DownloadButton
                      onClick={handleDownload}
                      disabled={isProcessing}
                      fileName="PDF com marca d'água"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="watermark-config watermark-config-image">
                <div className="watermark-image-upload">
                  <p className="watermark-type-label">Imagem da marca d&apos;água</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleImageSelected}
                    className="watermark-image-input"
                  />
                  <button
                    type="button"
                    className="watermark-upload-image-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FiImage size={18} />
                    {imageFile ? imageFile.name : 'Selecionar PNG ou JPEG'}
                  </button>
                  {imageFile && (
                    <p className="watermark-image-dimensions">
                      Tamanho: {imageFile.name} — {(imageFile.size / 1024).toFixed(1)} KB
                    </p>
                  )}
                  {imageError && (
                    <p className="watermark-image-error">{imageError}</p>
                  )}
                </div>
                <div className="watermark-form">
                  <label className="watermark-label watermark-label-compact">
                    <span className="watermark-label-text">Posição</span>
                    <div className="watermark-position-grid" role="group" aria-label="Posição da marca d&#39;água">
                      {POSITION_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`watermark-position-btn ${
                            imageOptions.position === opt.value ? 'active' : ''
                          }`}
                          onClick={() =>
                            setImageOptions((o) => ({ ...o, position: opt.value }))
                          }
                          title={opt.title}
                          aria-pressed={imageOptions.position === opt.value}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </label>
                  <label className="watermark-label">
                    Rotação: {imageOptions.rotation}°
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={imageOptions.rotation}
                      onChange={(e) =>
                        setImageOptions((o) => ({
                          ...o,
                          rotation: Number(e.target.value),
                        }))
                      }
                      className="watermark-range"
                    />
                  </label>
                  <label className="watermark-label">
                    Tamanho: {Math.round(imageOptions.scale * 100)}%
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={imageOptions.scale * 100}
                      onChange={(e) =>
                        setImageOptions((o) => ({
                          ...o,
                          scale: Number(e.target.value) / 100,
                        }))
                      }
                      className="watermark-range"
                    />
                  </label>
                </div>
              </div>
            )}

            {error && (
              <div className="error-message">
                <span>{error}</span>
              </div>
            )}

            {canDownload && watermarkType === 'image' && (
              <div className="action-section">
                <DownloadButton
                  onClick={handleDownload}
                  disabled={isProcessing}
                  fileName="PDF com marca d'água"
                />
              </div>
            )}
          </>
        )}
      </div>

      <LoadingOverlay
        isVisible={isProcessing}
        message="Aplicando marca d'água..."
        showProgress={false}
      />
    </div>
  );
};

export default WatermarkPDF;
