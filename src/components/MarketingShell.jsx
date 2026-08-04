import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FeedTopBar from './feed-v1/FeedTopBar';
import { useIsAuthenticated } from '../hooks/useIsAuthenticated';
import { getAppCurrentUser } from '../lib/socialIdentity';
import { ideasPath, disclosuresPath, insightsPath, resourcesPath, tabPath } from '../lib/routes';
import { signInWithGoogle } from '../lib/supabase';

const MENU_ITEMS = [
  { label: 'Insights', href: insightsPath() },
  { label: 'ETF iNAV tracker', href: resourcesPath('etf-inav') },
  { label: 'SGB Tracker', href: resourcesPath('sgb') },
  { label: 'MF Screener', href: resourcesPath('mf-screener') },
  { label: 'Disclosures', href: disclosuresPath() },
];

/**
 * Public marketing pages chrome — same FeedTopBar as the app (no asset-class dropdowns).
 */
export default function MarketingShell({ children, wide = false }) {
  const navigate = useNavigate();
  const isAuthenticated = useIsAuthenticated();
  const guestMode = !isAuthenticated;
  const [searchQuery, setSearchQuery] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');

  const currentUser = getAppCurrentUser();
  const avatarInitial = (currentUser?.name || currentUser?.handle || 'P')
    .trim()
    .charAt(0)
    .toUpperCase();

  const requireSignIn = useCallback(async () => {
    try {
      setSigningIn(true);
      setError('');
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || 'Could not start Google sign-in.');
      setSigningIn(false);
    }
  }, []);

  const goHome = useCallback(() => {
    navigate(isAuthenticated ? tabPath('feed') : '/');
  }, [navigate, isAuthenticated]);

  const goIdeas = useCallback(() => {
    navigate(ideasPath());
  }, [navigate]);

  const goProfile = useCallback(() => {
    if (guestMode) {
      requireSignIn();
      return;
    }
    navigate(tabPath('profile'));
  }, [guestMode, navigate, requireSignIn]);

  const goSettings = useCallback(() => {
    if (guestMode) {
      requireSignIn();
      return;
    }
    navigate(tabPath('settings'));
  }, [guestMode, navigate, requireSignIn]);

  const goActivity = useCallback(() => {
    if (guestMode) {
      requireSignIn();
      return;
    }
    navigate(tabPath('activity'));
  }, [guestMode, navigate, requireSignIn]);

  return (
    <div className="pe-feed-v1 flex min-h-dvh flex-col bg-white text-[var(--fv-text)]">
      <FeedTopBar
        standalone
        wide={wide}
        guestMode={guestMode}
        avatarInitial={avatarInitial}
        menuItems={MENU_ITEMS}
        searchQuery={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          if (value.trim()) goIdeas();
        }}
        onSearchFocus={goIdeas}
        onSearchClear={() => setSearchQuery('')}
        onGoHome={goHome}
        onActivity={goActivity}
        onProfile={goProfile}
        onSettings={goSettings}
      />

      <main
        className={`mx-auto w-full flex-1 px-4 py-6 md:px-8 md:py-8 print:max-w-none print:px-0 print:py-0 ${
          wide ? 'max-w-6xl' : 'max-w-3xl'
        }`}
      >
        {children}
        {error ? (
          <p className="mt-6 text-sm text-[var(--fv-negative)]">{error}</p>
        ) : null}
        {signingIn ? (
          <p className="mt-4 text-sm text-[var(--fv-text-muted)]">Redirecting to sign in…</p>
        ) : null}
      </main>
    </div>
  );
}
