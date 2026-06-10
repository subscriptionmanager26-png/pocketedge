import React, { useCallback, useEffect, useState } from 'react';
import AppTopBar from './components/AppTopBar';
import BottomNav from './components/BottomNav';
import BasketDetailView from './components/BasketDetailView';
import DashboardPage from './pages/DashboardPage';
import SearchPage from './pages/SearchPage';
import CreateBasketPage from './pages/CreateBasketPage';
import LeaderboardPage from './pages/LeaderboardPage';
import AccountPage from './pages/AccountPage';
import { getAppTab, getBasketIdFromUrl, getEditBasketIdFromUrl, navigateApp } from './appRoute';
import { loadNotifications } from './notificationStore';
import { enrichBasket, getBasketById } from './basketCatalog';
import { loadUserProfile } from './profileStore';
import { getWaitlistStatus, signInWithGoogle } from '../supabase';
import StickyTopChrome from '../components/StickyTopChrome';
import ChallengeProgressBanner from '../components/ChallengeProgressBanner';
import MarketWhispererBanner from '../components/MarketWhispererBanner';
import { edgeX } from '../designTokens';

export default function AppShell({
  user,
  userBaskets,
  waitlistStatus,
  challengeProgress,
  onBasketsChange,
}) {
  const [tab, setTab] = useState(getAppTab);
  const [basketId, setBasketId] = useState(getBasketIdFromUrl);
  const [localWaitlistStatus, setLocalWaitlistStatus] = useState(waitlistStatus);
  const [profileVersion, setProfileVersion] = useState(0);

  const effectiveWaitlistStatus = waitlistStatus ?? localWaitlistStatus;

  const userId = user?.id || 'local';
  const userProfile = loadUserProfile(userId);
  const displayName =
    userProfile.name?.trim() ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    'You';

  const syncRoute = useCallback(() => {
    setTab(getAppTab());
    setBasketId(getBasketIdFromUrl());
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, [syncRoute]);

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    setLocalWaitlistStatus(waitlistStatus);
  }, [waitlistStatus]);

  useEffect(() => {
    if (!user || waitlistStatus) return;
    getWaitlistStatus().then(setLocalWaitlistStatus).catch(() => {});
  }, [user, tab, waitlistStatus]);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch {
      // Supabase not configured or user cancelled
    }
  };

  const handleNavigate = (nextTab) => {
    navigateApp({ tab: nextTab });
    setTab(nextTab);
    setBasketId(null);
  };

  const selectedBasket = basketId
    ? enrichBasket(getBasketById(basketId, userBaskets))
    : null;
  const isOwnBasket = userBaskets.some((b) => b.id === basketId);
  const editBasketId = getEditBasketIdFromUrl();
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
        navigation={<AppTopBar activeTab={navTab} onNavigate={handleNavigate} />}
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
                    setTab('create');
                    setBasketId(null);
                  }
                : undefined
            }
          />
        ) : (
          <>
            {tab === 'dashboard' && <DashboardPage userBaskets={userBaskets} />}
            {tab === 'search' && <SearchPage userBaskets={userBaskets} />}
            {tab === 'leaderboard' && (
              <LeaderboardPage
                userBaskets={userBaskets}
                user={user}
                waitlistStatus={effectiveWaitlistStatus}
                onChallengeEnter={handleSignIn}
              />
            )}
            {tab === 'create' && (
              <CreateBasketPage
                key={`${profileVersion}-${editBasketId || 'new'}`}
                editBasketId={editBasketId}
                editBasket={editBasket}
                onCreated={onBasketsChange}
                userProfile={userProfile}
                displayName={displayName}
                userBaskets={userBaskets}
              />
            )}
            {tab === 'account' && (
              <AccountPage
                key={profileVersion}
                user={user}
                userId={userId}
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
