import React, { useState } from 'react';
import authService from '../auth/authService';

export default function AccountSecurity({ user }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const isCloud = user.mode === 'cloud';

  const handleChange = async (e) => {
    e.preventDefault();
    if (next !== confirm) {
      window.Toast.error('New passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if (isCloud) {
        await authService.updateCloudPassword(next);
      } else {
        await authService.changePassword(user.id, current, next);
      }
      window.Toast.success('Password changed successfully.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      window.Toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleNewRecoveryCode = async () => {
    const ok = await window.Dialog.confirm('Generate a new recovery code? Your previous code will stop working.', 'New Recovery Code');
    if (!ok) return;
    try {
      const code = await authService.regenerateRecoveryCode(user.id);
      await window.Dialog.alert(`Your new recovery code is:  ${code}  — write it down and keep it safe. It will not be shown again.`, 'Recovery Code');
    } catch (err) {
      window.Toast.error(err.message);
    }
  };

  return (
    <div className="card settings-card" style={{ padding: '24px' }}>
      <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700' }}>🔐 My Account</h3>
      <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
        Signed in as <strong>{user.name}</strong> ({user.username}) · {user.role === 'admin' ? 'Admin' : 'Staff'} · {isCloud ? 'Cloud account' : 'Local account on this device'}
      </p>

      <form onSubmit={handleChange} className="settings-form-grid">
        {!isCloud && (
          <label className="form-field-label">Current Password
            <input type="password" className="form-control" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </label>
        )}
        <label className="form-field-label">New Password
          <input type="password" className="form-control" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
        </label>
        <label className="form-field-label">Confirm New Password
          <input type="password" className="form-control" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'end' }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Change Password'}</button>
          {!isCloud && user.role === 'admin' && (
            <button type="button" className="btn btn-secondary" onClick={handleNewRecoveryCode}>New Recovery Code</button>
          )}
        </div>
      </form>
    </div>
  );
}
