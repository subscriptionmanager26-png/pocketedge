import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Users } from 'lucide-react';
import Avatar from '../components/Avatar';
import PageHeader, { PageHeaderSearch } from '../components/PageHeader';
import { PEOPLE, TOPICS } from '../data/mockData';
import {
  getFollowedTopicSlugs,
  isFollowing,
  isTopicFollowed,
  toggleFollow,
  toggleTopicFollow,
} from '../lib/socialGraphStore';
import { formatCount, formatPct, formatPrice, pnlClass } from '../lib/format';
import {
  MARKET_MIN_SEARCH_CHARS,
  fetchMarketPreview,
  searchMarketTab,
} from '../lib/marketDataApi';
import { formatTicker } from '../lib/tickers';

const RESULT_TABS = [
  { id: 'people', label: 'People' },
  { id: 'topics', label: 'Topics' },
  { id: 'stocks', label: 'Stocks' },
  { id: 'mutual_funds', label: 'Funds' },
  { id: 'etf', label: 'ETF' },
  { id: 'indices', label: 'Indices' },
];

function useDebouncedValue(value, delayMs = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function SearchPage({
  onOpenProfile,
  onSelectStock,
  onSelectFund,
  onGraphChange,
}) {
  const [query, setQuery] = useState('');
  const [resultTab, setResultTab] = useState('people');
  const [graphTick, setGraphTick] = useState(0);
  const [topStocks, setTopStocks] = useState([]);
  const [marketResults, setMarketResults] = useState({});
  const [marketSearching, setMarketSearching] = useState(false);

  const debouncedQuery = useDebouncedValue(query.trim());
  const isMarketSearch = debouncedQuery.length >= MARKET_MIN_SEARCH_CHARS;

  const bumpGraph = () => {
    setGraphTick((n) => n + 1);
    onGraphChange?.();
  };

  useEffect(() => {
    fetchMarketPreview('stocks')
      .then(({ items }) => setTopStocks(items.slice(0, 5)))
      .catch(() => setTopStocks([]));
  }, []);

  useEffect(() => {
    if (!isMarketSearch || !['stocks', 'mutual_funds', 'etf', 'indices'].includes(resultTab)) {
      return undefined;
    }

    let cancelled = false;
    setMarketSearching(true);
    searchMarketTab(resultTab, debouncedQuery)
      .then(({ items }) => {
        if (!cancelled) {
          setMarketResults((prev) => ({ ...prev, [resultTab]: items }));
        }
      })
      .finally(() => {
        if (!cancelled) setMarketSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, isMarketSearch, resultTab]);

  const q = query.trim().toLowerCase();
  const followedTopics = useMemo(() => getFollowedTopicSlugs(), [graphTick]);

  const peopleResults = useMemo(() => {
    const ranked = [...PEOPLE].sort((a, b) => b.xirr - a.xirr);
    if (!q) return ranked;
    return ranked.filter(
      (p) => p.name.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q)
    );
  }, [q]);

  const topicResults = useMemo(() => {
    if (!q) return TOPICS;
    return TOPICS.filter((t) => t.name.toLowerCase().includes(q));
  }, [q]);

  const activeMarketResults = marketResults[resultTab] ?? [];

  return (
    <div>
      <PageHeader>
        <PageHeaderSearch
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people, topics, stocks, funds…"
          autoFocus
        />
      </PageHeader>

      {!q ? (
        <div className="space-y-8 px-4 py-6">
          <section>
            <SectionLabel icon={TrendingUp}>Trending topics</SectionLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {TOPICS.map((topic) => {
                const followed = followedTopics.has(topic.slug);
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => {
                      toggleTopicFollow(topic.slug);
                      bumpGraph();
                    }}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                      followed
                        ? 'border-pe-accent bg-pe-accent-wash text-pe-accent'
                        : 'border-pe-border-strong text-pe-text-secondary hover:border-pe-text-muted hover:text-pe-text'
                    }`}
                  >
                    #{topic.name}
                    <span className="ml-1.5 font-medium text-pe-text-muted">
                      {topic.postsThisWeek}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <SectionLabel icon={Users}>Suggested people</SectionLabel>
            <div className="mt-1 divide-y divide-pe-border">
              {[...PEOPLE]
                .sort((a, b) => b.xirr - a.xirr)
                .slice(0, 4)
                .map((person) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    graphTick={graphTick}
                    onOpenProfile={onOpenProfile}
                    onFollowChange={bumpGraph}
                  />
                ))}
            </div>
          </section>

          <section>
            <SectionLabel>Top stock movers</SectionLabel>
            <div className="mt-1 divide-y divide-pe-border">
              {topStocks.map((stock) => (
                <StockRow key={stock.symbol} stock={stock} onSelectStock={onSelectStock} />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div>
          <div className="flex overflow-x-auto border-b border-pe-border">
            {RESULT_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setResultTab(t.id)}
                className={`relative shrink-0 px-4 py-3.5 text-sm font-semibold ${
                  resultTab === t.id ? 'text-pe-text' : 'text-pe-text-muted hover:text-pe-text'
                }`}
              >
                {t.label}
                {resultTab === t.id && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-pe-accent" />
                )}
              </button>
            ))}
          </div>

          <div className="px-4 py-1">
            {resultTab === 'people' &&
              (peopleResults.length ? (
                peopleResults.map((p) => (
                  <PersonRow
                    key={p.id}
                    person={p}
                    graphTick={graphTick}
                    onOpenProfile={onOpenProfile}
                    onFollowChange={bumpGraph}
                  />
                ))
              ) : (
                <Empty />
              ))}

            {resultTab === 'topics' &&
              (topicResults.length ? (
                topicResults.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between border-b border-pe-border py-4"
                  >
                    <div>
                      <p className="text-[15px] font-semibold text-pe-text">#{t.name}</p>
                      <p className="mt-0.5 text-sm text-pe-text-secondary">
                        {t.postsThisWeek} posts · {formatCount(t.followers)} followers
                      </p>
                    </div>
                    <FollowButton
                      following={isTopicFollowed(t.slug)}
                      onToggle={() => {
                        toggleTopicFollow(t.slug);
                        bumpGraph();
                      }}
                    />
                  </div>
                ))
              ) : (
                <Empty />
              ))}

            {['stocks', 'mutual_funds', 'etf', 'indices'].includes(resultTab) ? (
              marketSearching ? (
                <p className="py-14 text-center text-sm text-pe-text-secondary">Searching…</p>
              ) : debouncedQuery.length < MARKET_MIN_SEARCH_CHARS ? (
                <p className="py-14 text-center text-sm text-pe-text-secondary">
                  Type at least {MARKET_MIN_SEARCH_CHARS} characters to search markets
                </p>
              ) : activeMarketResults.length ? (
                activeMarketResults.map((item) => (
                  <MarketSearchRow
                    key={item.id ?? item.symbol ?? item.schemeCode}
                    tab={resultTab}
                    item={item}
                    onSelectStock={onSelectStock}
                    onSelectFund={onSelectFund}
                  />
                ))
              ) : (
                <Empty />
              )
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function MarketSearchRow({ tab, item, onSelectStock, onSelectFund }) {
  if (tab === 'stocks' || tab === 'etf') {
    return (
      <button
        type="button"
        onClick={() => onSelectStock?.(item.symbol)}
        className="flex w-full items-center justify-between py-3.5 text-left transition hover:bg-pe-surface/50"
      >
        <div>
          <p className="text-[15px] font-semibold text-pe-text">{formatTicker(item.symbol)}</p>
          <p className="text-sm text-pe-text-muted">{item.name}</p>
        </div>
        <div className="text-right">
          <p className="text-[15px] font-semibold text-pe-text">
            {item.price != null || item.ltp != null
              ? formatPrice(item.price ?? item.ltp)
              : '—'}
          </p>
          {item.changePct != null ? (
            <p className={`text-sm font-semibold ${pnlClass(item.changePct)}`}>
              {formatPct(item.changePct)}
            </p>
          ) : null}
        </div>
      </button>
    );
  }

  if (tab === 'mutual_funds') {
    return (
      <button
        type="button"
        onClick={() => onSelectFund?.(item.schemeCode)}
        className="flex w-full items-center justify-between py-3.5 text-left transition hover:bg-pe-surface/50"
      >
        <div className="min-w-0 pr-3">
          <p className="truncate text-[15px] font-semibold text-pe-text">{item.name}</p>
          <p className="text-sm text-pe-text-muted">
            {[item.category, item.subCategory].filter(Boolean).join(' · ') || item.amc}
          </p>
        </div>
        <p className="shrink-0 text-[15px] font-semibold text-pe-text">
          {item.nav != null ? formatPrice(item.nav) : '—'}
        </p>
      </button>
    );
  }

  return (
    <div className="flex w-full items-center justify-between py-3.5 text-left">
      <div>
        <p className="text-[15px] font-semibold text-pe-text">{item.name}</p>
        {item.group ? <p className="text-sm text-pe-text-muted">{item.group}</p> : null}
      </div>
      <div className="text-right">
        <p className="text-[15px] font-semibold text-pe-text">
          {item.value != null
            ? item.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
            : '—'}
        </p>
        {item.changePct != null ? (
          <p className={`text-sm font-semibold ${pnlClass(item.changePct)}`}>
            {formatPct(item.changePct)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SectionLabel({ children, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </div>
  );
}

function PersonRow({ person, graphTick, onOpenProfile, onFollowChange }) {
  const following = isFollowing(person.id);
  return (
    <div className="flex items-center gap-3 py-3.5">
      <Avatar person={person} onClick={() => onOpenProfile?.(person.id)} />
      <button
        type="button"
        onClick={() => onOpenProfile?.(person.id)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-[15px] font-semibold text-pe-text hover:underline">
          {person.name}
        </p>
        <p className="text-sm text-pe-text-muted">@{person.handle}</p>
        <p className="mt-0.5 text-xs text-pe-text-secondary">
          <span className="font-semibold text-pe-positive">
            XIRR {formatPct(person.xirr, { signed: false })}
          </span>
          <span> · {formatCount(person.followers)} followers</span>
        </p>
      </button>
      <FollowButton
        following={following}
        onToggle={() => {
          toggleFollow(person.id);
          onFollowChange?.();
        }}
      />
    </div>
  );
}

function StockRow({ stock, onSelectStock }) {
  return (
    <button
      type="button"
      onClick={() => onSelectStock?.(stock.symbol)}
      className="flex w-full items-center justify-between py-3.5 text-left transition hover:bg-pe-surface/50"
    >
      <div>
        <p className="text-[15px] font-semibold text-pe-text">{formatTicker(stock.symbol)}</p>
        <p className="text-sm text-pe-text-muted">{stock.name}</p>
      </div>
      <div className="text-right">
        <p className="text-[15px] font-semibold text-pe-text">
          {stock.price != null ? formatPrice(stock.price) : '—'}
        </p>
        {stock.changePct != null ? (
          <p className={`text-sm font-semibold ${pnlClass(stock.changePct)}`}>
            {formatPct(stock.changePct)}
          </p>
        ) : null}
      </div>
    </button>
  );
}

function FollowButton({ following, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`shrink-0 rounded-md px-3.5 py-1.5 text-sm font-bold transition ${
        following
          ? 'border border-pe-border-strong bg-pe-canvas text-pe-text hover:bg-pe-surface'
          : 'bg-pe-accent text-white hover:bg-pe-accent-pressed'
      }`}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  );
}

function Empty() {
  return <p className="py-14 text-center text-sm text-pe-text-secondary">No results</p>;
}
