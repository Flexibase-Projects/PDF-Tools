import { ReactNode, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import LDRSLoader from '../common/LDRSLoader';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const location = useLocation();

  // Loading inicial do sistema
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Loading durante transição de páginas
  useEffect(() => {
    setIsPageTransitioning(true);
    const timer = setTimeout(() => {
      setIsPageTransitioning(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading-content">
          <LDRSLoader type="ring" size={80} color="var(--primary-color)" />
          <p>Carregando PDF Tools...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        {isPageTransitioning && (
          <div className="page-transition-loading">
            <LDRSLoader type="tailspin" size={40} color="var(--primary-color)" />
          </div>
        )}
        <div className={isPageTransitioning ? 'content-transitioning' : ''}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
