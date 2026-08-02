import { useEffect, useMemo, useState } from 'react';
import { Eye, Flame } from 'lucide-react';
import PageHeader, { PageHeaderSearch } from '../components/PageHeader';
import SecurityIdeaCard from '../components/SecurityIdeaCard';
import { MarketsListSkeleton } from '../components/PageSkeletons';
import AssetLogo from '../components/AssetLogo';
import Avatar from '../components/Avatar';
import {
  MARKET_MIN_SEARCH_CHARS,
  fetchMarketPreview,
  listSgbMarketQuotes,
  searchAllMarkets,
  searchMarketTab,
} from '../lib/marketDataApi';
import {
  IDEA_ASSET_TYPES,
  IDEA_MARKET_TABS,
  ideaAssetTypeLabel,
  ideaSecurityKey,
  openIdeaSecurity,
  rankMostWatchedSecurities,
  rankTrendingSecurities,
  toIdeaSecurity,
} from '../lib/ideaSecurities';
import { formatCount, formatPct, formatPrice, pnlClass } from '../lib/format';
import { PEOPLE, TOPICS } from '../data/mockData';
import { isDevMockMode } from '../lib/appMode';
import { profileToPerson, rememberPerson } from '../lib/socialIdentity';
import { searchSocialProfiles } from '../lib/socialProfileApi';
import { isTopicFollowed, toggleTopicFollow } from '../lib/socialGraphStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { skipAuthForDev } from '../lib/sessionStore';

function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function SectionHeading({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      {Icon ? (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pe-surface text-pe-accent">
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </span>
      ) : null}
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-pe-text">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-[12px] leading-relaxed text-pe-text-secondary">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function TypeChip({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
        active
          ? 'border-pe-text bg-pe-text text-pe-canvas'
          : 'border-pe-border bg-pe-canvas text-pe-text-secondary hover:border-pe-border-strong hover:text-pe-text'
      }`}
    >
      {label}
    </button>
  );
}

function SecurityRail({ items, onOpen }) {
  if (!items.length) {
    return <p className="px-4 text-[12px] text-pe-text-secondary">Nothing here yet.</p>;
  }
  return (
    <div className="flex gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => (
        <div key={ideaSecurityKey(item)} className="h-[148px] w-[min(240px,78vw)] min-w-[240px] shrink-0">
          <SecurityIdeaCard item={item} onOpen={onOpen} />
        </div>
      ))}
    </div>
  );
}

function SecurityListRow({ item, onOpen }) {
  const type = item.assetType || item._ideaType;
  const title = item.name || item.symbol || 'Security';
  const subtitle =
    type === 'fund'
      ? `${ideaAssetTypeLabel(type)}${item.schemeCode ? ` · ${item.schemeCode}` : ''}`
      : `${ideaAssetTypeLabel(type)}${item.symbol ? ` · ${item.symbol}` : ''}`;
  const changePct = item.changePct;
  const hasPct = changePct != null && Number.isFinite(Number(changePct));
  const assetKey = String(
    item.symbol ?? item.id ?? item.schemeCode ?? item.assetKey ?? ''
  ).trim();

  return (
    <button
      type="button"
      onClick={() => onOpen?.(item)}
      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-pe-surface"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <AssetLogo
          logoIconUrl={item.logoIconUrl}
          assetType={type}
          assetKey={assetKey}
          name={title}
          size="sm"
        />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-pe-text">{title}</p>
          <p className="truncate text-[12px] text-pe-text-muted">{subtitle}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[15px] font-semibold tabular-nums text-pe-text">
          {item.price != null ? formatPrice(item.price) : '—'}
        </p>
        {hasPct ? (
          <p className={`text-[12px] font-semibold tabular-nums ${pnlClass(changePct)}`}>
            {formatPct(changePct)}
          </p>
        ) : null}
      </div>
    </button>
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
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-pe-surface"
    >
      <Avatar person={person} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-pe-text">{person.name}</p>
        <p className="text-sm text-pe-text-muted">@{person.handle}</p>
      </div>
    </button>
  );
}

function TopicRow({ topic, following, onToggle }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-4">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-pe-text">#{topic.name}</p>
        <p className="mt-0.5 text-sm text-pe-text-secondary">
          {topic.postsThisWeek} posts · {formatCount(topic.followers)} followers
        </p>
      </div>
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
    </div>
  );
}

async function loadBondIdeas() {
  try {
    const { items } = await listSgbMarketQuotes();
    return (items ?? [])
      .filter((row) => row.assetType === 'bond')
      .map((row) => toIdeaSecurity(row, 'bond'))
      .filter(Boolean);
  } catch (err) {
    console.warn('listSgbMarketQuotes failed for Ideas', err);
    return [];
  }
}

async function fetchSuggestedPeople(limit = 12) {
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

export default function IdeasPage({
  guestMode = false,
  onSelectStock,
  onSelectFund,
  onSelectCommodity,
  onSelectIndex,
  onOpenProfile,
  onGraphChange,
  onRequireSignIn,
}) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [byTab, setByTab] = useState({});
  const [bonds, setBonds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [peopleResults, setPeopleResults] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [graphTick, setGraphTick] = useState(0);
  const debouncedQuery = useDebouncedValue(query.trim());
  const q = debouncedQuery.toLowerCase();

  const handlers = useMemo(
    () => ({ onSelectStock, onSelectFund, onSelectCommodity, onSelectIndex }),
    [onSelectStock, onSelectFund, onSelectCommodity, onSelectIndex]
  );

  const handleOpen = (item) => openIdeaSecurity(item, handlers);

  const bumpGraph = () => {
    setGraphTick((n) => n + 1);
    onGraphChange?.();
  };

  const handleTopicFollow = (slug) => {
    if (guestMode) {
      onRequireSignIn?.();
      return;
    }
    toggleTopicFollow(slug);
    bumpGraph();
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      ...IDEA_MARKET_TABS.map(async (tab) => {
        const payload = await fetchMarketPreview(tab);
        const assetType =
          tab === 'stocks'
            ? 'stock'
            : tab === 'mutual_funds'
              ? 'fund'
              : tab === 'etf'
                ? 'etf'
                : 'commodity';
        return [
          tab,
          (payload.items ?? []).map((row) => toIdeaSecurity(row, assetType)).filter(Boolean),
        ];
      }),
      loadBondIdeas().then((items) => ['bonds', items]),
    ])
      .then((entries) => {
        if (cancelled) return;
        const next = {};
        let bondItems = [];
        for (const [key, items] of entries) {
          if (key === 'bonds') {
            bondItems = items;
            continue;
          }
          next[key] = items;
        }
        setByTab(next);
        setBonds(bondItems);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Ideas securities load failed', err);
        setError(err.message || 'Could not load ideas');
        setByTab({});
        setBonds([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // People: suggested list or search (People pill, or All while typing).
  useEffect(() => {
    const wantsPeople = typeFilter === 'people' || (typeFilter === 'all' && q.length > 0);
    if (!wantsPeople) {
      setPeopleResults([]);
      setPeopleLoading(false);
      return undefined;
    }

    let cancelled = false;
    setPeopleLoading(true);

    const run = async () => {
      try {
        if (q) {
          if (isDevMockMode()) {
            const ranked = [...PEOPLE].sort((a, b) => b.xirr - a.xirr);
            const filtered = ranked.filter(
              (p) =>
                p.name.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q)
            );
            for (const person of filtered) rememberPerson(person);
            if (!cancelled) setPeopleResults(filtered);
            return;
          }
          const rows = await searchSocialProfiles(q);
          const people = rows.map(profileToPerson);
          for (const person of people) rememberPerson(person);
          if (!cancelled) setPeopleResults(people);
          return;
        }

        const rows = await fetchSuggestedPeople(12);
        const people = rows.map(profileToPerson);
        for (const person of people) rememberPerson(person);
        if (!cancelled) setPeopleResults(people);
      } catch {
        if (!cancelled) setPeopleResults([]);
      } finally {
        if (!cancelled) setPeopleLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [q, typeFilter]);

  const topicResults = useMemo(() => {
    void graphTick;
    if (!isDevMockMode()) return [];
    if (!q) return TOPICS;
    return TOPICS.filter((t) => t.name.toLowerCase().includes(q));
  }, [q, graphTick]);

  // Securities search (All / Stocks / Funds / …)
  useEffect(() => {
    let cancelled = false;
    const wantsSecurities =
      typeFilter === 'all' ||
      typeFilter === 'stock' ||
      typeFilter === 'fund' ||
      typeFilter === 'etf' ||
      typeFilter === 'commodity' ||
      typeFilter === 'bond';

    if (!wantsSecurities || debouncedQuery.length < MARKET_MIN_SEARCH_CHARS) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }

    setSearching(true);
    const run = async () => {
      try {
        if (typeFilter === 'bond') {
          const needle = debouncedQuery.toLowerCase();
          const hits = bonds.filter((item) => {
            const hay = [item.name, item.symbol, item.isin].filter(Boolean).join(' ').toLowerCase();
            return hay.includes(needle);
          });
          if (!cancelled) setSearchResults(hits.slice(0, 40));
          return;
        }

        if (typeFilter === 'all') {
          const byType = await searchAllMarkets(debouncedQuery, 10);
          const mixed = [
            ...(byType.stocks ?? []).map((row) => toIdeaSecurity(row, 'stock')),
            ...(byType.etf ?? []).map((row) => toIdeaSecurity(row, 'etf')),
            ...(byType.mutual_funds ?? []).map((row) => toIdeaSecurity(row, 'fund')),
            ...(byType.commodity ?? []).map((row) => toIdeaSecurity(row, 'commodity')),
            ...bonds.filter((item) => {
              const hay = [item.name, item.symbol, item.isin]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
              return hay.includes(debouncedQuery.toLowerCase());
            }),
          ].filter(Boolean);
          if (!cancelled) setSearchResults(mixed.slice(0, 40));
          return;
        }

        const meta = IDEA_ASSET_TYPES.find((t) => t.id === typeFilter);
        if (!meta?.tab) {
          if (!cancelled) setSearchResults([]);
          return;
        }
        const { items } = await searchMarketTab(meta.tab, debouncedQuery, 40);
        if (!cancelled) {
          setSearchResults(
            (items ?? []).map((row) => toIdeaSecurity(row, typeFilter)).filter(Boolean)
          );
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Ideas search failed', err);
        setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, typeFilter, bonds]);

  const allSecurities = useMemo(() => {
    return [
      ...(byTab.stocks ?? []),
      ...(byTab.etf ?? []),
      ...(byTab.mutual_funds ?? []),
      ...(byTab.commodity ?? []),
      ...bonds,
    ];
  }, [byTab, bonds]);

  const filteredPool = useMemo(() => {
    if (typeFilter === 'all') return allSecurities;
    if (typeFilter === 'bond') return bonds;
    if (typeFilter === 'stock') return byTab.stocks ?? [];
    if (typeFilter === 'fund') return byTab.mutual_funds ?? [];
    if (typeFilter === 'etf') return byTab.etf ?? [];
    if (typeFilter === 'commodity') return byTab.commodity ?? [];
    return allSecurities;
  }, [typeFilter, allSecurities, bonds, byTab]);

  const trending = useMemo(
    () => rankTrendingSecurities(filteredPool, 10),
    [filteredPool]
  );
  const mostWatched = useMemo(
    () => rankMostWatchedSecurities(filteredPool, 10),
    [filteredPool]
  );

  const isPeopleFilter = typeFilter === 'people';
  const isTopicsFilter = typeFilter === 'topics';
  const isSecurityFilter =
    typeFilter === 'stock' ||
    typeFilter === 'fund' ||
    typeFilter === 'etf' ||
    typeFilter === 'commodity' ||
    typeFilter === 'bond';
  const securitySearchActive = debouncedQuery.length >= MARKET_MIN_SEARCH_CHARS;
  const peopleSearchActive = Boolean(q);
  const showAllSearch =
    typeFilter === 'all' && (peopleSearchActive || securitySearchActive);
  const showTypedSecurityList = !securitySearchActive && isSecurityFilter;
  const showBrowseRails = typeFilter === 'all' && !peopleSearchActive && !securitySearchActive;

  return (
    <div>
      <PageHeader>
        <PageHeaderSearch
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people, topics, stocks…"
          autoFocus
        />
      </PageHeader>

      <div className="flex gap-2 overflow-x-auto px-4 pb-1 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {IDEA_ASSET_TYPES.map((type) => (
          <TypeChip
            key={type.id}
            label={type.label}
            active={typeFilter === type.id}
            onClick={() => setTypeFilter(type.id)}
          />
        ))}
      </div>

      {error ? <p className="px-4 pt-4 text-sm text-pe-negative">{error}</p> : null}

      {/* People pill */}
      {isPeopleFilter ? (
        <section className="pt-4 pb-8">
          <div className="px-4">
            <SectionHeading
              title={q ? 'People' : 'Suggested people'}
              subtitle={
                peopleLoading
                  ? 'Loading…'
                  : q
                    ? `${peopleResults.length} result${peopleResults.length === 1 ? '' : 's'}`
                    : 'Investors to follow'
              }
            />
          </div>
          {peopleLoading ? (
            <div className="px-4">
              <MarketsListSkeleton rows={6} />
            </div>
          ) : peopleResults.length ? (
            <div className="divide-y divide-pe-border">
              {peopleResults.map((p) => (
                <PersonRow key={p.id} person={p} onOpenProfile={onOpenProfile} />
              ))}
            </div>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-pe-text-secondary">
              {q ? 'No matching people.' : 'Search by name or @username.'}
            </p>
          )}
        </section>
      ) : null}

      {/* Topics pill */}
      {isTopicsFilter ? (
        <section className="pt-4 pb-8">
          <div className="px-4">
            <SectionHeading
              title="Topics"
              subtitle={q ? 'Matching topics' : 'Themes to follow'}
            />
          </div>
          {topicResults.length ? (
            <div className="divide-y divide-pe-border">
              {topicResults.map((t) => (
                <TopicRow
                  key={t.id}
                  topic={t}
                  following={isTopicFollowed(t.slug)}
                  onToggle={() => handleTopicFollow(t.slug)}
                />
              ))}
            </div>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-pe-text-secondary">
              {q ? 'No matching topics.' : 'Topics coming soon.'}
            </p>
          )}
        </section>
      ) : null}

      {/* All: mixed search */}
      {showAllSearch ? (
        <div className="pb-8 pt-4">
          {(peopleSearchActive || typeFilter === 'all') && (
            <section className="pb-5">
              <div className="px-4">
                <SectionHeading
                  title="People"
                  subtitle={peopleLoading ? 'Searching…' : undefined}
                />
              </div>
              {peopleLoading ? (
                <div className="px-4">
                  <MarketsListSkeleton rows={3} />
                </div>
              ) : peopleResults.length ? (
                <div className="divide-y divide-pe-border">
                  {peopleResults.slice(0, 8).map((p) => (
                    <PersonRow key={p.id} person={p} onOpenProfile={onOpenProfile} />
                  ))}
                </div>
              ) : peopleSearchActive ? (
                <p className="px-4 py-6 text-sm text-pe-text-secondary">No matching people.</p>
              ) : null}
            </section>
          )}

          {peopleSearchActive ? (
            <section className="border-t border-pe-border pb-5 pt-5">
              <div className="px-4">
                <SectionHeading title="Topics" />
              </div>
              {topicResults.length ? (
                <div className="divide-y divide-pe-border">
                  {topicResults.map((t) => (
                    <TopicRow
                      key={t.id}
                      topic={t}
                      following={isTopicFollowed(t.slug)}
                      onToggle={() => handleTopicFollow(t.slug)}
                    />
                  ))}
                </div>
              ) : (
                <p className="px-4 py-6 text-sm text-pe-text-secondary">
                  {isDevMockMode() ? 'No matching topics.' : 'Topics coming soon.'}
                </p>
              )}
            </section>
          ) : null}

          {securitySearchActive ? (
            <section className="border-t border-pe-border pt-5">
              <div className="px-4">
                <SectionHeading
                  title="Securities"
                  subtitle={
                    searching
                      ? 'Searching…'
                      : `${searchResults.length} result${searchResults.length === 1 ? '' : 's'}`
                  }
                />
              </div>
              {searching ? (
                <div className="px-4">
                  <MarketsListSkeleton rows={6} />
                </div>
              ) : searchResults.length ? (
                <div className="divide-y divide-pe-border">
                  {searchResults.map((item) => (
                    <SecurityListRow
                      key={ideaSecurityKey(item)}
                      item={item}
                      onOpen={handleOpen}
                    />
                  ))}
                </div>
              ) : (
                <p className="px-4 py-6 text-sm text-pe-text-secondary">No matching securities.</p>
              )}
            </section>
          ) : peopleSearchActive && debouncedQuery.length < MARKET_MIN_SEARCH_CHARS ? (
            <p className="border-t border-pe-border px-4 py-6 text-sm text-pe-text-secondary">
              Type at least {MARKET_MIN_SEARCH_CHARS} characters to search securities.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Security-type search */}
      {isSecurityFilter && securitySearchActive ? (
        <section className="pt-4 pb-8">
          <div className="px-4">
            <SectionHeading
              title="Results"
              subtitle={
                searching
                  ? 'Searching…'
                  : `${searchResults.length} securit${searchResults.length === 1 ? 'y' : 'ies'}`
              }
            />
          </div>
          {searching ? (
            <div className="px-4">
              <MarketsListSkeleton rows={6} />
            </div>
          ) : !searchResults.length ? (
            <p className="px-4 py-10 text-center text-sm text-pe-text-secondary">
              No matching securities.
            </p>
          ) : (
            <div className="divide-y divide-pe-border">
              {searchResults.map((item) => (
                <SecurityListRow
                  key={ideaSecurityKey(item)}
                  item={item}
                  onOpen={handleOpen}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {showBrowseRails && loading ? (
        <div className="space-y-6 px-4 pt-4 pb-8">
          <MarketsListSkeleton rows={4} />
          <MarketsListSkeleton rows={4} />
        </div>
      ) : null}

      {showTypedSecurityList && !loading ? (
        <section className="pt-4 pb-8">
          <div className="px-4">
            <SectionHeading
              title={IDEA_ASSET_TYPES.find((t) => t.id === typeFilter)?.label ?? 'Securities'}
              subtitle="Tap a name to open it"
            />
          </div>
          {!filteredPool.length ? (
            <p className="px-4 py-10 text-center text-sm text-pe-text-secondary">
              Nothing in this category yet.
            </p>
          ) : (
            <div className="divide-y divide-pe-border">
              {filteredPool.slice(0, 40).map((item) => (
                <SecurityListRow
                  key={ideaSecurityKey(item)}
                  item={item}
                  onOpen={handleOpen}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {showBrowseRails && !loading ? (
        <>
          <section className="pb-5 pt-4">
            <div className="px-4">
              <SectionHeading
                icon={Flame}
                title="Trending"
                subtitle="Securities with the biggest 1D moves"
              />
            </div>
            <SecurityRail items={trending} onOpen={handleOpen} />
          </section>

          <section className="border-t border-pe-border pb-5 pt-5">
            <div className="px-4">
              <SectionHeading
                icon={Eye}
                title="Most watched"
                subtitle="Names drawing the most attention today"
              />
            </div>
            <SecurityRail items={mostWatched} onOpen={handleOpen} />
          </section>

          {(byTab.stocks ?? []).length ? (
            <section className="border-t border-pe-border pb-5 pt-5">
              <div className="px-4">
                <SectionHeading title="Stocks" subtitle="Equity movers" />
              </div>
              <SecurityRail
                items={rankTrendingSecurities(byTab.stocks ?? [], 8)}
                onOpen={handleOpen}
              />
            </section>
          ) : null}

          {(byTab.etf ?? []).length ? (
            <section className="border-t border-pe-border pb-5 pt-5">
              <div className="px-4">
                <SectionHeading title="ETFs" subtitle="Exchange-traded funds" />
              </div>
              <SecurityRail
                items={rankTrendingSecurities(byTab.etf ?? [], 8)}
                onOpen={handleOpen}
              />
            </section>
          ) : null}

          {(byTab.mutual_funds ?? []).length ? (
            <section className="border-t border-pe-border pb-5 pt-5">
              <div className="px-4">
                <SectionHeading title="Mutual funds" subtitle="Popular schemes" />
              </div>
              <SecurityRail items={(byTab.mutual_funds ?? []).slice(0, 8)} onOpen={handleOpen} />
            </section>
          ) : null}

          {(byTab.commodity ?? []).length ? (
            <section className="border-t border-pe-border pb-5 pt-5">
              <div className="px-4">
                <SectionHeading title="Commodities" subtitle="Metals and more" />
              </div>
              <SecurityRail
                items={rankTrendingSecurities(byTab.commodity ?? [], 8)}
                onOpen={handleOpen}
              />
            </section>
          ) : null}

          {bonds.length ? (
            <section className="border-t border-pe-border pb-8 pt-5">
              <div className="px-4">
                <SectionHeading title="Bonds" subtitle="Sovereign gold bonds" />
              </div>
              <SecurityRail items={bonds.slice(0, 8)} onOpen={handleOpen} />
            </section>
          ) : (
            <div className="pb-8" />
          )}
        </>
      ) : null}
    </div>
  );
}
