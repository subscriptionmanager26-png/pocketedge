import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AssetProductHeader from '../components/AssetProductHeader';
import PageHeader from '../components/PageHeader';
import AssetDetailSections from '../components/AssetDetailSections';
import { getStock, getStockNews } from '../data/stockData';
import { getCompanyBrief } from '../data/companyBriefs';
import { isDevMockMode } from '../lib/appMode';
import { getStockDiscussions } from '../lib/assetDiscussions';
import { getStockAssetType } from '../lib/assetTypes';
import {
  findCachedMarketItem,
  marketStockToDetail,
  resolveMarketStock,
} from '../lib/marketDataApi';
import { businessModelBriefPath, etfPath, stockPath } from '../lib/routes';
import { formatTicker } from '../lib/tickers';
import { useMarketQuotePolling } from '../hooks/useMarketQuoteRefresh';
import { useSeoMeta } from '../hooks/useSeoMeta';

function peekCachedStockDetail(ticker) {
  const cached =
    findCachedMarketItem('stocks', ticker) ?? findCachedMarketItem('etf', ticker);
  return cached ? marketStockToDetail(cached) : null;
}

function briefExcerpt(brief) {
  const prose = brief?.sections?.executiveSummary?.prose || brief?.tagline || '';
  const text = String(prose).trim();
  if (!text) return null;
  if (text.length <= 280) return text;
  return `${text.slice(0, 277).trim()}…`;
}

export default function StockInvestmentPage({
  ticker,
  onBack,
  onOpenProfile,
  onOpenPortfolio,
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

  useSeoMeta(
    guestMode
      ? {
          title: `${displayStock.name || symbolKey}${isEtf ? ' ETF' : ' share price'}`,
          description: excerpt
            ? `${excerpt} Track ${symbolKey} on PocketEdge.`
            : `${displayStock.name || symbolKey} (${symbolKey}) — live price, insights, and news on PocketEdge.`,
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

    resolveMarketStock(ticker)
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

  if (!marketLoading && !marketStock && !seedStock) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Stock not found.</div>
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
            name={displayStock.name}
            ticker={formatTicker(displayStock.ticker ?? ticker)}
            type={getStockAssetType(ticker, displayStock)}
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
            <div className="border-b border-pe-border px-4 py-4">
              <p className="text-sm leading-relaxed text-pe-text-secondary">{excerpt}</p>
              <Link
                to={businessModelBriefPath(ticker)}
                className="mt-2 inline-block text-sm font-semibold text-pe-accent hover:underline"
              >
                Full business model →
              </Link>
            </div>
          ) : !isEtf ? (
            <p className="border-b border-pe-border px-4 py-3 text-sm text-pe-text-secondary">
              Live quotes, AI insights, and news for {formatTicker(ticker)} on PocketEdge.
            </p>
          ) : (
            <p className="border-b border-pe-border px-4 py-3 text-sm text-pe-text-secondary">
              ETF price, discussions, and holders for {formatTicker(ticker)} on PocketEdge.
            </p>
          )}
        </>
      ) : null}

      <AssetDetailSections
        kind={isEtf ? 'etf' : 'stock'}
        assetKey={ticker}
        mentionKeys={[ticker]}
        assetLabel={displayStock.name || symbolKey}
        guestMode={guestMode}
        showCorporateActions={!isEtf}
        holdersKind="stock"
        mockDiscussions={isDevMockMode() ? getStockDiscussions(ticker) : null}
        mockNews={isDevMockMode() ? getStockNews(ticker) : null}
        onOpenProfile={onOpenProfile}
        onOpenPortfolio={onOpenPortfolio}
        onPanelChange={setDetailPanel}
      />
    </div>
  );
}
