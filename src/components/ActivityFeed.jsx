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

export function HoldingsSummary({ holdings, onSelectStock, onSelectFund, formByTicker = {} }) {
  const [metric, setMetric] = useState('today_pnl');
  const [sortBy, setSortBy] = useState('current_value');
  const [sortOrder, setSortOrder] = useState('desc');
  const [sortOpen, setSortOpen] = useState(false);
  const [assetFilter, setAssetFilter] = useState('all');
  const sortButtonRef = useRef(null);
  const sortPanelRef = useRef(null);
  const [sortMenuPos, setSortMenuPos] = useState(null);

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

  const cycleMetric = () => {
    setMetric((prev) => {
      const idx = METRIC_OPTIONS.findIndex((opt) => opt.id === prev);
      return METRIC_OPTIONS[(idx + 1) % METRIC_OPTIONS.length].id;
    });
  };

  const cycleAssetFilter = () => {
    setAssetFilter((prev) => {
      const idx = ASSET_FILTERS.findIndex((opt) => opt.id === prev);
      return ASSET_FILTERS[(idx + 1) % ASSET_FILTERS.length].id;
    });
  };

  const metricLabel = METRIC_OPTIONS.find((opt) => opt.id === metric)?.label ?? "Day's PnL";
  const sortLabel = SORT_OPTIONS.find((opt) => opt.id === sortBy)?.label ?? 'Current Value';
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
                    {SORT_OPTIONS.map((opt) => (
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

            const metricValue =
              metric === 'current_value'
                ? {
                    primary: currentValue,
                    secondaryPct: todayPnlPct,
                    primarySigned: false,
                    secondarySigned: true,
                  }
                : {
                    primary: todayPnl,
                    secondaryPct: todayPnlPct,
                    primarySigned: true,
                    secondarySigned: true,
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
              ? formatInr(
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
                    <p
                      data-holding-name
                      className="min-w-0 line-clamp-2 text-[15px] font-semibold leading-5 text-pe-text"
                      title={label}
                    >
                      {label}
                    </p>
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

const SORT_OPTIONS = [
  { id: 'name', label: 'Name' },
  { id: 'current_value', label: 'Current Value' },
  { id: 'today_profit_abs', label: "Today's Profit in abs" },
  { id: 'today_profit_pct', label: "Today's Profit in %" },
];

function getHoldingSortValue(holding, sortBy) {
  const stock = STOCKS[holding.ticker];
  const currentValue = holding.value != null ? Number(holding.value) : null;
  const todayAbs = Number(holding.todayPnl);
  const todayPct = Number(holding.todayPnlPct ?? holding.changePct ?? stock?.changePct);

  const safe = (n) => (n != null && Number.isFinite(Number(n)) ? Number(n) : Number.NEGATIVE_INFINITY);

  switch (sortBy) {
    case 'current_value':
      return safe(currentValue);
    case 'today_profit_abs':
      return safe(todayAbs);
    case 'today_profit_pct':
      return safe(todayPct);
    default:
      return safe(currentValue);
  }
}

function Empty({ label }) {
  return (
    <p className="px-6 py-14 text-center text-[12px] text-pe-text-secondary">{label}</p>
  );
}
