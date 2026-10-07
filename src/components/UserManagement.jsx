import React, { useState, useEffect } from 'react';
import authService, { ROLES } from '../auth/authService';
import { formatDate } from '../utils/invoice';

const EMPTY = { name: '', username: '', password: '', role: 'staff' };

export default function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setUsers(await authService.listUsers());
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (fn, successMsg) => {
    try {
      await fn();
      if (successMsg) window.Toast.success(successMsg);
      load();
    } catch (err) {
      window.Toast.error(err.message);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setBusy(true);
    await act(async () => {
      await authService.addUser(form);
      setForm(EMPTY);
      setAdding(false);
    }, `User "${form.username}" created.`);
    setBusy(false);
  };

  const handleResetPassword = async (u) => {
    const pwd = await window.Dialog.show({
      title: `Reset password · ${u.username}`,
      message: 'Enter a new password for this user (min 6 chars, letters and numbers). Share it with them privately.',
      isInput: true,
      inputType: 'password',
      confirmText: 'Set Password',
      cancelText: 'Cancel',
      confirmClass: 'btn-primary'
    });
    if (!pwd) return;
    act(() => authService.setUserPassword(u.id, pwd), 'Password updated.');
  };

  const handleToggleActive = (u) => {
    act(() => authService.updateUser(u.id, { active: !u.active }), u.active ? 'User disabled.' : 'User enabled.');
  };

  const handleRoleChange = (u, role) => {
    act(() => authService.updateUser(u.id, { role }), 'Role updated.');
  };

  const handleDelete = async (u) => {
    const ok = await window.Dialog.confirm(`Delete user "${u.username}"? Their past invoices are kept.`, 'Delete User', 'btn-danger');
    if (ok) act(() => authService.deleteUser(u.id), 'User deleted.');
  };

  return (
    <div className="card settings-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>👥 Users & Access</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            Staff can create bills, record payments and view customers. Only admins can change settings, see reports, edit products or delete invoices.
          </p>
        </div>
        {!adding && <button className="btn btn-primary" onClick={() => setAdding(true)}>➕ Add User</button>}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="settings-form-grid" style={{ marginBottom: '16px', padding: '12px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
          <label className="form-field-label">Full Name
            <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
          </label>
          <label className="form-field-label">Username
            <input className="form-control" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} required />
          </label>
          <label className="form-field-label">Password
            <input type="password" className="form-control" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" required />
          </label>
          <label className="form-field-label">Role
            <select className="form-control" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(ROLES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'end' }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create User'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setAdding(false); setForm(EMPTY); }}>Cancel</button>
          </div>
        </form>
      )}

      <div className="billing-table-container">
        <table className="billing-table">
          <thead>
            <tr>
              <th style={{ padding: '10px 8px' }}>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const isSelf = u.id === currentUser.id;
              return (
                <tr key={u.id}>
                  <td style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600 }}>{u.name}{isSelf && ' (you)'}</td>
                  <td><code>{u.username}</code></td>
                  <td>
                    <select className="form-control" value={u.role} disabled={isSelf} onChange={(e) => handleRoleChange(u, e.target.value)} style={{ padding: '4px', fontSize: '12px' }}>
                      <option value="admin">Admin</option>
                      <option value="staff">Staff</option>
                    </select>
                  </td>
                  <td style={{ color: u.active ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>{u.active ? 'Active' : 'Disabled'}</td>
                  <td>{u.lastLoginAt ? formatDate(u.lastLoginAt.slice(0, 10)) : 'Never'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleResetPassword(u)}>Reset Password</button>
                      {!isSelf && (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleToggleActive(u)}>{u.active ? 'Disable' : 'Enable'}</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u)} style={{ backgroundColor: 'var(--error)', border: 'none', color: '#fff' }}>Delete</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
