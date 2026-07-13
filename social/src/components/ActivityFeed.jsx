import NewsList from './NewsList';
import Avatar from './Avatar';
import { FormStatusTag } from './FormStatusIcons';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { isDevMockMode } from '../lib/appMode';
import {
  PORTFOLIO_UPDATES,
  POSTS,
  STOCKS,
} from '../data/mockData';
import { getPersonSync } from '../lib/socialIdentity';
import { formatInr, formatPct, formatPrice, pnlClass, timeAgo } from '../lib/format';
import { bodyMentionsTicker, formatTicker } from '../lib/tickers';
import { holdingDisplayLabel } from '../lib/portfolioAssetUniverse';

/** Aggregate news / trades / posts for a set of tickers (portfolio-level or single stock). */
export function collectActivity(tickers) {
  if (!isDevMockMode()) {
    return { news: [], trades: [], posts: [] };
  }

  const news = [];
  const trades = [];
  const posts = [];

  for (const ticker of tickers) {
    for (const u of PORTFOLIO_UPDATES[ticker] ?? []) {
      if (u.type === 'news') news.push({ ...u, ticker });
      if (u.type === 'buy' || u.type === 'sell') trades.push({ ...u, ticker });
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

  return { news, trades, posts };
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

export function TradesFeed({ items, onOpenProfile }) {
  if (!items.length) return <Empty label="No community trades yet." />;
  return (
    <div className="divide-y divide-pe-border">
      {items.map((item) => {
        const person = getPersonSync(item.authorId) ?? { name: 'Member', handle: 'member' };
        const isBuy = item.type === 'buy';
        return (
          <div key={item.id} className="flex gap-3 px-4 py-4">
            <Avatar
              person={person}
              size="sm"
              onClick={() => onOpenProfile?.(item.authorId)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <button
                  type="button"
                  onClick={() => onOpenProfile?.(item.authorId)}
                  className="font-semibold text-pe-text hover:underline"
                >
                  @{person.handle}
                </button>
                <span className="text-pe-text-muted"> · {item.time}</span>
              </p>
              <p className="mt-1 text-sm text-pe-text">
                <span className={`font-bold uppercase ${isBuy ? 'text-pe-positive' : 'text-pe-negative'}`}>
                  {item.type}
                </span>{' '}
                <span className="font-semibold">{formatTicker(item.ticker)}</span>{' '}
                <span className="text-pe-text-secondary">
                  {item.qty} @ {formatPrice(item.price)}
                </span>
                {item.pnlPct != null && (
                  <span className={`ml-2 font-semibold ${pnlClass(item.pnlPct)}`}>
                    {formatPct(item.pnlPct)}
                  </span>
                )}
              </p>
            </div>
          </div>
        );
      })}
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
            className="flex w-full gap-3 px-4 py-4 text-left transition hover:bg-pe-surface"
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
  if (!holdings.length) return <Empty label="No positions in this list." />;

  return (
    <div className="divide-y divide-pe-border">
      {holdings
        .filter((h) => !h.overall)
        .map((h) => {
        const stock = STOCKS[h.ticker];
        const form = formByTicker[h.ticker] ?? h.form;
        const isFund =
          h.assetType === 'fund' || /^\d{6,}$/.test(String(h.ticker ?? '').trim());
        const isEtf = h.assetType === 'etf';
        const qty = Number(h.qty);
        const avg = Number(h.avg);
        const invested =
          h.invested != null
            ? Number(h.invested)
            : Number.isFinite(qty) && Number.isFinite(avg)
              ? qty * avg
              : null;
        const currentValue = h.value != null ? Number(h.value) : null;
        const todayPnl = h.todayPnl;
        const todayPnlPct = h.todayPnlPct ?? h.changePct ?? stock?.changePct;
        const weightPct =
          typeof h.weight === 'number' && Number.isFinite(h.weight) ? h.weight : null;

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
            className="grid w-full grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-x-3 px-4 py-4 text-left transition hover:bg-pe-surface"
          >
            <div className="min-w-0">
              <p className="text-[15px] font-semibold tabular-nums text-pe-text">
                Total{' '}
                {invested != null && Number.isFinite(invested) && invested > 0
                  ? formatInr(invested, { compact: true })
                  : '-'}
                {weightPct != null ? ` · ${weightPct.toFixed(1)}% of Portfolio` : ''}
              </p>
              <p className="mt-1 truncate text-[15px] font-semibold text-pe-text">
                {holdingDisplayLabel(h)}
              </p>
              <p className="mt-1 text-[12px] font-semibold tabular-nums text-pe-text-muted">
                {Number.isFinite(qty) && qty > 0 ? qty.toLocaleString('en-IN') : '-'} QTY
                {' · '}
                Avg{' '}
                {Number.isFinite(avg) && avg > 0 ? formatInr(avg, { compact: true }) : '-'}
              </p>
            </div>
            <div className="min-w-0 self-start text-right">
              <p className="text-[15px] font-semibold tabular-nums text-pe-text">
                Current{' '}
                {currentValue != null && Number.isFinite(currentValue)
                  ? formatInr(currentValue, { compact: true })
                  : '-'}
              </p>
              <HoldingTodayDelta amount={todayPnl} pct={todayPnlPct} />
              {form ? (
                <div className="mt-1 flex justify-end">
                  <FormStatusTag form={form} />
                </div>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function formatHoldingDeltaAmount(n) {
  if (n == null || Number.isNaN(n)) return '-';
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${Math.round(abs).toLocaleString('en-IN')}`;
}

function HoldingTodayDelta({ amount, pct }) {
  const hasAmount = amount != null && Number.isFinite(Number(amount));
  const hasPct = pct != null && Number.isFinite(Number(pct));
  if (!hasAmount && !hasPct) {
    return <p className="mt-1 text-[15px] font-semibold text-pe-text-muted">Today -</p>;
  }

  const tone = hasAmount ? amount : pct;
  const up = tone > 0;
  const down = tone < 0;
  const Icon = up ? ArrowUp : down ? ArrowDown : null;
  const pctText = hasPct
    ? `${Math.abs(Number(pct)).toFixed(Math.abs(Number(pct)) >= 10 ? 0 : 1)}%`
    : null;

  return (
    <p
      className={`mt-1 inline-flex items-center justify-end gap-0.5 text-[15px] font-semibold tabular-nums ${pnlClass(
        tone
      )}`}
    >
      <span>Today</span>
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} /> : null}
      <span>
        {hasAmount ? formatHoldingDeltaAmount(amount) : '-'}
        {pctText ? ` ( ${pctText} )` : ''}
      </span>
    </p>
  );
}

function Empty({ label }) {
  return (
    <p className="px-6 py-14 text-center text-sm text-pe-text-secondary">{label}</p>
  );
}
