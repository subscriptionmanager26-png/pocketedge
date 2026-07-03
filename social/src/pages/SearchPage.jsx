import { useMemo, useState } from 'react';
import { Search, TrendingUp, Users } from 'lucide-react';
import Avatar from '../components/Avatar';
import {
  PEOPLE,
  STOCKS,
  TOPICS,
} from '../data/mockData';
import { formatCount, formatPct, formatPrice, pnlClass } from '../lib/format';

const RESULT_TABS = [
  { id: 'people', label: 'People' },
  { id: 'topics', label: 'Topics' },
  { id: 'stocks', label: 'Stocks' },
];

const TRENDING_STOCKS = Object.entries(STOCKS)
  .map(([ticker, s]) => ({ ticker, ...s, volume: Math.round(s.price * 40 + s.changePct * 100) }))
  .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
  .slice(0, 5);

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [resultTab, setResultTab] = useState('people');
  const [followedTopics, setFollowedTopics] = useState(
    () => new Set(TOPICS.filter((t) => t.followed).map((t) => t.slug))
  );

  const q = query.trim().toLowerCase();

  const peopleResults = useMemo(() => {
    const ranked = [...PEOPLE].sort((a, b) => b.xirr - a.xirr);
    if (!q) return ranked;
    return ranked.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.handle.toLowerCase().includes(q)
    );
  }, [q]);

  const topicResults = useMemo(() => {
    if (!q) return TOPICS;
    return TOPICS.filter((t) => t.name.toLowerCase().includes(q));
  }, [q]);

  const stockResults = useMemo(() => {
    const entries = Object.entries(STOCKS).map(([ticker, s]) => ({ ticker, ...s }));
    if (!q) return entries;
    return entries.filter(
      (s) =>
        s.ticker.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q)
    );
  }, [q]);

  return (
    <div>
      <div className="sticky top-[57px] z-30 border-b border-pe-border bg-pe-canvas/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2 rounded-xl border border-pe-border bg-pe-surface px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-pe-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="People, topics, stocks"
            className="w-full bg-transparent text-sm text-pe-text outline-none placeholder:text-pe-text-muted"
          />
        </div>
      </div>

      {!q ? (
        <div className="space-y-8 px-4 py-5">
          <section>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-pe-text-muted">
              <TrendingUp className="h-3.5 w-3.5" />
              Trending topics
            </div>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((topic) => {
                const followed = followedTopics.has(topic.slug);
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() =>
                      setFollowedTopics((prev) => {
                        const next = new Set(prev);
                        if (next.has(topic.slug)) next.delete(topic.slug);
                        else next.add(topic.slug);
                        return next;
                      })
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      followed
                        ? 'border-white bg-white text-black'
                        : 'border-pe-border text-pe-text-secondary hover:border-white/30'
                    }`}
                  >
                    #{topic.name}
                    <span className="ml-1.5 opacity-60">{topic.postsThisWeek}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-pe-text-muted">
              <Users className="h-3.5 w-3.5" />
              Suggested people
            </div>
            <div className="space-y-1">
              {[...PEOPLE]
                .sort((a, b) => b.xirr - a.xirr)
                .slice(0, 4)
                .map((person) => (
                  <PersonRow key={person.id} person={person} />
                ))}
            </div>
          </section>

          <section>
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-pe-text-muted">
              Most discussed this week
            </div>
            <div className="space-y-1">
              {TRENDING_STOCKS.map((stock) => (
                <StockRow key={stock.ticker} stock={stock} />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div>
          <div className="flex border-b border-pe-border">
            {RESULT_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setResultTab(t.id)}
                className={`relative flex-1 py-3 text-sm font-medium ${
                  resultTab === t.id ? 'text-pe-text' : 'text-pe-text-muted'
                }`}
              >
                {t.label}
                {resultTab === t.id && (
                  <span className="absolute inset-x-8 bottom-0 h-0.5 rounded-full bg-white" />
                )}
              </button>
            ))}
          </div>

          <div className="px-4 py-2">
            {resultTab === 'people' &&
              (peopleResults.length ? (
                peopleResults.map((p) => <PersonRow key={p.id} person={p} />)
              ) : (
                <Empty />
              ))}
            {resultTab === 'topics' &&
              (topicResults.length ? (
                topicResults.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between border-b border-pe-border/60 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">#{t.name}</p>
                      <p className="text-xs text-pe-text-muted">
                        {t.postsThisWeek} posts · {formatCount(t.followers)} followers
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-pe-border px-3 py-1 text-xs font-medium hover:bg-white/5"
                    >
                      Follow
                    </button>
                  </div>
                ))
              ) : (
                <Empty />
              ))}
            {resultTab === 'stocks' &&
              (stockResults.length ? (
                stockResults.map((s) => <StockRow key={s.ticker} stock={s} />)
              ) : (
                <Empty />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PersonRow({ person }) {
  return (
    <div className="flex items-center gap-3 border-b border-pe-border/60 py-3">
      <Avatar person={person} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{person.name}</p>
        <p className="text-xs text-pe-text-muted">@{person.handle}</p>
        <p className="mt-0.5 text-[11px] text-pe-text-secondary">
          XIRR {formatPct(person.xirr, { signed: false })} · {formatCount(person.followers)} followers
        </p>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-full border border-pe-border px-3 py-1 text-xs font-medium hover:bg-white/5"
      >
        Follow
      </button>
    </div>
  );
}

function StockRow({ stock }) {
  return (
    <div className="flex items-center justify-between border-b border-pe-border/60 py-3">
      <div>
        <p className="text-sm font-semibold">${stock.ticker}</p>
        <p className="text-xs text-pe-text-muted">{stock.name}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">{formatPrice(stock.price)}</p>
        <p className={`text-xs font-medium ${pnlClass(stock.changePct)}`}>
          {formatPct(stock.changePct)}
        </p>
      </div>
    </div>
  );
}

function Empty() {
  return <p className="py-12 text-center text-sm text-pe-text-muted">No results</p>;
}
