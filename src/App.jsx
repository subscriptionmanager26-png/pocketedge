import React, { useEffect, useMemo, useState } from 'react';
import LandingPage from './LandingPage';
import DesignLibraryPage from './DesignLibraryPage';
import WaitlistPage from './WaitlistPage';
import LegalPage from './LegalPage';
import PublicLeaderboardPage from './PublicLeaderboardPage';
import AppShell from './app/AppShell';
import MarketWhispererBanner from './components/MarketWhispererBanner';
import ChallengeProgressBanner from './components/ChallengeProgressBanner';
import { isDesignRoute, isLocalAppRoute, isAppShellRoute } from './app/appRoute';
import { loadUserBaskets } from './app/basketStore';
import { getChallengeProgress } from './challengeEligibility';
import { isLegalRoute } from './legalRoute';
import { isChallengeDemoRoute, isReferralsDemoRoute, isStep2DemoRoute } from './demoRoute';
import ReferralsDemoPage from './ReferralsDemoPage';
import ChallengeDemoPage from './ChallengeDemoPage';
import Step2DemoPage from './Step2DemoPage';
import {
  supabase,
  isWaitlistRoute,
  isLeaderboardRoute,
  cleanOAuthCallbackUrl,
  captureReferralFromUrl,
  enrollWaitlistMember,
  getWaitlistStatus,
} from './supabase';
import { identifyPostHogUser, resetPostHogUser } from './posthog';

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

function resolveRoute(session) {
  if (isStep2DemoRoute()) return 'step2-demo';
  if (isChallengeDemoRoute()) return 'challenge-demo';
  if (isReferralsDemoRoute()) return 'referrals-demo';
  if (isDesignRoute()) return 'design';
  if (isLegalRoute()) return 'legal';
  if (isLeaderboardRoute()) return 'leaderboard';
  if (isWaitlistRoute()) return session ? 'app' : 'waitlist';
  if (import.meta.env.DEV && isLocalAppRoute()) return 'app';
  if (session) return 'app';
  if (isAppShellRoute()) return 'landing';
  return 'landing';
}

export default function App() {
  const [route, setRoute] = useState(() => resolveRoute(null));
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
    window.scrollTo(0, 0);
  }, [route]);

  useEffect(() => {
    captureReferralFromUrl();

    if (!supabase) {
      setRoute(resolveRoute(null));
      return undefined;
    }

    let mounted = true;

    const syncSession = async (session) => {
      if (!mounted) return false;

      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setUserBaskets(loadUserBaskets());

      if (nextUser) {
        identifyPostHogUser(nextUser);
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
      resetPostHogUser();
      return false;
    };

    const finishBootstrap = async (session) => {
      if (!mounted) return;
      if (session) cleanOAuthCallbackUrl();
      const accessConfirmed = await syncSession(session);
      if (!mounted) return;
      setRoute(resolveRoute(session));
      setBootstrapping(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        finishBootstrap(session);
      }
      if (event === 'SIGNED_OUT') {
        resetPostHogUser();
        syncSession(null);
        setRoute(resolveRoute(null));
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
            const next = resolveRoute(user);
            return next === prev ? prev : next;
          });
        })
        .catch(() => {});
    };

    window.addEventListener('focus', refreshWaitlist);
    return () => window.removeEventListener('focus', refreshWaitlist);
  }, [user]);

  if (route === 'step2-demo') {
    return <Step2DemoPage />;
  }

  if (route === 'challenge-demo') {
    return <ChallengeDemoPage />;
  }

  if (route === 'referrals-demo') {
    return <ReferralsDemoPage />;
  }

  if (route === 'design') {
    return <DesignLibraryPage />;
  }

  if (route === 'legal') {
    return (
      <PageShell user={user} challengeProgress={challengeProgress}>
        <LegalPage />
      </PageShell>
    );
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
    const accessLimited = Boolean(user && waitlistStatus?.access_confirmed !== true);

    return (
      <AppShell
        user={user}
        userBaskets={userBaskets}
        waitlistStatus={waitlistStatus}
        challengeProgress={challengeProgress}
        accessLimited={accessLimited}
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
