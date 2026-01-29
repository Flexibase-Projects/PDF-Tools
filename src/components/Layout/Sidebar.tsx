import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  FiMenu, 
  FiFileText, 
  FiScissors, 
  FiMinimize2, 
  FiFile 
} from 'react-icons/fi';
import { useCounter } from '../../contexts/CounterContext';
import './Sidebar.css';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const menuItems: MenuItem[] = [
  { id: 'merge', label: 'Juntar & Organizar PDF', icon: <FiFileText />, path: '/merge' },
  { id: 'split', label: 'Dividir PDF', icon: <FiScissors />, path: '/split' },
  { id: 'compress', label: 'Comprimir PDF', icon: <FiMinimize2 />, path: '/compress' },
  { id: 'word', label: 'PDF para Word', icon: <FiFile />, path: '/word' },
];

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const { count } = useCounter();
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!isCollapsed ? (
          <>
            <div className="sidebar-header-title-wrapper">
              <h1 className="sidebar-title">PDF Tools</h1>
            </div>
            <button 
              className="sidebar-toggle" 
              onClick={toggleSidebar}
              aria-label="Retrair menu"
            >
              <FiMenu />
            </button>
          </>
        ) : (
          <>
            <div className="sidebar-header-title-wrapper">
              <div className="sidebar-title-collapsed">
                <div className="sidebar-title-line">PDF</div>
                <div className="sidebar-title-line-small">TOOLS</div>
              </div>
            </div>
            <div className="sidebar-separator" />
            <button 
              className="sidebar-toggle" 
              onClick={toggleSidebar}
              aria-label="Expandir menu"
            >
              <FiMenu />
            </button>
          </>
        )}
      </div>
      
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path || 
                          (item.path === '/merge' && location.pathname === '/');
          
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              title={isCollapsed ? item.label : ''}
            >
              <span className="sidebar-icon">{item.icon}</span>
              {!isCollapsed && <span className="sidebar-label">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="usage-card">
          {!isCollapsed && (
            <div className="usage-card-label">Usos totais</div>
          )}
          <div className="usage-card-value">{count.toLocaleString('pt-BR')}</div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
