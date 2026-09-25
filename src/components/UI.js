import React from 'react';
import { createPortal } from 'react-dom';

/* ── Badge ── */
export function Badge({ children, color }) {
  const cls = {
    green: 'badge-green',
    yellow: 'badge-yellow',
    red: 'badge-red',
    blue: 'badge-blue',
  };
  return <span className={`badge ${cls[color] || 'badge-blue'}`}>{children}</span>;
}

/* ── Stat Card ── */
export function StatCard({ label, value, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: accent || 'var(--text)' }}>
        {value}
      </div>
    </div>
  );
}

/* ── Button ── */
export function Btn({ children, variant = 'primary', size = 'md', onClick, disabled, style, className = '', ...rest }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant} btn-${size} ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ── Input ── */
export function Input({ label, style, ...props }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <input className="form-input" style={style} {...props} />
    </div>
  );
}

/* ── TextArea ── */
export function TextArea({ label, ...props }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <textarea className="form-textarea" {...props} />
    </div>
  );
}

/* ── Select ── */
export function Select({ label, options, ...props }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <select className="form-select" {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ── Avatar (initials, stable colour per name) ── */
export function Avatar({ name, size = 36 }) {
  const initials = (name || '?').trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  const hue = [...(name || 'X')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: `hsl(${hue},55%,92%)`, color: `hsl(${hue},45%,32%)` }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

/* ── Segmented control ── */
export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && <span className="seg-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ── Side drawer (slide-over panel) ── */
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 480 }) {
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  // Portal to <body> so animated (transformed) page wrappers can't trap the fixed overlay
  return createPortal(
    <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="drawer" style={{ width }} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="drawer-head">
          <div style={{ minWidth: 0 }}>
            <div className="drawer-title">{title}</div>
            {subtitle && <div className="drawer-sub">{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}

/* ── Empty state ── */
export function Empty({ icon = '✨', title, text, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {text && <div className="empty-text">{text}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}
