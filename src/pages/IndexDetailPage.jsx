import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import AssetProductHeader from '../components/AssetProductHeader';
import PageHeader from '../components/PageHeader';
import UnderlineTabs from '../components/UnderlineTabs';
import {
  DiscussionsList,
  INVESTMENT_TABS,
} from '../components/InvestmentSections';
import { formatIndexGroup } from '../components/MarketDetailLayout';
import { getIndexDiscussions, loadPostsMentioning } from '../lib/assetDiscussions';
import { isDevMockMode } from '../lib/appMode';
import { fetchMarketPreview, resolveMarketIndex } from '../lib/marketDataApi';

export default function IndexDetailPage({
  indexId,
  onBack,
  onOpenProfile,
}) {
  const [index, setIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('insights');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setIndex({
      id: indexId,
      name: indexId,
      symbol: indexId,
      value: null,
      group: null,
    });

    (async () => {
      const preview = await fetchMarketPreview('indices');
      let found = preview.items.find((item) => item.id === indexId);
      if (!found) found = await resolveMarketIndex(indexId);
      if (!cancelled) {
        setIndex(found ?? null);
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

  useEffect(() => {
    if (!indexId || loading) return undefined;
    let cancelled = false;

    const refresh = async () => {
      try {
        const fresh = await resolveMarketIndex(indexId);
        if (!cancelled && fresh) setIndex(fresh);
      } catch {
        // Keep last successful quote if refresh fails.
      }
    };

    const timer = window.setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [indexId, loading]);

  const displayIndex = index;

  const [discussions, setDiscussions] = useState(() =>
    isDevMockMode() ? getIndexDiscussions(indexId, displayIndex?.name) : []
  );

  useEffect(() => {
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
  }, [indexId, displayIndex?.name]);

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
        <DiscussionsList
          posts={discussions}
          onOpenProfile={onOpenProfile}
          emptyMessage={`No posts yet - posts mentioning ${displayIndex.name} will show up here.`}
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
