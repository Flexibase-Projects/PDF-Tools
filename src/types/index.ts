export interface PDFFile {
  id: string;
  file: File;
  name: string;
  size: number;
  pages?: number;
  preview?: string;
}

export interface PDFPage {
  pageNumber: number;
  thumbnail?: string;
}

export interface MergedPage {
  id: string;
  fileId: string;
  fileIndex: number;
  originalPageNumber: number;
  displayPageNumber: number;
  thumbnail?: string;
  file: File;
}

export type ToolType = 
  | 'merge' 
  | 'split' 
  | 'compress' 
  | 'word';

export interface MenuItem {
  id: ToolType;
  label: string;
  icon: string;
  path: string;
}
