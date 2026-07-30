import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Users } from 'lucide-react';
import Avatar from '../components/Avatar';
import PageHeader, { PageHeaderSearch } from '../components/PageHeader';
import { PEOPLE, TOPICS } from '../data/mockData';
import { isDevMockMode } from '../lib/appMode';
import { profileToPerson, rememberPerson } from '../lib/socialIdentity';
import { searchSocialProfiles } from '../lib/socialProfileApi';
import {
  getFollowedTopicSlugs,
  isTopicFollowed,
  toggleTopicFollow,
} from '../lib/socialGraphStore';
import { formatCount } from '../lib/format';
import AssetLogo from '../components/AssetLogo';
import { QuoteChangeBlock } from '../components/AssetProductHeader';
import { MARKET_MIN_SEARCH_CHARS, searchMarketTab } from '../lib/marketDataApi';
import { preloadAssetLogos } from '../lib/assetLogo';
import { etfPath, fundPath, indexPath, stockPath, tabPath } from '../lib/routes';
import { formatTicker } from '../lib/tickers';
import { useSeoMeta } from '../hooks/useSeoMeta';

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
  onSelectIndex,
  onGraphChange,
  guestMode = false,
}) {
  const [query, setQuery] = useState('');
  const [resultTab, setResultTab] = useState(guestMode ? 'stocks' : 'people');
  const [graphTick, setGraphTick] = useState(0);
  const [marketResults, setMarketResults] = useState({});
  const [marketSearching, setMarketSearching] = useState(false);
  const [peopleResults, setPeopleResults] = useState([]);
  const [peopleSearching, setPeopleSearching] = useState(false);

  useSeoMeta(
    guestMode
      ? {
          title: 'Search markets',
          description: 'Search Indian stocks, mutual funds, ETFs, and indices on PocketEdge.',
          path: tabPath('search'),
        }
      : null
  );

  const debouncedQuery = useDebouncedValue(query.trim());
  const isMarketSearch = debouncedQuery.length >= MARKET_MIN_SEARCH_CHARS;
  const q = query.trim().toLowerCase();

  const bumpGraph = () => {
    setGraphTick((n) => n + 1);
    onGraphChange?.();
  };

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
          preloadAssetLogos(items, { limit: 30 });
        }
      })
      .finally(() => {
        if (!cancelled) setMarketSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, isMarketSearch, resultTab]);

  useEffect(() => {
    if (!q || resultTab !== 'people') return undefined;

    let cancelled = false;
    setPeopleSearching(true);

    if (isDevMockMode()) {
      const ranked = [...PEOPLE].sort((a, b) => b.xirr - a.xirr);
      const filtered = ranked.filter(
        (p) => p.name.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q)
      );
      for (const person of filtered) rememberPerson(person);
      setPeopleResults(filtered);
      setPeopleSearching(false);
      return undefined;
    }

    searchSocialProfiles(q)
      .then((rows) => {
        if (cancelled) return;
        const people = rows.map(profileToPerson);
        for (const person of people) rememberPerson(person);
        setPeopleResults(people);
      })
      .catch(() => {
        if (!cancelled) setPeopleResults([]);
      })
      .finally(() => {
        if (!cancelled) setPeopleSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [q, resultTab]);

  const followedTopics = useMemo(() => getFollowedTopicSlugs(), [graphTick]);

  const topicResults = useMemo(() => {
    if (!isDevMockMode()) return [];
    if (!q) return TOPICS;
    return TOPICS.filter((t) => t.name.toLowerCase().includes(q));
  }, [q]);

  const activeMarketResults = marketResults[resultTab] ?? [];
  const displayedMarketResults = activeMarketResults;

  const searchTabs = guestMode
    ? RESULT_TABS.filter((t) => ['stocks', 'mutual_funds', 'etf', 'indices'].includes(t.id))
    : RESULT_TABS;

  return (
    <div>
      <PageHeader>
        <PageHeaderSearch
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            guestMode
              ? 'Search stocks, funds, ETFs…'
              : 'Search people, topics, stocks, funds…'
          }
          autoFocus
        />
      </PageHeader>

      {!q ? (
        <div className="space-y-8 px-4 py-6">
          {guestMode ? (
            <section className="py-4 text-center">
              <h1 className="text-xl font-bold tracking-tight text-pe-text">Search markets</h1>
              <p className="mt-2 text-sm text-pe-text-secondary">
                Type at least {MARKET_MIN_SEARCH_CHARS} characters to find stocks, mutual funds,
                ETFs, or indices.
              </p>
            </section>
          ) : isDevMockMode() ? (
            <>
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
                        onOpenProfile={onOpenProfile}
                      />
                    ))}
                </div>
              </section>
            </>
          ) : (
            <section className="py-4 text-center">
              <p className="text-sm text-pe-text-secondary">
                Search by name or @username to find people on PocketEdge Social.
              </p>
            </section>
          )}
        </div>
      ) : (
        <div>
          <div className="flex overflow-x-auto border-b border-pe-border">
            {searchTabs.map((t) => (
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
                    onOpenProfile={onOpenProfile}
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
              ) : displayedMarketResults.length ? (
                displayedMarketResults.map((item) => (
                  <MarketSearchRow
                    key={item.id ?? item.symbol ?? item.schemeCode}
                    tab={resultTab}
                    item={item}
                    onSelectStock={onSelectStock}
                    onSelectFund={onSelectFund}
                    onSelectIndex={onSelectIndex}
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

function marketSearchAssetMeta(tab, item) {
  if (tab === 'stocks') {
    return { assetType: 'stock', assetKey: item.id ?? item.symbol };
  }
  if (tab === 'etf') {
    return { assetType: 'etf', assetKey: item.id ?? item.symbol };
  }
  if (tab === 'mutual_funds') {
    return { assetType: 'fund', assetKey: item.schemeCode ?? item.id };
  }
  return { assetType: 'index', assetKey: item.id };
}

function MarketSearchRow({ tab, item, onSelectStock, onSelectFund, onSelectIndex }) {
  const { assetType, assetKey } = marketSearchAssetMeta(tab, item);
  const className =
    'flex w-full items-center justify-between gap-3 py-3.5 text-left transition hover:bg-pe-surface/50';

  if (tab === 'stocks' || tab === 'etf') {
    const price = item.price ?? item.ltp;
    const to = tab === 'etf' ? etfPath(item.id ?? item.symbol) : stockPath(item.id ?? item.symbol);
    const body = (
      <>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <AssetLogo
            logoIconUrl={item.logoIconUrl}
            assetType={assetType}
            assetKey={assetKey}
            name={item.name}
            size="sm"
          />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-pe-text">{formatTicker(item.symbol)}</p>
            <p className="truncate text-sm text-pe-text-muted">{item.name}</p>
          </div>
        </div>
        <QuoteChangeBlock
          className="shrink-0 text-right"
          price={price}
          changePct={item.changePct}
          previousClose={item.previousClose}
          change={item.change}
        />
      </>
    );
    return (
      <Link
        to={to}
        onClick={(event) => {
          if (!onSelectStock) return;
          event.preventDefault();
          onSelectStock?.(item.id ?? item.symbol, {
            kind: tab === 'etf' ? 'etf' : 'stock',
            seed: item,
          });
        }}
        className={className}
      >
        {body}
      </Link>
    );
  }

  if (tab === 'mutual_funds') {
    const body = (
      <>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <AssetLogo
            logoIconUrl={item.logoIconUrl}
            assetType={assetType}
            assetKey={assetKey}
            name={item.name}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-pe-text">{item.name}</p>
            <p className="text-sm text-pe-text-muted">
              {[item.category, item.subCategory].filter(Boolean).join(' · ') || item.amc}
            </p>
          </div>
        </div>
        <QuoteChangeBlock
          className="shrink-0 text-right"
          price={item.nav}
          changePct={item.changePct}
          previousClose={item.previousClose}
          change={item.change}
        />
      </>
    );
    return (
      <Link
        to={fundPath(item.schemeCode)}
        onClick={(event) => {
          if (!onSelectFund) return;
          event.preventDefault();
          onSelectFund?.(item.schemeCode, item);
        }}
        className={className}
      >
        {body}
      </Link>
    );
  }

  return (
    <Link
      to={indexPath(item.id)}
      onClick={(event) => {
        if (!onSelectIndex) return;
        event.preventDefault();
        onSelectIndex?.(item.id, item);
      }}
      className={className}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <AssetLogo
          logoIconUrl={item.logoIconUrl}
          assetType={assetType}
          assetKey={assetKey}
          name={item.name}
          size="sm"
        />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-pe-text">{item.name}</p>
          {item.group ? <p className="text-sm text-pe-text-muted">{item.group}</p> : null}
        </div>
      </div>
      <QuoteChangeBlock
        className="shrink-0 text-right"
        price={item.value}
        formatAsCurrency={false}
        priceText={
          item.value != null
            ? item.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
            : '-'
        }
        changePct={item.changePct}
        previousClose={item.previousClose}
        change={item.change}
      />
    </Link>
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

function PersonRow({ person, onOpenProfile }) {
  return (
    <button
      type="button"
      onClick={() => {
        rememberPerson(person);
        onOpenProfile?.(person.id);
      }}
      className="flex w-full items-center gap-3 py-3.5 text-left transition hover:bg-pe-surface/50"
    >
      <Avatar person={person} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-pe-text">{person.name}</p>
        <p className="text-sm text-pe-text-muted">@{person.handle}</p>
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
