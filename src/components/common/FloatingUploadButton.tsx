import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { FiUpload } from 'react-icons/fi';
import { validatePDFFile } from '../../utils/fileUtils';
import './FloatingUploadButton.css';

interface FloatingUploadButtonProps {
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  maxFiles?: number;
}

const FloatingUploadButton = ({
  onFilesSelected,
  multiple = false,
  maxFiles,
}: FloatingUploadButtonProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const validFiles: File[] = [];

    fileArray.forEach((file) => {
      const validation = validatePDFFile(file);
      if (validation.valid) {
        validFiles.push(file);
      }
    });

    if (validFiles.length > 0) {
      if (maxFiles && validFiles.length > maxFiles) {
        onFilesSelected(validFiles.slice(0, maxFiles));
      } else {
        onFilesSelected(validFiles);
      }
    }
  };

  const handleDragOver = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple={multiple}
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />
      <button
        className={`floating-upload-btn ${isDragging ? 'dragging' : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-label="Adicionar mais arquivos PDF"
        title="Clique ou arraste para adicionar mais PDFs"
      >
        <FiUpload className="floating-upload-icon" />
        <span className="floating-upload-text">Adicionar PDF</span>
      </button>
    </>
  );
};

export default FloatingUploadButton;
