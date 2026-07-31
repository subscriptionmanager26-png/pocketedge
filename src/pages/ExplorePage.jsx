import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar';
import PageHeader, { PageHeaderSearch } from '../components/PageHeader';
import { MarketsListSkeleton } from '../components/PageSkeletons';
import { PEOPLE, TOPICS } from '../data/mockData';
import { isDevMockMode } from '../lib/appMode';
import { profileToPerson, rememberPerson } from '../lib/socialIdentity';
import { searchSocialProfiles } from '../lib/socialProfileApi';
import { isTopicFollowed, toggleTopicFollow } from '../lib/socialGraphStore';
import { formatCount } from '../lib/format';
import AssetLogo from '../components/AssetLogo';
import { QuoteChangeBlock } from '../components/AssetProductHeader';
import { MARKET_MIN_SEARCH_CHARS } from '../lib/marketDataApi';
import { useMarketTabData } from '../hooks/useMarketTabData';
import {
  commodityPath,
  etfPath,
  fundPath,
  indexPath,
  stockPath,
  tabPath,
} from '../lib/routes';
import { formatTicker } from '../lib/tickers';
import { useSeoMeta } from '../hooks/useSeoMeta';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { skipAuthForDev } from '../lib/sessionStore';

const RESULT_TABS = [
  { id: 'people', label: 'People' },
  { id: 'topics', label: 'Topics' },
  { id: 'stocks', label: 'Stocks' },
  { id: 'mutual_funds', label: 'Funds' },
  { id: 'etf', label: 'ETF' },
  { id: 'indices', label: 'Indices' },
  { id: 'commodity', label: 'Commodity' },
];

const MARKET_TAB_IDS = ['stocks', 'mutual_funds', 'etf', 'indices', 'commodity'];

function useDebouncedValue(value, delayMs = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

async function fetchSuggestedPeople(limit = 8) {
  if (isDevMockMode() || !isSupabaseConfigured() || skipAuthForDev()) {
    return [...PEOPLE]
      .sort((a, b) => b.xirr - a.xirr)
      .slice(0, limit)
      .map((p) => ({
        user_id: p.id,
        username: p.handle,
        display_name: p.name,
        bio: p.bio,
        avatar_url: null,
        location: p.location,
        focus: p.focus,
      }));
  }

  const { data, error } = await supabase
    .from('social_profiles')
    .select('user_id, username, display_name, bio, avatar_url, location, focus')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export default function ExplorePage({
  onOpenProfile,
  onSelectStock,
  onSelectFund,
  onSelectIndex,
  onSelectCommodity,
  onGraphChange,
  guestMode = false,
}) {
  const [query, setQuery] = useState('');
  const [resultTab, setResultTab] = useState(guestMode ? 'stocks' : 'people');
  const [graphTick, setGraphTick] = useState(0);
  const [peopleResults, setPeopleResults] = useState([]);
  const [peopleSearching, setPeopleSearching] = useState(false);
  const [suggestedPeople, setSuggestedPeople] = useState([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);

  useSeoMeta(
    guestMode
      ? {
          title: 'Explore',
          description:
            'Explore Indian stocks, mutual funds, ETFs, indices, and commodities on PocketEdge.',
          path: tabPath('explore'),
        }
      : null
  );

  const debouncedQuery = useDebouncedValue(query.trim());
  const q = query.trim().toLowerCase();
  const isMarketTab = MARKET_TAB_IDS.includes(resultTab);

  const {
    items: marketItems,
    loading: marketLoading,
    searching: marketSearching,
    error: marketError,
  } = useMarketTabData(isMarketTab ? resultTab : 'stocks', isMarketTab ? query : '');

  const bumpGraph = () => {
    setGraphTick((n) => n + 1);
    onGraphChange?.();
  };

  useEffect(() => {
    if (resultTab !== 'people' || guestMode) return undefined;

    if (q) {
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
    }

    let cancelled = false;
    setSuggestedLoading(true);
    fetchSuggestedPeople(8)
      .then((rows) => {
        if (cancelled) return;
        const people = rows.map(profileToPerson);
        for (const person of people) rememberPerson(person);
        setSuggestedPeople(people);
      })
      .catch(() => {
        if (!cancelled) setSuggestedPeople([]);
      })
      .finally(() => {
        if (!cancelled) setSuggestedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [q, resultTab, guestMode]);

  const topicResults = useMemo(() => {
    if (!isDevMockMode()) return [];
    if (!q) return TOPICS;
    return TOPICS.filter((t) => t.name.toLowerCase().includes(q));
  }, [q, graphTick]);

  const searchTabs = guestMode
    ? RESULT_TABS.filter((t) => MARKET_TAB_IDS.includes(t.id))
    : RESULT_TABS;

  const marketNeedsMoreChars =
    Boolean(q) && debouncedQuery.length > 0 && debouncedQuery.length < MARKET_MIN_SEARCH_CHARS;

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
        {resultTab === 'people' && !guestMode ? (
          q ? (
            peopleSearching ? (
              <p className="py-14 text-center text-sm text-pe-text-secondary">Searching…</p>
            ) : peopleResults.length ? (
              peopleResults.map((p) => (
                <PersonRow key={p.id} person={p} onOpenProfile={onOpenProfile} />
              ))
            ) : (
              <Empty />
            )
          ) : suggestedLoading ? (
            <p className="py-14 text-center text-sm text-pe-text-secondary">Loading…</p>
          ) : suggestedPeople.length ? (
            suggestedPeople.map((p) => (
              <PersonRow key={p.id} person={p} onOpenProfile={onOpenProfile} />
            ))
          ) : (
            <p className="py-14 text-center text-sm text-pe-text-secondary">
              Search by name or @username to find people.
            </p>
          )
        ) : null}

        {resultTab === 'topics' && !guestMode ? (
          topicResults.length ? (
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
            <p className="py-14 text-center text-sm text-pe-text-secondary">
              {q ? 'No results' : 'Topics coming soon.'}
            </p>
          )
        ) : null}

        {isMarketTab ? (
          marketNeedsMoreChars ? (
            <p className="py-14 text-center text-sm text-pe-text-secondary">
              Type at least {MARKET_MIN_SEARCH_CHARS} characters to search
            </p>
          ) : marketLoading || marketSearching ? (
            <div className="py-4">
              {marketSearching ? (
                <p className="py-10 text-center text-sm text-pe-text-secondary">Searching…</p>
              ) : (
                <MarketsListSkeleton />
              )}
            </div>
          ) : marketError ? (
            <p className="py-14 text-center text-sm text-pe-negative">{marketError}</p>
          ) : marketItems.length ? (
            marketItems.map((item) => (
              <MarketSearchRow
                key={item.id ?? item.symbol ?? item.schemeCode}
                tab={resultTab}
                item={item}
                onSelectStock={onSelectStock}
                onSelectFund={onSelectFund}
                onSelectIndex={onSelectIndex}
                onSelectCommodity={onSelectCommodity}
              />
            ))
          ) : (
            <Empty />
          )
        ) : null}
      </div>
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
  if (tab === 'commodity') {
    return { assetType: 'commodity', assetKey: item.id };
  }
  return { assetType: 'index', assetKey: item.id };
}

function MarketSearchRow({
  tab,
  item,
  onSelectStock,
  onSelectFund,
  onSelectIndex,
  onSelectCommodity,
}) {
  const { assetType, assetKey } = marketSearchAssetMeta(tab, item);
  const className =
    'flex w-full items-center justify-between gap-3 py-3.5 text-left transition hover:bg-pe-surface/50';

  if (tab === 'stocks' || tab === 'etf') {
    const price = item.price ?? item.ltp;
    const to = tab === 'etf' ? etfPath(item.id ?? item.symbol) : stockPath(item.id ?? item.symbol);
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
      </Link>
    );
  }

  if (tab === 'mutual_funds') {
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
      </Link>
    );
  }

  if (tab === 'commodity') {
    return (
      <Link
        to={commodityPath(item.id)}
        onClick={(event) => {
          if (!onSelectCommodity) return;
          event.preventDefault();
          onSelectCommodity?.(item.id, item);
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
            <p className="text-sm text-pe-text-muted">
              {[item.unit, item.location].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <QuoteChangeBlock
          className="shrink-0 text-right"
          price={item.spotPrice}
          changePct={item.changePct}
          previousClose={item.previousClose}
          change={item.change}
        />
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
