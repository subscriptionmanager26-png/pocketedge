import { useCallback, useEffect, useState } from 'react';
import AssetProductHeader from '../components/AssetProductHeader';
import AssetDetailSections from '../components/AssetDetailSections';
import { formatIndexGroup } from '../components/MarketDetailLayout';
import { getIndexDiscussions } from '../lib/assetDiscussions';
import { isDevMockMode } from '../lib/appMode';
import { fetchMarketPreview, findCachedMarketItem, peekMarketPreview, resolveMarketIndex } from '../lib/marketDataApi';
import { indexPath } from '../lib/routes';
import { useMarketQuotePolling } from '../hooks/useMarketQuoteRefresh';
import { useSeoMeta } from '../hooks/useSeoMeta';

export default function IndexDetailPage({
  indexId,
  onBack,
  onOpenProfile,
  onRegisterAssetPanelBack,
  onAssetDetailPanelChange,
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
  const [detailPanel, setDetailPanel] = useState(null);

  useEffect(() => {
    return () => {
      onRegisterAssetPanelBack?.(null);
      onAssetDetailPanelChange?.(null);
    };
  }, [onRegisterAssetPanelBack, onAssetDetailPanelChange]);

  const handlePanelChange = useCallback(
    (panel, meta) => {
      setDetailPanel(panel);
      onAssetDetailPanelChange?.(panel || null);
      if (panel && meta?.close) {
        onRegisterAssetPanelBack?.({ label: 'Back', onBack: meta.close });
      } else {
        onRegisterAssetPanelBack?.(null);
      }
    },
    [onRegisterAssetPanelBack, onAssetDetailPanelChange]
  );

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
      {!detailPanel ? (
        <>
          <AssetProductHeader
            name={displayIndex.name}
            ticker={displayIndex.symbol !== displayIndex.name ? displayIndex.symbol : null}
            subtitle={formatIndexGroup(displayIndex.group)}
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
        </>
      ) : null}

      <AssetDetailSections
        kind="index"
        assetKey={indexId}
        mentionKeys={[indexId, displayIndex?.name].filter(Boolean)}
        assetLabel={displayIndex.name || indexId}
        guestMode={guestMode}
        supportsHolders={false}
        supportsNews={false}
        supportsInsights
        mockDiscussions={
          isDevMockMode() ? getIndexDiscussions(indexId, displayIndex?.name) : null
        }
        onOpenProfile={onOpenProfile}
        onPanelChange={handlePanelChange}
        shellOwnsMobileBack={Boolean(onRegisterAssetPanelBack)}
      />
    </div>
  );
}
