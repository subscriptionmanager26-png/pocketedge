import NewsList from './NewsList';
import Avatar from './Avatar';
import { FormStatusTag } from './FormStatusIcons';
import { isDevMockMode } from '../lib/appMode';
import {
  PORTFOLIO_UPDATES,
  POSTS,
  STOCKS,
} from '../data/mockData';
import { getPersonSync } from '../lib/socialIdentity';
import { formatPct, formatPrice, pnlClass, timeAgo } from '../lib/format';
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
      {holdings.map((h) => {
        const isOverall = h.overall;
        const stock = isOverall ? null : STOCKS[h.ticker];
        const isWatch = h.watchlistOnly;
        const changePct = h.pnlPct ?? stock?.changePct ?? 0;
        const weightLabel =
          typeof h.weight === 'number' ? `${h.weight.toFixed(1)}% of holdings` : null;
        const form = !isOverall ? formByTicker[h.ticker] ?? h.form : null;
        const isFund =
          h.assetType === 'fund' || /^\d{6,}$/.test(String(h.ticker ?? '').trim());

        return (
          <button
            key={isOverall ? 'overall' : h.ticker}
            type="button"
            onClick={() => {
              if (isOverall) return;
              if (isFund) {
                if (onSelectFund) onSelectFund(h.ticker);
                else onSelectStock?.(h.ticker, { assetType: 'fund' });
                return;
              }
              onSelectStock?.(h.ticker, {
                kind: h.assetType === 'etf' ? 'etf' : 'stock',
                assetType: h.assetType,
              });
            }}
            className={`grid w-full grid-cols-[minmax(0,1.4fr)_0.8fr] gap-x-3 gap-y-0.5 px-4 py-4 text-left transition ${
              isOverall ? 'cursor-default' : 'hover:bg-pe-surface'
            }`}
          >
            {!isWatch && weightLabel ? (
              <>
                <p className="text-xs font-semibold text-pe-text-secondary">
                  {isOverall ? weightLabel : `${h.qty} units · ${weightLabel}`}
                </p>
                <span />
              </>
            ) : null}

            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-pe-text">
                {isOverall ? 'Overall' : holdingDisplayLabel(h)}
              </p>
              {form ? (
                <div className="mt-1">
                  <FormStatusTag form={form} />
                </div>
              ) : isOverall ? (
                <p className="mt-0.5 text-sm font-normal text-pe-text-muted">Portfolio return</p>
              ) : null}
            </div>
            <p className={`self-start text-right text-[15px] font-bold ${pnlClass(changePct)}`}>
              {formatPct(changePct)}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function Empty({ label }) {
  return (
    <p className="px-6 py-14 text-center text-sm text-pe-text-secondary">{label}</p>
  );
}
