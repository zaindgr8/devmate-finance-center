import React, { useState } from 'react';
import { Btn, Input } from './UI';
import Icon from './Icon';

export default function LoginView({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Simple frontend-only check as requested
    setTimeout(() => {
      if (email === 'zainulabideenbaloch@proton.me' && password === 'Ajalpc@yo1') {
        onLogin();
      } else {
        setError('Invalid email or password. Please try again.');
        setLoading(false);
      }
    }, 600);
  };

  return (
    <div className="login-container" style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc', // Light theme background
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 1000
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        padding: 40,
        background: '#ffffff',
        borderRadius: 24,
        border: '1px solid #e2e8f0',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: 32 }}>
          <img src="/logo_2.png" alt="Devmate" style={{ width: 64, height: 64, marginBottom: 16 }} />
          <h1 style={{ color: '#0f172a', fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>DEVMATE</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Finance Control Portal</p>
        </div>

        <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', color: '#475569', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>Email Address</label>
            <Input 
              type="email" 
              placeholder="zainulabideenbaloch@proton.me" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#1e293b' }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: '#475569', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>Password</label>
            <Input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#1e293b' }}
            />
          </div>

          {error && (
            <div style={{ 
              background: '#fef2f2', 
              color: '#b91c1c', 
              padding: '10px 14px', 
              borderRadius: 8, 
              fontSize: 12, 
              marginBottom: 20,
              border: '1px solid #fee2e2'
            }}>
              {error}
            </div>
          )}

          <Btn 
            type="submit" 
            disabled={loading}
            style={{ width: '100%', height: 48, fontSize: 14, fontWeight: 600 }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
            {!loading && <Icon name="plus" size={14} style={{ marginLeft: 8, transform: 'rotate(45deg)' }} />}
          </Btn>
        </form>

        <div style={{ marginTop: 32, fontSize: 11, color: '#94a3b8', letterSpacing: 0.5 }}>
          SECURE PORTAL ACCESS
        </div>
      </div>
    </div>
  );
}
