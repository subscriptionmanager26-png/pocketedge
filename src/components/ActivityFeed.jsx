import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import NewsList from './NewsList';
import Avatar from './Avatar';
import AssetLogo from './AssetLogo';
import { FormStatusTag } from './FormStatusIcons';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { isDevMockMode } from '../lib/appMode';
import {
  PORTFOLIO_UPDATES,
  POSTS,
  STOCKS,
} from '../data/mockData';
import { getPersonSync } from '../lib/socialIdentity';
import { formatInr, pnlClass, timeAgo } from '../lib/format';
import { bodyMentionsTicker, formatTicker } from '../lib/tickers';
import { holdingDisplayLabel } from '../lib/portfolioAssetUniverse';

const ASSET_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'stock', label: 'Stocks' },
  { id: 'etf', label: 'ETFs' },
  { id: 'bond', label: 'Bonds' },
  { id: 'fund', label: 'MFs' },
];

const RATING_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'Buy', label: 'Buy' },
  { id: 'Hold', label: 'Hold' },
  { id: 'Sell', label: 'Sell' },
];

function holdingAssetKind(holding) {
  const ticker = String(holding?.ticker ?? '').trim();
  const type = String(holding?.assetType ?? '').toLowerCase();
  if (type === 'fund' || /^\d{6,}$/.test(ticker)) return 'fund';
  if (type === 'etf') return 'etf';
  if (type === 'bond') return 'bond';
  if (type === 'commodity') return 'stock';
  return type === 'stock' || !type ? 'stock' : type;
}

/** Aggregate news / posts for a set of tickers (portfolio-level or single stock). */
export function collectActivity(tickers) {
  if (!isDevMockMode()) {
    return { news: [], posts: [] };
  }

  const news = [];
  const posts = [];

  for (const ticker of tickers) {
    for (const u of PORTFOLIO_UPDATES[ticker] ?? []) {
      if (u.type === 'news') news.push({ ...u, ticker });
      if (u.type === 'post') posts.push({ ...u, ticker });
    }
  }

  // Also pull feed posts that mention these tickers
  for (const post of POSTS) {
    const mentioned = tickers.some((t) => bodyMentionsTicker(post.body, t) || post.trade?.ticker === t);
    if (!mentioned) continue;
    if (posts.some((p) => p.postId === post.id || p.id === post.id)) continue;
    posts.push({
      id: post.id,
      type: 'post',
      postId: post.id,
      authorId: post.authorId,
      snippet: post.body.slice(0, 120) + (post.body.length > 120 ? '…' : ''),
      time: 'recent',
      ticker: tickers.find((t) => bodyMentionsTicker(post.body, t) || post.trade?.ticker === t),
    });
  }

  return { news, posts };
}

/** Map backend posts into the compact PostsFeed shape. */
export function postsToActivityItems(posts, tickers = []) {
  return (posts ?? []).map((post) => {
    const ticker =
      tickers.find((t) => bodyMentionsTicker(post.body, t) || post.trade?.ticker === t) ??
      post.trade?.ticker ??
      null;
    const body = post.body ?? '';
    return {
      id: post.id,
      type: 'post',
      postId: post.id,
      authorId: post.authorId,
      snippet: body.slice(0, 120) + (body.length > 120 ? '…' : ''),
      time: post.createdAt ? timeAgo(post.createdAt) : '',
      createdAt: post.createdAt,
      ticker,
    };
  });
}

export function NewsFeed({ items }) {
  if (!items.length) return <Empty label="No news for this list yet." />;
  return <NewsList items={items} showTicker />;
}

/**
 * Portfolio tab: compact analyst ratings for stock/ETF holdings with coverage.
 * Rating (consensus) and upside vs live price are shown as separate fields —
 * they can disagree (e.g. Buy with negative upside).
 */
export function AnalystRatingsFeed({
  holdings = [],
  analystByTicker = {},
  onSelectStock,
}) {
  const [ratingFilter, setRatingFilter] = useState('all');

  const allRows = holdings
    .filter((h) => {
      const ticker = String(h.ticker ?? '').trim();
      if (!ticker) return false;
      if (h.assetType === 'fund' || /^\d{6,}$/.test(ticker)) return false;
      if (/^(BSE|NSE):\d+$/i.test(ticker)) return false;
      if (ticker.includes(':')) return false;
      const key = ticker.toUpperCase();
      const rating = analystByTicker[key] ?? analystByTicker[h.ticker];
      return (
        rating &&
        rating.consensusLabel &&
        rating.consensusLabel !== 'Limited'
      );
    })
    .map((h) => {
      const key = String(h.ticker ?? '')
        .trim()
        .toUpperCase();
      return {
        holding: h,
        rating: analystByTicker[key] ?? analystByTicker[h.ticker],
      };
    })
    .sort((a, b) => {
      const order = { Buy: 0, Hold: 1, Sell: 2 };
      const la = order[a.rating.consensusLabel] ?? 9;
      const lb = order[b.rating.consensusLabel] ?? 9;
      if (la !== lb) return la - lb;
      const ua = Number(a.rating.upsidePct);
      const ub = Number(b.rating.upsidePct);
      const aOk = Number.isFinite(ua);
      const bOk = Number.isFinite(ub);
      if (aOk && bOk) return ub - ua;
      if (aOk) return -1;
      if (bOk) return 1;
      return holdingDisplayLabel(a.holding).localeCompare(holdingDisplayLabel(b.holding));
    });

  const counts = { all: allRows.length, Buy: 0, Hold: 0, Sell: 0 };
  for (const row of allRows) {
    const label = row.rating.consensusLabel;
    if (counts[label] != null) counts[label] += 1;
  }

  const rows =
    ratingFilter === 'all'
      ? allRows
      : allRows.filter((row) => row.rating.consensusLabel === ratingFilter);

  if (!allRows.length) {
    return <Empty label="No analyst ratings for holdings in this list yet." />;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 border-b border-pe-border px-4 py-2.5 sm:px-5">
        {RATING_FILTERS.map((opt) => {
          const active = ratingFilter === opt.id;
          const count = counts[opt.id] ?? 0;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRatingFilter(opt.id)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold transition ${
                active
                  ? 'bg-[var(--fv-accent,var(--pe-accent))] text-white'
                  : 'bg-pe-surface text-pe-text-secondary hover:text-pe-text'
              }`}
              aria-pressed={active}
            >
              <span>{opt.label}</span>
              <span
                className={`tabular-nums ${
                  active ? 'text-white/80' : 'text-pe-text-muted'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {!rows.length ? (
        <Empty label={`No ${ratingFilter.toLowerCase()} ratings in this list.`} />
      ) : (
        <div className="divide-y divide-pe-border">
          {rows.map(({ holding: h, rating }) => {
            const isEtf = h.assetType === 'etf';
            const label = holdingDisplayLabel(h);
            const consensus = rating.consensusLabel;
            const consensusClass =
              consensus === 'Buy'
                ? 'text-pe-positive'
                : consensus === 'Sell'
                  ? 'text-pe-negative'
                  : 'text-pe-text';
            const consensusBadgeClass =
              consensus === 'Buy'
                ? 'bg-[rgba(26,137,23,0.1)] text-pe-positive'
                : consensus === 'Sell'
                  ? 'bg-[rgba(217,48,37,0.1)] text-pe-negative'
                  : 'bg-pe-surface text-pe-text-secondary';
            const upside = Number(rating.upsidePct);
            const hasUpside = Number.isFinite(upside);
            const upsideText = hasUpside
              ? `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%`
              : '—';

            return (
              <button
                key={h.ticker}
                type="button"
                onClick={() =>
                  onSelectStock?.(h.ticker, {
                    kind: isEtf ? 'etf' : 'stock',
                    assetType: h.assetType,
                  })
                }
                className="flex w-full items-start gap-x-2.5 px-4 py-3.5 text-left transition hover:bg-black/[0.03] sm:gap-x-3.5 sm:px-5 sm:py-5"
              >
                <div className="flex h-10 w-8 shrink-0 items-center justify-center">
                  <AssetLogo
                    logoIconUrl={h.logoIconUrl}
                    assetType={isEtf ? 'etf' : h.assetType ?? 'stock'}
                    assetKey={h.ticker}
                    name={label}
                    size="sm"
                    priority
                    className="shrink-0"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className="min-w-0 line-clamp-2 text-[15px] font-semibold leading-5 text-pe-text"
                        title={label}
                      >
                        {label}
                      </p>
                      <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-pe-text-muted">
                        {formatTicker(h.ticker)}
                      </p>
                    </div>

                    <div className="grid shrink-0 grid-cols-2 gap-x-4 text-right">
                      <div className="min-w-[3.25rem]">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-pe-text-muted">
                          Rating
                        </p>
                        <span
                          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${consensusBadgeClass} ${consensusClass}`}
                        >
                          {consensus}
                        </span>
                      </div>
                      <div className="min-w-[3.75rem]">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-pe-text-muted">
                          Upside
                        </p>
                        <p
                          className={`mt-1 text-[15px] font-semibold leading-6 tabular-nums ${
                            hasUpside ? pnlClass(upside) : 'text-pe-text-muted'
                          }`}
                        >
                          {upsideText}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PostsFeed({ items, onOpenProfile, onOpenPost }) {
  if (!items.length) return <Empty label="No posts mentioning these stocks yet." />;
  return (
    <div className="divide-y divide-pe-border">
      {items.map((item) => {
        const person = getPersonSync(item.authorId) ?? { name: 'Member', handle: 'member' };
        const postId = item.postId ?? item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenPost?.(postId)}
            className="flex w-full gap-3 px-4 py-4 text-left transition hover:bg-black/[0.03]"
          >
            <Avatar
              person={person}
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onOpenProfile?.(item.authorId);
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-semibold text-pe-text">{person.name}</span>
                <span className="text-sm text-pe-text-muted">@{person.handle}</span>
                {item.ticker && (
                  <span className="text-xs font-semibold text-pe-text-secondary">
                    {formatTicker(item.ticker)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[15px] leading-6 text-pe-ink">{item.snippet}</p>
              <p className="mt-1 text-xs text-pe-text-muted">{item.time}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function HoldingsSummary({
  holdings,
  onSelectStock,
  onSelectFund,
  formByTicker = {},
  isWatchlist = false,
}) {
  const [metric, setMetric] = useState('today_pnl');
  const [sortBy, setSortBy] = useState(isWatchlist ? 'today_profit_pct' : 'current_value');
  const [sortOrder, setSortOrder] = useState('desc');
  const [sortOpen, setSortOpen] = useState(false);
  const [assetFilter, setAssetFilter] = useState('all');
  const sortButtonRef = useRef(null);
  const sortPanelRef = useRef(null);
  const [sortMenuPos, setSortMenuPos] = useState(null);

  useEffect(() => {
    if (isWatchlist) {
      setMetric('today_pnl');
      setSortBy((prev) => (prev === 'current_value' || prev === 'today_profit_abs' ? 'today_profit_pct' : prev));
    }
  }, [isWatchlist]);

  useLayoutEffect(() => {
    if (!sortOpen) {
      setSortMenuPos(null);
      return undefined;
    }
    const syncPos = () => {
      const button = sortButtonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setSortMenuPos({
        top: rect.bottom + 4,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };
    syncPos();
    window.addEventListener('resize', syncPos);
    window.addEventListener('scroll', syncPos, true);
    return () => {
      window.removeEventListener('resize', syncPos);
      window.removeEventListener('scroll', syncPos, true);
    };
  }, [sortOpen]);

  useEffect(() => {
    if (!sortOpen) return undefined;
    const onPointerDown = (event) => {
      const inButton = sortButtonRef.current?.contains(event.target);
      const inPanel = sortPanelRef.current?.contains(event.target);
      if (!inButton && !inPanel) setSortOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [sortOpen]);

  if (!holdings.length) return <Empty label="No positions in this list." />;

  const metricOptions = isWatchlist ? WATCHLIST_METRIC_OPTIONS : METRIC_OPTIONS;
  const sortOptions = isWatchlist ? WATCHLIST_SORT_OPTIONS : SORT_OPTIONS;

  const cycleMetric = () => {
    if (isWatchlist) return;
    setMetric((prev) => {
      const idx = metricOptions.findIndex((opt) => opt.id === prev);
      return metricOptions[(idx + 1) % metricOptions.length].id;
    });
  };

  const cycleAssetFilter = () => {
    setAssetFilter((prev) => {
      const idx = ASSET_FILTERS.findIndex((opt) => opt.id === prev);
      return ASSET_FILTERS[(idx + 1) % ASSET_FILTERS.length].id;
    });
  };

  const metricLabel =
    metricOptions.find((opt) => opt.id === metric)?.label ?? (isWatchlist ? '1D change' : "Day's PnL");
  const sortLabel = sortOptions.find((opt) => opt.id === sortBy)?.label ?? (isWatchlist ? '1D change' : 'Current Value');
  const assetLabel = ASSET_FILTERS.find((opt) => opt.id === assetFilter)?.label ?? 'All';

  const sortedHoldings = [...holdings]
    .filter((h) => !h.overall)
    .filter((h) => assetFilter === 'all' || holdingAssetKind(h) === assetFilter)
    .sort((a, b) => {
      if (sortBy === 'name') {
        const aName = holdingDisplayLabel(a).toLocaleLowerCase();
        const bName = holdingDisplayLabel(b).toLocaleLowerCase();
        const cmp = aName.localeCompare(bName);
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      const aValue = getHoldingSortValue(a, sortBy);
      const bValue = getHoldingSortValue(b, sortBy);
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

  const pillClass =
    'inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-medium uppercase tracking-[0.04em] text-pe-text-muted shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition hover:text-pe-text sm:px-2.5';

  return (
    <div>
      <div className="relative z-10 flex flex-nowrap items-center gap-1.5 overflow-visible border-b border-[var(--fv-border,#ececec)] px-4 py-2.5 sm:gap-2 sm:px-5">
        <p className="inline-flex shrink-0 items-center px-1 text-[11px] font-medium uppercase tracking-[0.04em] text-pe-text-muted sm:px-2">
          Name
        </p>
        <div className="relative ml-auto flex shrink-0 flex-nowrap items-center gap-1.5 overflow-visible sm:gap-2">
          <button
            type="button"
            onClick={cycleAssetFilter}
            className={pillClass}
            aria-label={`Asset filter: ${assetLabel}. Click to change.`}
            title="Tap to switch asset type"
          >
            <span className="whitespace-nowrap">{assetLabel}</span>
            <span aria-hidden="true" className="shrink-0 text-[12px] leading-none">
              {'>'}
            </span>
          </button>

          <div className="relative shrink-0">
            <button
              ref={sortButtonRef}
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              className={pillClass}
              aria-haspopup="menu"
              aria-expanded={sortOpen}
              aria-label={`Sort holdings. Current: ${sortLabel}`}
              title="Sort holdings"
            >
              <span>Sort</span>
              <span className="inline-flex items-center gap-0">
                <ArrowUp className="h-3 w-3 shrink-0" strokeWidth={2.5} />
                <ArrowDown className="-ml-0.5 h-3 w-3 shrink-0" strokeWidth={2.5} />
              </span>
            </button>

            {sortOpen && sortMenuPos && typeof document !== 'undefined'
              ? createPortal(
                  <div
                    ref={sortPanelRef}
                    role="menu"
                    style={{ top: sortMenuPos.top, right: sortMenuPos.right }}
                    className="fixed z-[80] w-44 rounded-[14px] bg-white p-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.06)]"
                  >
                    <div className="mb-1 grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => setSortOrder('asc')}
                        className={`rounded-lg px-2 py-1 text-[12px] font-semibold leading-5 ${
                          sortOrder === 'asc'
                            ? 'bg-black/[0.06] text-pe-text'
                            : 'text-pe-text-muted hover:bg-black/[0.04] hover:text-pe-text'
                        }`}
                      >
                        Asc
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortOrder('desc')}
                        className={`rounded-lg px-2 py-1 text-[12px] font-semibold leading-5 ${
                          sortOrder === 'desc'
                            ? 'bg-black/[0.06] text-pe-text'
                            : 'text-pe-text-muted hover:bg-black/[0.04] hover:text-pe-text'
                        }`}
                      >
                        Desc
                      </button>
                    </div>
                    {sortOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={sortBy === opt.id}
                        onClick={() => {
                          setSortBy(opt.id);
                          setSortOpen(false);
                        }}
                        className={`block w-full rounded-lg px-2 py-1.5 text-left text-[12px] font-semibold leading-5 ${
                          sortBy === opt.id
                            ? 'bg-black/[0.06] text-pe-text'
                            : 'text-pe-text-muted hover:bg-black/[0.04] hover:text-pe-text'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>,
                  document.body
                )
              : null}
          </div>

          {isWatchlist ? (
            <span className={pillClass} aria-label="Metric column: 1D change">
              <span className="whitespace-nowrap">1D change</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={cycleMetric}
              className={pillClass}
              aria-label={`Metric column: ${metricLabel}. Click to change.`}
              title="Tap to switch metric"
            >
              <span className="whitespace-nowrap">{metricLabel}</span>
              <span aria-hidden="true" className="shrink-0 text-[12px] leading-none">
                {'>'}
              </span>
            </button>
          )}
        </div>
      </div>

      {sortedHoldings.length === 0 ? (
        <Empty label="No holdings in this category." />
      ) : (
      <div className="divide-y divide-[var(--fv-border,#ececec)]">
        {sortedHoldings.map((h) => {
            const stock = STOCKS[h.ticker];
            const computedForm = formByTicker[h.ticker];
            const form = computedForm && computedForm !== 'unsure' ? computedForm : h.form ?? computedForm;
            const isFund =
              h.assetType === 'fund' || /^\d{6,}$/.test(String(h.ticker ?? '').trim());
            const isEtf = h.assetType === 'etf';
            const currentValue = h.value != null ? Number(h.value) : null;
            const todayPnl = h.todayPnl;
            const todayPnlPct = h.todayPnlPct ?? h.changePct ?? stock?.changePct;
            const label = holdingDisplayLabel(h);

            const metricValue = isWatchlist
              ? {
                  primary: todayPnlPct,
                  secondaryPct: null,
                  primarySigned: true,
                  secondarySigned: false,
                  primaryIsPct: true,
                }
              : metric === 'current_value'
                ? {
                    primary: currentValue,
                    secondaryPct: todayPnlPct,
                    primarySigned: false,
                    secondarySigned: true,
                    primaryIsPct: false,
                  }
                : {
                    primary: todayPnl,
                    secondaryPct: todayPnlPct,
                    primarySigned: true,
                    secondarySigned: true,
                    primaryIsPct: false,
                  };

            const primaryTone = metricValue.primarySigned ? metricValue.primary : null;
            const secondaryTone = metricValue.secondarySigned ? metricValue.secondaryPct : null;
            const primaryUp = Number(primaryTone) > 0;
            const primaryDown = Number(primaryTone) < 0;
            const secondaryUp = Number(secondaryTone) > 0;
            const secondaryDown = Number(secondaryTone) < 0;
            const SecondaryIcon = secondaryUp ? ArrowUp : secondaryDown ? ArrowDown : null;
            const hasPrimary =
              metricValue.primary != null && Number.isFinite(Number(metricValue.primary));
            const hasSecondary =
              metricValue.secondaryPct != null &&
              Number.isFinite(Number(metricValue.secondaryPct));
            const primaryMagnitude = hasPrimary
              ? metricValue.primaryIsPct
                ? `${Math.abs(Number(metricValue.primary)).toFixed(2)}%`
                : formatInr(
                    metricValue.primarySigned
                      ? Math.abs(Number(metricValue.primary))
                      : Number(metricValue.primary),
                    { compact: true }
                  )
              : '—';
            const primarySign = metricValue.primarySigned
              ? primaryUp
                ? '+'
                : primaryDown
                  ? '-'
                  : ''
              : '';
            const primaryText = hasPrimary ? `${primarySign}${primaryMagnitude}` : '—';
            const secondaryText = hasSecondary
              ? `${Math.abs(Number(metricValue.secondaryPct)).toFixed(2)}%`
              : null;

            return (
              <button
                key={h.ticker}
                type="button"
                onClick={() => {
                  if (isFund) {
                    if (onSelectFund) onSelectFund(h.ticker);
                    else onSelectStock?.(h.ticker, { assetType: 'fund' });
                    return;
                  }
                  onSelectStock?.(h.ticker, {
                    kind: isEtf ? 'etf' : 'stock',
                    assetType: h.assetType,
                  });
                }}
                className="flex w-full items-start gap-x-2.5 px-4 py-3.5 text-left transition hover:bg-black/[0.03] sm:gap-x-3.5 sm:px-5 sm:py-5"
              >
                {/*
                  Center logo in a fixed band:
                  Invested line (leading-5) + gap-0.5 + first name line (leading-5).
                  Extra wrapped name lines sit below this band and do not move the logo.
                */}
                <div
                  data-holding-logo
                  className="flex h-[calc(1.25rem+0.125rem+1.25rem)] w-8 shrink-0 items-center justify-center"
                >
                  <AssetLogo
                    logoIconUrl={h.logoIconUrl}
                    assetType={isFund ? 'fund' : isEtf ? 'etf' : h.assetType ?? 'stock'}
                    assetKey={h.ticker}
                    name={label}
                    size="sm"
                    priority
                    className="shrink-0"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex h-5 items-center justify-between gap-2 sm:gap-3">
                    <div
                      data-holding-invested
                      className="flex h-5 min-w-0 items-center gap-1.5 sm:gap-2"
                    >
                      <p className="min-w-0 truncate text-[12px] font-semibold leading-5 tabular-nums text-pe-text-muted">
                        Qty{' '}
                        {Number.isFinite(Number(h.qty))
                          ? Number(h.qty).toLocaleString('en-IN', { maximumFractionDigits: 4 })
                          : '—'}
                      </p>
                      {form ? (
                        <span className="inline-flex max-h-5 shrink-0 items-center overflow-visible">
                          <FormStatusTag form={form} compact />
                        </span>
                      ) : null}
                    </div>
                    <p
                      className={`inline-flex h-5 shrink-0 items-center justify-end gap-0.5 whitespace-nowrap text-right text-[12px] font-semibold leading-5 tabular-nums ${
                        hasSecondary
                          ? metricValue.secondarySigned
                            ? pnlClass(secondaryTone ?? 0)
                            : 'text-pe-text-muted'
                          : 'text-pe-text-muted'
                      }`}
                    >
                      {SecondaryIcon ? (
                        <SecondaryIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                      ) : null}
                      {secondaryText ?? '—'}
                    </p>
                  </div>

                  <div className="mt-0.5 flex items-start justify-between gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        data-holding-name
                        className="min-w-0 line-clamp-2 text-[15px] font-semibold leading-5 text-pe-text"
                        title={label}
                      >
                        {label}
                      </p>
                    </div>
                    <p
                      className={`inline-flex h-5 shrink-0 items-center justify-end gap-0.5 whitespace-nowrap text-right text-[15px] font-semibold leading-5 tabular-nums ${
                        metricValue.primarySigned
                          ? pnlClass(metricValue.primary ?? 0)
                          : 'text-pe-text'
                      }`}
                    >
                      <span>{primaryText}</span>
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
      </div>
      )}
    </div>
  );
}

const METRIC_OPTIONS = [
  { id: 'today_pnl', label: "Day's PnL" },
  { id: 'current_value', label: 'Current Value' },
];

const WATCHLIST_METRIC_OPTIONS = [{ id: 'today_pnl', label: '1D change' }];

const SORT_OPTIONS = [
  { id: 'name', label: 'Name' },
  { id: 'current_value', label: 'Current Value' },
  { id: 'today_profit_abs', label: "Today's Profit in abs" },
  { id: 'today_profit_pct', label: "Today's Profit in %" },
];

const WATCHLIST_SORT_OPTIONS = [
  { id: 'name', label: 'Name' },
  { id: 'today_profit_pct', label: '1D change' },
  { id: 'weight', label: 'Alloc. %' },
];

function getHoldingSortValue(holding, sortBy) {
  const stock = STOCKS[holding.ticker];
  const currentValue = holding.value != null ? Number(holding.value) : null;
  const todayAbs = Number(holding.todayPnl);
  const todayPct = Number(holding.todayPnlPct ?? holding.changePct ?? stock?.changePct);
  const weight = Number(holding.weight ?? holding.weightPct);

  const safe = (n) => (n != null && Number.isFinite(Number(n)) ? Number(n) : Number.NEGATIVE_INFINITY);

  switch (sortBy) {
    case 'current_value':
      return safe(currentValue);
    case 'today_profit_abs':
      return safe(todayAbs);
    case 'today_profit_pct':
      return safe(todayPct);
    case 'weight':
      return safe(weight);
    default:
      return safe(currentValue);
  }
}

function Empty({ label }) {
  return (
    <p className="px-6 py-14 text-center text-[12px] text-pe-text-secondary">{label}</p>
  );
}
