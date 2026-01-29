import { useState } from 'react';
import { FiX, FiMove, FiFile } from 'react-icons/fi';
import { PDFFile } from '../../types';
import { formatFileSize } from '../../utils/fileUtils';
import './FileList.css';

interface FileListProps {
  files: PDFFile[];
  onRemove: (id: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  showPreview?: boolean;
}

const FileList = ({ files, onRemove, onReorder, showPreview = false }: FileListProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index || !onReorder) return;

    const newFiles = [...files];
    const draggedItem = newFiles[draggedIndex];
    newFiles.splice(draggedIndex, 1);
    newFiles.splice(index, 0, draggedItem);
    
    onReorder(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="file-list">
      {files.map((file, index) => (
        <div
          key={file.id}
          className={`file-item ${draggedIndex === index ? 'dragging' : ''}`}
          draggable={!!onReorder}
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
        >
          <div className="file-item-content">
            {onReorder && (
              <div className="file-drag-handle">
                <FiMove />
              </div>
            )}
            <div className="file-icon">
              <FiFile />
            </div>
            <div className="file-info">
              <p className="file-name">{file.name}</p>
              <p className="file-size">{formatFileSize(file.size)}</p>
            </div>
            <button
              className="file-remove"
              onClick={() => onRemove(file.id)}
              aria-label="Remover arquivo"
            >
              <FiX />
            </button>
          </div>
          {showPreview && file.preview && (
            <div className="file-preview">
              <img src={file.preview} alt={`Preview ${file.name}`} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default FileList;
