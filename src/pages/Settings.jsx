import React, { useState, useEffect, useRef } from 'react';
import dbInstance from '../db/syncService';
import AccountSecurity from '../components/AccountSecurity';
import UserManagement from '../components/UserManagement';
import { INDIAN_STATES } from '../utils/states';

export default function Settings({ onSettingsUpdated, user }) {
  const isAdmin = user.role === 'admin';
  const [form, setForm] = useState({
    shopName: '',
    gstNumber: '',
    address: '',
    state: 'Uttar Pradesh',
    mobile: '',
    email: '',
    bankName: '',
    bankAccount: '',
    bankIfsc: '',
    upiId: '',
    proprietor: '',
    invoicePrefix: '',
    invoiceStartNumber: 1001,
    lowStockThreshold: 5,
    terms: ''
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await dbInstance.getSettings();
        setForm(settings);
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const gstin = (form.gstNumber || '').trim().toUpperCase();
    if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
      window.Toast.error('Shop GSTIN looks invalid. It should be 15 characters, e.g. 09ABCDE1234F1Z5.');
      return;
    }
    if (form.bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.bankIfsc.trim().toUpperCase())) {
      window.Toast.error('IFSC code looks invalid (e.g. HDFC0001234).');
      return;
    }
    try {
      await dbInstance.saveSettings({
        ...form,
        gstNumber: gstin,
        bankIfsc: (form.bankIfsc || '').trim().toUpperCase(),
        invoiceStartNumber: Number(form.invoiceStartNumber) || 1001,
        lowStockThreshold: Number(form.lowStockThreshold) || 5
      });
      window.Toast.success('Settings profile updated successfully.');
      if (onSettingsUpdated) onSettingsUpdated();
    } catch (err) {
      console.error('Failed to save settings:', err);
      window.Toast.error('Failed to save settings configurations.');
    }
  };

  // --- DATABASE EXPORT (JSON DUMP) ---
  const handleExportBackup = async () => {
    try {
      const settings = await dbInstance.getSettings();
      const products = await dbInstance.getProducts();
      const invoices = await dbInstance.getInvoices();

      const dump = {
        exportedAt: new Date().toISOString(),
        settings,
        products,
        invoices
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dump));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `Vardhman_Billing_Backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      window.Toast.success('Database backup JSON exported successfully.');
    } catch (err) {
      console.error('Backup export failed:', err);
      window.Toast.error('Failed to export database backup.');
    }
  };

  // --- DATABASE IMPORT (RESTORE JSON) ---
  const handleImportBackup = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);

        if (!parsed.products || !parsed.invoices) {
          window.Toast.error('Invalid backup JSON format. Missing key databases.');
          return;
        }

        const confirm = await window.Dialog.confirm('Warning: Importing this backup will overwrite all current invoices and products. Do you want to proceed?', 'Confirm Data Restore');
        if (confirm) {
          await dbInstance.importBackup(parsed);
          window.Toast.success('Database restored successfully! Reloading...');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      } catch (err) {
        console.error('Restore parser crash:', err);
        window.Toast.error('Failed to parse and restore backup JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Clean input
  };

  // --- CLEAR / RESET DATABASE ---
  const handleClearDatabase = async () => {
    const confirm = await window.Dialog.confirm('DANGER WARNING: This action will permanently erase all settings, invoices, and product masters from your computer. This cannot be undone! Are you sure?', 'Purge Databases', 'btn-danger');
    if (confirm) {
      const doubleConfirm = await window.Dialog.confirm('Are you absolutely, 100% sure you want to delete everything?', 'Final Purge Warning', 'btn-danger');
      if (doubleConfirm) {
        try {
          await dbInstance.clearAll();
          window.Toast.success('Databases purged completely. Restarting app...');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } catch (err) {
          console.error('Purge failed:', err);
          window.Toast.error('Failed to clear database stores.');
        }
      }
    }
  };

  if (!isAdmin) {
    return (
      <div className="settings-layout" style={{ maxWidth: '720px' }}>
        <AccountSecurity user={user} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
    <div className="settings-layout" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', alignItems: 'start' }}>

      {/* Settings Form Card */}
      <div className="card settings-card" style={{ padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700' }}>Shop Configuration Details</h3>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Shop Business Name</label>
            <input
              type="text"
              className="form-control"
              value={form.shopName}
              onChange={(e) => setForm({ ...form, shopName: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>GSTIN / Business Tax ID</label>
              <input
                type="text"
                className="form-control"
                value={form.gstNumber}
                onChange={(e) => setForm({ ...form, gstNumber: e.target.value.toUpperCase() })}
                maxLength={15}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Business Contact Mobile</label>
              <input
                type="text"
                className="form-control"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Billing Address Details</label>
            <textarea
              className="form-control"
              rows="2"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              required
              style={{ resize: 'vertical', minHeight: '60px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Shop State (decides CGST/SGST vs IGST)</label>
              <select className="form-control" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                {INDIAN_STATES.map(st => <option key={st.code} value={st.name}>{st.name} ({st.code})</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Business Email</label>
              <input type="email" className="form-control" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>

          <h4 style={{ margin: '8px 0 4px 0', fontSize: '13px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>🏦 Bank Settlements (NEFT/UPI Print Details)</h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Bank Name</label>
              <input type="text" className="form-control" value={form.bankName || ''} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>UPI ID (for payments)</label>
              <input type="text" className="form-control" placeholder="shop@upi" value={form.upiId || ''} onChange={(e) => setForm({ ...form, upiId: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Bank A/C Number</label>
              <input
                type="text"
                className="form-control"
                value={form.bankAccount}
                onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Bank IFSC Code</label>
              <input
                type="text"
                className="form-control"
                value={form.bankIfsc}
                onChange={(e) => setForm({ ...form, bankIfsc: e.target.value.toUpperCase() })}
                maxLength={11}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Proprietor Signature Name</label>
            <input
              type="text"
              className="form-control"
              value={form.proprietor}
              onChange={(e) => setForm({ ...form, proprietor: e.target.value })}
            />
          </div>

          <h4 style={{ margin: '8px 0 4px 0', fontSize: '13px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>🔢 Invoice Auto-Numbering Setup</h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Prefix String (e.g. VFH/)</label>
              <input
                type="text"
                className="form-control"
                value={form.invoicePrefix}
                onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Starting Invoice Serial (Numeric)</label>
              <input
                type="number"
                className="form-control"
                value={form.invoiceStartNumber}
                onChange={(e) => setForm({ ...form, invoiceStartNumber: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '260px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Low Stock Alert Threshold</label>
            <input type="number" min="0" className="form-control" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Standard Invoice Disclaimers (Terms)</label>
            <textarea
              className="form-control"
              rows="3"
              value={form.terms}
              onChange={(e) => setForm({ ...form, terms: e.target.value })}
              style={{ resize: 'vertical', minHeight: '80px' }}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: '10px 16px', fontWeight: '600', alignSelf: 'flex-start', marginTop: '8px' }}>
            💾 Save Configurations
          </button>
        </form>
      </div>

      {/* Database Backup / Operations Card */}
      <div className="card operations-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ margin: '0', fontSize: '16px', fontWeight: '700' }}>System Utilities</h3>
        <p style={{ margin: '0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Manage your offline storage records, export invoice spreadsheets, or restore data backups from local storage file dumps.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={handleExportBackup} style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '600' }}>
            📥 Export DB Backup (JSON)
          </button>

          <button className="btn btn-secondary" onClick={handleImportBackup} style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '600' }}>
            📤 Restore Backup File
          </button>
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <button className="btn btn-danger" onClick={handleClearDatabase} style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '600', backgroundColor: 'var(--error)', border: 'none', color: '#fff' }}>
            💥 Purge All Local Data (keeps user logins)
          </button>
        </div>

        <div style={{ marginTop: 'auto', padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', fontSize: '11.5px', color: 'var(--text-muted)' }}>
          <strong>ℹ️ Safety Notice:</strong> {user.mode === 'cloud'
            ? 'Your data is synced to your cloud account and cached in this browser.'
            : "Your data is stored only in this browser (IndexedDB) on this device. Clearing browser data will erase it."} Export a backup regularly and keep it somewhere safe.
        </div>
      </div>

    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
      <AccountSecurity user={user} />
      {user.mode === 'local' && <UserManagement currentUser={user} />}
    </div>
    </div>
  );
}
