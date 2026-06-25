import React, { useEffect, useMemo, useRef, useState } from 'react';
import LandingPage, { LandingSiteHeader } from './LandingPage';
import DesignLibraryPage from './DesignLibraryPage';
import LegalPage, { LegalSiteHeader } from './LegalPage';
import PublicLeaderboardPage from './PublicLeaderboardPage';
import AppShell from './app/AppShell';
import MarketWhispererBanner from './components/MarketWhispererBanner';
import ChallengeProgressBanner from './components/ChallengeProgressBanner';
import StickyTopChrome from './components/StickyTopChrome';
import { isDesignRoute, isLocalAppRoute, isAppShellRoute } from './app/appRoute';
import { loadUserBaskets, loadUserBasketsAsync, migrateLocalBasketsToDb } from './app/basketStore';
import { fetchMarketplaceBaskets } from './app/userDataApi';
import { migrateLocalProfileToDb } from './app/profileStore';
import { getChallengeProgress } from './challengeEligibility';
import { CAMPAIGN_UI_ENABLED } from './campaignFlags';
import { isLegalRoute } from './legalRoute';
import { isChallengeDemoRoute, isReferralsDemoRoute, isStep2DemoRoute } from './demoRoute';
import ReferralsDemoPage from './ReferralsDemoPage';
import ChallengeDemoPage from './ChallengeDemoPage';
import Step2DemoPage from './Step2DemoPage';
import {
  supabase,
  isLeaderboardRoute,
  cleanOAuthCallbackUrl,
  captureReferralFromUrl,
  recordAppSignup,
  getReferralStats,
} from './supabase';
import { identifyPostHogUser, resetPostHogUser } from './posthog';
import {
  captureOAuthCallbackError,
  captureAuthCompleted,
  captureChallengeProgress,
  captureScreen,
  captureSignupFailed,
  captureSignupRecorded,
  captureUserSessionStarted,
  syncUserReferralTraits,
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
  if (isLeaderboardRoute()) return CAMPAIGN_UI_ENABLED ? 'leaderboard' : 'landing';
  if (import.meta.env.DEV && isLocalAppRoute()) return 'app';
  if (session) return 'app';
  if (isAppShellRoute()) return 'landing';
  return 'landing';
}

export default function App() {
  const [route, setRoute] = useState(() => resolveRoute(null));
  const [user, setUser] = useState(null);
  const [userBaskets, setUserBaskets] = useState(() => loadUserBaskets());
  const [marketplaceBaskets, setMarketplaceBaskets] = useState([]);
  const [referralStats, setReferralStats] = useState(null);
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
    () => getChallengeProgress({ user, userBaskets, referralStats }),
    [user, userBaskets, referralStats]
  );

  const refreshBaskets = async () => {
    try {
      const market = await fetchMarketplaceBaskets();
      if (market) setMarketplaceBaskets(market);
    } catch {
      setMarketplaceBaskets([]);
    }

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

  useEffect(() => {
    fetchMarketplaceBaskets()
      .then(setMarketplaceBaskets)
      .catch(() => setMarketplaceBaskets([]));
  }, []);
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
      referral_count: referralStats?.referral_count ?? 0,
    });
  }, [route, user, referralStats?.referral_count]);

  useEffect(() => {
    if (!user || !referralStats || sessionTrackedRef.current) return;
    sessionTrackedRef.current = true;
    syncUserReferralTraits(user, referralStats);
    captureUserSessionStarted({
      referralStats,
      challengeProgress,
    });
  }, [user, referralStats, challengeProgress]);

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
      if (!mounted) return { isNewMember: false };

      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (nextUser) {
        try {
          const baskets = await migrateLocalBasketsToDb(nextUser.id);
          if (mounted) setUserBaskets(baskets);
        } catch {
          if (mounted) setUserBaskets([]);
        }

        try {
          await migrateLocalProfileToDb(nextUser.id, nextUser);
        } catch {
          // Profile sync is best-effort; user can save manually on Account.
        }
      } else if (mounted) {
        setUserBaskets(loadUserBaskets());
      }

      if (nextUser) {
        identifyPostHogUser(nextUser);
        try {
          const hadReferral = Boolean(sessionStorage.getItem('referral_ref'));
          const signup = await recordAppSignup();
          const isNewMember = signup?.status === 'joined';
          if (isNewMember) {
            captureSignupRecorded({ referredByCode: hadReferral });
          }
          const stats = await getReferralStats();
          if (mounted) setReferralStats(stats);
          if (mounted && stats) syncUserReferralTraits(nextUser, stats);
          return { isNewMember };
        } catch (err) {
          captureSignupFailed(err);
          if (mounted) setReferralStats(null);
          return { isNewMember: false };
        }
      }

      setReferralStats(null);
      return { isNewMember: false };
    };

    const finishBootstrap = async (session, { trackSignIn = false } = {}) => {
      if (!mounted) return;
      if (session) cleanOAuthCallbackUrl();
      const { isNewMember } = await syncSession(session);
      if (!mounted) return;
      if (trackSignIn && session?.user) {
        captureAuthCompleted({ isNewMember });
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

    const refreshReferrals = () => {
      getReferralStats()
        .then((stats) => {
          setReferralStats(stats);
        })
        .catch(() => {});
    };

    window.addEventListener('focus', refreshReferrals);
    return () => window.removeEventListener('focus', refreshReferrals);
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
        <div className="min-h-screen flex items-center justify-center bg-pe-canvas">
          <div className={`w-10 h-10 border-2 rounded-full animate-spin border-pe-border border-t-pe-text`} />
        </div>
      </PageShell>
    );
  }

  if (route === 'app') {
    return (
      <AppShell
        user={user}
        userBaskets={userBaskets}
        marketplaceBaskets={marketplaceBaskets}
        referralStats={referralStats}
        challengeProgress={challengeProgress}
        onBasketsChange={refreshBaskets}
      />
    );
  }

  if (route === 'leaderboard') {
    return <PublicLeaderboardPage marketplaceBaskets={marketplaceBaskets} />;
  }

  return (
    <PageShell
      user={user}
      challengeProgress={challengeProgress}
      navigation={<LandingSiteHeader />}
    >
      <LandingPage marketplaceBaskets={marketplaceBaskets} />
    </PageShell>
  );
}
