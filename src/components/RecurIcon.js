import React from 'react';

// Small "repeats" arrows shown next to monthly (recurring) bills
export default function RecurIcon({ size = 13 }) {
  return (
    <span className="recur-icon" title="Monthly · repeats every month" aria-label="Monthly, repeats every month" role="img">
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2.5 7.5a5.5 5.5 0 0 1 9.4-3.9L13.5 5" />
        <path d="M13.5 2v3h-3" />
        <path d="M13.5 8.5a5.5 5.5 0 0 1-9.4 3.9L2.5 11" />
        <path d="M2.5 14v-3h3" />
      </svg>
    </span>
  );
}
