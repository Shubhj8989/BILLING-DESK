import React, { useState, useEffect } from 'react';
import { supabase } from './db/supabaseClient';
import syncService from './db/syncService';

// Component Imports
import Sidebar from './components/Sidebar';
import ToastHelper from './components/Toast';
import DialogHelper from './components/Dialog';
import Login from './pages/Login';

// Page Imports
import Dashboard from './pages/Dashboard';
import Billing from './pages/Billing';
import Products from './pages/Products';
import Records from './pages/Records';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [dbReady, setDbReady] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [shopConfig, setShopConfig] = useState({});
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // History & Editing States
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);

  // Initialize DB & Load Shop Settings & Auth Listeners
  useEffect(() => {
    async function initDB() {
      try {
        // Initialize IndexedDB fallback
        await syncService.init();
        setDbReady(true);

        if (!supabase) {
          setAuthChecked(true);
          return;
        }

        // Check active session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
          const settings = await syncService.getSettings();
          setShopConfig(settings);
        }
        setAuthChecked(true);

        // Listen to Auth State Changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
          const activeUser = session ? session.user : null;
          setUser(activeUser);
          if (activeUser) {
            const settings = await syncService.getSettings();
            setShopConfig(settings);
          } else {
            setShopConfig({});
          }
        });

        return () => {
          if (subscription && typeof subscription.unsubscribe === 'function') {
            subscription.unsubscribe();
          }
        };
      } catch (err) {
        console.error('Failed to initialize IndexedDB/Auth:', err);
        setDbReady(true);
        setAuthChecked(true);
      }
    }
    initDB();
  }, []);

  // Sync Theme State to DOM Attribute
  useEffect(() => {
    document.documentElement.setAttribute('theme', theme);
    document.body.setAttribute('theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleSettingsUpdated = async () => {
    try {
      const settings = await syncService.getSettings();
      setShopConfig(settings);
    } catch (err) {
      console.error('Settings reload failed:', err);
    }
  };

  const handleLogout = async () => {
    const confirm = await window.Dialog.confirm('Are you sure you want to log out of your session?', 'Confirm Sign Out');
    if (confirm) {
      if (supabase && user && user.email !== 'offline@demo.local') {
        await supabase.auth.signOut();
      }
      setUser(null);
      setShopConfig({});
      setActivePage('dashboard');
      window.Toast.info('Signed out successfully.');
    }
  };

  const handleEditInvoice = (invoice) => {
    setEditingInvoice(invoice);
    setActiveInvoice(null); // Close viewer modal
    setActivePage('billing'); // Switch to billing screen
  };

  const handleInvoiceSaved = (invoice) => {
    setEditingInvoice(null);
    setActiveInvoice(invoice); // Open details preview modal for printing
    setActivePage('records'); // Redirect to history logs
  };

  if (!dbReady || !authChecked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>VARDHMAN BILLING ENGINE</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Initializing storage and network authentication...</div>
      </div>
    );
  }

  // Render Login page if not signed in
  if (!user) {
    return <Login onLoginSuccess={async (u) => {
      setUser(u);
      const settings = await syncService.getSettings();
      setShopConfig(settings);
    }} />;
  }

  // Determine Online / Offline indicator status
  const isCloudActive = supabase !== null && user.email !== 'offline@demo.local';

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      
      {/* Mobile Sidebar Overlay Backdrop */}
      {isSidebarOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(2px)',
            zIndex: 999
          }}
        ></div>
      )}

      {/* Sidebar navigation */}
      <Sidebar 
        activePage={activePage} 
        setActivePage={(page) => {
          if (page === 'billing') setEditingInvoice(null);
          setActivePage(page);
          setIsSidebarOpen(false);
        }}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
      />

      {/* Main page desk */}
      <main id="main-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
        
        {/* Header toolbar */}
        <header id="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel)' }}>
          <div className="header-title-section" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
            <button
              className="hamburger-btn"
              onClick={() => setIsSidebarOpen(prev => !prev)}
              style={{
                display: 'none',
                background: 'none',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                width: '36px',
                height: '36px',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '18px',
                color: 'var(--text-main)'
              }}
            >
              ☰
            </button>
            <div>
              <div className="header-title" style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-display)', color: 'var(--text-main)' }}>
                {shopConfig.shopName || 'My Furniture House'}
              </div>
              <div className="header-subtitle" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {shopConfig.address || 'Local Sandbox Mode'} {shopConfig.gstNumber ? `| GST: ${shopConfig.gstNumber}` : ''}
              </div>
            </div>
          </div>
          
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div 
              className="shop-status-badge" 
              style={{ 
                backgroundColor: isCloudActive ? 'var(--primary-light)' : 'var(--success-bg)', 
                color: isCloudActive ? 'var(--primary)' : 'var(--success)', 
                padding: '4px 10px', 
                fontSize: '11px', 
                borderRadius: '4px', 
                fontWeight: '600' 
              }}
            >
              {isCloudActive ? `☁️ Cloud Account: ${user.email}` : '⚡ Offline Demo (Local)'}
            </div>
            <button 
              className="btn-theme-toggle" 
              onClick={toggleTheme} 
              title="Toggle Light/Dark Theme"
              style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px' }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        {/* Content switch area */}
        <div id="content-area" style={{ flex: 1, padding: '24px', backgroundColor: 'var(--bg-app)' }}>
          {activePage === 'dashboard' && (
            <Dashboard 
              setActivePage={setActivePage} 
              onViewInvoice={(inv) => {
                setActiveInvoice(inv);
                setActivePage('records');
              }} 
            />
          )}
          
          {activePage === 'billing' && (
            <Billing 
              editingInvoice={editingInvoice} 
              onInvoiceSaved={handleInvoiceSaved} 
              setActivePage={setActivePage}
            />
          )}
          
          {activePage === 'products' && <Products />}
          
          {activePage === 'records' && (
            <Records 
              activeInvoice={activeInvoice} 
              setActiveInvoice={setActiveInvoice} 
              onEditInvoice={handleEditInvoice}
              setActivePage={setActivePage}
            />
          )}
          
          {activePage === 'reports' && <Reports />}
          
          {activePage === 'settings' && (
            <Settings onSettingsUpdated={handleSettingsUpdated} />
          )}
        </div>
      </main>

    </div>
  );
}
