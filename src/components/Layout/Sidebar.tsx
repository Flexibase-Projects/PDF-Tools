import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FiMenu,
  FiChevronLeft,
  FiFileText,
  FiScissors,
  FiMinimize2,
  FiFile,
  FiFilePlus,
  FiEdit2,
  FiMonitor,
  FiDroplet,
  FiEdit3,
  FiTool,
  FiSun,
  FiMoon,
  FiHelpCircle,
} from 'react-icons/fi';
import { useTheme } from '../../contexts/ThemeContext';
import { useCounter } from '../../contexts/CounterContext';
import './Sidebar.css';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const SIDEBAR_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'ORGANIZAR',
    items: [
      { id: 'merge', label: 'Juntar & Organizar PDF', icon: <FiFileText size={18} />, path: '/merge' },
      { id: 'split', label: 'Dividir PDF', icon: <FiScissors size={18} />, path: '/split' },
    ],
  },
  {
    title: 'CONVERTER',
    items: [
      { id: 'word', label: 'PDF para Word', icon: <FiFile size={18} />, path: '/word' },
      { id: 'word-to-pdf', label: 'Word para PDF', icon: <FiFilePlus size={18} />, path: '/word-to-pdf' },
    ],
  },
  {
    title: 'OTIMIZAR',
    items: [
      { id: 'compress', label: 'Comprimir PDF', icon: <FiMinimize2 size={18} />, path: '/compress' },
      { id: 'repair', label: 'Reparar PDF', icon: <FiTool size={18} />, path: '/repair' },
    ],
  },
  {
    title: 'EDITAR & MARCAR',
    items: [
      { id: 'edit', label: 'Editar PDF', icon: <FiEdit2 size={18} />, path: '/edit' },
      { id: 'watermark', label: 'Marca D\'água', icon: <FiDroplet size={18} />, path: '/watermark' },
      { id: 'sign', label: 'Assinar PDF', icon: <FiEdit3 size={18} />, path: '/sign' },
    ],
  },
  {
    title: 'VISUALIZAR',
    items: [
      { id: 'present', label: 'Apresentar PDF', icon: <FiMonitor size={18} />, path: '/present' },
    ],
  },
];

const APP_NAME = 'PDF Tools';
const APP_SUBTITLE = 'Ferramentas';

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const { isDark, toggleTheme } = useTheme();
  const { count } = useCounter();
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);
  const handleThemeToggle = () => toggleTheme();

  const getActiveTab = () => {
    const path = location.pathname === '/' ? '/merge' : location.pathname;
    const item = SIDEBAR_SECTIONS.flatMap((s) => s.items).find((i) => i.path === path);
    return item?.id ?? '';
  };

  const activeTab = getActiveTab();

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Header: recolhido = logo + divider + botão expandir; expandido = logo + título + subtítulo + botão recolher */}
      {isCollapsed ? (
        <div className="sidebar-header-collapsed">
          <div className="sidebar-logo-wrap">
            <div className="sidebar-logo">
              <FiFileText size={18} color="white" />
            </div>
          </div>
          <div className="sidebar-divider" />
          <button
            type="button"
            className="sidebar-btn-expand"
            onClick={toggleSidebar}
            title="Expandir"
            aria-label="Expandir menu"
          >
            <FiMenu size={22} />
          </button>
          <div className="sidebar-divider" />
        </div>
      ) : (
        <div className="sidebar-header-expanded">
          <div className="sidebar-header-left">
            <div className="sidebar-logo">
              <FiFileText size={18} color="white" />
            </div>
            <div className="sidebar-header-text">
              <span className="sidebar-app-name">{APP_NAME}</span>
              <span className="sidebar-app-subtitle">{APP_SUBTITLE}</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-btn-collapse"
            onClick={toggleSidebar}
            title="Recolher"
            aria-label="Recolher menu"
          >
            <FiChevronLeft size={18} />
          </button>
        </div>
      )}

      {/* Navegação por seções */}
      <div className="sidebar-nav">
        {SIDEBAR_SECTIONS.map((section) => (
          <div
            key={section.title}
            className={`sidebar-section ${isCollapsed ? 'collapsed' : ''}`}
          >
            {!isCollapsed && (
              <h2 className="sidebar-section-title">{section.title}</h2>
            )}
            <nav className="sidebar-section-nav">
              {section.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={`sidebar-item ${isActive ? 'active' : ''} ${isCollapsed ? 'collapsed' : ''}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <span className="sidebar-item-icon">{item.icon}</span>
                    {!isCollapsed && (
                      <span className="sidebar-item-label">{item.label}</span>
                    )}
                    {isActive && !isCollapsed && (
                      <span className="sidebar-item-dot" aria-hidden />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Rodapé: Tema, Ajuda, card de usos */}
      <div className={`sidebar-footer ${isCollapsed ? 'collapsed' : ''}`}>
        <button
          type="button"
          className={`sidebar-footer-btn ${isCollapsed ? 'collapsed' : ''}`}
          onClick={handleThemeToggle}
          title={isCollapsed ? (isDark ? 'Modo Claro' : 'Modo Escuro') : undefined}
        >
          {isDark ? <FiSun size={18} /> : <FiMoon size={18} />}
          {!isCollapsed && <span>{isDark ? 'Claro' : 'Escuro'}</span>}
        </button>
        <Link
          to="/ajuda"
          className={`sidebar-footer-btn sidebar-footer-link ${isCollapsed ? 'collapsed' : ''}`}
          title={isCollapsed ? 'Ajuda' : undefined}
        >
          <FiHelpCircle size={18} />
          {!isCollapsed && <span>Ajuda</span>}
        </Link>
        <div className="sidebar-usage-card">
          {!isCollapsed && <div className="sidebar-usage-label">Usos totais</div>}
          <div className="sidebar-usage-value">{count.toLocaleString('pt-BR')}</div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
