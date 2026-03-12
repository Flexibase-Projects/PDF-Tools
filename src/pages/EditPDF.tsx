import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import FileUpload from '../components/common/FileUpload';
import DownloadButton from '../components/common/DownloadButton';
import LoadingOverlay from '../components/common/LoadingOverlay';
import { loadPDFPages, generateThumbnail, type PDFPageData } from '../utils/pdfUtils';
import {
  applyPDFEdits,
  downloadEditedPDF,
  type EditPDFOptions,
  type PageRotations,
  type TextAddition,
  type ImageAddition,
} from '../services/pdfEdit';
import { validateImageFile } from '../utils/fileUtils';
import { useCounter } from '../contexts/CounterContext';
import { FiTrash2, FiChevronUp, FiChevronDown, FiType, FiImage, FiEye } from 'react-icons/fi';
import './PageStyles.css';
import './EditPDF.css';

const THUMBNAIL_SCALE = 0.35;
/** Escala da preview para texto legível (maior que a miniatura do grid). */
const PREVIEW_SCALE = 1.25;

const ROTATION_OPTIONS: { value: 0 | 90 | 180 | 270; label: string }[] = [
  { value: 0, label: '0°' },
  { value: 90, label: '90°' },
  { value: 180, label: '180°' },
  { value: 270, label: '270°' },
];

const EditPDF = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [pageRotations, setPageRotations] = useState<PageRotations>({});
  const [pagesData, setPagesData] = useState<PDFPageData[]>([]);
  const [textAdditions, setTextAdditions] = useState<TextAddition[]>([]);
  const [imageAdditions, setImageAdditions] = useState<ImageAddition[]>([]);
  const [addTextPage, setAddTextPage] = useState(1);
  const [addTextValue, setAddTextValue] = useState('');
  const [addTextSize, setAddTextSize] = useState(12);
  const [addImagePage, setAddImagePage] = useState(1);
  const [addImageFile, setAddImageFile] = useState<File | null>(null);
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [previewHighResImage, setPreviewHighResImage] = useState<string | null>(null);
  const [previewHighResLoading, setPreviewHighResLoading] = useState(false);
  const previewPageRef = useRef<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { increment } = useCounter();

  previewPageRef.current = previewPage;

  useEffect(() => {
    if (pageOrder.length > 0 && (previewPage === null || !pageOrder.includes(previewPage))) {
      setPreviewPage(pageOrder[0]);
    }
  }, [pageOrder, previewPage]);

  useEffect(() => {
    if (!pdfFile || !previewPage) {
      setPreviewHighResImage(null);
      setPreviewHighResLoading(false);
      return;
    }
    const requestedPage = previewPage;
    setPreviewHighResImage(null);
    setPreviewHighResLoading(true);
    generateThumbnail(pdfFile, requestedPage, PREVIEW_SCALE)
      .then((dataUrl) => {
        if (previewPageRef.current === requestedPage) {
          setPreviewHighResImage(dataUrl);
        }
      })
      .catch(() => {
        if (previewPageRef.current === requestedPage) {
          setPreviewHighResImage(null);
        }
      })
      .finally(() => {
        if (previewPageRef.current === requestedPage) {
          setPreviewHighResLoading(false);
        }
      });
  }, [pdfFile, previewPage]);

  const loadPages = useCallback(async (file: File) => {
    const pages = await loadPDFPages(file, THUMBNAIL_SCALE);
    setPagesData(pages);
    const order = pages.map((p) => p.pageNumber);
    setPageOrder(order);
    setPageRotations({});
    setPreviewPage(order[0] ?? null);
  }, []);

  const handlePdfSelected = useCallback(
    async (files: File[]) => {
      if (files.length > 0) {
        setPdfFile(files[0]);
        setTextAdditions([]);
        setImageAdditions([]);
        setError(null);
        await loadPages(files[0]);
        await increment();
      }
    },
    [loadPages, increment]
  );

  const removePage = (originalPageNum: number) => {
    setPageOrder((prev) => prev.filter((n) => n !== originalPageNum));
  };

  const movePage = (index: number, direction: 'up' | 'down') => {
    setPageOrder((prev) => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const setRotation = (pageNum: number, rotation: 0 | 90 | 180 | 270) => {
    setPageRotations((prev) => ({ ...prev, [pageNum]: rotation }));
  };

  const addText = () => {
    if (!addTextValue.trim() || !pdfFile) return;
    const maxPage = pagesData.length;
    if (addTextPage < 1 || addTextPage > maxPage) return;
    setTextAdditions((prev) => [
      ...prev,
      { pageNumber: addTextPage, text: addTextValue.trim(), fontSize: addTextSize },
    ]);
    setAddTextValue('');
  };

  const addImage = () => {
    if (!addImageFile || !pdfFile) return;
    const maxPage = pagesData.length;
    if (addImagePage < 1 || addImagePage > maxPage) return;
    setImageAdditions((prev) => [
      ...prev,
      { pageNumber: addImagePage, imageFile: addImageFile },
    ]);
    setAddImageFile(null);
  };

  const removeTextAddition = (index: number) => {
    setTextAdditions((prev) => prev.filter((_, i) => i !== index));
  };

  const removeImageAddition = (index: number) => {
    setImageAdditions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDownload = async () => {
    if (!pdfFile || pageOrder.length === 0) {
      setError('Adicione um PDF e mantenha ao menos uma página.');
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const options: EditPDFOptions = {
        pageOrder,
        pageRotations,
        textAdditions: textAdditions.length ? textAdditions : undefined,
        imageAdditions: imageAdditions.length ? imageAdditions : undefined,
      };
      const blob = await applyPDFEdits(pdfFile, options);
      const baseName = pdfFile.name.replace(/\.pdf$/i, '') || 'documento';
      await downloadEditedPDF(blob, `${baseName}-editado.pdf`);
      await increment();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao editar PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const pageMap = Object.fromEntries(pagesData.map((p) => [p.pageNumber, p]));
  const canDownload = pdfFile && pageOrder.length > 0;

  const previewPageData = previewPage ? pageMap[previewPage] : null;
  const previewRotation = previewPage ? (pageRotations[previewPage] ?? 0) : 0;
  const previewTexts = useMemo(
    () => (previewPage ? textAdditions.filter((t) => t.pageNumber === previewPage) : []),
    [previewPage, textAdditions]
  );
  const previewImages = useMemo(
    () => (previewPage ? imageAdditions.filter((i) => i.pageNumber === previewPage) : []),
    [previewPage, imageAdditions]
  );
  const previewImageUrls = useMemo(
    () => previewImages.map((a) => URL.createObjectURL(a.imageFile)),
    [previewImages]
  );
  useEffect(() => () => previewImageUrls.forEach((u) => URL.revokeObjectURL(u)), [previewImageUrls]);

  useEffect(() => {
    if (pdfFile && pagesData.length > 0) {
      const max = Math.max(...pagesData.map((p) => p.pageNumber));
      if (addTextPage > max) setAddTextPage(max);
      if (addImagePage > max) setAddImagePage(max);
    }
  }, [pdfFile, pagesData, addTextPage, addImagePage]);

  return (
    <div className="page-container edit-pdf-page">
      <div className="page-header">
        <h1>Editar PDF</h1>
        <p>Remova, reordene e rotacione páginas. Adicione texto ou imagens.</p>
      </div>
      <div className="page-content">
        <div className="page-upload">
          <FileUpload
            onFilesSelected={handlePdfSelected}
            accept=".pdf,application/pdf"
            multiple={false}
          />
        </div>

        {!pdfFile ? (
          <p className="edit-pdf-empty-hint">Envie um PDF para começar a editar.</p>
        ) : (
          <div className="edit-pdf-layout">
            <div className="edit-pdf-main">
              {error && <div className="error-message">{error}</div>}

              <section className="edit-pdf-section">
                <h2 className="edit-pdf-section-title">Páginas (ordem e rotação)</h2>
                <p className="section-hint">
                  Clique em uma página para visualizá-la ao lado. Remova, reordene ou rotacione.
                </p>
                <div className="edit-pdf-pages-grid">
                  {pageOrder.map((originalNum, index) => {
                    const data = pageMap[originalNum];
                    const isPreview = previewPage === originalNum;
                    return (
                      <div
                        key={`${originalNum}-${index}`}
                        className={`edit-pdf-page-card ${isPreview ? 'edit-pdf-page-card-preview' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setPreviewPage(originalNum)}
                        onKeyDown={(e) => e.key === 'Enter' && setPreviewPage(originalNum)}
                        aria-label={`Página ${originalNum}${isPreview ? ', em preview' : ''}`}
                      >
                        <div className="edit-pdf-page-card-thumb">
                        {data?.thumbnail ? (
                          <img src={data.thumbnail} alt={`Página ${originalNum}`} />
                        ) : (
                          <span>Pág. {originalNum}</span>
                        )}
                        <span className="edit-pdf-page-badge">#{index + 1}</span>
                      </div>
                      <div className="edit-pdf-page-card-actions">
                        <select
                          value={pageRotations[originalNum] ?? 0}
                          onChange={(e) => {
                            e.stopPropagation();
                            setRotation(originalNum, Number(e.target.value) as 0 | 90 | 180 | 270);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Rotação página ${originalNum}`}
                        >
                          {ROTATION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <div className="edit-pdf-page-move" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => movePage(index, 'up')}
                            disabled={index === 0}
                            aria-label="Subir"
                          >
                            <FiChevronUp />
                          </button>
                          <button
                            type="button"
                            onClick={() => movePage(index, 'down')}
                            disabled={index === pageOrder.length - 1}
                            aria-label="Descer"
                          >
                            <FiChevronDown />
                          </button>
                        </div>
                        <button
                          type="button"
                          className="edit-pdf-remove-page"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePage(originalNum);
                          }}
                          aria-label={`Remover página ${originalNum}`}
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="edit-pdf-section">
              <h2 className="edit-pdf-section-title">
                <FiType /> Adicionar texto
              </h2>
              <div className="edit-pdf-add-row">
                <label>
                  Página
                  <select
                    value={addTextPage}
                    onChange={(e) => setAddTextPage(Number(e.target.value))}
                  >
                    {pageOrder.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Texto
                  <input
                    type="text"
                    value={addTextValue}
                    onChange={(e) => setAddTextValue(e.target.value)}
                    placeholder="Digite o texto"
                  />
                </label>
                <label>
                  Tamanho
                  <input
                    type="number"
                    min={8}
                    max={72}
                    value={addTextSize}
                    onChange={(e) => setAddTextSize(Number(e.target.value) || 12)}
                  />
                </label>
                <button type="button" className="edit-pdf-btn-add" onClick={addText}>
                  Adicionar
                </button>
              </div>
              {textAdditions.length > 0 && (
                <ul className="edit-pdf-add-list">
                  {textAdditions.map((a, i) => (
                    <li key={i}>
                      Pág. {a.pageNumber}: “{a.text}”
                      <button
                        type="button"
                        className="edit-pdf-remove-item"
                        onClick={() => removeTextAddition(i)}
                        aria-label="Remover"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="edit-pdf-section">
              <h2 className="edit-pdf-section-title">
                <FiImage /> Adicionar imagem
              </h2>
              <div className="edit-pdf-add-row">
                <label>
                  Página
                  <select
                    value={addImagePage}
                    onChange={(e) => setAddImagePage(Number(e.target.value))}
                  >
                    {pageOrder.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Imagem
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const ok = validateImageFile(f);
                        if (ok.valid) setAddImageFile(f);
                        else setError(ok.error ?? 'Imagem inválida');
                      }
                      e.target.value = '';
                    }}
                  />
                  {addImageFile && <span className="edit-pdf-file-name">{addImageFile.name}</span>}
                </label>
                <button
                  type="button"
                  className="edit-pdf-btn-add"
                  onClick={addImage}
                  disabled={!addImageFile}
                >
                  Adicionar
                </button>
              </div>
              {imageAdditions.length > 0 && (
                <ul className="edit-pdf-add-list">
                  {imageAdditions.map((a, i) => (
                    <li key={i}>
                      Pág. {a.pageNumber}: {a.imageFile.name}
                      <button
                        type="button"
                        className="edit-pdf-remove-item"
                        onClick={() => removeImageAddition(i)}
                        aria-label="Remover"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

              <div className="action-section">
                <DownloadButton
                  onClick={handleDownload}
                  disabled={!canDownload || isProcessing}
                  fileName="PDF editado"
                />
              </div>
            </div>

            <aside className="edit-pdf-preview-panel" aria-label="Preview da página">
              <h2 className="edit-pdf-preview-title">
                <FiEye /> Preview
              </h2>
              <label className="edit-pdf-preview-page-label">
                Página
                <select
                  value={previewPage ?? ''}
                  onChange={(e) => setPreviewPage(Number(e.target.value) || null)}
                  aria-label="Selecionar página para preview"
                >
                  {pageOrder.map((n) => (
                    <option key={n} value={n}>
                      Página original {n} → #{pageOrder.indexOf(n) + 1}
                    </option>
                  ))}
                </select>
              </label>
              {previewPageData && (
                <div
                  className="edit-pdf-preview-box"
                  style={{
                    transform: `rotate(${previewRotation}deg)`,
                  }}
                >
                  <div className="edit-pdf-preview-page-wrap">
                    {previewHighResLoading && (
                      <div className="edit-pdf-preview-loading" aria-hidden>
                        <span>Carregando...</span>
                      </div>
                    )}
                    <img
                      src={previewHighResImage ?? previewPageData.thumbnail ?? undefined}
                      alt={`Preview página ${previewPage}${previewHighResImage ? ' (legível)' : ''}`}
                      className="edit-pdf-preview-thumb"
                    />
                    <div className="edit-pdf-preview-overlays">
                      {previewTexts.map((t, i) => (
                        <div
                          key={i}
                          className="edit-pdf-preview-text-overlay"
                          style={{
                            fontSize: Math.max(10, (t.fontSize ?? 12) * 0.8),
                            marginTop: `${i * 24}px`,
                          }}
                        >
                          {t.text}
                        </div>
                      ))}
                      {previewImages.map((_, i) => (
                        <div
                          key={i}
                          className="edit-pdf-preview-image-overlay"
                          style={{ marginTop: `${previewTexts.length * 24 + i * 60}px` }}
                        >
                          {previewImageUrls[i] && (
                            <img src={previewImageUrls[i]} alt="" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {!previewPageData && (
                <p className="edit-pdf-preview-empty">Selecione uma página ao lado.</p>
              )}
            </aside>
          </div>
        )}

        {isProcessing && <LoadingOverlay message="Aplicando edições..." />}
      </div>
    </div>
  );
};

export default EditPDF;
