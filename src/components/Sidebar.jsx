import React from 'react';

export default function Sidebar({ activePage, setActivePage, onLogout }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'billing', label: 'Create Invoice', icon: '🧾' },
    { id: 'products', label: 'Product Master', icon: '🛋️' },
    { id: 'records', label: 'Invoice History', icon: '📂' },
    { id: 'reports', label: 'Reports', icon: '📈' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  return (
    <aside id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <img src="/assets/default-logo.svg" alt="logo" style={{ width: '100%', height: '100%' }} />
        </div>
        <div class="sidebar-brand">
          VARDHMAN
          <span>Furniture House</span>
        </div>
      </div>
      
      <nav class="sidebar-menu">
        {menuItems.map((item) => (
          <a
            key={item.id}
            className={`menu-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => setActivePage(item.id)}
            style={{ cursor: 'pointer' }}
          >
            <span class="menu-item-icon">{item.icon}</span> {item.label}
          </a>
        ))}
      </nav>
      
      <div class="sidebar-footer">
        <div>Offline Engine v1.0</div>
        <div style={{ fontSize: '10px', marginTop: '2px', color: 'var(--success)' }}>● Storage Connected</div>
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
