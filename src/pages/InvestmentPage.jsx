import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import AssetProductHeader from '../components/AssetProductHeader';
import PageHeader from '../components/PageHeader';
import AssetDetailSections from '../components/AssetDetailSections';
import {
  getFund,
  getFundNews,
} from '../data/fundData';
import { getFundDiscussions } from '../lib/assetDiscussions';
import { getFundAssetType } from '../lib/assetTypes';
import {
  findCachedMarketItem,
  marketFundToDetail,
  resolveMarketFund,
} from '../lib/marketDataApi';
import { isDevMockMode } from '../lib/appMode';
import { fundPath } from '../lib/routes';
import { useMarketQuotePolling } from '../hooks/useMarketQuoteRefresh';
import { useSeoMeta } from '../hooks/useSeoMeta';

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

  useSeoMeta(
    guestMode
      ? {
          title: fund.name || `Fund ${fundId}`,
          description: categoryLine
            ? `${fund.name} — ${categoryLine}. NAV and details on PocketEdge.`
            : `${fund.name || fundId} mutual fund details on PocketEdge.`,
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

  const hasResolvedFund = Boolean(seedFund || marketFund);

  if (!marketLoading && !hasResolvedFund) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Fund not found.</div>
    );
  }

  return (
    <div>
      {!detailPanel ? (
        <>
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
            name={fund.name}
            type={getFundAssetType()}
            logoIconUrl={fund.logoIconUrl}
            assetType="fund"
            assetKey={fund.id ?? fundId}
            price={marketLoading && fund.nav == null ? '…' : fund.nav}
            changePct={fund.changePct}
            previousClose={fund.previousClose}
            change={fund.change}
            subtitle={categoryLine || undefined}
          />

          <p className="border-b border-pe-border px-4 py-3 text-sm text-pe-text-secondary">
            {categoryLine
              ? `${fund.name} is a ${categoryLine} scheme. View NAV, community posts, and holders on PocketEdge.`
              : `${fund.name} mutual fund details on PocketEdge.`}
          </p>
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
        onPanelChange={setDetailPanel}
      />
    </div>
  );
}
