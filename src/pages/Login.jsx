import React, { useState, useEffect } from 'react';
import authService from '../auth/authService';
import syncService from '../db/syncService';

function Field({ label, children, hint }) {
  return (
    <div className="auth-field">
      <label>{label}</label>
      {children}
      {hint && <span className="auth-hint">{hint}</span>}
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder = '••••••••', autoComplete = 'current-password', autoFocus = false }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-password-wrap">
      <input
        type={visible ? 'text' : 'password'}
        className="form-control"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
      />
      <button type="button" className="auth-eye-btn" onClick={() => setVisible(v => !v)} aria-label={visible ? 'Hide password' : 'Show password'}>
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

function RecoveryCodePanel({ code, onDone }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      window.Toast.warn('Copy failed. Please write the code down manually.');
    }
  };
  return (
    <div className="auth-stack">
      <div className="auth-notice auth-notice-warning">
        Save this <strong>recovery code</strong> somewhere safe (write it down). It is the only way to reset your password if you forget it. It will not be shown again.
      </div>
      <div className="auth-recovery-code">{code}</div>
      <button type="button" className="btn btn-secondary" onClick={copy}>{copied ? 'Copied ✓' : 'Copy code'}</button>
      <button type="button" className="btn btn-primary auth-submit" onClick={onDone}>I have saved it — continue</button>
    </div>
  );
}

export default function Login({ onLoginSuccess }) {
  // views: loading | setup | login | recover | recovery-code | cloud-signup | cloud-forgot
  const [view, setView] = useState('loading');
  const [tab, setTab] = useState('local');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [cloudReachable, setCloudReachable] = useState(null);

  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [remember, setRemember] = useState(true);

  const [issuedCode, setIssuedCode] = useState('');
  const [pendingUser, setPendingUser] = useState(null);

  const cloudConfigured = authService.isCloudConfigured();

  useEffect(() => {
    authService.hasLocalUsers().then(has => setView(has ? 'login' : 'setup'));
  }, []);

  useEffect(() => {
    if (tab === 'cloud' && cloudReachable === null) {
      authService.isCloudReachable().then(setCloudReachable);
    }
  }, [tab, cloudReachable]);

  const switchView = (next) => {
    setErrorMsg('');
    setInfoMsg('');
    setPassword('');
    setConfirmPassword('');
    setRecoveryInput('');
    setView(next);
  };

  const run = async (fn) => {
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const requireMatch = () => {
    if (password !== confirmPassword) throw new Error('Passwords do not match.');
  };

  const handleSetup = (e) => {
    e.preventDefault();
    run(async () => {
      requireMatch();
      const { user, recoveryCode } = await authService.createOwner({ name, username, password });
      if (shopName.trim()) {
        const settings = await syncService.getSettings();
        await syncService.saveSettings({ ...settings, shopName: shopName.trim() });
      }
      // Owner setup signs in straight away
      await authService.loginLocal(user.username, password, true);
      setPendingUser(user);
      setIssuedCode(recoveryCode);
      setView('recovery-code');
    });
  };

  const handleLocalLogin = (e) => {
    e.preventDefault();
    run(async () => {
      const user = await authService.loginLocal(username, password, remember);
      window.Toast.success(`Welcome back, ${user.name}!`);
      onLoginSuccess(user);
    });
  };

  const handleRecover = (e) => {
    e.preventDefault();
    run(async () => {
      requireMatch();
      const newCode = await authService.resetWithRecoveryCode(username, recoveryInput, password);
      setPendingUser(null);
      setIssuedCode(newCode);
      setView('recovery-code');
      window.Toast.success('Password reset. Your old recovery code no longer works.');
    });
  };

  const handleCloudLogin = (e) => {
    e.preventDefault();
    run(async () => {
      const user = await authService.loginCloud(username, password, remember);
      window.Toast.success('Signed in to cloud account.');
      onLoginSuccess(user);
    });
  };

  const handleCloudSignup = (e) => {
    e.preventDefault();
    run(async () => {
      requireMatch();
      const result = await authService.signUpCloud({ email: username, password, fullName: name });
      if (result.user) {
        onLoginSuccess(result.user);
      } else {
        switchView('login');
        setInfoMsg('Verification email sent. Confirm your email, then sign in.');
      }
    });
  };

  const handleCloudForgot = (e) => {
    e.preventDefault();
    run(async () => {
      await authService.sendCloudPasswordReset(username);
      setInfoMsg('If an account exists for this email, a password reset link has been sent.');
    });
  };

  const finishRecoveryCode = () => {
    if (pendingUser) {
      onLoginSuccess(pendingUser);
    } else {
      switchView('login');
      setInfoMsg('Sign in with your new password.');
    }
  };

  const subtitle = {
    loading: '',
    setup: 'First-time setup: create the owner (admin) account',
    login: tab === 'local' ? 'Sign in to your billing desk' : 'Sign in to your cloud account',
    recover: 'Reset your password with your recovery code',
    'recovery-code': 'Your recovery code',
    'cloud-signup': 'Create a cloud account',
    'cloud-forgot': 'Reset your cloud account password'
  }[view];

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-brand">
          <div className="auth-logo">
            <img src="/assets/default-logo.svg" alt="" />
          </div>
          <h1>Vardhman Billing Desk</h1>
          <span>{subtitle}</span>
        </div>

        {errorMsg && <div className="auth-notice auth-notice-error" role="alert">{errorMsg}</div>}
        {infoMsg && <div className="auth-notice auth-notice-info">{infoMsg}</div>}

        {view === 'loading' && <div className="auth-hint" style={{ textAlign: 'center' }}>Loading…</div>}

        {view === 'setup' && (
          <form onSubmit={handleSetup} className="auth-stack">
            <Field label="Your Full Name">
              <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shivam Jain" required autoFocus />
            </Field>
            <Field label="Shop Name (optional)">
              <input className="form-control" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="e.g. Vardhman Furniture House" />
            </Field>
            <Field label="Username" hint="Lowercase letters, numbers, dot, dash or underscore">
              <input className="form-control" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="e.g. owner" autoComplete="username" required />
            </Field>
            <Field label="Password" hint="At least 6 characters with letters and numbers">
              <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
            </Field>
            <Field label="Confirm Password">
              <PasswordInput value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
            </Field>
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? 'Creating account…' : 'Create Owner Account'}
            </button>
          </form>
        )}

        {view === 'recovery-code' && <RecoveryCodePanel code={issuedCode} onDone={finishRecoveryCode} />}

        {view === 'login' && (
          <>
            {cloudConfigured && (
              <div className="auth-tabs" role="tablist">
                <button type="button" role="tab" aria-selected={tab === 'local'} className={tab === 'local' ? 'active' : ''} onClick={() => { setTab('local'); setErrorMsg(''); }}>
                  This Device
                </button>
                <button type="button" role="tab" aria-selected={tab === 'cloud'} className={tab === 'cloud' ? 'active' : ''} onClick={() => { setTab('cloud'); setErrorMsg(''); }}>
                  Cloud Account
                </button>
              </div>
            )}

            {tab === 'local' ? (
              <form onSubmit={handleLocalLogin} className="auth-stack">
                <Field label="Username">
                  <input className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus />
                </Field>
                <Field label="Password">
                  <PasswordInput value={password} onChange={setPassword} />
                </Field>
                <div className="auth-row">
                  <label className="auth-check">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me signed in (7 days)
                  </label>
                  <a className="auth-link" onClick={() => switchView('recover')}>Forgot password?</a>
                </div>
                <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleCloudLogin} className="auth-stack">
                {cloudReachable === false && (
                  <div className="auth-notice auth-notice-warning">
                    The cloud server can't be reached right now. You can still use a local account on the "This Device" tab.
                  </div>
                )}
                <Field label="Email Address">
                  <input type="email" className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="name@shop.com" autoComplete="email" required />
                </Field>
                <Field label="Password">
                  <PasswordInput value={password} onChange={setPassword} />
                </Field>
                <div className="auth-row">
                  <label className="auth-check">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me signed in
                  </label>
                  <a className="auth-link" onClick={() => switchView('cloud-forgot')}>Forgot password?</a>
                </div>
                <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign In to Cloud'}
                </button>
                <div className="auth-footer-text">
                  No cloud account? <a className="auth-link" onClick={() => switchView('cloud-signup')}>Create one</a>
                </div>
              </form>
            )}
          </>
        )}

        {view === 'recover' && (
          <form onSubmit={handleRecover} className="auth-stack">
            <Field label="Username">
              <input className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
            </Field>
            <Field label="Recovery Code" hint="The code shown when the account was created, e.g. 1A2B-3C4D-5E6F-7A8B">
              <input className="form-control" value={recoveryInput} onChange={(e) => setRecoveryInput(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" required />
            </Field>
            <Field label="New Password">
              <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
            </Field>
            <Field label="Confirm New Password">
              <PasswordInput value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
            </Field>
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
            <div className="auth-footer-text">
              Staff members: ask the shop owner to reset your password from Settings → Users.
            </div>
            <a className="auth-link auth-back" onClick={() => switchView('login')}>← Back to sign in</a>
          </form>
        )}

        {view === 'cloud-signup' && (
          <form onSubmit={handleCloudSignup} className="auth-stack">
            <Field label="Full Name">
              <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </Field>
            <Field label="Email Address">
              <input type="email" className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="email" required />
            </Field>
            <Field label="Password" hint="At least 6 characters with letters and numbers">
              <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
            </Field>
            <Field label="Confirm Password">
              <PasswordInput value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
            </Field>
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create Cloud Account'}
            </button>
            <a className="auth-link auth-back" onClick={() => switchView('login')}>← Back to sign in</a>
          </form>
        )}

        {view === 'cloud-forgot' && (
          <form onSubmit={handleCloudForgot} className="auth-stack">
            <Field label="Email Address">
              <input type="email" className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
            </Field>
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
            <a className="auth-link auth-back" onClick={() => switchView('login')}>← Back to sign in</a>
          </form>
        )}
      </div>
    </div>
  );
}
