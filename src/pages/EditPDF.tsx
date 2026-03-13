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
  type TextAlign,
  type ImageAddition,
} from '../services/pdfEdit';
import { validateImageFile } from '../utils/fileUtils';
import { useCounter } from '../contexts/CounterContext';
import { FiTrash2, FiChevronUp, FiChevronDown, FiType, FiImage, FiEye, FiBold } from 'react-icons/fi';
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

const ALIGN_OPTIONS: { value: TextAlign; label: string }[] = [
  { value: 'left', label: 'Esq' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Dir' },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  };
}

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
  const [addTextBold, setAddTextBold] = useState(false);
  const [addTextColor, setAddTextColor] = useState('#000000');
  const [addTextAlign, setAddTextAlign] = useState<TextAlign>('left');
  const [addImagePage, setAddImagePage] = useState(1);
  const [addImageFile, setAddImageFile] = useState<File | null>(null);
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [previewHighResImage, setPreviewHighResImage] = useState<string | null>(null);
  const [previewHighResLoading, setPreviewHighResLoading] = useState(false);
  const previewPageRef = useRef<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  /** Clique no preview para digitar texto no local: posição em PDF e em pixels para o input. */
  const [inlineTextPlacement, setInlineTextPlacement] = useState<{
    pageNumber: number;
    xPdf: number;
    yPdf: number;
    leftPx: number;
    topPx: number;
  } | null>(null);
  const [inlineTextValue, setInlineTextValue] = useState('');
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const [draggingTextIndex, setDraggingTextIndex] = useState<number | null>(null);
  const [draggingImageIndex, setDraggingImageIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { increment } = useCounter();

  const pageMap = Object.fromEntries(pagesData.map((p) => [p.pageNumber, p]));
  const previewPageData = previewPage ? pageMap[previewPage] ?? null : null;
  const previewRotation = previewPage ? (pageRotations[previewPage] ?? 0) : 0;

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
    const pageData = pageMap[addTextPage];
    const pageWidthPt = pageData ? pageData.width / THUMBNAIL_SCALE : 400;
    const pageHeightPt = pageData ? pageData.height / THUMBNAIL_SCALE : 600;
    setTextAdditions((prev) => [
      ...prev,
      {
        pageNumber: addTextPage,
        text: addTextValue.trim(),
        fontSize: addTextSize,
        bold: addTextBold,
        color: hexToRgb(addTextColor),
        align: addTextAlign,
        x: pageWidthPt / 2,
        y: pageHeightPt / 2,
      },
    ]);
    setAddTextValue('');
  };

  /** Converte coordenadas de clique (tela) para pontos PDF. Y do PDF é de baixo para cima. */
  const getPdfCoordsFromClick = useCallback(
    (clientX: number, clientY: number): { xPdf: number; yPdf: number; leftPx: number; topPx: number } | null => {
      if (!previewPageData || !previewWrapRef.current) return null;
      const img = previewWrapRef.current.querySelector('.edit-pdf-preview-thumb') as HTMLImageElement | null;
      if (!img) return null;
      const imgRect = img.getBoundingClientRect();
      const wrapRect = previewWrapRef.current.getBoundingClientRect();
      if (
        clientX < imgRect.left ||
        clientX > imgRect.right ||
        clientY < imgRect.top ||
        clientY > imgRect.bottom
      ) {
        return null;
      }
      const xRatio = (clientX - imgRect.left) / imgRect.width;
      const yRatio = (imgRect.bottom - clientY) / imgRect.height;
      const pageWidthPt = previewPageData.width / THUMBNAIL_SCALE;
      const pageHeightPt = previewPageData.height / THUMBNAIL_SCALE;
      const xPdf = xRatio * pageWidthPt;
      const yPdf = yRatio * pageHeightPt;
      const leftPx = clientX - wrapRect.left;
      const topPx = clientY - wrapRect.top;
      return { xPdf, yPdf, leftPx, topPx };
    },
    [previewPageData]
  );

  const handlePreviewClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (inlineTextPlacement || !previewPage) return;
      if (previewRotation !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('.edit-pdf-inline-text-input-wrap')) return;
      if (target.closest('.edit-pdf-preview-text-overlay')) return;
      if (target.closest('.edit-pdf-preview-image-overlay')) return;
      const coords = getPdfCoordsFromClick(e.clientX, e.clientY);
      if (!coords) return;
      setInlineTextPlacement({
        pageNumber: previewPage,
        xPdf: coords.xPdf,
        yPdf: coords.yPdf,
        leftPx: coords.leftPx,
        topPx: coords.topPx,
      });
      setInlineTextValue('');
      setTimeout(() => inlineInputRef.current?.focus(), 0);
    },
    [inlineTextPlacement, previewPage, previewRotation, getPdfCoordsFromClick]
  );

  const submitInlineText = useCallback(() => {
    if (!inlineTextPlacement || !pdfFile) return;
    const text = inlineTextValue.trim();
    if (text) {
      setTextAdditions((prev) => [
        ...prev,
        {
          pageNumber: inlineTextPlacement.pageNumber,
          text,
          fontSize: addTextSize,
          x: inlineTextPlacement.xPdf,
          y: inlineTextPlacement.yPdf,
          bold: addTextBold,
          color: hexToRgb(addTextColor),
          align: addTextAlign,
        },
      ]);
    }
    setInlineTextPlacement(null);
    setInlineTextValue('');
  }, [inlineTextPlacement, inlineTextValue, pdfFile, addTextSize, addTextBold, addTextColor, addTextAlign]);

  const cancelInlineText = useCallback(() => {
    setInlineTextPlacement(null);
    setInlineTextValue('');
  }, []);

  const moveTextAddition = useCallback((index: number, xPdf: number, yPdf: number) => {
    setTextAdditions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, x: xPdf, y: yPdf } : item))
    );
  }, []);

  useEffect(() => {
    if (draggingTextIndex === null || !previewPageData) return;
    const onMove = (e: MouseEvent) => {
      const coords = getPdfCoordsFromClick(e.clientX, e.clientY);
      if (coords) moveTextAddition(draggingTextIndex, coords.xPdf, coords.yPdf);
    };
    const onUp = () => setDraggingTextIndex(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [draggingTextIndex, previewPageData, getPdfCoordsFromClick, moveTextAddition]);

  const moveImageAddition = useCallback((index: number, xPdf: number, yPdf: number) => {
    setImageAdditions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, x: xPdf, y: yPdf } : item))
    );
  }, []);

  useEffect(() => {
    if (draggingImageIndex === null || !previewPageData) return;
    const onMove = (e: MouseEvent) => {
      const coords = getPdfCoordsFromClick(e.clientX, e.clientY);
      if (coords) moveImageAddition(draggingImageIndex, coords.xPdf, coords.yPdf);
    };
    const onUp = () => setDraggingImageIndex(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [draggingImageIndex, previewPageData, getPdfCoordsFromClick, moveImageAddition]);

  const addImage = () => {
    if (!addImageFile || !pdfFile) return;
    const maxPage = pagesData.length;
    if (addImagePage < 1 || addImagePage > maxPage) return;
    const pageData = pageMap[addImagePage];
    const pageWidthPt = pageData ? pageData.width / THUMBNAIL_SCALE : 400;
    const pageHeightPt = pageData ? pageData.height / THUMBNAIL_SCALE : 600;
    setImageAdditions((prev) => [
      ...prev,
      {
        pageNumber: addImagePage,
        imageFile: addImageFile,
        x: pageWidthPt / 2 - 50,
        y: pageHeightPt / 2 - 50,
        width: 100,
        height: 100,
      },
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

  const canDownload = pdfFile && pageOrder.length > 0;
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
              <div className="edit-pdf-format-bar" role="toolbar" aria-label="Formatação do texto">
                <label className="edit-pdf-format-item">
                  <span className="edit-pdf-format-label">Tamanho</span>
                  <input
                    type="number"
                    min={8}
                    max={72}
                    value={addTextSize}
                    onChange={(e) => setAddTextSize(Number(e.target.value) || 12)}
                    aria-label="Tamanho da fonte"
                  />
                </label>
                <button
                  type="button"
                  className={`edit-pdf-format-btn ${addTextBold ? 'edit-pdf-format-btn-active' : ''}`}
                  onClick={() => setAddTextBold((b) => !b)}
                  title="Negrito"
                  aria-pressed={addTextBold}
                  aria-label="Negrito"
                >
                  <FiBold size={18} />
                </button>
                <label className="edit-pdf-format-item edit-pdf-format-color">
                  <span className="edit-pdf-format-label">Cor</span>
                  <input
                    type="color"
                    value={addTextColor}
                    onChange={(e) => setAddTextColor(e.target.value)}
                    aria-label="Cor do texto"
                  />
                </label>
                <div className="edit-pdf-format-align" role="group" aria-label="Alinhamento">
                  {ALIGN_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`edit-pdf-format-btn ${addTextAlign === opt.value ? 'edit-pdf-format-btn-active' : ''}`}
                      onClick={() => setAddTextAlign(opt.value)}
                      title={opt.value === 'left' ? 'Esquerda' : opt.value === 'center' ? 'Centro' : 'Direita'}
                      aria-pressed={addTextAlign === opt.value}
                      aria-label={opt.label}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
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
                <label className="edit-pdf-image-upload-label">
                  <span className="edit-pdf-image-upload-hint">Clique no botão ao lado para selecionar a imagem (PNG ou JPEG, máx. 10MB)</span>
                  <span className="edit-pdf-image-upload-btn">
                    <FiImage size={18} aria-hidden />
                    {addImageFile ? addImageFile.name : 'Escolher imagem'}
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                      className="edit-pdf-image-input"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const ok = validateImageFile(f);
                          if (ok.valid) {
                            setAddImageFile(f);
                            setError(null);
                          } else {
                            setAddImageFile(null);
                            setError(ok.error ?? 'Imagem inválida');
                          }
                        }
                        e.target.value = '';
                      }}
                    />
                  </span>
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
              <p className="edit-pdf-preview-hint">
                {previewRotation === 0
                  ? 'Clique no PDF para digitar texto. Arraste texto ou imagem para mover. Enter confirma, Esc cancela.'
                  : 'Para editar texto dentro do PDF, use rotação 0° nesta página.'}
              </p>
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
              {previewPageData && previewRotation === 0 && (
                <div className="edit-pdf-preview-align-bar" role="toolbar" aria-label="Alinhamento do texto no PDF">
                  <span className="edit-pdf-preview-align-label">Alinhamento:</span>
                  {ALIGN_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`edit-pdf-format-btn ${addTextAlign === opt.value ? 'edit-pdf-format-btn-active' : ''}`}
                      onClick={() => setAddTextAlign(opt.value)}
                      title={opt.value === 'left' ? 'Esquerda' : opt.value === 'center' ? 'Centro' : 'Direita'}
                      aria-pressed={addTextAlign === opt.value}
                      aria-label={opt.label}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              {previewPageData && (
                <div
                  className="edit-pdf-preview-box"
                  style={{
                    transform: `rotate(${previewRotation}deg)`,
                  }}
                >
                  <div
                    ref={previewWrapRef}
                    className="edit-pdf-preview-page-wrap edit-pdf-preview-page-wrap-clickable"
                    onClick={handlePreviewClick}
                    aria-label="Clique no preview para adicionar texto no local desejado"
                  >
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
                      {textAdditions.map((t, idx) => {
                        if (t.pageNumber !== previewPage) return null;
                        const pageWidthPt = previewPageData.width / THUMBNAIL_SCALE;
                        const pageHeightPt = previewPageData.height / THUMBNAIL_SCALE;
                        const hasPos = t.x != null && t.y != null;
                        const colorCss = t.color
                          ? `rgb(${Math.round(t.color.r * 255)}, ${Math.round(t.color.g * 255)}, ${Math.round(t.color.b * 255)})`
                          : undefined;
                        const align = t.align ?? 'left';
                        const translateX = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0';
                        const stackedIndex = textAdditions
                          .slice(0, idx)
                          .filter((x) => x.pageNumber === previewPage).length;
                        return (
                          <div
                            key={idx}
                            className="edit-pdf-preview-text-overlay"
                            style={{
                              fontSize: Math.max(10, (t.fontSize ?? 12) * 0.8),
                              fontWeight: t.bold ? 'bold' : undefined,
                              color: colorCss,
                              pointerEvents: hasPos ? 'auto' : undefined,
                              cursor: hasPos ? (draggingTextIndex === idx ? 'grabbing' : 'grab') : undefined,
                              userSelect: hasPos && draggingTextIndex === idx ? 'none' : undefined,
                              ...(hasPos
                                ? {
                                    position: 'absolute',
                                    left: `${((t.x ?? 0) / pageWidthPt) * 100}%`,
                                    top: `${(1 - (t.y ?? 0) / pageHeightPt) * 100}%`,
                                    marginTop: 0,
                                    transform: `translate(${translateX}, -50%)`,
                                  }
                                : { marginTop: `${stackedIndex * 24}px` }),
                            }}
                            onMouseDown={
                              hasPos
                                ? (e) => {
                                    e.stopPropagation();
                                    setDraggingTextIndex(idx);
                                  }
                                : undefined
                            }
                            title={hasPos ? 'Arraste para mover o texto' : undefined}
                            role={hasPos ? 'button' : undefined}
                            aria-label={hasPos ? 'Mover texto' : undefined}
                          >
                            {t.text}
                          </div>
                        );
                      })}
                      {imageAdditions.map((img, idx) => {
                        if (img.pageNumber !== previewPage) return null;
                        const pageWidthPt = previewPageData.width / THUMBNAIL_SCALE;
                        const pageHeightPt = previewPageData.height / THUMBNAIL_SCALE;
                        const hasPos = img.x != null && img.y != null;
                        const imageUrlIndex = imageAdditions
                          .slice(0, idx)
                          .filter((i) => i.pageNumber === previewPage).length;
                        const stackedIndex = imageAdditions
                          .slice(0, idx)
                          .filter((i) => i.pageNumber === previewPage).length;
                        return (
                          <div
                            key={idx}
                            className="edit-pdf-preview-image-overlay"
                            style={{
                              pointerEvents: hasPos ? 'auto' : undefined,
                              cursor: hasPos
                                ? draggingImageIndex === idx
                                  ? 'grabbing'
                                  : 'grab'
                                : undefined,
                              userSelect:
                                hasPos && draggingImageIndex === idx ? 'none' : undefined,
                              ...(hasPos
                                ? {
                                    position: 'absolute',
                                    left: `${((img.x ?? 0) / pageWidthPt) * 100}%`,
                                    top: `${(1 - (img.y ?? 0) / pageHeightPt) * 100}%`,
                                    transform: 'translate(0, 100%)',
                                    marginTop: 0,
                                  }
                                : {
                                    marginTop: `${previewTexts.length * 24 + stackedIndex * 60}px`,
                                  }),
                            }}
                            onMouseDown={
                              hasPos
                                ? (e) => {
                                    e.stopPropagation();
                                    setDraggingImageIndex(idx);
                                  }
                                : undefined
                            }
                            title={hasPos ? 'Arraste para mover a imagem' : undefined}
                            role={hasPos ? 'button' : undefined}
                            aria-label={hasPos ? 'Mover imagem' : undefined}
                          >
                            {previewImageUrls[imageUrlIndex] && (
                              <img src={previewImageUrls[imageUrlIndex]} alt="" draggable={false} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {inlineTextPlacement &&
                      inlineTextPlacement.pageNumber === previewPage && (
                        <div
                          className="edit-pdf-inline-text-input-wrap"
                          style={{
                            left: `${(inlineTextPlacement.xPdf / (previewPageData.width / THUMBNAIL_SCALE)) * 100}%`,
                            top: `${(1 - inlineTextPlacement.yPdf / (previewPageData.height / THUMBNAIL_SCALE)) * 100}%`,
                            transform: `translate(${addTextAlign === 'center' ? '-50%' : addTextAlign === 'right' ? '-100%' : '0'}, -50%)`,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            ref={inlineInputRef}
                            type="text"
                            className="edit-pdf-inline-text-input"
                            value={inlineTextValue}
                            onChange={(e) => setInlineTextValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                submitInlineText();
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelInlineText();
                              }
                            }}
                            onBlur={submitInlineText}
                            placeholder="Digite aqui..."
                            aria-label="Editar texto no PDF"
                            style={{
                              fontSize: Math.max(10, addTextSize * 0.8),
                              fontWeight: addTextBold ? 'bold' : undefined,
                              color: addTextColor,
                            }}
                          />
                        </div>
                      )}
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
