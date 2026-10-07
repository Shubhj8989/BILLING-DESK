import React from 'react';
import { MENU_ITEMS } from './menu';

export default function Sidebar({ activePage, setActivePage, onLogout, isOpen, user, shopName, isCloud }) {
  const items = MENU_ITEMS.filter(item => item.roles.includes(user.role));
  const [firstWord, ...rest] = (shopName || 'Vardhman Furniture House').split(' ');

  return (
    <aside id="sidebar" className={isOpen ? 'open' : ''}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src="/assets/default-logo.svg" alt="logo" style={{ width: '100%', height: '100%' }} />
        </div>
        <div className="sidebar-brand">
          {firstWord.toUpperCase()}
          <span>{rest.join(' ')}</span>
        </div>
      </div>

      <nav className="sidebar-menu">
        {items.map((item) => (
          <a
            key={item.id}
            className={`menu-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => setActivePage(item.id)}
            title={item.label}
            style={{ cursor: 'pointer' }}
          >
            <span className="menu-item-icon">{item.icon}</span>
            <span className="menu-item-label">{item.label}</span>
          </a>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ fontWeight: 600, color: 'var(--text-on-sidebar)' }}>{user.name}</div>
        <div style={{ fontSize: '10px', marginTop: '2px' }}>{user.role === 'admin' ? 'Admin' : 'Staff'} · {isCloud ? 'Cloud Sync' : 'This Device'}</div>
        <button
          onClick={onLogout}
          className="btn btn-secondary"
          style={{
            marginTop: '10px',
            width: '100%',
            padding: '6px',
            fontSize: '11px',
            fontWeight: '600',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            color: 'var(--error)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer'
          }}
        >
          🚪 Sign Out
        </button>
      </div>
    </aside>
  );
}
