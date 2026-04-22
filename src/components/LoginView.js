import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Btn, Input } from './UI';
import Icon from './Icon';

export default function LoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 1000
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        padding: 40,
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(12px)',
        borderRadius: 24,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: 32 }}>
          <img src="/logo_2.png" alt="Devmate" style={{ width: 64, height: 64, marginBottom: 16 }} />
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>DEVMATE</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 }}>Finance Control Portal</p>
        </div>

        <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 8, fontWeight: 500 }}>Email Address</label>
            <Input 
              type="email" 
              placeholder="name@company.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 8, fontWeight: 500 }}>Password</label>
            <Input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
            />
          </div>

          {error && (
            <div style={{ 
              background: 'rgba(239, 68, 68, 0.1)', 
              color: '#f87171', 
              padding: '10px 14px', 
              borderRadius: 8, 
              fontSize: 12, 
              marginBottom: 20,
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}>
              {error}
            </div>
          )}

          <Btn 
            type="submit" 
            disabled={loading}
            style={{ width: '100%', height: 48, fontSize: 14, fontWeight: 600 }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            {!loading && <Icon name="plus" size={14} style={{ marginLeft: 8, transform: 'rotate(45deg)' }} />}
          </Btn>
        </form>

        <div style={{ marginTop: 32, fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>
          SECURED BY SUPABASE AUTH
        </div>
      </div>
    </div>
  );
}
