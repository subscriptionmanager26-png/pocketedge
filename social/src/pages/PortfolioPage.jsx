import { useMemo, useState, useEffect } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import UnderlineTabs from '../components/UnderlineTabs';
import WatchlistModal from '../components/WatchlistModal';
import {
  HoldingsSummary,
  NewsFeed,
  PostsFeed,
  TradesFeed,
  collectActivity,
} from '../components/ActivityFeed';
import { MY_PORTFOLIO, STOCKS, computePortfolioDisplayMetrics, getUserPortfolios } from '../data/mockData';
import { formatInr, formatPct, pnlClass } from '../lib/format';
import { formatTicker } from '../lib/tickers';
import { addWatchlist, getWatchlists, subscribeWatchlists } from '../lib/watchlistStore';
import { PortfolioPageSkeleton } from '../components/PortfolioSkeletons';
import { fetchUserPortfolios } from '../lib/socialPortfolioApi';
import { getAppCurrentUserId } from '../lib/socialIdentity';
import { isSupabaseConfigured } from '../lib/supabase';
import { isDevMockMode } from '../lib/appMode';
import { fetchStockNewsForTickers, isStockNewsConfigured } from '../lib/stockNewsApi';
import { skipAuthForDev } from '../lib/sessionStore';
import {
  PortfolioKindMetaTags,
  PortfolioSourceAttribution,
} from '../components/PortfolioMetaTag';

function useBackend() {
  return isSupabaseConfigured() && !skipAuthForDev();
}

export default function PortfolioPage({
  onSelectStock,
  onOpenProfile,
  onOpenPost,
  onOpenSourcePortfolio,
}) {
  const [listId, setListId] = useState(null);
  const [period, setPeriod] = useState('1D');
  const [contentTab, setContentTab] = useState('performance');
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [watchlistTick, setWatchlistTick] = useState(0);
  const [portfolioTick, setPortfolioTick] = useState(0);
  const [remotePortfolios, setRemotePortfolios] = useState([]);
  const [portfoliosLoading, setPortfoliosLoading] = useState(false);

  const ownerId = getAppCurrentUserId();

  useEffect(() => subscribeWatchlists(() => setWatchlistTick((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;

    if (useBackend()) {
      setPortfoliosLoading(true);
      fetchUserPortfolios(ownerId)
        .then((rows) => {
          if (!cancelled) setRemotePortfolios(rows.filter((p) => !p.isDraft));
        })
        .catch(() => {
          if (!cancelled) setRemotePortfolios([]);
        })
        .finally(() => {
          if (!cancelled) setPortfoliosLoading(false);
        });
    } else {
      setRemotePortfolios(getUserPortfolios(ownerId).filter((p) => !p.isDraft));
      setPortfoliosLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [ownerId, portfolioTick]);

  const watchlists = useMemo(() => getWatchlists(), [watchlistTick]);

  const lists = useMemo(() => {
    if (useBackend()) {
      const livePortfolios = remotePortfolios.filter((p) => p.kind !== 'watchlist');
      const watchlistPortfolios = remotePortfolios.filter((p) => p.kind === 'watchlist');
      return [
        ...livePortfolios.map((p) => ({ ...p, kind: 'portfolio' })),
        ...watchlistPortfolios.map((w) => ({ ...w, kind: 'watchlist' })),
      ];
    }

    const portfolioLists = remotePortfolios.length
      ? remotePortfolios
          .filter((p) => p.kind !== 'watchlist')
          .map((p) => ({ ...p, kind: 'portfolio' }))
      : [
          {
            id: 'fallback_portfolio',
            name: 'Main portfolio',
            kind: 'portfolio',
            holdings: MY_PORTFOLIO.holdings,
            ...MY_PORTFOLIO,
          },
        ];

    return [
      ...portfolioLists,
      ...watchlists.map((w) => ({
        id: w.id,
        name: w.name,
        kind: 'watchlist',
        tickers: w.tickers,
        holdings: [],
      })),
    ];
  }, [remotePortfolios, watchlists]);

  useEffect(() => {
    if (!lists.length) return;
    if (!listId || !lists.some((l) => l.id === listId)) {
      setListId(lists[0].id);
    }
  }, [lists, listId]);

  const activeList = lists.find((l) => l.id === listId) ?? lists[0];
  const isPortfolio = activeList?.kind === 'portfolio' || activeList?.kind === 'watchlist';

  const holdingsRows = useMemo(() => {
    if (!activeList) return [];
    const metrics = computePortfolioDisplayMetrics(activeList);
    const holdings = metrics.holdings ?? [];
    const totalValue = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0);
    return holdings.map((h) => ({
      ...h,
      weight: totalValue > 0 ? ((h.value ?? 0) / totalValue) * 100 : 0,
    }));
  }, [activeList]);

  const tickers = useMemo(() => holdingsRows.map((h) => h.ticker), [holdingsRows]);
  const [portfolioNews, setPortfolioNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);

  useEffect(() => {
    if (!tickers.length) {
      setPortfolioNews([]);
      return undefined;
    }

    if (isStockNewsConfigured()) {
      let cancelled = false;
      setNewsLoading(true);
      fetchStockNewsForTickers(tickers)
        .then((items) => {
          if (!cancelled) setPortfolioNews(items);
        })
        .finally(() => {
          if (!cancelled) setNewsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }

    if (isDevMockMode()) {
      setPortfolioNews(collectActivity(tickers).news);
      return undefined;
    }

    setPortfolioNews([]);
    return undefined;
  }, [tickers]);

  const activity = useMemo(() => {
    const base = collectActivity(tickers);
    if (isStockNewsConfigured() || !isDevMockMode()) {
      return { ...base, news: portfolioNews };
    }
    return base;
  }, [tickers, portfolioNews]);

  const metrics = useMemo(() => {
    if (!activeList) return null;
    if (activeList.kind === 'portfolio' || activeList.kind === 'watchlist') {
      return computePortfolioDisplayMetrics(activeList);
    }
    return computePortfolioDisplayMetrics({
      ...activeList,
      kind: 'portfolio',
      holdings: MY_PORTFOLIO.holdings,
    });
  }, [activeList]);

  const overallRow = useMemo(() => {
    if (!metrics || metrics.kind !== 'portfolio') return null;
    return {
      overall: true,
      weight: 100,
      pnlPct: metrics.todayPnlPct ?? 0,
      invested: metrics.invested ?? 0,
    };
  }, [metrics]);

  const chartDistribution = useMemo(
    () => compressDistribution(metrics?.distribution ?? []),
    [metrics]
  );

  if (useBackend() && portfoliosLoading) {
    return (
      <div>
        <PageHeader>
          <div className="h-10 animate-pulse rounded-md bg-pe-surface" aria-hidden="true" />
        </PageHeader>
        <PortfolioPageSkeleton />
      </div>
    );
  }

  if (useBackend() && !lists.length) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-lg font-semibold text-pe-text">No portfolios yet</p>
        <p className="mt-2 text-sm text-pe-text-secondary">
          Add a portfolio from your profile to track holdings here.
        </p>
        <button
          type="button"
          onClick={() => onOpenProfile?.(ownerId)}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-pe-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-pe-accent-pressed"
        >
          Go to profile
        </button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader>
        <UnderlineTabs
          embedded
          tabs={lists.map((list) => ({ id: list.id, label: list.name }))}
          active={listId}
          onChange={(id) => {
            setListId(id);
            setContentTab('performance');
          }}
          trailing={
            !useBackend() ? (
              <div className="flex h-full shrink-0 items-center gap-1 pr-2">
                <button
                  type="button"
                  onClick={() => setWatchlistOpen(true)}
                  className="inline-flex h-full items-center gap-1 text-[15px] font-semibold text-pe-text-muted hover:text-pe-accent"
                >
                  <Plus className="h-4 w-4" />
                  New list
                </button>
              </div>
            ) : null
          }
        />
      </PageHeader>

      <section className="border-b border-pe-border px-4 py-5">
        {metrics?.kind === 'portfolio' ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-semibold text-pe-text-muted">Current value</p>
              <PortfolioKindMetaTags portfolio={activeList} />
            </div>
            <PortfolioSourceAttribution
              portfolio={activeList}
              onSeeOriginal={onOpenSourcePortfolio}
            />
            <p className="mt-1 text-3xl font-bold tracking-tight text-pe-text">
              {formatInr(metrics.totalValue)}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <MetricCard
                label="Invested"
                value={formatInr(metrics.invested, { compact: true })}
              />
              <MetricCard
                label="Total P&L"
                value={formatInr(metrics.totalPnl, { compact: true })}
                tone={metrics.totalPnl}
              />
              <MetricCard
                label="Day's P&L"
                value={formatInr(metrics.todayPnl, { compact: true })}
                tone={metrics.todayPnl}
              />
            </div>
          </>
        ) : null}

        <div className="mt-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
            Distribution
          </p>
          <div className="flex h-2 overflow-hidden rounded-full bg-pe-surface">
            {chartDistribution.map((d, i) => (
              <div
                key={d.ticker}
                title={`${d.label} ${d.weight.toFixed(1)}%`}
                className="h-full"
                style={{
                  width: `${d.weight}%`,
                  backgroundColor: d.isOthers
                    ? OTHERS_COLOR
                    : DIST_COLORS[i % DIST_COLORS.length],
                }}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {chartDistribution.map((d, i) => (
              <span
                key={d.ticker}
                className="inline-flex items-center gap-1.5 text-xs text-pe-text-secondary"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: d.isOthers
                      ? OTHERS_COLOR
                      : DIST_COLORS[i % DIST_COLORS.length],
                  }}
                />
                {d.label} {d.weight.toFixed(0)}%
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 flex gap-1 rounded-lg bg-pe-surface p-1">
          {PERIODS.map((per) => (
            <button
              key={per}
              type="button"
              onClick={() => setPeriod(per)}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
                period === per
                  ? 'bg-pe-canvas text-pe-text shadow-sm'
                  : 'text-pe-text-secondary hover:text-pe-text'
              }`}
            >
              {per}
            </button>
          ))}
        </div>
      </section>

      <UnderlineTabs tabs={CONTENT_TABS} active={contentTab} onChange={setContentTab} />

      {contentTab === 'summary' && <PortfolioSummaryComingSoon portfolioName={activeList?.name} />}
      {contentTab === 'performance' && (
        <HoldingsSummary
          holdings={overallRow ? [overallRow, ...holdingsRows] : holdingsRows}
          onSelectStock={onSelectStock}
        />
      )}
      {contentTab === 'news' && (
        newsLoading ? (
          <p className="px-6 py-14 text-center text-sm text-pe-text-secondary">Loading news…</p>
        ) : (
          <NewsFeed items={activity.news} />
        )
      )}
      {contentTab === 'trades' && (
        <TradesFeed items={activity.trades} onOpenProfile={onOpenProfile} />
      )}
      {contentTab === 'posts' && (
        <PostsFeed items={activity.posts} onOpenProfile={onOpenProfile} onOpenPost={onOpenPost} />
      )}

      <WatchlistModal
        open={watchlistOpen}
        onClose={() => setWatchlistOpen(false)}
        onSave={(payload) => {
          const created = addWatchlist(payload);
          setListId(created.id);
          setContentTab('performance');
        }}
      />
    </div>
  );
}

const PERIODS = ['1D', '1W', '1M', '1Y'];
const CONTENT_TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'performance', label: 'Performance' },
  { id: 'news', label: 'News' },
  { id: 'trades', label: 'Trades' },
  { id: 'posts', label: 'Posts' },
];

const DIST_COLORS = ['#ff6719', '#1a8917', '#4a6fe3', '#c47b0a', '#6b6b6b', '#d93025'];
const DIST_TOP_N = 5;
const OTHERS_COLOR = '#c7c7c7';

function compressDistribution(distribution, topN = DIST_TOP_N) {
  const sorted = [...(distribution ?? [])].sort((a, b) => b.weight - a.weight);
  if (sorted.length <= topN) {
    return sorted.map((d) => ({ ...d, label: formatTicker(d.ticker), isOthers: false }));
  }

  const top = sorted.slice(0, topN).map((d) => ({
    ...d,
    label: formatTicker(d.ticker),
    isOthers: false,
  }));
  const rest = sorted.slice(topN);
  const othersWeight = rest.reduce((sum, d) => sum + d.weight, 0);

  return [
    ...top,
    {
      ticker: '__others__',
      label: `Others (${rest.length})`,
      weight: othersWeight,
      isOthers: true,
      restCount: rest.length,
    },
  ];
}

function PortfolioSummaryComingSoon({ portfolioName }) {
  return (
    <div className="px-4 py-10">
      <div className="rounded-2xl border border-pe-border bg-pe-surface px-5 py-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pe-accent-wash">
          <Sparkles className="h-5 w-5 text-pe-accent" aria-hidden="true" />
        </div>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-pe-accent">
          Coming soon
        </p>
        <h3 className="mt-2 text-lg font-semibold text-pe-text">AI portfolio summary</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-pe-text-secondary">
          {portfolioName ? (
            <>
              A concise AI read on <span className="font-semibold text-pe-text">{portfolioName}</span>
              — allocation, recent moves, and what to watch.
            </>
          ) : (
            'A concise AI read on your holdings — allocation, recent moves, and what to watch.'
          )}
        </p>
        <p className="mx-auto mt-4 max-w-xs text-xs text-pe-text-muted">
          We&apos;re building this now. You&apos;ll see it here once it&apos;s ready.
        </p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, tone }) {
  return (
    <div className="rounded-[10px] border border-pe-border bg-pe-surface px-3 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
        {label}
      </p>
      <p className={`mt-1.5 text-[15px] font-semibold ${tone != null ? pnlClass(tone) : 'text-pe-text'}`}>
        {value}
      </p>
      {sub && <p className={`text-xs font-semibold ${pnlClass(tone)}`}>{sub}</p>}
    </div>
  );
}
