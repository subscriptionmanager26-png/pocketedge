import React, { useEffect, useMemo, useRef, useState } from 'react';
import LandingPage, { LandingSiteHeader } from './LandingPage';
import DesignLibraryPage from './DesignLibraryPage';
import WaitlistPage from './WaitlistPage';
import LegalPage, { LegalSiteHeader } from './LegalPage';
import PublicLeaderboardPage from './PublicLeaderboardPage';
import AppShell from './app/AppShell';
import MarketWhispererBanner from './components/MarketWhispererBanner';
import ChallengeProgressBanner from './components/ChallengeProgressBanner';
import StickyTopChrome from './components/StickyTopChrome';
import SiteHeader from './components/SiteHeader';
import { isDesignRoute, isLocalAppRoute, isAppShellRoute } from './app/appRoute';
import { loadUserBaskets, loadUserBasketsAsync, migrateLocalBasketsToDb } from './app/basketStore';
import { migrateLocalProfileToDb } from './app/profileStore';
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
import {
  captureOAuthCallbackError,
  captureAuthCompleted,
  captureChallengeProgress,
  captureScreen,
  captureUserSessionStarted,
  captureWaitlistJoined,
  captureWaitlistJoinFailed,
  syncUserWaitlistTraits,
} from './analytics';
import { getAppTab } from './app/appRoute';

function PageShell({ children, user, challengeProgress, navigation = null }) {
  const banner = user ? (
    <ChallengeProgressBanner progress={challengeProgress} />
  ) : (
    <MarketWhispererBanner />
  );

  return (
    <>
      <StickyTopChrome banner={banner} navigation={navigation} />
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

  const refreshBaskets = async () => {
    if (user?.id) {
      try {
        setUserBaskets(await loadUserBasketsAsync(user.id));
      } catch {
        setUserBaskets([]);
      }
      return;
    }
    setUserBaskets(loadUserBaskets());
  };
  const sessionTrackedRef = useRef(false);
  const lastProgressKeyRef = useRef('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  useEffect(() => {
    const tab = route === 'app' ? getAppTab() : null;
    const screen =
      route === 'app' && tab ? `app_${tab}` : route === 'landing' ? 'landing' : route;

    captureScreen(screen, {
      route,
      tab,
      signed_in: Boolean(user),
      access_confirmed: waitlistStatus?.access_confirmed ?? false,
    });
  }, [route, user, waitlistStatus?.access_confirmed]);

  useEffect(() => {
    if (!user || !waitlistStatus || sessionTrackedRef.current) return;
    sessionTrackedRef.current = true;
    syncUserWaitlistTraits(user, waitlistStatus);
    captureUserSessionStarted({
      accessConfirmed: Boolean(waitlistStatus.access_confirmed),
      waitlistStatus,
      challengeProgress,
    });
  }, [user, waitlistStatus, challengeProgress]);

  useEffect(() => {
    if (!user) return;
    const key = `${challengeProgress.basketCount}:${challengeProgress.referralCount}:${challengeProgress.referralsMet}`;
    if (lastProgressKeyRef.current === key) return;
    lastProgressKeyRef.current = key;
    captureChallengeProgress(challengeProgress, 'progress_changed');
  }, [user, challengeProgress]);

  useEffect(() => {
    captureOAuthCallbackError();

    captureReferralFromUrl();

    if (!supabase) {
      setRoute(resolveRoute(null));
      return undefined;
    }

    let mounted = true;

    const syncSession = async (session) => {
      if (!mounted) return { accessConfirmed: false, isNewWaitlistMember: false };

      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (nextUser) {
        try {
          const baskets = await migrateLocalBasketsToDb(nextUser.id);
          if (mounted) setUserBaskets(baskets);
          await migrateLocalProfileToDb(nextUser.id);
        } catch {
          if (mounted) setUserBaskets([]);
        }
      } else if (mounted) {
        setUserBaskets(loadUserBaskets());
      }

      if (nextUser) {
        identifyPostHogUser(nextUser);
        try {
          const hadReferral = Boolean(sessionStorage.getItem('waitlist_ref'));
          const enrollment = await enrollWaitlistMember();
          const isNewWaitlistMember = enrollment?.status === 'joined';
          if (isNewWaitlistMember) {
            captureWaitlistJoined({ referredByCode: hadReferral });
          }
          const status = await getWaitlistStatus();
          if (mounted) setWaitlistStatus(status);
          if (mounted && status) syncUserWaitlistTraits(nextUser, status);
          return {
            accessConfirmed: Boolean(status?.access_confirmed),
            isNewWaitlistMember,
          };
        } catch (err) {
          captureWaitlistJoinFailed(err);
          if (mounted) setWaitlistStatus(null);
          return { accessConfirmed: false, isNewWaitlistMember: false };
        }
      }

      setWaitlistStatus(null);
      return { accessConfirmed: false, isNewWaitlistMember: false };
    };

    const finishBootstrap = async (session, { trackSignIn = false } = {}) => {
      if (!mounted) return;
      if (session) cleanOAuthCallbackUrl();
      const { accessConfirmed, isNewWaitlistMember } = await syncSession(session);
      if (!mounted) return;
      if (trackSignIn && session?.user) {
        captureAuthCompleted({ isNewWaitlistMember });
      }
      setRoute(resolveRoute(session));
      setBootstrapping(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        finishBootstrap(session, { trackSignIn: event === 'SIGNED_IN' });
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
      <PageShell user={user} challengeProgress={challengeProgress} navigation={<LegalSiteHeader />}>
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
    return <PublicLeaderboardPage />;
  }

  if (route === 'waitlist') {
    return (
      <PageShell
        user={user}
        challengeProgress={challengeProgress}
        navigation={<SiteHeader logoHref="/" embedded sticky={false} />}
      >
        <WaitlistPage />
      </PageShell>
    );
  }

  return (
    <PageShell user={user} challengeProgress={challengeProgress} navigation={<LandingSiteHeader />}>
      <LandingPage />
    </PageShell>
  );
}
