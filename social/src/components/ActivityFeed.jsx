import { Newspaper } from 'lucide-react';
import Avatar from './Avatar';
import {
  PORTFOLIO_UPDATES,
  POSTS,
  STOCKS,
  getPerson,
} from '../data/mockData';
import { formatInr, formatPct, formatPrice, pnlClass } from '../lib/format';
import { bodyMentionsTicker, formatTicker } from '../lib/tickers';

/** Aggregate news / trades / posts for a set of tickers (portfolio-level or single stock). */
export function collectActivity(tickers) {
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

export function NewsFeed({ items }) {
  if (!items.length) return <Empty label="No news for this list yet." />;
  return (
    <div className="divide-y divide-pe-border">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3 px-4 py-4">
          <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-pe-link" />
          <div className="min-w-0">
            {item.ticker && (
              <p className="text-xs font-semibold text-pe-text-secondary">
                {formatTicker(item.ticker)}
              </p>
            )}
            <p className="font-serif text-[15px] leading-6 text-pe-text">{item.title}</p>
            <p className="mt-0.5 text-xs text-pe-text-muted">
              {item.source} · {item.time}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TradesFeed({ items, onOpenProfile }) {
  if (!items.length) return <Empty label="No community trades yet." />;
  return (
    <div className="divide-y divide-pe-border">
      {items.map((item) => {
        const person = getPerson(item.authorId);
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
        const person = getPerson(item.authorId);
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
              <p className="mt-1 font-serif text-[15px] leading-6 text-pe-ink">{item.snippet}</p>
              <p className="mt-1 text-xs text-pe-text-muted">{item.time}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function HoldingsSummary({ holdings, onSelectStock }) {
  if (!holdings.length) return <Empty label="No positions in this list." />;

  return (
    <div className="divide-y divide-pe-border">
      {holdings.map((h) => {
        const isOverall = h.overall;
        const stock = isOverall ? null : STOCKS[h.ticker];
        const isWatch = h.watchlistOnly;
        const price = stock?.price ?? h.price ?? 0;
        const invested = isOverall
          ? h.invested ?? 0
          : !isWatch
            ? (h.qty ?? 0) * (h.avg ?? price)
            : null;
        const changePct = h.pnlPct ?? stock?.changePct ?? 0;
        const weightLabel =
          typeof h.weight === 'number' ? `${h.weight.toFixed(1)}% of holdings` : null;

        return (
          <button
            key={isOverall ? 'overall' : h.ticker}
            type="button"
            onClick={() => {
              if (!isOverall) onSelectStock?.(h.ticker);
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
                {invested != null ? (
                  <p className="text-right text-xs font-semibold text-pe-text-secondary">
                    Invested {formatInr(invested, { compact: true })}
                  </p>
                ) : (
                  <span />
                )}
              </>
            ) : null}

            <p className="text-[15px] font-semibold text-pe-text">
              {isOverall ? 'Overall' : formatTicker(h.ticker)}
            </p>
            <p className={`text-right text-[15px] font-bold ${pnlClass(changePct)}`}>
              {formatPct(changePct)}
            </p>

            <p className="truncate text-sm font-normal text-pe-text-muted">
              {isOverall ? 'Portfolio return' : stock?.name}
            </p>
            <span />
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
