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
        const weightPct = (() => {
          const fromHolding = Number(h.weight ?? h.weightPct);
          if (Number.isFinite(fromHolding) && fromHolding > 0) return fromHolding;
          return null;
        })();

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
            <div className="flex min-w-0 items-start gap-3">
              <AssetLogo
                logoIconUrl={h.logoIconUrl}
                assetType={isFund ? 'fund' : isEtf ? 'etf' : h.assetType ?? 'stock'}
                assetKey={h.ticker}
                name={holdingDisplayLabel(h)}
                size="sm"
                priority
                className="mt-0.5"
              />
              <div className="min-w-0">
                <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-pe-text">
                  {holdingDisplayLabel(h)}
                </p>
                <p className="mt-1 text-[12px] tabular-nums text-pe-text-muted">
                  <span className="inline-block">
                    Invested{' '}
                    {invested != null && Number.isFinite(invested) && invested > 0
                      ? formatInr(invested, { compact: true })
                      : '-'}
                  </span>
                  <span className="mx-1.5 text-pe-border-strong">·</span>
                  <span className="inline-block whitespace-nowrap">
                    Qty{' '}
                    {Number.isFinite(qty) && qty > 0 ? qty.toLocaleString('en-IN') : '-'}
                  </span>
                </p>
                <p className="mt-0.5 text-[12px] tabular-nums text-pe-text-muted">
                  {weightPct != null ? `${weightPct.toFixed(1)}% of Portfolio` : '-'}
                </p>
              </div>
            </div>
            <div className="min-w-0 self-start text-right">
              <p className="text-[12px] tabular-nums text-pe-text-muted">
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

function HoldingTodayDelta({ amount, pct }) {
  const hasAmount = amount != null && Number.isFinite(Number(amount));
  const hasPct = pct != null && Number.isFinite(Number(pct));
  if (!hasAmount && !hasPct) {
    return <p className="mt-1 whitespace-nowrap text-[15px] font-semibold text-pe-text-muted">-</p>;
  }

  const tone = hasAmount ? amount : pct;
  const up = tone > 0;
  const down = tone < 0;
  const Icon = up ? ArrowUp : down ? ArrowDown : null;
  const pctText = hasPct ? `${Math.abs(Number(pct)).toFixed(2)}%` : null;

  return (
    <p
      className={`mt-1 inline-flex max-w-full items-center justify-end gap-0.5 whitespace-nowrap text-[15px] font-semibold tabular-nums ${pnlClass(
        tone
      )}`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} /> : null}
      <span>
        {hasAmount ? formatInr(amount, { compact: true }) : '-'}
        {pctText ? ` (${pctText})` : ''}
      </span>
    </p>
  );
}

function Empty({ label }) {
  return (
    <p className="px-6 py-14 text-center text-sm text-pe-text-secondary">{label}</p>
  );
}
