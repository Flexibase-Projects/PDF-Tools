import { useEffect } from 'react';

// Importar os loaders do ldrs
if (typeof window !== 'undefined') {
  import('ldrs/ring');
  import('ldrs/tailspin');
}

interface LDRSLoaderProps {
  type?: 'ring' | 'tailspin';
  size?: number | string;
  color?: string;
  speed?: number | string;
}

// Declaração de tipos para os elementos customizados do ldrs
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'l-ring': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        size?: string | number;
        color?: string;
        speed?: string | number;
      };
      'l-tailspin': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        size?: string | number;
        color?: string;
        speed?: string | number;
      };
    }
  }
}

const LDRSLoader = ({ 
  type = 'ring', 
  size = 60, 
  color = '#1e40af',
  speed = 1.2 
}: LDRSLoaderProps) => {
  useEffect(() => {
    // Garantir que os custom elements estão registrados
    if (typeof window !== 'undefined') {
      if (!customElements.get('l-ring')) {
        import('ldrs/ring');
      }
      if (!customElements.get('l-tailspin')) {
        import('ldrs/tailspin');
      }
    }
  }, []);

  const sizeStr = typeof size === 'number' ? size.toString() : size;
  const speedStr = typeof speed === 'number' ? speed.toString() : speed;

  if (type === 'tailspin') {
    return (
      <l-tailspin
        size={sizeStr}
        color={color}
        speed={speedStr}
      />
    );
  }

  return (
    <l-ring
      size={sizeStr}
      color={color}
      speed={speedStr}
    />
  );
};

export default LDRSLoader;
