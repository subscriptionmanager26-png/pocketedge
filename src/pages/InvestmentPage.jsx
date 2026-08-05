import { useCallback, useEffect, useState } from 'react';
import AssetProductHeader from '../components/AssetProductHeader';
import AssetDetailSections from '../components/AssetDetailSections';
import {
  getFund,
  getFundNews,
} from '../data/fundData';
import { getFundDiscussions } from '../lib/assetDiscussions';
import {
  findCachedMarketItem,
  marketFundToDetail,
  resolveMarketFund,
} from '../lib/marketDataApi';
import { isDevMockMode } from '../lib/appMode';
import { fundPath } from '../lib/routes';
import { useMarketQuotePolling } from '../hooks/useMarketQuoteRefresh';
import { useSeoMeta } from '../hooks/useSeoMeta';
import { fundSeoMeta } from '../lib/seoCopy';

/** Growth + Direct schemes are indexable; other plan variants stay public but noindex. */
export function isSelectiveFundForSeo(fund) {
  const name = String(fund?.name ?? fund?.schemeName ?? '').toLowerCase();
  const hay = `${name} ${String(fund?.plan ?? '')} ${String(fund?.option ?? '')}`.toLowerCase();
  const isDirect = /\bdirect\b/.test(hay);
  const isGrowth = /\bgrowth\b/.test(hay) && !/\bidcw\b|\bdividend\b/.test(hay);
  return isDirect && isGrowth;
}

export default function InvestmentPage({
  fundId,
  onBack,
  onOpenProfile,
  onOpenPortfolio,
  onRegisterAssetPanelBack,
  onAssetDetailPanelChange,
  guestMode = false,
}) {
  const seedFund = getFund(fundId);
  const [marketFund, setMarketFund] = useState(() => {
    const cached = findCachedMarketItem('mutual_funds', fundId);
    return cached ? marketFundToDetail(cached) : null;
  });
  const [marketLoading, setMarketLoading] = useState(
    () => !seedFund && !findCachedMarketItem('mutual_funds', fundId)
  );
  const [detailPanel, setDetailPanel] = useState(null);
  const fund =
    seedFund ??
    marketFund ??
    ({
      id: fundId,
      name: fundId,
      category: 'Mutual Fund',
      nav: null,
    });
  const indexable = isSelectiveFundForSeo(fund);
  const categoryLine = [fund.category, fund.amc].filter(Boolean).join(' · ');
  const seo = fundSeoMeta({
    name: fund.name,
    schemeCode: fundId,
    categoryLine,
  });

  useSeoMeta(
    guestMode
      ? {
          title: seo.title,
          description: seo.description,
          path: fundPath(fundId),
          noindex: !indexable,
        }
      : null
  );

  useEffect(() => {
    let cancelled = false;
    const cached = findCachedMarketItem('mutual_funds', fundId);
    if (seedFund) {
      setMarketLoading(false);
      return undefined;
    }
    if (cached) {
      setMarketFund(marketFundToDetail(cached));
      setMarketLoading(false);
    } else {
      setMarketLoading(true);
    }

    resolveMarketFund(fundId)
      .then((found) => {
        if (!cancelled) setMarketFund(found ? marketFundToDetail(found) : null);
      })
      .finally(() => {
        if (!cancelled) setMarketLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fundId, seedFund]);

  const refreshFund = useCallback(async () => {
    const found = await resolveMarketFund(fundId);
    if (found) setMarketFund(marketFundToDetail(found));
  }, [fundId]);

  useMarketQuotePolling({
    assetType: 'fund',
    enabled: Boolean(fundId) && !marketLoading && !seedFund,
    onRefresh: refreshFund,
    deps: [fundId, marketLoading, seedFund],
  });

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

  const hasResolvedFund = Boolean(seedFund || marketFund);
  const amfiCode = String(fund.id ?? fund.schemeCode ?? fundId ?? '').trim();
  const navAsOf = fund.asOfDate ?? fund.navDate ?? null;
  // Prefer category · AMC; avoid a bare "Mutual Fund" standing in for the symbol.
  const subtitle =
    categoryLine && categoryLine.toLowerCase() !== 'mutual fund' ? categoryLine : undefined;

  if (!marketLoading && !hasResolvedFund) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Fund not found.</div>
    );
  }

  return (
    <div>
      {!detailPanel ? (
        <>
          <AssetProductHeader
            name={fund.name}
            ticker={amfiCode || undefined}
            logoIconUrl={fund.logoIconUrl}
            assetType="fund"
            assetKey={fund.id ?? fundId}
            price={marketLoading && fund.nav == null ? '…' : fund.nav}
            changePct={fund.changePct}
            previousClose={fund.previousClose}
            change={fund.change}
            asOfDate={navAsOf}
            subtitle={subtitle}
          />
        </>
      ) : null}

      <AssetDetailSections
        kind="fund"
        assetKey={fundId}
        mentionKeys={[fundId, fund?.name].filter(Boolean)}
        assetLabel={fund.name || fundId}
        guestMode={guestMode}
        holdersKind="fund"
        supportsInsights
        supportsNews
        supportsHolders
        mockDiscussions={isDevMockMode() ? getFundDiscussions(fundId) : null}
        mockNews={getFundNews(fundId)}
        onOpenProfile={onOpenProfile}
        onOpenPortfolio={onOpenPortfolio}
        onPanelChange={handlePanelChange}
        shellOwnsMobileBack={Boolean(onRegisterAssetPanelBack)}
      />
    </div>
  );
}
