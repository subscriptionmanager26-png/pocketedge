import React, { useCallback, useEffect, useState } from 'react';
import AppTopBar from './components/AppTopBar';
import BottomNav from './components/BottomNav';
import BasketDetailView from './components/BasketDetailView';
import DashboardPage from './pages/DashboardPage';
import SearchPage from './pages/SearchPage';
import CreateBasketPage from './pages/CreateBasketPage';
import LeaderboardPage from './pages/LeaderboardPage';
import AccountPage from './pages/AccountPage';
import {
  getAppTab,
  getBasketIdFromUrl,
  getCreateRouteFromUrl,
  navigateApp,
} from './appRoute';
import { loadNotifications, syncSubscribedBasketNotifications } from './notificationStore';
import { loadSubscribedBasketIds } from './subscriptionStore';
import { enrichBasket, getBasketById } from './basketCatalog';
import { loadUserProfile, loadUserProfileAsync } from './profileStore';
import { getReferralStats, signInWithGoogle } from '../supabase';
import StickyTopChrome from '../components/StickyTopChrome';
import ChallengeProgressBanner from '../components/ChallengeProgressBanner';
import MarketWhispererBanner from '../components/MarketWhispererBanner';
import { edgeX } from '../designTokens';
import {
  captureAppTabViewed,
  captureAuthStarted,
} from '../analytics';
import { CAMPAIGN_UI_ENABLED } from '../campaignFlags';

export default function AppShell({
  user,
  userBaskets,
  referralStats,
  challengeProgress,
  onBasketsChange,
}) {
  const [tab, setTab] = useState(getAppTab);
  const [basketId, setBasketId] = useState(getBasketIdFromUrl);
  const [createRoute, setCreateRoute] = useState(getCreateRouteFromUrl);
  const [localReferralStats, setLocalReferralStats] = useState(referralStats);
  const [profileVersion, setProfileVersion] = useState(0);
  const [userProfile, setUserProfile] = useState(() => loadUserProfile(user?.id || 'local'));

  const effectiveReferralStats = referralStats ?? localReferralStats;

  const userId = user?.id || 'local';

  useEffect(() => {
    let mounted = true;
    loadUserProfileAsync(userId)
      .then((profile) => {
        if (mounted) setUserProfile(profile);
      })
      .catch(() => {
        if (mounted) setUserProfile(loadUserProfile(userId));
      });
    return () => {
      mounted = false;
    };
  }, [userId, profileVersion]);

  const displayName =
    userProfile.name?.trim() ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    'You';

  const syncRoute = useCallback(() => {
    setTab(getAppTab());
    setBasketId(getBasketIdFromUrl());
    setCreateRoute(getCreateRouteFromUrl());
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, [syncRoute]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, basketId, createRoute.editId, createRoute.isNew]);

  useEffect(() => {
    const createMode = createRoute.isNew
      ? 'new'
      : createRoute.editId
        ? 'edit'
        : tab === 'create'
          ? 'hub'
          : null;

    captureAppTabViewed(tab, {
      basketId,
      createMode,
    });
  }, [tab, basketId, createRoute.editId, createRoute.isNew]);

  useEffect(() => {
    loadNotifications();
    syncSubscribedBasketNotifications(loadSubscribedBasketIds());
  }, []);

  useEffect(() => {
    setLocalReferralStats(referralStats);
  }, [referralStats]);

  useEffect(() => {
    if (!user || referralStats) return;
    getReferralStats().then(setLocalReferralStats).catch(() => {});
  }, [user, tab, referralStats]);

  const handleSignIn = async () => {
    captureAuthStarted('app_leaderboard');
    try {
      await signInWithGoogle();
    } catch {
      // Supabase not configured or user cancelled
    }
  };

  const handleNavigate = (nextTab) => {
    if (nextTab === 'create') {
      navigateApp({ tab: 'create', createNew: false });
    } else {
      navigateApp({ tab: nextTab });
    }
    setTab(nextTab);
    setBasketId(null);
    setCreateRoute(getCreateRouteFromUrl());
  };

  const selectedBasket = basketId
    ? enrichBasket(getBasketById(basketId, userBaskets))
    : null;
  const isOwnBasket = userBaskets.some((b) => b.id === basketId);
  const { editId: editBasketId, isNew: creatingNew } = createRoute;
  const editBasket = editBasketId
    ? userBaskets.find((b) => b.id === editBasketId) ?? null
    : null;
  const showMainNav = tab !== 'basket';
  const navTab = tab === 'basket' ? 'search' : tab;

  const banner = user ? (
    <ChallengeProgressBanner progress={challengeProgress} />
  ) : (
    <MarketWhispererBanner />
  );

  return (
    <div className="min-h-screen w-full bg-[#F7F7F5] text-neutral-900 flex flex-col">
      <StickyTopChrome
        banner={banner}
        navigation={
          <AppTopBar activeTab={navTab} onNavigate={handleNavigate} />
        }
      />

      <main
        className={`flex-1 w-full overflow-x-hidden ${
          tab === 'basket' ? 'px-0' : edgeX
        } ${
          tab === 'basket' ? 'py-0' : 'py-4 sm:py-5'
        } ${showMainNav ? 'pb-24 lg:pb-10' : 'pb-8'}`}
      >
        {tab === 'basket' && selectedBasket ? (
          <BasketDetailView
            basket={selectedBasket}
            isOwn={isOwnBasket}
            onBack={() => handleNavigate('search')}
            onEdit={
              isOwnBasket
                ? () => {
                    navigateApp({ tab: 'create', editBasketId: basketId });
                  }
                : undefined
            }
          />
        ) : (
          <>
            {tab === 'dashboard' && <DashboardPage userBaskets={userBaskets} />}
            {tab === 'search' && <SearchPage userBaskets={userBaskets} />}
            {CAMPAIGN_UI_ENABLED && tab === 'leaderboard' && (
              <LeaderboardPage
                userBaskets={userBaskets}
                user={user}
                referralStats={effectiveReferralStats}
                onChallengeEnter={handleSignIn}
              />
            )}
            {tab === 'create' && (
              <CreateBasketPage
                key={`${profileVersion}-${editBasketId || (creatingNew ? 'new' : 'hub')}`}
                editBasketId={editBasketId}
                creatingNew={creatingNew}
                editBasket={editBasket}
                onCreated={onBasketsChange}
                userProfile={userProfile}
                displayName={displayName}
                userBaskets={userBaskets}
                userId={userId}
              />
            )}
            {tab === 'account' && (
              <AccountPage
                key={profileVersion}
                user={user}
                userId={userId}
                referralCount={effectiveReferralStats?.referral_count ?? 0}
                onProfileSaved={() => setProfileVersion((v) => v + 1)}
              />
            )}
            {tab === 'basket' && !selectedBasket && (
              <div className="text-center py-16 text-neutral-500 text-sm">
                Basket not found.{' '}
                <button
                  type="button"
                  onClick={() => handleNavigate('search')}
                  className="text-neutral-900 font-medium"
                >
                  Browse baskets
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {showMainNav && (
        <BottomNav activeTab={navTab} onNavigate={handleNavigate} />
      )}
    </div>
  );
}
