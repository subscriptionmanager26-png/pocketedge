import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import AssetLogo from './AssetLogo';
import Avatar from './Avatar';
import { MarketsListSkeleton } from './PageSkeletons';
import {
  MARKET_MIN_SEARCH_CHARS,
  listSgbMarketQuotes,
  searchAllMarkets,
  searchMarketTab,
} from '../lib/marketDataApi';
import {
  IDEA_ASSET_TYPES,
  ideaAssetTypeLabel,
  ideaSecurityKey,
  openIdeaSecurity,
  toIdeaSecurity,
} from '../lib/ideaSecurities';
import { formatCount, formatPct, formatPrice, pnlClass } from '../lib/format';
import { PEOPLE, TOPICS } from '../data/mockData';
import { isDevMockMode } from '../lib/appMode';
import { profileToPerson, rememberPerson } from '../lib/socialIdentity';
import { searchSocialProfiles } from '../lib/socialProfileApi';
import { isTopicFollowed, toggleTopicFollow } from '../lib/socialGraphStore';

function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function TypeChip({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition duration-150 ${
        active
          ? 'bg-pe-text text-white'
          : 'bg-transparent text-pe-text-secondary hover:bg-black/[0.04] hover:text-pe-text'
      }`}
    >
      {label}
    </button>
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
      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-black/[0.03]"
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
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-black/[0.03]"
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
        className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition duration-150 ${
          following
            ? 'bg-black/[0.04] text-pe-text hover:bg-black/[0.06]'
            : 'bg-pe-accent text-white hover:bg-pe-accent-pressed'
        }`}
      >
        {following ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}

/**
 * Global search results panel — pills narrow scope; searching without a pill uses All.
 */
export default function GlobalSearchPanel({
  query,
  onClose,
  guestMode = false,
  onRequireSignIn,
  onSelectStock,
  onSelectFund,
  onSelectCommodity,
  onSelectIndex,
  onOpenProfile,
  onGraphChange,
}) {
  const [typeFilter, setTypeFilter] = useState('all');
  const [bonds, setBonds] = useState([]);
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

  const handleOpenSecurity = (item) => {
    openIdeaSecurity(item, handlers);
    onClose?.();
  };

  const handleOpenProfile = (userId) => {
    onOpenProfile?.(userId);
    onClose?.();
  };

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
    listSgbMarketQuotes()
      .then(({ items }) => {
        if (cancelled) return;
        setBonds(
          (items ?? [])
            .filter((row) => row.assetType === 'bond')
            .map((row) => toIdeaSecurity(row, 'bond'))
            .filter(Boolean)
        );
      })
      .catch(() => {
        if (!cancelled) setBonds([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // People
  useEffect(() => {
    const wantsPeople = typeFilter === 'people' || (typeFilter === 'all' && q.length > 0);
    if (!wantsPeople || !q) {
      setPeopleResults([]);
      setPeopleLoading(false);
      return undefined;
    }

    let cancelled = false;
    setPeopleLoading(true);

    const run = async () => {
      try {
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
    if (!isDevMockMode() || !q) return [];
    if (typeFilter !== 'topics' && typeFilter !== 'all') return [];
    return TOPICS.filter((t) => t.name.toLowerCase().includes(q));
  }, [q, graphTick, typeFilter]);

  // Securities
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
        console.error('Global search failed', err);
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
  const hasQuery = query.trim().length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--fv-border,#ececec)] px-4 py-3">
        <p className="text-[13px] font-semibold text-pe-text-muted">Search</p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-pe-text-secondary transition hover:bg-black/[0.04] hover:text-pe-text"
          aria-label="Close search"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* Pills appear once the user starts searching */}
      {hasQuery ? (
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
      ) : (
        <p className="px-4 py-8 text-center text-sm text-pe-text-secondary">
          Search people, topics, stocks, funds, and more.
        </p>
      )}

      {hasQuery ? (
        <div className="min-h-0 flex-1 overflow-y-auto pb-10">
          {isPeopleFilter ? (
            <section className="pt-2">
              {peopleLoading ? (
                <div className="px-4">
                  <MarketsListSkeleton rows={6} />
                </div>
              ) : peopleResults.length ? (
                <div className="divide-y divide-pe-border">
                  {peopleResults.map((p) => (
                    <PersonRow key={p.id} person={p} onOpenProfile={handleOpenProfile} />
                  ))}
                </div>
              ) : (
                <p className="px-4 py-10 text-center text-sm text-pe-text-secondary">
                  No matching people.
                </p>
              )}
            </section>
          ) : null}

          {isTopicsFilter ? (
            <section className="pt-2">
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
                  No matching topics.
                </p>
              )}
            </section>
          ) : null}

          {typeFilter === 'all' ? (
            <div className="pt-2">
              {peopleSearchActive ? (
                <section className="pb-4">
                  <p className="px-4 pb-1 text-[13px] font-semibold text-pe-text-muted">People</p>
                  {peopleLoading ? (
                    <div className="px-4">
                      <MarketsListSkeleton rows={3} />
                    </div>
                  ) : peopleResults.length ? (
                    <div className="divide-y divide-pe-border">
                      {peopleResults.slice(0, 5).map((p) => (
                        <PersonRow key={p.id} person={p} onOpenProfile={handleOpenProfile} />
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-3 text-sm text-pe-text-secondary">No matching people.</p>
                  )}
                </section>
              ) : null}

              {topicResults.length ? (
                <section className="border-t border-pe-border/60 pb-4 pt-4">
                  <p className="px-4 pb-1 text-[13px] font-semibold text-pe-text-muted">Topics</p>
                  <div className="divide-y divide-pe-border">
                    {topicResults.slice(0, 5).map((t) => (
                      <TopicRow
                        key={t.id}
                        topic={t}
                        following={isTopicFollowed(t.slug)}
                        onToggle={() => handleTopicFollow(t.slug)}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {securitySearchActive ? (
                <section className="border-t border-pe-border/60 pt-4">
                  <p className="px-4 pb-1 text-[13px] font-semibold text-pe-text-muted">
                    {searching ? 'Securities…' : 'Securities'}
                  </p>
                  {searching ? (
                    <div className="px-4">
                      <MarketsListSkeleton rows={4} />
                    </div>
                  ) : searchResults.length ? (
                    <div className="divide-y divide-pe-border">
                      {searchResults.map((item) => (
                        <SecurityListRow
                          key={ideaSecurityKey(item)}
                          item={item}
                          onOpen={handleOpenSecurity}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-3 text-sm text-pe-text-secondary">No matching securities.</p>
                  )}
                </section>
              ) : peopleSearchActive && debouncedQuery.length < MARKET_MIN_SEARCH_CHARS ? (
                <p className="border-t border-pe-border/60 px-4 py-6 text-sm text-pe-text-secondary">
                  Type at least {MARKET_MIN_SEARCH_CHARS} characters to search securities.
                </p>
              ) : null}
            </div>
          ) : null}

          {isSecurityFilter && securitySearchActive ? (
            <section className="pt-2">
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
                      onOpen={handleOpenSecurity}
                    />
                  ))}
                </div>
              ) : (
                <p className="px-4 py-10 text-center text-sm text-pe-text-secondary">
                  No matching securities.
                </p>
              )}
            </section>
          ) : null}

          {isSecurityFilter && !securitySearchActive ? (
            <p className="px-4 py-10 text-center text-sm text-pe-text-secondary">
              Type at least {MARKET_MIN_SEARCH_CHARS} characters to search.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
