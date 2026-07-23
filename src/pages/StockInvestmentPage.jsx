import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import AssetProductHeader from '../components/AssetProductHeader';
import PageHeader from '../components/PageHeader';
import UnderlineTabs from '../components/UnderlineTabs';
import NewsList from '../components/NewsList';
import {
  DiscussionsList,
  HoldersList,
  INVESTMENT_TABS,
  STOCK_INVESTMENT_TABS,
} from '../components/InvestmentSections';
import { getStock, getStockNews } from '../data/stockData';
import { isDevMockMode } from '../lib/appMode';
import { fetchAssetHolders } from '../lib/assetHoldersApi';
import {
  fetchStockNews,
  fetchStockExplanations,
  fetchCorporateActions,
  isStockNewsConfigured,
} from '../lib/stockNewsApi';
import CorporateActionsList from '../components/CorporateActionsList';
import { getStockDiscussions, loadPostsMentioning } from '../lib/assetDiscussions';
import { getStockAssetType } from '../lib/assetTypes';
import {
  findCachedMarketItem,
  marketStockToDetail,
  resolveMarketStock,
} from '../lib/marketDataApi';
import { formatTicker } from '../lib/tickers';
import { useMarketQuotePolling } from '../hooks/useMarketQuoteRefresh';

function peekCachedStockDetail(ticker) {
  const cached =
    findCachedMarketItem('stocks', ticker) ?? findCachedMarketItem('etf', ticker);
  return cached ? marketStockToDetail(cached) : null;
}

export default function StockInvestmentPage({
  ticker,
  onBack,
  onOpenProfile,
  onOpenPortfolio,
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
    // Paint immediately from URL while market metadata resolves.
    return marketStockToDetail({
      symbol: ticker,
      name: formatTicker(ticker),
      price: null,
      changePct: null,
    });
  }, [marketStock, seedStock, ticker]);
  const displayStock = stock;
  const [tab, setTab] = useState('insights');

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

  const refreshStock = useCallback(async () => {
    const resolved = await resolveMarketStock(ticker);
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

  const [discussions, setDiscussions] = useState(() =>
    isDevMockMode() ? getStockDiscussions(ticker) : []
  );
  const [holders, setHolders] = useState([]);
  const [holdersLoading, setHoldersLoading] = useState(false);
  const [news, setNews] = useState(() => (isDevMockMode() ? getStockNews(ticker) : []));
  const [newsLoading, setNewsLoading] = useState(false);
  const [insights, setInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [corporateActions, setCorporateActions] = useState([]);
  const [corpActionsLoading, setCorpActionsLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'insights') return undefined;
    if (!isStockNewsConfigured()) {
      setInsights([]);
      return undefined;
    }
    let cancelled = false;
    setInsightsLoading(true);
    fetchStockExplanations(ticker, { limit: 14 })
      .then((items) => {
        if (!cancelled) setInsights(items);
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, tab]);

  useEffect(() => {
    if (tab !== 'holders') return undefined;
    let cancelled = false;
    setHoldersLoading(true);
    fetchAssetHolders(ticker, { kind: 'stock' })
      .then((rows) => {
        if (!cancelled) setHolders(rows);
      })
      .catch(() => {
        if (!cancelled) setHolders([]);
      })
      .finally(() => {
        if (!cancelled) setHoldersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, tab]);

  useEffect(() => {
    if (tab !== 'discussions') return undefined;
    let cancelled = false;
    if (isDevMockMode()) {
      setDiscussions(getStockDiscussions(ticker));
      return undefined;
    }
    loadPostsMentioning([ticker])
      .then((posts) => {
        if (!cancelled) setDiscussions(posts);
      })
      .catch(() => {
        if (!cancelled) setDiscussions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, tab]);

  useEffect(() => {
    if (tab !== 'news') return undefined;

    if (isStockNewsConfigured()) {
      let cancelled = false;
      setNewsLoading(true);
      fetchStockNews(ticker)
        .then((items) => {
          if (!cancelled) setNews(items);
        })
        .finally(() => {
          if (!cancelled) setNewsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }

    if (isDevMockMode()) {
      setNews(getStockNews(ticker));
      return undefined;
    }

    setNews([]);
    return undefined;
  }, [ticker, tab]);

  useEffect(() => {
    if (tab !== 'corporate_actions') return undefined;
    if (!isStockNewsConfigured() || isEtf) {
      setCorporateActions([]);
      return undefined;
    }

    let cancelled = false;
    setCorpActionsLoading(true);
    fetchCorporateActions(ticker)
      .then((items) => {
        if (!cancelled) setCorporateActions(items);
      })
      .finally(() => {
        if (!cancelled) setCorpActionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ticker, isEtf, tab]);

  if (!marketLoading && !marketStock && !seedStock) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Stock not found.</div>
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

      <UnderlineTabs
        tabs={isEtf ? INVESTMENT_TABS : STOCK_INVESTMENT_TABS}
        active={tab}
        onChange={setTab}
      />

      {tab === 'insights' && (
        insightsLoading ? (
          <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
            Loading insights…
          </p>
        ) : insights.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
            No insights yet - daily AI summaries for {formatTicker(ticker)} will appear here.
          </p>
        ) : (
          <NewsList items={insights} />
        )
      )}

      {tab === 'discussions' && (
        <DiscussionsList
          posts={discussions}
          onOpenProfile={onOpenProfile}
          emptyMessage="No posts yet - posts mentioning this stock will show up here."
        />
      )}

      {tab === 'holders' && (
        <HoldersList
          holders={holders}
          loading={holdersLoading}
          onOpenProfile={onOpenProfile}
          onOpenPortfolio={onOpenPortfolio}
          emptyMessage="No disclosed holders yet."
        />
      )}

      {tab === 'news' && (
        <div>
          {newsLoading ? (
            <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">Loading news…</p>
          ) : news.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">No recent news.</p>
          ) : (
            <NewsList items={news} />
          )}
        </div>
      )}

      {tab === 'corporate_actions' && (
        corpActionsLoading ? (
          <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
            Loading corporate actions…
          </p>
        ) : (
          <CorporateActionsList items={corporateActions} />
        )
      )}

    </div>
  );
}
