export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export const validatePDFFile = (file: File): { valid: boolean; error?: string } => {
  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'O arquivo deve ser um PDF' };
  }
  
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSize) {
    return { valid: false, error: 'O arquivo é muito grande. Tamanho máximo: 100MB' };
  }
  
  return { valid: true };
};

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOC_MIME = 'application/msword';

export const validateWordFile = (file: File): { valid: boolean; error?: string } => {
  const isDocx = file.type === DOCX_MIME || /\.docx$/i.test(file.name);
  const isDoc = file.type === DOC_MIME || /\.doc$/i.test(file.name);
  if (!isDocx && !isDoc) {
    return { valid: false, error: 'O arquivo deve ser Word (DOC ou DOCX)' };
  }
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    return { valid: false, error: 'O arquivo é muito grande. Tamanho máximo: 50MB' };
  }
  if (isDoc && !isDocx) {
    return { valid: false, error: 'Apenas DOCX é suportado. Salve o documento como DOCX no Word.' };
  }
  return { valid: true };
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  if (!validTypes.includes(file.type) && !/\.(png|jpe?g)$/i.test(file.name)) {
    return { valid: false, error: 'Use uma imagem PNG ou JPEG' };
  }
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { valid: false, error: 'Imagem muito grande. Máximo: 10MB' };
  }
  return { valid: true };
};
