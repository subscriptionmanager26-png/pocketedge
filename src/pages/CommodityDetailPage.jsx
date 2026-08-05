import { useCallback, useEffect, useState } from 'react';
import AssetProductHeader from '../components/AssetProductHeader';
import AssetDetailSections from '../components/AssetDetailSections';
import { getCommodityDiscussions } from '../lib/assetDiscussions';
import { isDevMockMode } from '../lib/appMode';
import { fetchMarketPreview, findCachedMarketItem, peekMarketPreview, resolveMarketCommodity } from '../lib/marketDataApi';
import { commodityPath } from '../lib/routes';
import { useMarketQuotePolling } from '../hooks/useMarketQuoteRefresh';
import { useSeoMeta } from '../hooks/useSeoMeta';
import { commoditySeoMeta } from '../lib/seoCopy';

export default function CommodityDetailPage({
  commodityId,
  onBack,
  onOpenProfile,
  onRegisterAssetPanelBack,
  onAssetDetailPanelChange,
  guestMode = false,
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

  const seo = commoditySeoMeta({ name: commodity?.name || commodityId });
  useSeoMeta(
    guestMode
      ? {
          title: seo.title,
          description: seo.description,
          path: commodityPath(commodityId),
        }
      : null
  );

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
      {!detailPanel ? (
        <>
          <AssetProductHeader
            name={commodity.name}
            ticker={commodity.symbol !== commodity.name ? commodity.symbol : null}
            subtitle={subtitle}
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
        </>
      ) : null}

      <AssetDetailSections
        kind="commodity"
        assetKey={commodityId}
        mentionKeys={[commodityId, commodity?.name].filter(Boolean)}
        assetLabel={commodity.name || commodityId}
        guestMode={guestMode}
        supportsHolders={false}
        supportsNews={false}
        supportsInsights
        mockDiscussions={
          isDevMockMode() ? getCommodityDiscussions(commodityId, commodity?.name) : null
        }
        onOpenProfile={onOpenProfile}
        onPanelChange={handlePanelChange}
        shellOwnsMobileBack={Boolean(onRegisterAssetPanelBack)}
      />
    </div>
  );
}
