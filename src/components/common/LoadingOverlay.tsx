import { useEffect, useState } from 'react';
import LDRSLoader from './LDRSLoader';
import './LoadingOverlay.css';

interface LoadingOverlayProps {
  message?: string;
  progress?: number; // 0-100
  showProgress?: boolean;
  isVisible?: boolean;
}

const LoadingOverlay = ({ 
  message = 'Processando...', 
  progress,
  showProgress = false,
  isVisible = true 
}: LoadingOverlayProps) => {
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    if (progress !== undefined && showProgress) {
      // Animar progresso suavemente
      const interval = setInterval(() => {
        setDisplayProgress((prev) => {
          if (prev < progress) {
            return Math.min(prev + 2, progress);
          }
          return prev;
        });
      }, 50);

      return () => clearInterval(interval);
    }
  }, [progress, showProgress]);

  if (!isVisible) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="loading-spinner">
          <LDRSLoader type="ring" size={64} color="var(--primary-color)" />
        </div>
        <p className="loading-message">{message}</p>
        {showProgress && progress !== undefined && (
          <div className="loading-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${displayProgress}%` }}
              />
            </div>
            <span className="progress-text">{Math.round(displayProgress)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingOverlay;
