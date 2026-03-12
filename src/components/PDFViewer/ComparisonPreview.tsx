import { useState, useEffect, useRef } from 'react';
import { generateThumbnail, generateCompressedThumbnail } from '../../utils/pdfUtils';
import { isFileReadPermissionError, FILE_READ_ERROR_USER_MESSAGE } from '../../utils/fileUtils';
import LDRSLoader from '../common/LDRSLoader';
import { FiFile } from 'react-icons/fi';
import './ComparisonPreview.css';

interface ComparisonPreviewProps {
  file: File;
  quality: number;
  scale?: number;
}

const ComparisonPreview = ({ file, quality, scale = 1.0 }: ComparisonPreviewProps) => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [compressedImage, setCompressedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFileReadError, setIsFileReadError] = useState(false);
  const [zoomPosition, setZoomPosition] = useState<{ x: number; y: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(5.0); // Nível de zoom inicial (dobro do anterior)
  
  const originalRef = useRef<HTMLDivElement>(null);
  const compressedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadImages = async () => {
      setLoading(true);
      setError(null);
      setIsFileReadError(false);

      try {
        // Carregar imagem original (PNG para máxima qualidade)
        const original = await generateThumbnail(file, 1, scale);
        setOriginalImage(original);

        // Gerar preview comprimido com qualidade ajustável (JPEG com qualidade baseada no parâmetro)
        // Isso simula melhor como ficará o PDF comprimido
        const compressed = await generateCompressedThumbnail(file, 1, quality, scale);
        setCompressedImage(compressed);
      } catch (err) {
        console.error('Erro ao carregar previews:', err);
        const message = isFileReadPermissionError(err)
          ? FILE_READ_ERROR_USER_MESSAGE
          : 'Erro ao gerar previews de comparação';
        setError(message);
        setIsFileReadError(isFileReadPermissionError(err));
      } finally {
        setLoading(false);
      }
    };

    if (file) {
      loadImages();
    }
  }, [file, quality, scale]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const img = e.currentTarget.querySelector('img');
    if (!img) return;
    
    const imgRect = img.getBoundingClientRect();
    const x = ((e.clientX - imgRect.left) / imgRect.width) * 100;
    const y = ((e.clientY - imgRect.top) / imgRect.height) * 100;
    
    // Limitar dentro dos bounds da imagem
    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));
    
    setZoomPosition({ x: clampedX, y: clampedY });
  };

  const handleMouseLeave = () => {
    setZoomPosition(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const delta = e.deltaY > 0 ? -0.5 : 0.5;
    setZoomLevel((prev) => {
      const newLevel = prev + delta;
      return Math.max(2.0, Math.min(10.0, newLevel));
    });
    
    // Se não houver zoomPosition, criar uma baseada na posição do mouse
    if (!zoomPosition) {
      const img = e.currentTarget.querySelector('img');
      if (img) {
        const imgRect = img.getBoundingClientRect();
        const x = ((e.clientX - imgRect.left) / imgRect.width) * 100;
        const y = ((e.clientY - imgRect.top) / imgRect.height) * 100;
        const clampedX = Math.max(0, Math.min(100, x));
        const clampedY = Math.max(0, Math.min(100, y));
        setZoomPosition({ x: clampedX, y: clampedY });
      }
    }
  };

  // Bloquear scroll da página quando estiver em modo zoom
  useEffect(() => {
    const handleWheelGlobal = (e: WheelEvent) => {
      if (zoomPosition) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (zoomPosition) {
        e.preventDefault();
      }
    };

    if (zoomPosition) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      window.addEventListener('wheel', handleWheelGlobal, { passive: false });
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      window.removeEventListener('wheel', handleWheelGlobal);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [zoomPosition]);

  if (loading) {
    return (
      <div className="comparison-preview-loading">
        <LDRSLoader type="tailspin" size={48} color="var(--primary-color)" />
        <p>Gerando previews...</p>
      </div>
    );
  }

  if (error) {
    if (isFileReadError) {
      return (
        <div className="comparison-preview-error file-read-error-wrapper">
          <div className="file-read-error-message">
            <p>{error}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="comparison-preview-error">
        <FiFile />
        <p>{error}</p>
      </div>
    );
  }

  if (!originalImage || !compressedImage) {
    return null;
  }

  return (
    <div className="comparison-preview">
      <div className="comparison-header">
        <div className="comparison-label">
          <span className="label-text">Original</span>
        </div>
        <div className="comparison-label">
          <span className="label-text">Comprimido</span>
        </div>
      </div>
      <div className="comparison-images">
        <div
          ref={originalRef}
          className="comparison-image-container original"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          style={{ cursor: zoomPosition ? 'none' : 'crosshair' }}
        >
          <img src={originalImage} alt="Original" className="comparison-image" />
          {zoomPosition && (
            <div
              className="zoom-overlay"
              style={{
                left: `${zoomPosition.x}%`,
                top: `${zoomPosition.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className="zoom-window"
                style={{
                  backgroundImage: `url(${originalImage})`,
                  backgroundSize: `${zoomLevel * 100}%`,
                  backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
                }}
              />
            </div>
          )}
        </div>
        <div
          ref={compressedRef}
          className="comparison-image-container compressed"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          style={{ cursor: zoomPosition ? 'none' : 'crosshair' }}
        >
          <img src={compressedImage} alt="Comprimido" className="comparison-image" />
          {zoomPosition && (
            <div
              className="zoom-overlay"
              style={{
                left: `${zoomPosition.x}%`,
                top: `${zoomPosition.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className="zoom-window"
                style={{
                  backgroundImage: `url(${compressedImage})`,
                  backgroundSize: `${zoomLevel * 100}%`,
                  backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
                }}
              />
            </div>
          )}
        </div>
      </div>
      <div className="comparison-hint">
        <p>Passe o mouse sobre as imagens para ver detalhes ampliados. Use a roda do mouse para ajustar o zoom.</p>
      </div>
    </div>
  );
};

export default ComparisonPreview;
