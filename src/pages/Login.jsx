import React, { useState } from 'react';
import { supabase } from '../db/supabaseClient';

export default function Login({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    if (!supabase) {
      setErrorMsg('Supabase URL/Key is not configured. Please test using the Offline Demo mode below.');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              shop_name: shopName || 'My Furniture House'
            }
          }
        });
        if (error) throw error;
        
        if (data.session) {
          window.Toast.success('Sign up successful! Logged in.');
          onLoginSuccess(data.user);
        } else {
          window.Toast.info('Verification email sent! Please confirm your email.');
          setIsSignUp(false); // Shift to login view
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        window.Toast.success('Signed in successfully.');
        onLoginSuccess(data.user);
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setErrorMsg(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineMode = () => {
    window.Toast.info('Offline Demo mode activated. Using local browser IndexedDB cache.');
    // Mock user for offline mode bypass
    onLoginSuccess({
      id: 'offline_local_owner',
      email: 'offline@demo.local',
      user_metadata: { shop_name: 'Vardhman Furniture House' }
    });
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: 'var(--bg-app)',
      fontFamily: 'var(--font-display), sans-serif',
      color: 'var(--text-main)',
      padding: '24px',
      boxSizing: 'border-box'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '36px',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '45px', height: '45px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', backgroundColor: 'var(--primary-light)', padding: '4px' }}>
            <img src="/assets/default-logo.svg" alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <h2 style={{ margin: '0', fontSize: '18px', fontWeight: '800', letterSpacing: '0.5px' }}>
            VARDHMAN BILLING DESK
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {isSignUp ? 'Create your shop cloud account' : 'Sign in to access your cloud invoices'}
          </span>
        </div>

        {errorMsg && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--error)',
            color: 'var(--error)',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            lineHeight: '1.4'
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isSignUp && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Shop Business Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Vardhman Furniture House"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                required
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Email Address</label>
            <input
              type="email"
              className="form-control"
              placeholder="name@shop.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: '600',
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            {loading ? 'Authenticating...' : isSignUp ? 'Create Cloud Account' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
          {isSignUp ? (
            <span>
              Already have an account?{' '}
              <a
                onClick={() => setIsSignUp(false)}
                style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: '600', textDecoration: 'underline' }}
              >
                Sign In
              </a>
            </span>
          ) : (
            <span>
              Don't have an account?{' '}
              <a
                onClick={() => setIsSignUp(true)}
                style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: '600', textDecoration: 'underline' }}
              >
                Create Account
              </a>
            </span>
          )}
        </div>

        <div style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: '16px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>No Cloud Database? Run locally:</span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleOfflineMode}
            style={{
              padding: '10px',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            ⚡ Try Offline Demo (Local Storage)
          </button>
        </div>

      </div>
    </div>
  );
}
