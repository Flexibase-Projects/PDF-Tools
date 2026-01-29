import { useState } from 'react';
import { FiDownload, FiCheck } from 'react-icons/fi';
import LDRSLoader from './LDRSLoader';
import './DownloadButton.css';

interface DownloadButtonProps {
  onClick: () => void;
  disabled?: boolean;
  fileName?: string;
  className?: string;
}

const DownloadButton = ({ 
  onClick, 
  disabled = false, 
  fileName,
  className = '' 
}: DownloadButtonProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleClick = async () => {
    if (disabled || isDownloading) return;

    setIsDownloading(true);
    setIsSuccess(false);

    try {
      await onClick();
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsDownloading(false);
      }, 2000);
    } catch (error) {
      setIsDownloading(false);
      console.error('Erro ao fazer download:', error);
    }
  };

  return (
    <button
      className={`download-button ${className} ${isSuccess ? 'success' : ''}`}
      onClick={handleClick}
      disabled={disabled || isDownloading}
      aria-label={fileName ? `Baixar ${fileName}` : 'Baixar arquivo'}
    >
      {isDownloading ? (
        <>
          <LDRSLoader type="tailspin" size={18} color="white" />
          <span>Processando...</span>
        </>
      ) : isSuccess ? (
        <>
          <FiCheck />
          <span>Download concluído!</span>
        </>
      ) : (
        <>
          <FiDownload />
          <span>Baixar PDF</span>
        </>
      )}
    </button>
  );
};

export default DownloadButton;
