import React, { useEffect, useMemo, useState } from 'react';
import LandingPage from './LandingPage';
import DesignLibraryPage from './DesignLibraryPage';
import WaitlistPage from './WaitlistPage';
import PublicLeaderboardPage from './PublicLeaderboardPage';
import AppShell from './app/AppShell';
import MarketWhispererBanner from './components/MarketWhispererBanner';
import ChallengeProgressBanner from './components/ChallengeProgressBanner';
import { isDesignRoute, isLocalAppRoute, isAppShellRoute } from './app/appRoute';
import { loadUserBaskets } from './app/basketStore';
import { getChallengeProgress } from './challengeEligibility';
import {
  supabase,
  isWaitlistRoute,
  isLeaderboardRoute,
  cleanOAuthCallbackUrl,
  captureReferralFromUrl,
  enrollWaitlistMember,
  getWaitlistStatus,
} from './supabase';

function PageShell({ children, user, challengeProgress }) {
  const banner = user ? (
    <ChallengeProgressBanner progress={challengeProgress} />
  ) : (
    <MarketWhispererBanner />
  );

  return (
    <>
      <div className="sticky top-0 z-50 w-full isolate">{banner}</div>
      {children}
    </>
  );
}

function resolveRoute(session, accessConfirmed = false) {
  if (isDesignRoute()) return 'design';
  if (isLeaderboardRoute()) return 'leaderboard';
  if (isWaitlistRoute()) return 'waitlist';
  if (import.meta.env.DEV && isLocalAppRoute()) return 'app';
  if (session) {
    if (accessConfirmed) return 'app';
    return 'waitlist';
  }
  if (isAppShellRoute()) return 'landing';
  return 'landing';
}

export default function App() {
  const [route, setRoute] = useState(() => resolveRoute(null, false));
  const [user, setUser] = useState(null);
  const [userBaskets, setUserBaskets] = useState(() => loadUserBaskets());
  const [waitlistStatus, setWaitlistStatus] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(() => {
    if (!supabase) return false;
    const params = new URLSearchParams(window.location.search);
    return (
      params.has('code') ||
      params.has('error') ||
      params.has('error_description')
    );
  });

  const challengeProgress = useMemo(
    () => getChallengeProgress({ user, userBaskets, waitlistStatus }),
    [user, userBaskets, waitlistStatus]
  );

  const refreshBaskets = () => setUserBaskets(loadUserBaskets());

  useEffect(() => {
    captureReferralFromUrl();

    if (!supabase) {
      setRoute(resolveRoute(null, false));
      return undefined;
    }

    let mounted = true;

    const syncSession = async (session) => {
      if (!mounted) return false;

      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setUserBaskets(loadUserBaskets());

      if (nextUser) {
        try {
          await enrollWaitlistMember();
          const status = await getWaitlistStatus();
          if (mounted) setWaitlistStatus(status);
          return Boolean(status?.access_confirmed);
        } catch {
          if (mounted) setWaitlistStatus(null);
          return false;
        }
      }

      setWaitlistStatus(null);
      return false;
    };

    const finishBootstrap = async (session) => {
      if (!mounted) return;
      if (session) cleanOAuthCallbackUrl();
      const accessConfirmed = await syncSession(session);
      if (!mounted) return;
      setRoute(resolveRoute(session, accessConfirmed));
      setBootstrapping(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        finishBootstrap(session);
      }
      if (event === 'SIGNED_OUT') {
        syncSession(null);
        setRoute(resolveRoute(null, false));
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => finishBootstrap(session))
      .catch(() => finishBootstrap(null));

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    const refreshWaitlist = () => {
      getWaitlistStatus()
        .then((status) => {
          setWaitlistStatus(status);
          setRoute((prev) => {
            const next = resolveRoute(user, Boolean(status?.access_confirmed));
            return next === prev ? prev : next;
          });
        })
        .catch(() => {});
    };

    window.addEventListener('focus', refreshWaitlist);
    return () => window.removeEventListener('focus', refreshWaitlist);
  }, [user]);

  if (route === 'design') {
    return <DesignLibraryPage />;
  }

  if (bootstrapping && route !== 'app') {
    return (
      <PageShell user={user} challengeProgress={challengeProgress}>
        <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
        </div>
      </PageShell>
    );
  }

  if (route === 'app') {
    return (
      <AppShell
        user={user}
        userBaskets={userBaskets}
        waitlistStatus={waitlistStatus}
        challengeProgress={challengeProgress}
        onBasketsChange={refreshBaskets}
      />
    );
  }

  if (route === 'leaderboard') {
    return (
      <PageShell user={user} challengeProgress={challengeProgress}>
        <PublicLeaderboardPage />
      </PageShell>
    );
  }

  if (route === 'waitlist') {
    return (
      <PageShell user={user} challengeProgress={challengeProgress}>
        <WaitlistPage />
      </PageShell>
    );
  }

  return (
    <PageShell user={user} challengeProgress={challengeProgress}>
      <LandingPage />
    </PageShell>
  );
}
