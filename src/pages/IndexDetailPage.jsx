import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import AssetProductHeader from '../components/AssetProductHeader';
import GuestSignInCta from '../components/GuestSignInCta';
import PageHeader from '../components/PageHeader';
import UnderlineTabs from '../components/UnderlineTabs';
import {
  DiscussionsList,
  INVESTMENT_TABS,
} from '../components/InvestmentSections';
import { formatIndexGroup } from '../components/MarketDetailLayout';
import { getIndexDiscussions, loadPostsMentioning } from '../lib/assetDiscussions';
import { isDevMockMode } from '../lib/appMode';
import { fetchMarketPreview, findCachedMarketItem, peekMarketPreview, resolveMarketIndex } from '../lib/marketDataApi';
import { indexPath } from '../lib/routes';
import { useMarketQuotePolling } from '../hooks/useMarketQuoteRefresh';
import { useSeoMeta } from '../hooks/useSeoMeta';

export default function IndexDetailPage({
  indexId,
  onBack,
  onOpenProfile,
  guestMode = false,
}) {
  const [index, setIndex] = useState(() => {
    const cached = findCachedMarketItem('indices', indexId);
    if (cached) return cached;
    return {
      id: indexId,
      name: indexId,
      symbol: indexId,
      value: null,
      group: null,
    };
  });
  const [loading, setLoading] = useState(() => !findCachedMarketItem('indices', indexId));
  const [tab, setTab] = useState('insights');

  useEffect(() => {
    let cancelled = false;
    const cached = findCachedMarketItem('indices', indexId);
    if (cached) {
      setIndex(cached);
      setLoading(false);
    } else {
      setLoading(true);
      setIndex({
        id: indexId,
        name: indexId,
        symbol: indexId,
        value: null,
        group: null,
      });
    }

    (async () => {
      const peek = peekMarketPreview('indices');
      const fromPeek = peek?.items?.find((item) => item.id === indexId || item.symbol === indexId);
      if (fromPeek && !cancelled) {
        setIndex(fromPeek);
        setLoading(false);
      }

      const [preview, resolved] = await Promise.all([
        fromPeek ? Promise.resolve({ items: [fromPeek] }) : fetchMarketPreview('indices'),
        resolveMarketIndex(indexId),
      ]);
      const found =
        resolved ??
        preview.items.find((item) => item.id === indexId || item.symbol === indexId) ??
        null;
      if (!cancelled) {
        setIndex(found);
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) {
        setIndex(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [indexId]);

  const refreshIndex = useCallback(async () => {
    const fresh = await resolveMarketIndex(indexId);
    if (fresh) setIndex(fresh);
  }, [indexId]);

  useMarketQuotePolling({
    assetType: 'index',
    enabled: Boolean(indexId) && !loading,
    onRefresh: refreshIndex,
    deps: [indexId, loading],
  });

  const displayIndex = index;

  useSeoMeta(
    guestMode
      ? {
          title: `${displayIndex?.name || indexId} index`,
          description: `Track ${displayIndex?.name || indexId} index levels and community discussion on PocketEdge.`,
          path: indexPath(indexId),
        }
      : null
  );

  const [discussions, setDiscussions] = useState(() =>
    isDevMockMode() ? getIndexDiscussions(indexId, displayIndex?.name) : []
  );

  useEffect(() => {
    if (tab !== 'discussions') return undefined;
    let cancelled = false;
    if (isDevMockMode()) {
      setDiscussions(getIndexDiscussions(indexId, displayIndex?.name));
      return undefined;
    }
    loadPostsMentioning([indexId, displayIndex?.name].filter(Boolean))
      .then((posts) => {
        if (!cancelled) setDiscussions(posts);
      })
      .catch(() => {
        if (!cancelled) setDiscussions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [indexId, displayIndex?.name, tab]);

  if (!loading && !index) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Index not found.</div>
    );
  }

  if (!displayIndex) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Loading index…</div>
    );
  }

  return (
    <div>
      <PageHeader desktopOnly>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-pe-text-secondary hover:text-pe-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </PageHeader>

      <AssetProductHeader
        name={displayIndex.name}
        ticker={displayIndex.symbol !== displayIndex.name ? displayIndex.symbol : null}
        subtitle={formatIndexGroup(displayIndex.group)}
        type="Index"
        logoIconUrl={displayIndex.logoIconUrl}
        assetType="index"
        assetKey={displayIndex.id}
        formatAsCurrency={false}
        price={
          loading && displayIndex.value == null
            ? '…'
            : displayIndex.value
        }
        changePct={displayIndex.changePct}
        previousClose={displayIndex.previousClose}
        change={displayIndex.change}
      />

      <UnderlineTabs tabs={INVESTMENT_TABS} active={tab} onChange={setTab} />

      {tab === 'insights' && (
        <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
          No insights yet - daily AI summaries will appear here.
        </p>
      )}

      {tab === 'discussions' && (
        guestMode ? (
          <GuestSignInCta action="join index discussions" />
        ) : (
          <DiscussionsList
            posts={discussions}
            onOpenProfile={onOpenProfile}
            emptyMessage={`No posts yet - posts mentioning ${displayIndex.name} will show up here.`}
          />
        )
      )}

      {tab === 'holders' && (
        <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
          No disclosed holders yet.
        </p>
      )}

      {tab === 'news' && (
        <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">No recent news.</p>
      )}
    </div>
  );
}
