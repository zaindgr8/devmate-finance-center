import React from 'react';
import Icon from './Icon';

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
