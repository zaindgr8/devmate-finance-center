import React, { useState } from 'react';
import Icon from './Icon';
import { signIn } from '../api';

export default function LoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isMissingConfig = !process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_SUPABASE_ANON_KEY;

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isMissingConfig) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Session is picked up by the auth listener in App
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err?.message === 'Invalid login credentials'
        ? 'Invalid email or password. Please try again.'
        : err?.message || 'Sign in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-aside">
        <div className="login-aside-inner">
          <img src="/logo_2.png" alt="" style={{ width: 48, height: 48, borderRadius: 12, background: '#fff', padding: 4 }} />
          <h2>Every dirham,<br />accounted for.</h2>
          <p>Invoices, salaries, clients and expenses. One ledger for Devmate Solutions.</p>
          <div className="login-aside-foot">DUBAI · MUSCAT · NEW YORK</div>
        </div>
      </div>

      <div className="login-main">
        <form onSubmit={handleLogin} className="login-card">
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'var(--primary)' }}>DEVMATE FINANCE CENTER</div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, marginTop: 6 }}>Welcome back</h1>
            <p style={{ color: 'var(--text-light)', fontSize: 13, marginTop: 4 }}>Sign in to continue to your portal.</p>
          </div>

          {isMissingConfig && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
              padding: '10px 14px',
              color: '#ef4444',
              fontSize: 12,
              marginBottom: 18,
              lineHeight: 1.4
            }}>
              <strong>Missing Supabase Configuration:</strong> Please create <code>.env.local</code> with <code>REACT_APP_SUPABASE_URL</code> and <code>REACT_APP_SUPABASE_ANON_KEY</code>, then restart the server.
            </div>
          )}

          <label className="form-label" htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            className="form-input"
            type="email"
            autoComplete="username"
            placeholder="you@devmatesolutions.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ marginBottom: 18, height: 46 }}
          />

          <label className="form-label" htmlFor="login-password">Password</label>
          <div style={{ position: 'relative', marginBottom: 22 }}>
            <input
              id="login-password"
              className="form-input"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ height: 46, paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: 4, display: 'flex' }}
            >
              <Icon name="eye" size={16} />
            </button>
          </div>

          {error && <div className="login-error" role="alert">{error}</div>}

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', justifyContent: 'center', height: 48 }}>
            {loading ? 'Signing in…' : 'Sign in'}
            {!loading && <Icon name="arrow-right" size={16} />}
          </button>

          <div style={{ marginTop: 28, fontSize: 11, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', letterSpacing: 0.5 }}>
            <Icon name="lock" size={12} /> Secured with Supabase Auth
          </div>
        </form>
      </div>
    </div>
  );
}
