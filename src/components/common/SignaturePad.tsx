import { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import './SignaturePad.css';

export interface SignaturePadRef {
  getDataUrl: () => string | null;
  isEmpty: () => boolean;
  clear: () => void;
}

interface SignaturePadProps {
  onSignatureChange?: (hasDrawing: boolean) => void;
  /** Chamado quando o conteúdo da assinatura muda (para preview em tempo real). */
  onSignatureDataUrlChange?: (dataUrl: string | null) => void;
  className?: string;
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(function SignaturePad(
  {
    onSignatureChange,
    onSignatureDataUrlChange,
    className = '',
  },
  ref
) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const hasDrawnRef = useRef(false);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  const startDrawing = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = getCtx();
      if (!ctx) return;

      const pos = getPosition(e, canvas);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      setIsDrawing(true);
      hasDrawnRef.current = true;
      onSignatureChange?.(true);
    },
    [getCtx, onSignatureChange]
  );

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = getCtx();
      if (!ctx) return;

      e.preventDefault();
      const pos = getPosition(e, canvas);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    },
    [isDrawing, getCtx]
  );

  const stopDrawing = useCallback(() => {
    if (hasDrawnRef.current && canvasRef.current) {
      onSignatureDataUrlChange?.(canvasRef.current.toDataURL('image/png'));
    }
    setIsDrawing(false);
  }, [onSignatureDataUrlChange]);

  const getPosition = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCtx();
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    hasDrawnRef.current = false;
    onSignatureChange?.(false);
    onSignatureDataUrlChange?.(null);
  }, [getCtx, onSignatureChange, onSignatureDataUrlChange]);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const setCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (w <= 0 || h <= 0) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    setCanvasSize();
    const observer = new ResizeObserver(setCanvasSize);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const getDataUrl = useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawnRef.current) return null;
    return canvas.toDataURL('image/png');
  }, []);

  const isEmpty = useCallback((): boolean => !hasDrawnRef.current, []);

  useImperativeHandle(ref, () => ({
    getDataUrl,
    isEmpty,
    clear,
  }), [getDataUrl, isEmpty, clear]);

  return (
    <div className={`signature-pad-wrap ${className}`}>
      <p className="signature-pad-label">Desenhe sua assinatura no espaço abaixo</p>
      <div ref={boxRef} className="signature-pad-box">
        <canvas
          ref={canvasRef}
          className="signature-pad-canvas"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          aria-label="Área para desenhar sua assinatura"
        />
      </div>
      <button type="button" className="signature-pad-clear btn-secondary" onClick={clear}>
        Limpar assinatura
      </button>
    </div>
  );
});

export default SignaturePad;
