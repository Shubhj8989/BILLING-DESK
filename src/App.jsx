import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './db/supabaseClient';
import syncService from './db/syncService';
import authService from './auth/authService';

// Global helpers (attach window.Toast / window.Dialog)
import './components/Toast';
import './components/Dialog';
import Sidebar from './components/Sidebar';
import { MENU_ITEMS } from './components/menu';
import Login from './pages/Login';

// Page Imports
import Dashboard from './pages/Dashboard';
import Billing from './pages/Billing';
import Products from './pages/Products';
import Records from './pages/Records';
import Customers from './pages/Customers';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [ready, setReady] = useState(false);
  // 'blocked' = another open copy of the app is holding the database; 'slow' = startup is taking too long
  const [startupIssue, setStartupIssue] = useState(null);

  useEffect(() => {
    if (ready) return;
    const onBlocked = () => setStartupIssue('blocked');
    window.addEventListener('billing-db-blocked', onBlocked);
    const timer = setTimeout(() => setStartupIssue(prev => prev || 'slow'), 8000);
    return () => {
      window.removeEventListener('billing-db-blocked', onBlocked);
      clearTimeout(timer);
    };
  }, [ready]);
  const [user, setUser] = useState(null);
  const [shopConfig, setShopConfig] = useState({});
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // History & Editing States
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [billingPrefill, setBillingPrefill] = useState(null);

  const startSession = useCallback(async (sessionUser) => {
    syncService.setCloudEnabled(sessionUser.mode === 'cloud');
    const settings = await syncService.getSettings();
    setShopConfig(settings);
    setUser(sessionUser);
    setActivePage('dashboard');
  }, []);

  // Initialize DB, restore any saved session
  useEffect(() => {
    let subscription;
    async function init() {
      try {
        await syncService.init();
        const restored = await authService.restoreSession();
        if (restored) await startSession(restored);
      } catch (err) {
        console.error('Failed to initialize storage/session:', err);
        window.Toast.error('Could not open local storage. Check that your browser allows site data.');
      } finally {
        setReady(true);
      }

      // Handle cloud password-reset links (user lands here from the email)
      if (supabase) {
        const { data } = supabase.auth.onAuthStateChange(async (event) => {
          if (event !== 'PASSWORD_RECOVERY') return;
          const newPassword = await window.Dialog.show({
            title: 'Set New Password',
            message: 'Enter a new password for your cloud account (min 6 chars, letters and numbers).',
            isInput: true,
            inputType: 'password',
            confirmText: 'Update Password',
            cancelText: 'Cancel',
            confirmClass: 'btn-primary'
          });
          if (!newPassword) return;
          try {
            await authService.updateCloudPassword(newPassword);
            window.Toast.success('Password updated. Please sign in.');
          } catch (err) {
            window.Toast.error(err.message);
          }
        });
        subscription = data.subscription;
      }
    }
    init();
    return () => subscription?.unsubscribe();
  }, [startSession]);

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
      setShopConfig(await syncService.getSettings());
    } catch (err) {
      console.error('Settings reload failed:', err);
    }
  };

  const handleLogout = async () => {
    const confirm = await window.Dialog.confirm('Are you sure you want to sign out?', 'Confirm Sign Out');
    if (!confirm) return;
    await authService.logout(user);
    syncService.setCloudEnabled(false);
    setUser(null);
    setShopConfig({});
    setActiveInvoice(null);
    setEditingInvoice(null);
    setIsSidebarOpen(false);
    window.Toast.info('Signed out successfully.');
  };

  const navigate = (page) => {
    if (page === 'billing') {
      setEditingInvoice(null);
    }
    setActivePage(page);
    setIsSidebarOpen(false);
  };

  const handleEditInvoice = (invoice) => {
    setEditingInvoice(invoice);
    setBillingPrefill(null);
    setActiveInvoice(null);
    setActivePage('billing');
  };

  // Start a new bill copying items/customer from an existing invoice
  const handleDuplicateInvoice = (invoice) => {
    setEditingInvoice(null);
    setBillingPrefill(invoice);
    setActiveInvoice(null);
    setActivePage('billing');
  };

  const handleNewBillForCustomer = (customer) => {
    setEditingInvoice(null);
    setBillingPrefill({
      customerName: customer.name,
      customerMobile: customer.mobile,
      customerAddress: customer.address,
      customerGstin: customer.gstin,
      customerState: customer.state,
      items: []
    });
    setActivePage('billing');
  };

  const handleInvoiceSaved = (invoice) => {
    setEditingInvoice(null);
    setBillingPrefill(null);
    setActiveInvoice(invoice); // Open preview for printing
    setActivePage('records');
  };

  if (!ready) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>VARDHMAN BILLING DESK</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Opening storage…</div>
        {startupIssue && (
          <div style={{ marginTop: '20px', maxWidth: '420px', padding: '0 16px', textAlign: 'center', fontSize: '13px', lineHeight: 1.5, color: 'var(--text-main)' }}>
            {startupIssue === 'blocked'
              ? 'The app is being updated, but an older copy is still open in another tab or app window. Close the other tabs/windows of this app, and this page will continue automatically.'
              : 'This is taking longer than expected. Close any other tabs or app windows of this billing app, then reload.'}
            <div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{ marginTop: '14px', padding: '8px 18px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Reload
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={startSession} />;
  }

  const isCloudActive = user.mode === 'cloud';
  const isAdmin = user.role === 'admin';
  const allowedPages = MENU_ITEMS.filter(item => item.roles.includes(user.role)).map(item => item.id);
  const page = allowedPages.includes(activePage) ? activePage : 'dashboard';

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

      <Sidebar
        activePage={page}
        setActivePage={navigate}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        user={user}
        shopName={shopConfig.shopName}
        isCloud={isCloudActive}
      />

      <main id="main-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>

        <header id="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel)' }}>
          <div className="header-title-section" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
            <button
              className="hamburger-btn"
              onClick={() => setIsSidebarOpen(prev => !prev)}
              aria-label="Toggle menu"
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
                {shopConfig.address || ''} {shopConfig.gstNumber ? `| GST: ${shopConfig.gstNumber}` : ''}
              </div>
            </div>
          </div>

          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              className="shop-status-badge"
              title={isCloudActive ? 'Data is synced to your cloud account' : 'Data is stored in this browser'}
              style={{
                backgroundColor: isCloudActive ? 'var(--primary-light)' : 'var(--success-bg)',
                color: isCloudActive ? 'var(--primary)' : 'var(--success)',
                padding: '4px 10px',
                fontSize: '11px',
                borderRadius: '4px',
                fontWeight: '600'
              }}
            >
              {isCloudActive ? `☁️ ${user.email}` : `👤 ${user.name} (${isAdmin ? 'Admin' : 'Staff'})`}
            </div>
            <button
              className="btn-theme-toggle"
              onClick={toggleTheme}
              title="Toggle Light/Dark Theme"
              style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px' }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              className="btn-theme-toggle header-logout-btn"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '15px' }}
            >
              🚪
            </button>
          </div>
        </header>

        <div id="content-area" style={{ flex: 1, padding: '24px', backgroundColor: 'var(--bg-app)' }}>
          {page === 'dashboard' && (
            <Dashboard
              setActivePage={navigate}
              shopConfig={shopConfig}
              user={user}
              onViewInvoice={(inv) => {
                setActiveInvoice(inv);
                setActivePage('records');
              }}
            />
          )}

          {page === 'billing' && (
            <Billing
              editingInvoice={editingInvoice}
              prefill={billingPrefill}
              onPrefillConsumed={() => setBillingPrefill(null)}
              onInvoiceSaved={handleInvoiceSaved}
              user={user}
            />
          )}

          {page === 'products' && <Products canEdit={isAdmin} shopConfig={shopConfig} />}

          {page === 'records' && (
            <Records
              activeInvoice={activeInvoice}
              setActiveInvoice={setActiveInvoice}
              onEditInvoice={handleEditInvoice}
              onDuplicateInvoice={handleDuplicateInvoice}
              canDelete={isAdmin}
            />
          )}

          {page === 'customers' && (
            <Customers
              onNewBill={handleNewBillForCustomer}
              onViewInvoice={(inv) => {
                setActiveInvoice(inv);
                setActivePage('records');
              }}
            />
          )}

          {page === 'reports' && <Reports />}

          {page === 'settings' && (
            <Settings onSettingsUpdated={handleSettingsUpdated} user={user} />
          )}
        </div>
      </main>

    </div>
  );
}
