import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import AssetProductHeader from '../components/AssetProductHeader';
import PageHeader from '../components/PageHeader';
import UnderlineTabs from '../components/UnderlineTabs';
import {
  DiscussionsList,
  INVESTMENT_TABS,
} from '../components/InvestmentSections';
import { getCommodityDiscussions, loadPostsMentioning } from '../lib/assetDiscussions';
import { isDevMockMode } from '../lib/appMode';
import { fetchMarketPreview, findCachedMarketItem, peekMarketPreview, resolveMarketCommodity } from '../lib/marketDataApi';
import { useMarketQuotePolling } from '../hooks/useMarketQuoteRefresh';

export default function CommodityDetailPage({
  commodityId,
  onBack,
  onOpenProfile,
}) {
  const [commodity, setCommodity] = useState(() => {
    const cached = findCachedMarketItem('commodity', commodityId);
    if (cached) return cached;
    return {
      id: commodityId,
      name: commodityId,
      symbol: commodityId,
      spotPrice: null,
      unit: null,
      location: null,
    };
  });
  const [loading, setLoading] = useState(() => !findCachedMarketItem('commodity', commodityId));
  const [tab, setTab] = useState('insights');

  useEffect(() => {
    let cancelled = false;
    const cached = findCachedMarketItem('commodity', commodityId);
    if (cached) {
      setCommodity(cached);
      setLoading(false);
    } else {
      setLoading(true);
      setCommodity({
        id: commodityId,
        name: commodityId,
        symbol: commodityId,
        spotPrice: null,
        unit: null,
        location: null,
      });
    }

    (async () => {
      const peek = peekMarketPreview('commodity');
      const fromPeek = peek?.items?.find(
        (item) => item.id === commodityId || item.symbol === commodityId
      );
      if (fromPeek && !cancelled) {
        setCommodity(fromPeek);
        setLoading(false);
      }

      const [preview, resolved] = await Promise.all([
        fromPeek ? Promise.resolve({ items: [fromPeek] }) : fetchMarketPreview('commodity'),
        resolveMarketCommodity(commodityId),
      ]);
      const found =
        resolved ??
        preview.items.find((item) => item.id === commodityId || item.symbol === commodityId) ??
        null;
      if (!cancelled) {
        setCommodity(found);
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) {
        setCommodity(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [commodityId]);

  const refreshCommodity = useCallback(async () => {
    const fresh = await resolveMarketCommodity(commodityId);
    if (fresh) setCommodity(fresh);
  }, [commodityId]);

  useMarketQuotePolling({
    assetType: 'commodity',
    enabled: Boolean(commodityId) && !loading,
    onRefresh: refreshCommodity,
    deps: [commodityId, loading],
  });

  const [discussions, setDiscussions] = useState(() =>
    isDevMockMode() ? getCommodityDiscussions(commodityId, commodity?.name) : []
  );

  useEffect(() => {
    if (tab !== 'discussions') return undefined;
    let cancelled = false;
    if (isDevMockMode()) {
      setDiscussions(getCommodityDiscussions(commodityId, commodity?.name));
      return undefined;
    }
    loadPostsMentioning([commodityId, commodity?.name].filter(Boolean))
      .then((posts) => {
        if (!cancelled) setDiscussions(posts);
      })
      .catch(() => {
        if (!cancelled) setDiscussions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [commodityId, commodity?.name, tab]);

  if (!loading && !commodity) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">
        Commodity not found.
      </div>
    );
  }

  if (!commodity) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">
        Loading commodity…
      </div>
    );
  }

  const subtitle = [commodity.unit, commodity.location].filter(Boolean).join(' · ') || 'MCX spot';

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
        name={commodity.name}
        ticker={commodity.symbol !== commodity.name ? commodity.symbol : null}
        subtitle={subtitle}
        type="Commodity"
        logoIconUrl={commodity.logoIconUrl}
        assetType="commodity"
        assetKey={commodity.id}
        price={
          loading && commodity.spotPrice == null
            ? '…'
            : commodity.spotPrice != null
              ? commodity.spotPrice
              : '-'
        }
        changePct={commodity.changePct}
        previousClose={commodity.previousClose}
        change={commodity.change}
      />

      <UnderlineTabs tabs={INVESTMENT_TABS} active={tab} onChange={setTab} />

      {tab === 'insights' && (
        <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
          No insights yet - daily AI summaries will appear here.
        </p>
      )}

      {tab === 'discussions' && (
        <DiscussionsList
          posts={discussions}
          onOpenProfile={onOpenProfile}
          emptyMessage={`No posts yet - posts mentioning ${commodity.name} will show up here.`}
        />
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
