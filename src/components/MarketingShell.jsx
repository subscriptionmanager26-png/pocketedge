import { useCallback, useEffect, useState } from 'react';
import AuthLayoutHeader from './AuthLayoutHeader';
import { signInWithGoogle } from '../lib/supabase';

/**
 * Shared chrome for public marketing pages (Insights, Learning, Disclosures, Resources).
 */
export default function MarketingShell({ children, wide = false }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const handleGetStarted = async () => {
    try {
      setLoading(true);
      setError('');
      closeDrawer();
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || 'Could not start Google sign-in.');
      setLoading(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeDrawer]);

  useEffect(() => {
    document.body.classList.toggle('overflow-hidden', drawerOpen);
    return () => document.body.classList.remove('overflow-hidden');
  }, [drawerOpen]);

  return (
    <div
      className={`flex min-h-dvh flex-col bg-pe-canvas text-pe-text${
        drawerOpen ? ' overflow-hidden' : ''
      }`}
    >
      <AuthLayoutHeader
        showMarketingNav
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen((open) => !open)}
        onCloseDrawer={closeDrawer}
        onGetStarted={handleGetStarted}
        loading={loading}
      />

      <main
        className={`mx-auto w-full flex-1 px-4 py-8 md:px-8 md:py-10 ${
          wide ? 'max-w-6xl' : 'max-w-3xl'
        }`}
      >
        {children}
        {error ? <p className="mt-6 text-sm text-pe-negative">{error}</p> : null}
      </main>
    </div>
  );
}
