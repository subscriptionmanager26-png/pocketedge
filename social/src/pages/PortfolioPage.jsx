import { useMemo, useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
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
import { MY_PORTFOLIO, STOCKS } from '../data/mockData';
import { formatInr, formatPct, pnlClass } from '../lib/format';
import { addWatchlist, getWatchlists, subscribeWatchlists } from '../lib/watchlistStore';

export default function PortfolioPage({ onSelectStock, onOpenProfile, onOpenPost }) {
  const [listId, setListId] = useState('holdings');
  const [period, setPeriod] = useState('1D');
  const [contentTab, setContentTab] = useState('summary');
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [watchlistTick, setWatchlistTick] = useState(0);

  useEffect(() => subscribeWatchlists(() => setWatchlistTick((n) => n + 1)), []);

  const watchlists = useMemo(() => getWatchlists(), [watchlistTick]);

  const lists = useMemo(
    () => [
      { id: 'holdings', name: 'Holdings', kind: 'portfolio' },
      ...watchlists.map((w) => ({
        id: w.id,
        name: w.name,
        kind: 'watchlist',
        tickers: w.tickers,
      })),
    ],
    [watchlists]
  );

  const activeList = lists.find((l) => l.id === listId) ?? lists[0];
  const isHoldings = activeList.id === 'holdings';

  const holdingsRows = useMemo(() => {
    if (isHoldings) return MY_PORTFOLIO.holdings;
    return (activeList.tickers ?? []).map((ticker) => ({
      ticker,
      watchlistOnly: true,
      spark: STOCKS[ticker]?.spark,
      pnlPct: STOCKS[ticker]?.changePct,
      price: STOCKS[ticker]?.price,
    }));
  }, [activeList, isHoldings]);

  const tickers = holdingsRows.map((h) => h.ticker);

  const metrics = useMemo(() => {
    if (isHoldings) {
      const p = MY_PORTFOLIO;
      const totalValue = p.holdings.reduce((s, h) => s + h.value, 0);
      const distribution = p.holdings
        .map((h) => ({
          ticker: h.ticker,
          weight: (h.value / totalValue) * 100,
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
        count: p.holdings.length,
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
  }, [isHoldings, tickers]);

  const activity = useMemo(() => collectActivity(tickers), [tickers]);

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
            setContentTab('summary');
          }}
          trailing={
            <button
              type="button"
              onClick={() => setWatchlistOpen(true)}
              className="inline-flex h-full shrink-0 items-center gap-1 pr-2 text-[15px] font-semibold text-pe-text-muted hover:text-pe-accent"
            >
              <Plus className="h-4 w-4" />
              New list
            </button>
          }
        />
      </PageHeader>

      {/* Metrics for selected list */}
      <section className="border-b border-pe-border px-4 py-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
          {activeList.name}
        </p>

        {metrics.kind === 'portfolio' ? (
          <>
            <p className="mt-1 font-serif text-3xl font-bold tracking-tight text-pe-text">
              {formatInr(metrics.totalValue)}
            </p>
            <p className={`mt-1 text-[15px] font-semibold ${pnlClass(metrics.todayPnl)}`}>
              {formatInr(metrics.todayPnl)} ({formatPct(metrics.todayPnlPct)}) today
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <MetricCard label="Invested" value={formatInr(metrics.invested, { compact: true })} />
              <MetricCard
                label="Total P&L"
                value={formatInr(metrics.totalPnl, { compact: true })}
                sub={formatPct(metrics.totalPnlPct)}
                tone={metrics.totalPnl}
              />
              <MetricCard
                label="XIRR"
                value={formatPct(metrics.xirr, { signed: false })}
                tone={metrics.xirr}
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

        {/* Distribution */}
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
            Distribution
          </p>
          <div className="flex h-2 overflow-hidden rounded-full bg-pe-surface">
            {metrics.distribution.map((d, i) => (
              <div
                key={d.ticker}
                title={`${d.ticker} ${d.weight.toFixed(1)}%`}
                className="h-full"
                style={{
                  width: `${d.weight}%`,
                  backgroundColor: DIST_COLORS[i % DIST_COLORS.length],
                }}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {metrics.distribution.slice(0, 5).map((d, i) => (
              <span key={d.ticker} className="inline-flex items-center gap-1.5 text-xs text-pe-text-secondary">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: DIST_COLORS[i % DIST_COLORS.length] }}
                />
                ${d.ticker} {d.weight.toFixed(0)}%
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

      {contentTab === 'summary' && (
        <HoldingsSummary holdings={holdingsRows} onSelectStock={onSelectStock} />
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
          setContentTab('summary');
        }}
      />
    </div>
  );
}

const PERIODS = ['1D', '1W', '1M', '1Y'];
const CONTENT_TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'news', label: 'News' },
  { id: 'trades', label: 'Trades' },
  { id: 'posts', label: 'Posts' },
];

const DIST_COLORS = ['#ff6719', '#1a8917', '#4a6fe3', '#c47b0a', '#6b6b6b', '#d93025'];

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
