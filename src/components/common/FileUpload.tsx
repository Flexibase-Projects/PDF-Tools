import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { FiUpload, FiFile } from 'react-icons/fi';
import { validatePDFFile } from '../../utils/fileUtils';
import './FileUpload.css';

export type FileValidator = (file: File) => { valid: boolean; error?: string };

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  maxFiles?: number;
  className?: string;
  /** Aceita tipos de arquivo (ex: ".pdf,application/pdf" ou ".docx,.doc"). Se não informado, usa PDF. */
  accept?: string;
  /** Validador customizado. Se não informado, usa validação de PDF. */
  validateFile?: FileValidator;
  /** Textos para upload (upload de Word vs PDF). */
  uploadText?: { main: string; hint: string };
}

const FileUpload = ({ 
  onFilesSelected, 
  multiple = false, 
  maxFiles,
  className = '',
  accept = '.pdf,application/pdf',
  validateFile = validatePDFFile,
  uploadText
}: FileUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    fileArray.forEach((file) => {
      const validation = validateFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    });

    if (errors.length > 0) {
      setError(errors.join(', '));
      setTimeout(() => setError(null), 5000);
    }

    if (validFiles.length > 0) {
      if (maxFiles && validFiles.length > maxFiles) {
        setError(`Máximo de ${maxFiles} arquivo(s) permitido(s)`);
        setTimeout(() => setError(null), 5000);
        onFilesSelected(validFiles.slice(0, maxFiles));
      } else {
        onFilesSelected(validFiles);
      }
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
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
    <div className={`file-upload-container ${className}`}>
      <div
        className={`file-upload-area ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInputChange}
        />
        <div className="file-upload-content">
          <FiUpload className="upload-icon" />
          <p className="upload-text">
            {isDragging 
              ? 'Solte os arquivos aqui' 
              : (uploadText?.main ?? 'Clique ou arraste arquivos PDF aqui')}
          </p>
          <p className="upload-hint">
            {uploadText?.hint ?? (multiple ? 'Você pode selecionar múltiplos arquivos' : 'Selecione um arquivo PDF')}
          </p>
        </div>
      </div>
      {error && (
        <div className="upload-error">
          <FiFile />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
