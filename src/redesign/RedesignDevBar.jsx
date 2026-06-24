import React, { useEffect, useState } from 'react';
import { isRedesignThemeActive, withRedesignParam } from '../redesignFlags';

const LINKS = [
  { label: 'Landing', href: '/' },
  { label: 'App', href: '/?app=1&tab=dashboard' },
  { label: 'Discover', href: '/?app=1&tab=search' },
  { label: 'Create', href: '/?app=1&tab=create' },
  { label: 'Account', href: '/?app=1&tab=account' },
  { label: 'Design lib', href: '/?design=1' },
];

export default function RedesignDevBar() {
  const [dark, setDark] = useState(() => isRedesignThemeActive());

  useEffect(() => {
    const onChange = () => setDark(isRedesignThemeActive());
    window.addEventListener('pe-theme-change', onChange);
    return () => window.removeEventListener('pe-theme-change', onChange);
  }, []);

  if (!import.meta.env.DEV || !dark) return null;

  const legacyHref = (() => {
    const url = new URL(window.location.href);
    url.searchParams.set('legacy', '1');
    return url.pathname + url.search;
  })();

  return (
    <div className="pe-redesign-devbar" role="status">
      <span className="text-white font-medium">Dark theme (production)</span>
      {LINKS.map((link) => (
        <a key={link.href} href={link.href}>
          {link.label}
        </a>
      ))}
      <button
        type="button"
        onClick={() => {
          const next = withRedesignParam();
          navigator.clipboard?.writeText(`${window.location.origin}${next}`);
        }}
      >
        Copy link
      </button>
      <a href={legacyHref}>Legacy light</a>
    </div>
  );
}
