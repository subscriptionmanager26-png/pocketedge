import React, { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import SearchBasketCard from '../components/SearchBasketCard';
import { getBasketById, mergeDiscoverBaskets } from '../basketCatalog';
import { navigateApp } from '../appRoute';
import { loadSubscribedBasketIds, subscribeSubscriptions } from '../subscriptionStore';
import AppPageLayout from '../components/AppPageLayout';

const CARD_GRID =
  'grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-3 sm:gap-3 sm:items-stretch';
const SECTION_DIVIDER = 'pt-5 border-t border-pe-border';

export default function DashboardPage({ userBaskets, marketplaceBaskets = [] }) {
  const [followedIds, setFollowedIds] = useState(loadSubscribedBasketIds);

  useEffect(() => subscribeSubscriptions(setFollowedIds), []);

  const discoverBaskets = useMemo(
    () => mergeDiscoverBaskets(userBaskets, marketplaceBaskets),
    [userBaskets, marketplaceBaskets]
  );

  const followedBaskets = useMemo(
    () =>
      followedIds
        .map((id) => getBasketById(id, userBaskets, marketplaceBaskets))
        .filter(Boolean),
    [followedIds, userBaskets, marketplaceBaskets]
  );

  const trendingBaskets = useMemo(() => {
    const tagged = discoverBaskets.filter((b) => b.badge === 'trending' || b.badge === 'hot');
    return tagged.length > 0 ? tagged : discoverBaskets.slice(0, 6);
  }, [discoverBaskets]);

  const openBasket = (id) => navigateApp({ tab: 'basket', basketId: id });

  return (
    <AppPageLayout>
      <PageHeader title="Dashboard" align="left" className="!mb-0" />

      <DashboardSection title="Your Baskets">
        {userBaskets.length === 0 ? (
          <EmptyState message="Add a Basket" onAction={() => navigateApp({ tab: 'create' })} />
        ) : (
          <div className={CARD_GRID}>
            {userBaskets.map((basket) => (
              <SearchBasketCard
                key={basket.id}
                basket={{ ...basket, isOwn: true }}
                onClick={() => openBasket(basket.id)}
              />
            ))}
          </div>
        )}
      </DashboardSection>

      <DashboardSection title="Baskets You are following" className={SECTION_DIVIDER}>
        {followedBaskets.length === 0 ? (
          <EmptyState
            message="Discover baskets"
            onAction={() => navigateApp({ tab: 'search' })}
          />
        ) : (
          <div className={CARD_GRID}>
            {followedBaskets.map((basket) => (
              <SearchBasketCard
                key={basket.id}
                basket={basket}
                onClick={() => openBasket(basket.id)}
              />
            ))}
          </div>
        )}
      </DashboardSection>

      <DashboardSection title="Trending Baskets" className={SECTION_DIVIDER}>
        <div className={CARD_GRID}>
          {trendingBaskets.map((basket) => (
            <SearchBasketCard
              key={basket.id}
              basket={basket}
              onClick={() => openBasket(basket.id)}
            />
          ))}
        </div>
      </DashboardSection>
    </AppPageLayout>
  );
}

function DashboardSection({ title, className = '', children }) {
  return (
    <section className={className}>
      <h2 className="pe-section-title mb-3">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ message, onAction }) {
  return (
    <button
      type="button"
      onClick={onAction}
      className="w-full pe-card border-dashed p-5 text-left hover:border-neutral-300 transition-colors"
    >
      <p className="text-base font-medium text-pe-text">{message}</p>
      <p className="text-sm text-pe-text-secondary mt-1">Tap to get started →</p>
    </button>
  );
}
