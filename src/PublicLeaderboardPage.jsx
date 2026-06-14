import React, { useEffect, useState } from 'react';
import LeaderboardPage from './app/pages/LeaderboardPage';
import SiteHeader from './components/SiteHeader';
import StickyTopChrome from './components/StickyTopChrome';
import MarketWhispererBanner from './components/MarketWhispererBanner';
import { loadUserBaskets } from './app/basketStore';
import { edgeX } from './designTokens';
import { getWaitlistStatus, supabase, signInWithGoogle } from './supabase';
import {
  captureAuthFailed,
  captureAuthStarted,
} from './analytics';

export default function PublicLeaderboardPage() {
  const [user, setUser] = useState(null);
  const [userBaskets, setUserBaskets] = useState(() => loadUserBaskets());
  const [waitlistStatus, setWaitlistStatus] = useState(null);

  useEffect(() => {
    if (!supabase) return undefined;

    const syncUser = async (session) => {
      setUser(session?.user ?? null);
      setUserBaskets(loadUserBaskets());
      if (session?.user) {
        try {
          setWaitlistStatus(await getWaitlistStatus());
        } catch {
          setWaitlistStatus(null);
        }
      } else {
        setWaitlistStatus(null);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => syncUser(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUser(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const goHome = () => {
    const url = new URL(window.location.href);
    url.search = '';
    window.location.href = url.pathname;
  };

  const handleSignIn = async () => {
    captureAuthStarted('public_leaderboard');
    try {
      await signInWithGoogle({ afterAuthPath: '/?leaderboard=1' });
    } catch (err) {
      captureAuthFailed({ source: 'public_leaderboard', error: err?.message });
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F7F5] text-neutral-900">
      <StickyTopChrome
        banner={<MarketWhispererBanner />}
        navigation={
          <SiteHeader onLogoClick={goHome} embedded sticky={false}>
            <button
              type="button"
              onClick={goHome}
              className="text-base text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Home
            </button>
            {!user ? (
              <button
                type="button"
                onClick={handleSignIn}
                className="pe-btn-primary text-sm px-5 py-2.5 shrink-0"
              >
                Sign in
              </button>
            ) : (
              <a href="/?waitlist=1" className="pe-btn-primary text-sm px-5 py-2.5 shrink-0">
                My waitlist
              </a>
            )}
          </SiteHeader>
        }
      />

      <main className={`${edgeX} py-8 sm:py-12`}>
        <LeaderboardPage
          user={user}
          userBaskets={userBaskets}
          waitlistStatus={waitlistStatus}
          publicView
          onChallengeEnter={handleSignIn}
        />
      </main>
    </div>
  );
}
