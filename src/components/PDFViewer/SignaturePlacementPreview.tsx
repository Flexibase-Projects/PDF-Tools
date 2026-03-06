import { useRef, useState, useCallback, useEffect } from 'react';
import PDFPreview from './PDFPreview';
import './SignaturePlacementPreview.css';

export const SIGNATURE_BASE_WIDTH_PERCENT = 28;
export const SIGNATURE_BASE_HEIGHT_PERCENT = 12;

export interface SignaturePlacement {
  leftPercent: number;
  topPercent: number;
  sizeScale: number;
}

interface SignaturePlacementPreviewProps {
  file: File;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  placement: SignaturePlacement;
  onPlacementChange: (placement: SignaturePlacement) => void;
  signatureDataUrl?: string | null;
  className?: string;
}

const SignaturePlacementPreview = ({
  file,
  pageNumber,
  pageWidth,
  pageHeight,
  placement,
  onPlacementChange,
  signatureDataUrl,
  className = '',
}: SignaturePlacementPreviewProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, left: 0, top: 0 });

  const widthPercent = Math.min(100, SIGNATURE_BASE_WIDTH_PERCENT * placement.sizeScale);
  const heightPercent = Math.min(100, SIGNATURE_BASE_HEIGHT_PERCENT * placement.sizeScale);

  const clampPosition = useCallback(
    (left: number, top: number) => {
      const l = Math.max(0, Math.min(100 - widthPercent, left));
      const t = Math.max(0, Math.min(100 - heightPercent, top));
      return { left: l, top: t };
    },
    [widthPercent, heightPercent]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!overlayRef.current) return;
      const rect = overlayRef.current.getBoundingClientRect();
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        left: placement.leftPercent,
        top: placement.topPercent,
      };
    },
    [placement.leftPercent, placement.topPercent]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!overlayRef.current) return;
      const t = e.touches[0];
      setIsDragging(true);
      dragStartRef.current = {
        x: t.clientX,
        y: t.clientY,
        left: placement.leftPercent,
        top: placement.topPercent,
      };
    },
    [placement.leftPercent, placement.topPercent]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!overlayRef.current) return;
      const rect = overlayRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaX = ((clientX - dragStartRef.current.x) / rect.width) * 100;
      const deltaY = ((clientY - dragStartRef.current.y) / rect.height) * 100;
      const { left, top } = clampPosition(
        dragStartRef.current.left + deltaX,
        dragStartRef.current.top + deltaY
      );
      onPlacementChange({
        ...placement,
        leftPercent: left,
        topPercent: top,
      });
    };

    const handleEnd = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, clampPosition, onPlacementChange, placement]);

  return (
    <div className={`signature-placement-preview ${className}`}>
      <div
        className="signature-placement-preview-wrapper"
        style={{ aspectRatio: pageWidth / pageHeight }}
      >
        <PDFPreview
          file={file}
          pageNumber={pageNumber}
          scale={1.5}
          className="signature-placement-pdf"
        />
        <div
          ref={overlayRef}
          className="signature-placement-overlay"
          aria-hidden
        >
          <div
            className={`signature-placement-box ${isDragging ? 'dragging' : ''}`}
            style={{
              left: `${placement.leftPercent}%`,
              top: `${placement.topPercent}%`,
              width: `${widthPercent}%`,
              height: `${heightPercent}%`,
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            role="presentation"
          >
            {signatureDataUrl ? (
              <img
                src={signatureDataUrl}
                alt="Preview da assinatura"
                className="signature-placement-preview-img"
              />
            ) : (
              <span className="signature-placement-placeholder">Assinatura aqui</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignaturePlacementPreview;
export type { SignaturePlacement };
