import React, { useEffect, useState } from 'react';
import { isRedesignThemeActive } from '../redesignFlags';

const REDESIGN_VARS = {
  '--pe-canvas': '#000000',
  '--pe-surface': '#000000',
  '--pe-text': '#ffffff',
  '--pe-text-secondary': '#a0a0a0',
  '--pe-text-muted': '#a0a0a0',
  '--pe-border': '#1a1a1a',
  '--pe-accent': '#ffffff',
  '--pe-accent-bright': '#ffffff',
  '--pe-positive': '#10b981',
  '--pe-negative': '#f43f5e',
  '--pe-warning': '#f59e0b',
};

/** Sets dark-theme token variables on a DOM ancestor for every child. */
export default function RedesignRoot({ children }) {
  const [active, setActive] = useState(() => isRedesignThemeActive());

  useEffect(() => {
    const onChange = () => setActive(isRedesignThemeActive());
    window.addEventListener('pe-theme-change', onChange);
    return () => window.removeEventListener('pe-theme-change', onChange);
  }, []);

  if (!active) return children;

  return (
    <div
      className="theme-redesign relative min-h-screen bg-pe-canvas text-pe-text"
      style={REDESIGN_VARS}
    >
      {children}
    </div>
  );
}
