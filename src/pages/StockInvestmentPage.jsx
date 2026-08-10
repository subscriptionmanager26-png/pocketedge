import { useCallback, useEffect, useMemo, useState } from 'react';
import AssetProductHeader from '../components/AssetProductHeader';
import AssetDetailSections from '../components/AssetDetailSections';
import { getStock, getStockNews } from '../data/stockData';
import { getCompanyBrief } from '../data/companyBriefs';
import { isDevMockMode } from '../lib/appMode';
import { getStockDiscussions } from '../lib/assetDiscussions';
import {
  findCachedMarketItem,
  marketStockToDetail,
  resolveMarketStock,
} from '../lib/marketDataApi';
import { etfPath, stockPath } from '../lib/routes';
import { formatTicker } from '../lib/tickers';
import { truncateSummary } from '../lib/assetDetailHelpers';
import { useMarketQuotePolling } from '../hooks/useMarketQuoteRefresh';
import { useSeoMeta } from '../hooks/useSeoMeta';
import { stockSeoMeta } from '../lib/seoCopy';

function peekCachedStockDetail(ticker) {
  const cached =
    findCachedMarketItem('stocks', ticker) ?? findCachedMarketItem('etf', ticker);
  return cached ? marketStockToDetail(cached) : null;
}

function briefExcerpt(brief) {
  const prose = brief?.sections?.executiveSummary?.prose || brief?.tagline || '';
  return truncateSummary(prose, 155) || null;
}

export default function StockInvestmentPage({
  ticker,
  onBack,
  onOpenProfile,
  onOpenPortfolio,
  onRegisterAssetPanelBack,
  onAssetDetailPanelChange,
  guestMode = false,
}) {
  const seedStock = getStock(ticker);
  const [marketStock, setMarketStock] = useState(() => peekCachedStockDetail(ticker));
  const [isEtf, setIsEtf] = useState(() => {
    const cached =
      findCachedMarketItem('etf', ticker) ?? findCachedMarketItem('stocks', ticker);
    return cached?.assetType === 'etf';
  });
  const [marketLoading, setMarketLoading] = useState(
    () => !peekCachedStockDetail(ticker) && !seedStock
  );
  const [brief, setBrief] = useState(null);
  const stock = useMemo(() => {
    if (marketStock) return marketStock;
    if (seedStock) {
      return marketStockToDetail({
        symbol: ticker,
        name: seedStock.name,
        price: seedStock.price,
        changePct: seedStock.changePct,
      });
    }
    return marketStockToDetail({
      symbol: ticker,
      name: formatTicker(ticker),
      price: null,
      changePct: null,
    });
  }, [marketStock, seedStock, ticker]);
  const displayStock = stock;
  const symbolKey = formatTicker(ticker);
  const excerpt = briefExcerpt(brief);
  const seo = stockSeoMeta({
    name: displayStock.name || symbolKey,
    symbol: symbolKey,
    isEtf,
    excerpt,
  });

  useSeoMeta(
    guestMode
      ? {
          title: seo.title,
          description: seo.description,
          path: isEtf ? etfPath(ticker) : stockPath(ticker),
        }
      : null
  );

  useEffect(() => {
    let cancelled = false;
    const cached = peekCachedStockDetail(ticker);
    if (cached) {
      setMarketStock(cached);
      setIsEtf(
        cached.assetType === 'etf' ||
          findCachedMarketItem('etf', ticker)?.assetType === 'etf'
      );
      setMarketLoading(false);
    } else {
      setMarketLoading(true);
    }

    resolveMarketStock(ticker, { force: true })
      .then((resolved) => {
        if (cancelled) return;
        if (resolved?.assetType === 'etf') setIsEtf(true);
        else setIsEtf(false);
        setMarketStock(resolved ? marketStockToDetail(resolved) : null);
      })
      .finally(() => {
        if (!cancelled) setMarketLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  useEffect(() => {
    if (isEtf) {
      setBrief(null);
      return undefined;
    }
    let cancelled = false;
    getCompanyBrief(ticker)
      .then((next) => {
        if (!cancelled) setBrief(next);
      })
      .catch(() => {
        if (!cancelled) setBrief(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, isEtf]);

  const refreshStock = useCallback(async () => {
    const resolved = await resolveMarketStock(ticker, { force: true });
    if (!resolved) return;
    if (resolved.assetType === 'etf') setIsEtf(true);
    else setIsEtf(false);
    setMarketStock(marketStockToDetail(resolved));
  }, [ticker]);

  useMarketQuotePolling({
    assetType: isEtf ? 'etf' : 'stock',
    enabled: Boolean(ticker) && !marketLoading,
    onRefresh: refreshStock,
    deps: [ticker, marketLoading, isEtf],
  });

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

  if (!marketLoading && !marketStock && !seedStock) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Stock not found.</div>
    );
  }

  return (
    <div>
      {!detailPanel ? (
        <>
          <AssetProductHeader
            name={displayStock.name}
            ticker={formatTicker(displayStock.ticker ?? ticker)}
            logoIconUrl={displayStock.logoIconUrl}
            assetType={displayStock.assetType ?? (isEtf ? 'etf' : 'stock')}
            assetKey={displayStock.id ?? displayStock.symbol ?? ticker}
            price={
              marketLoading && displayStock.price == null
                ? '…'
                : displayStock.price
            }
            changePct={displayStock.changePct}
            previousClose={displayStock.previousClose}
            change={displayStock.change}
            priceSource={displayStock.priceSource}
          />

          {excerpt ? (
            <p className="px-4 pb-4 text-[15px] leading-relaxed text-pe-text-secondary md:px-6">
              {excerpt}
            </p>
          ) : null}
        </>
      ) : null}

      <AssetDetailSections
        kind={isEtf ? 'etf' : 'stock'}
        assetKey={ticker}
        mentionKeys={[ticker]}
        assetLabel={displayStock.name || symbolKey}
        livePrice={displayStock.price ?? displayStock.ltp ?? null}
        guestMode={guestMode}
        showCorporateActions={!isEtf}
        holdersKind="stock"
        mockDiscussions={isDevMockMode() ? getStockDiscussions(ticker) : null}
        mockNews={isDevMockMode() ? getStockNews(ticker) : null}
        onOpenProfile={onOpenProfile}
        onOpenPortfolio={onOpenPortfolio}
        onPanelChange={handlePanelChange}
        shellOwnsMobileBack={Boolean(onRegisterAssetPanelBack)}
      />
    </div>
  );
}
