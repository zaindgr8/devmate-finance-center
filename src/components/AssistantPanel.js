import React, { useState } from 'react';
import { getSession } from '../api';

// Floating chat box that sends a prompt to /api/assistant (Gemini + Supabase tools)
export default function AssistantPanel({ onDataChanged }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]); // { role: 'user'|'assistant'|'error', text }
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const prompt = input.trim();
    if (!prompt || busy) return;
    setInput('');
    // Earlier turns (without errors) so follow-up prompts have context
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: 'user', text: prompt }]);
    setBusy(true);
    try {
      const session = await getSession();
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ prompt, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.changed && onDataChanged) onDataChanged();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setMessages((m) => [...m, { role: 'assistant', text: data.reply, toolLog: data.toolLog }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'error', text: e.message }]);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const panelStyle = {
    position: 'fixed', right: 20, bottom: 20, zIndex: 1000,
    width: 'min(380px, calc(100vw - 32px))', background: 'var(--surface, #fff)',
    border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', right: 20, bottom: 20, zIndex: 1000,
          padding: '10px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
          background: '#111827', color: '#fff', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}
      >
        Assistant
      </button>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #e5e7eb' }}>
        <strong>Assistant</strong>
        <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18 }} aria-label="Close">×</button>
      </div>
      <div style={{ flex: 1, minHeight: 200, maxHeight: 360, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && (
          <div style={{ color: '#6b7280', fontSize: 13 }}>
            Try: "How many pending invoices do we have?" or "Add client Acme Ltd".
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%', padding: '8px 10px', borderRadius: 10, fontSize: 14, whiteSpace: 'pre-wrap',
              background: m.role === 'user' ? '#111827' : m.role === 'error' ? '#fee2e2' : '#f3f4f6',
              color: m.role === 'user' ? '#fff' : m.role === 'error' ? '#991b1b' : '#111827',
            }}
          >
            {m.text}
            {m.toolLog?.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280' }}>
                Used: {m.toolLog.map((t) => t.name + (t.ok ? '' : ' (failed)')).join(', ')}
              </div>
            )}
          </div>
        ))}
        {busy && <div style={{ color: '#6b7280', fontSize: 13 }}>Thinking…</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #e5e7eb' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          placeholder="Ask or tell me what to do…"
          style={{ flex: 1, resize: 'none', padding: 8, borderRadius: 8, border: '1px solid #d1d5db', fontFamily: 'inherit', fontSize: 14 }}
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          style={{ padding: '0 14px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', cursor: 'pointer', opacity: busy || !input.trim() ? 0.5 : 1 }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
