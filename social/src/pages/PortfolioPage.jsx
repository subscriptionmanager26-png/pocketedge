import { useMemo, useState, useEffect } from 'react';
import { Plus, Share2 } from 'lucide-react';
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
import { CURRENT_USER, MY_PORTFOLIO, STOCKS, getUserPortfolios } from '../data/mockData';
import { formatInr, formatPct, pnlClass } from '../lib/format';
import { formatTicker } from '../lib/tickers';
import { addWatchlist, getWatchlists, subscribeWatchlists } from '../lib/watchlistStore';

export default function PortfolioPage({
  onSelectStock,
  onOpenProfile,
  onOpenPost,
  onSharePortfolio,
}) {
  const [listId, setListId] = useState(null);
  const [period, setPeriod] = useState('1D');
  const [contentTab, setContentTab] = useState('performance');
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [watchlistTick, setWatchlistTick] = useState(0);

  useEffect(() => subscribeWatchlists(() => setWatchlistTick((n) => n + 1)), []);

  const watchlists = useMemo(() => getWatchlists(), [watchlistTick]);

  const lists = useMemo(() => {
    const portfolios = getUserPortfolios(CURRENT_USER.id);
    const livePortfolios = portfolios.filter((p) => p.kind !== 'watchlist');
    const watchlistPortfolios = portfolios.filter((p) => p.kind === 'watchlist');
    const portfolioLists = livePortfolios.length
      ? livePortfolios.map((p) => ({ ...p, kind: 'portfolio' }))
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
      ...watchlistPortfolios.map((w) => ({
        id: w.id,
        name: w.name,
        kind: 'watchlist',
        tickers: w.tickers ?? [],
      })),
    ];
  }, [watchlists]);

  useEffect(() => {
    if (!lists.length) return;
    if (!listId || !lists.some((l) => l.id === listId)) {
      setListId(lists[0].id);
    }
  }, [lists, listId]);

  const activeList = lists.find((l) => l.id === listId) ?? lists[0];
  const isPortfolio = activeList?.kind === 'portfolio';

  const holdingsRows = useMemo(() => {
    if (!activeList) return [];
    if (isPortfolio) {
      const holdings = activeList.holdings ?? [];
      const totalValue = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0);
      return holdings.map((h) => ({
        ...h,
        weight: totalValue > 0 ? ((h.value ?? 0) / totalValue) * 100 : 0,
      }));
    }
    return (activeList.tickers ?? []).map((ticker) => ({
      ticker,
      watchlistOnly: true,
      spark: STOCKS[ticker]?.spark,
      pnlPct: STOCKS[ticker]?.changePct,
      price: STOCKS[ticker]?.price,
    }));
  }, [activeList, isPortfolio]);

  const tickers = holdingsRows.map((h) => h.ticker);

  const metrics = useMemo(() => {
    if (isPortfolio) {
      const p = activeList ?? MY_PORTFOLIO;
      const holdings = p.holdings ?? [];
      const totalValue = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
      const distribution = holdings
        .map((h) => ({
          ticker: h.ticker,
          weight: totalValue > 0 ? ((h.value ?? 0) / totalValue) * 100 : 0,
        }))
        .sort((a, b) => b.weight - a.weight);
      return {
        kind: 'portfolio',
        totalValue: p.totalValue,
        todayPnl: p.todayPnl,
        todayPnlPct: p.todayPnlPct,
        invested: p.invested,
        totalPnl: p.totalPnl,
        totalPnlPct: p.totalPnlPct,
        xirr: p.xirr,
        count: holdings.length,
        distribution,
      };
    }

    const changes = tickers.map((t) => STOCKS[t]?.changePct ?? 0);
    const avgChange = changes.length
      ? changes.reduce((a, b) => a + b, 0) / changes.length
      : 0;
    const distribution = tickers.map((t) => ({
      ticker: t,
      weight: 100 / Math.max(tickers.length, 1),
    }));
    return {
      kind: 'watchlist',
      count: tickers.length,
      avgChange,
      gainers: changes.filter((c) => c > 0).length,
      losers: changes.filter((c) => c < 0).length,
      distribution,
    };
  }, [isPortfolio, activeList, tickers]);

  const activity = useMemo(() => collectActivity(tickers), [tickers]);

  const overallRow = useMemo(() => {
    if (!isPortfolio || metrics?.kind !== 'portfolio') return null;
    return {
      overall: true,
      weight: 100,
      pnlPct: metrics.todayPnlPct ?? 0,
      invested: metrics.invested ?? 0,
    };
  }, [isPortfolio, metrics]);

  const chartDistribution = useMemo(
    () => compressDistribution(metrics?.distribution ?? []),
    [metrics]
  );

  return (
    <div>
      {/* Primary control: which portfolio / watchlist (replaces page title on desktop) */}
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
          }
        />
      </PageHeader>

      {isPortfolio ? (
        <div className="border-b border-pe-border px-4 py-3">
          <button
            type="button"
            onClick={() => onSharePortfolio?.(activeList)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-pe-accent bg-pe-accent-wash px-4 py-2.5 text-[15px] font-semibold text-pe-accent transition hover:bg-pe-accent hover:text-white"
          >
            <Share2 className="h-4 w-4" />
            Share portfolio to feed
          </button>
        </div>
      ) : null}

      {/* Metrics for selected list */}
      <section className="border-b border-pe-border px-4 py-5">
        {metrics.kind === 'portfolio' ? (
          <>
            <p className="font-serif text-[15px] font-semibold text-pe-text-muted">Current value</p>
            <p className="mt-1 font-serif text-3xl font-bold tracking-tight text-pe-text">
              {formatInr(metrics.totalValue)}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <MetricCard label="Invested" value={formatInr(metrics.invested, { compact: true })} />
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
        ) : (
          <>
            <p className="mt-1 font-serif text-3xl font-bold tracking-tight text-pe-text">
              {metrics.count} stocks
            </p>
            <p className={`mt-1 text-[15px] font-semibold ${pnlClass(metrics.avgChange)}`}>
              Avg {formatPct(metrics.avgChange)} today
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <MetricCard label="Tracking" value={String(metrics.count)} />
              <MetricCard label="Gainers" value={String(metrics.gainers)} tone={1} />
              <MetricCard label="Losers" value={String(metrics.losers)} tone={-1} />
            </div>
          </>
        )}

        {/* Distribution — Top N + Others so large portfolios stay readable */}
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

      {/* Portfolio-level content tabs */}
      <UnderlineTabs tabs={CONTENT_TABS} active={contentTab} onChange={setContentTab} />

      {contentTab === 'performance' && (
        <HoldingsSummary
          holdings={overallRow ? [overallRow, ...holdingsRows] : holdingsRows}
          onSelectStock={onSelectStock}
        />
      )}
      {contentTab === 'news' && <NewsFeed items={activity.news} />}
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
  { id: 'performance', label: 'Performance' },
  { id: 'news', label: 'News' },
  { id: 'trades', label: 'Trades' },
  { id: 'posts', label: 'Posts' },
];

const DIST_COLORS = ['#ff6719', '#1a8917', '#4a6fe3', '#c47b0a', '#6b6b6b', '#d93025'];
const DIST_TOP_N = 5;
const OTHERS_COLOR = '#c7c7c7';

/** Collapse a long weight list into Top N + Others for the distribution chart. */
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
