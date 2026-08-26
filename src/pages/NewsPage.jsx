import { useEffect, useMemo, useRef, useState } from 'react';
import UnderlineTabs from '../components/UnderlineTabs';
import NewsCustomFilterDialog from '../components/news/NewsCustomFilterDialog';
import { NewsStoryCard, newsPostToStory } from '../components/news/NewsStoryCards';
import { FeedSkeleton } from '../components/PageSkeletons';
import { isDevMockMode } from '../lib/appMode';
import { isNewsSocialPost, parseNewsSocialContent } from '../lib/newsPostBody';
import {
  NEWS_ALL_PORTFOLIOS_ID,
  tickersFromPortfolios,
} from '../lib/newsFilters';
import {
  newsFilterKey,
  readCachedNews,
  writeCachedNews,
} from '../lib/newsCache';
import { fetchDistinctStockIndustries } from '../lib/marketDataApi';
import { rememberPerson, getAppCurrentUserId } from '../lib/socialIdentity';
import {
  fetchNewsPosts,
  fetchNewsPostTypes,
  fetchPublicNewsPosts,
  usePostBackend,
} from '../lib/socialPostApi';
import {
  fetchUserPortfolios,
  peekUserPortfolios,
} from '../lib/socialPortfolioApi';
import { isSupabaseConfigured } from '../lib/supabase';
import { skipAuthForDev } from '../lib/sessionStore';
import { useNewsMarketAssets } from '../lib/useNewsCompanyNames';
import { usePostEnrichment } from '../lib/usePostEnrichment';
import { computePortfolioDisplayMetrics } from '../data/mockData';

const NEWS_PAGE_LIMIT = 20;

function readInitialFilterUi(guestMode) {
  const cached = readCachedNews();
  const ui = cached?.filterUi;
  if (!ui || typeof ui !== 'object') return null;
  // Don't restore a guest-incompatible portfolio scope.
  if (guestMode && ui.scope === 'portfolio') return { ...ui, scope: 'global' };
  return ui;
}

function seedMockNews() {
  return import('../data/feedDesignMock').then((mod) =>
    (mod.FEED_DESIGN_POSTS ?? [])
      .filter((p) => p.kind === 'news')
      .map((p) => {
        const symbol = String(p.tickers?.[0]?.symbol ?? '').toUpperCase() || null;
        rememberPerson({
          id: p.author?.id ?? 'pe_news',
          name: p.author?.name ?? 'PocketEdge News',
          handle: p.author?.handle ?? 'pocketedge_news',
          avatar: p.author?.avatar,
        });
        const title = p.title || '';
        const body = symbol
          ? `@${symbol} ${title}\n\n${p.body ?? ''}`.trim()
          : String(p.body ?? '');
        return {
          id: p.id,
          authorId: p.author?.id ?? 'pe_news',
          body,
          createdAt: p.createdAt,
          likes: p.likes ?? 0,
          liked: false,
          commentCount: 0,
          comments: [],
          via: {
            source: 'mn_news_ai_summaries',
            kind: 'person',
            ticker: symbol,
            type: 'Stock',
          },
          kind: 'news',
        };
      })
  );
}

function mapPortfoliosForFilter(list) {
  return (list ?? []).map((p) => ({
    id: p.id,
    name: p.name || (p.kind === 'watchlist' ? 'Watchlist' : 'Portfolio'),
    kind: p.kind === 'watchlist' ? 'watchlist' : 'portfolio',
    holdings: p.holdings ?? [],
    tickers: p.tickers ?? [],
  }));
}

function quoteForTicker(quotes, ticker) {
  const key = String(ticker ?? '').trim().toUpperCase();
  if (!key) return null;
  return quotes.get(key) ?? null;
}

function withLiveQuotes(portfolio, quotes) {
  return {
    ...portfolio,
    kind: portfolio.kind === 'watchlist' ? 'watchlist' : 'portfolio',
    holdings: (portfolio.holdings ?? []).map((holding) => {
      const quote = quoteForTicker(quotes, holding.ticker);
      const livePrice = Number(quote?.price ?? quote?.nav ?? quote?.ltp);
      return {
        ...holding,
        price:
          Number.isFinite(livePrice) && livePrice > 0
            ? livePrice
            : holding.price,
        changePct: quote?.changePct ?? holding.changePct ?? null,
        logoIconUrl: holding.logoIconUrl ?? quote?.logoIconUrl ?? null,
        assetType: holding.assetType ?? quote?.assetType ?? null,
      };
    }),
  };
}

/** Allocation % and quote fields keyed by ticker, scoped to the For You portfolios. */
function holdingMetricsByTicker(portfolios, quotes) {
  const map = new Map();
  const list = portfolios ?? [];
  const live = list.filter((p) => p.kind !== 'watchlist');
  const watch = list.filter((p) => p.kind === 'watchlist');

  const put = (ticker, patch) => {
    const key = String(ticker ?? '').trim().toUpperCase();
    if (!key) return;
    map.set(key, { ...(map.get(key) ?? {}), ...patch, ticker: key });
  };

  let totalLiveValue = 0;
  const liveValueByTicker = new Map();
  for (const portfolio of live) {
    const metrics = computePortfolioDisplayMetrics(withLiveQuotes(portfolio, quotes));
    totalLiveValue += Number(metrics.totalValue) || 0;
    for (const holding of metrics.holdings ?? []) {
      const ticker = String(holding.ticker ?? '').toUpperCase();
      if (!ticker) continue;
      const quote = quoteForTicker(quotes, ticker);
      liveValueByTicker.set(ticker, (liveValueByTicker.get(ticker) || 0) + (Number(holding.value) || 0));
      put(ticker, {
        logoIconUrl: holding.logoIconUrl ?? quote?.logoIconUrl ?? null,
        assetType: holding.assetType ?? quote?.assetType ?? null,
        changePct: quote?.changePct ?? holding.changePct ?? null,
      });
    }
  }
  if (totalLiveValue > 0) {
    for (const [ticker, value] of liveValueByTicker) {
      put(ticker, { allocationPct: (value / totalLiveValue) * 100 });
    }
  } else if (live.length) {
    const unique = [...liveValueByTicker.keys()];
    const equal = unique.length ? 100 / unique.length : 0;
    for (const ticker of unique) put(ticker, { allocationPct: equal });
  }

  for (const portfolio of watch) {
    const metrics = computePortfolioDisplayMetrics(withLiveQuotes(portfolio, quotes));
    for (const row of metrics.distribution ?? []) {
      const ticker = String(row.ticker ?? '').toUpperCase();
      if (!ticker) continue;
      const existing = map.get(ticker);
      if (existing?.allocationPct != null) continue;
      const quote = quoteForTicker(quotes, ticker);
      put(ticker, {
        allocationPct: row.weight,
        logoIconUrl: quote?.logoIconUrl ?? existing?.logoIconUrl ?? null,
        assetType: row.assetType ?? quote?.assetType ?? existing?.assetType ?? null,
        changePct: quote?.changePct ?? existing?.changePct ?? null,
      });
    }
  }

  return map;
}

/**
 * News tab — PocketEdge AI market summaries without poster identity.
 * Filters refetch top 100 matching the active scope/custom dimension.
 */
export default function NewsPage({
  posts: postsFromParent,
  guestMode = false,
  onOpenPost,
  onOpenStock,
  onToggleLike,
  onNewsPostsChange,
}) {
  const initialUi = useMemo(() => readInitialFilterUi(guestMode), [guestMode]);
  const [fetchedPosts, setFetchedPosts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [portfolios, setPortfolios] = useState([]);
  const [portfoliosReady, setPortfoliosReady] = useState(guestMode);

  /** @type {['global'|'portfolio'|'custom', Function]} */
  const [scope, setScope] = useState(
    () => initialUi?.scope ?? (guestMode ? 'global' : 'portfolio')
  );
  const [selectedPortfolioId, setSelectedPortfolioId] = useState(
    () => initialUi?.selectedPortfolioId ?? NEWS_ALL_PORTFOLIOS_ID
  );
  const [customDim, setCustomDim] = useState(() => initialUi?.customDim ?? 'company');
  const [companies, setCompanies] = useState(() =>
    Array.isArray(initialUi?.companies) ? initialUi.companies : []
  );
  const [companyLabels, setCompanyLabels] = useState(() =>
    initialUi?.companyLabels && typeof initialUi.companyLabels === 'object'
      ? initialUi.companyLabels
      : {}
  );
  const [types, setTypes] = useState(() =>
    Array.isArray(initialUi?.types) ? initialUi.types : []
  );
  const [industries, setIndustries] = useState(() =>
    Array.isArray(initialUi?.industries) ? initialUi.industries : []
  );
  const [typeOptions, setTypeOptions] = useState([]);
  const [industryOptions, setIndustryOptions] = useState([]);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const onNewsPostsChangeRef = useRef(onNewsPostsChange);
  onNewsPostsChangeRef.current = onNewsPostsChange;
  const fetchGenRef = useRef(0);
  const postsRef = useRef([]);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef(null);
  const filterUiRef = useRef(null);

  useEffect(() => {
    if (guestMode) {
      setPortfolios([]);
      setPortfoliosReady(true);
      setScope((s) => (s === 'portfolio' ? 'global' : s));
      setSelectedPortfolioId(NEWS_ALL_PORTFOLIOS_ID);
      return undefined;
    }

    let cancelled = false;
    setPortfoliosReady(false);
    const ownerId = getAppCurrentUserId();
    const cached = peekUserPortfolios(ownerId);
    if (cached?.length) {
      setPortfolios(mapPortfoliosForFilter(cached));
      setPortfoliosReady(true);
    }

    fetchUserPortfolios(ownerId)
      .then((list) => {
        if (!cancelled) {
          setPortfolios(mapPortfoliosForFilter(list));
          setPortfoliosReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (!cached?.length) setPortfolios([]);
          setPortfoliosReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [guestMode]);

  useEffect(() => {
    if (selectedPortfolioId === NEWS_ALL_PORTFOLIOS_ID) return;
    if (!portfolios.some((p) => p.id === selectedPortfolioId)) {
      setSelectedPortfolioId(NEWS_ALL_PORTFOLIOS_ID);
    }
  }, [portfolios, selectedPortfolioId]);

  // Facets for Custom panel — independent of the filtered feed.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchNewsPostTypes().catch(() => []),
      fetchDistinctStockIndustries().catch(() => []),
    ]).then(([typeList, industryList]) => {
      if (cancelled) return;
      setTypeOptions(Array.isArray(typeList) ? typeList : []);
      setIndustryOptions(Array.isArray(industryList) ? industryList : []);
    });
    return () => {
      cancelled = true;
    };
  }, [guestMode]);

  const holdingsTickers = useMemo(() => {
    if (selectedPortfolioId === NEWS_ALL_PORTFOLIOS_ID) {
      return tickersFromPortfolios(portfolios);
    }
    const one = portfolios.find((p) => p.id === selectedPortfolioId);
    return tickersFromPortfolios(one ? [one] : []);
  }, [selectedPortfolioId, portfolios]);

  const holdingsKey = useMemo(
    () => [...holdingsTickers].sort().join(','),
    [holdingsTickers]
  );

  const companiesKey = useMemo(
    () =>
      companies
        .map((c) => String(c).trim().toUpperCase())
        .filter(Boolean)
        .sort()
        .join(','),
    [companies]
  );
  const typesKey = useMemo(
    () =>
      types
        .map((t) => String(t).trim())
        .filter(Boolean)
        .sort()
        .join(','),
    [types]
  );
  const industriesKey = useMemo(
    () =>
      industries
        .map((t) => String(t).trim())
        .filter(Boolean)
        .sort()
        .join(','),
    [industries]
  );

  // First page for the active filter (skip when session cache is warm).
  useEffect(() => {
    let cancelled = false;
    const gen = ++fetchGenRef.current;

    const useLive =
      guestMode
        ? isSupabaseConfigured() && !skipAuthForDev()
        : usePostBackend();

    if (scope === 'portfolio' && !guestMode && !portfoliosReady) {
      setLoading(true);
      return undefined;
    }

    if (scope === 'portfolio' && !guestMode && holdingsTickers.size === 0) {
      setFetchedPosts([]);
      postsRef.current = [];
      setHasMore(false);
      setLoading(false);
      onNewsPostsChangeRef.current?.([]);
      return undefined;
    }

    const filterArgs = { limit: NEWS_PAGE_LIMIT, offset: 0 };
    if (scope === 'portfolio') {
      filterArgs.tickers = [...holdingsTickers];
    } else if (scope === 'custom') {
      if (customDim === 'company' && companies.length) {
        filterArgs.tickers = companies.map((c) => String(c).toUpperCase());
      } else if (customDim === 'type' && types.length) {
        filterArgs.types = [...types];
      } else if (customDim === 'industry' && industries.length) {
        filterArgs.industries = [...industries];
      }
    }

    const cacheKey = newsFilterKey({
      guestMode,
      scope,
      customDim,
      tickers: filterArgs.tickers,
      types: filterArgs.types,
      industries: filterArgs.industries,
    });
    const filterUi = {
      scope,
      selectedPortfolioId,
      customDim,
      companies,
      companyLabels,
      types,
      industries,
    };
    filterUiRef.current = { cacheKey, filterArgs, filterUi, useLive };

    const cached = readCachedNews(cacheKey);
    if (cached?.items) {
      setFetchedPosts(cached.items);
      postsRef.current = cached.items;
      setHasMore(cached.items.length >= NEWS_PAGE_LIMIT);
      setLoading(false);
      onNewsPostsChangeRef.current?.(cached.items);
      return undefined;
    }

    // Paint immediately from any warm global bag while the network fetch runs.
    let painted = fetchedPosts != null && Array.isArray(fetchedPosts);
    if (!painted && scope === 'global') {
      const latest = readCachedNews()?.items;
      const seed =
        (Array.isArray(latest) && latest.length ? latest : null) ??
        (Array.isArray(postsFromParent) && postsFromParent.length ? postsFromParent : null);
      if (seed) {
        setFetchedPosts(seed);
        postsRef.current = seed;
        painted = true;
      }
    }
    setLoading(!painted);
    setHasMore(true);

    const load = !useLive
      ? isDevMockMode()
        ? seedMockNews()
        : Promise.resolve([])
      : guestMode
        ? fetchPublicNewsPosts(filterArgs)
        : fetchNewsPosts(filterArgs);

    load
      .then((next) => {
        if (cancelled || fetchGenRef.current !== gen) return;
        const items = Array.isArray(next) ? next.slice(0, NEWS_PAGE_LIMIT) : [];
        setFetchedPosts(items);
        postsRef.current = items;
        setHasMore(items.length === NEWS_PAGE_LIMIT);
        writeCachedNews({ filterKey: cacheKey, items, filterUi });
        onNewsPostsChangeRef.current?.(items);
      })
      .catch((err) => {
        console.error('NewsPage load failed', err);
        if (!cancelled && fetchGenRef.current === gen) {
          setFetchedPosts([]);
          postsRef.current = [];
          setHasMore(false);
        }
      })
      .finally(() => {
        if (!cancelled && fetchGenRef.current === gen) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed from parent only on cold start
  }, [
    guestMode,
    scope,
    customDim,
    companiesKey,
    typesKey,
    industriesKey,
    holdingsKey,
    portfoliosReady,
    holdingsTickers,
    companies,
    types,
    industries,
    selectedPortfolioId,
    companyLabels,
  ]);

  useEffect(() => {
    postsRef.current = fetchedPosts ?? [];
  }, [fetchedPosts]);

  const loadMoreNews = () => {
    if (loading || loadingMoreRef.current || !hasMore) return;
    const ctx = filterUiRef.current;
    if (!ctx?.filterArgs) return;
    const args = ctx.filterArgs;
    if (
      scope === 'custom' &&
      !args.tickers?.length &&
      !args.types?.length &&
      !args.industries?.length
    ) {
      return;
    }

    const gen = fetchGenRef.current;
    const existing = postsRef.current ?? [];
    loadingMoreRef.current = true;
    setLoadingMore(true);

    const filterArgs = {
      ...ctx.filterArgs,
      limit: NEWS_PAGE_LIMIT,
      offset: existing.length,
    };
    const useLive = ctx.useLive;
    const load = !useLive
      ? Promise.resolve([])
      : guestMode
        ? fetchPublicNewsPosts(filterArgs)
        : fetchNewsPosts(filterArgs);

    load
      .then((next) => {
        if (fetchGenRef.current !== gen) return;
        const page = Array.isArray(next) ? next : [];
        const seen = new Set(existing.map((p) => p.id));
        const appended = page.filter((p) => p?.id && !seen.has(p.id));
        const items = [...existing, ...appended];
        setFetchedPosts(items);
        postsRef.current = items;
        setHasMore(page.length === NEWS_PAGE_LIMIT);
        writeCachedNews({
          filterKey: ctx.cacheKey,
          items,
          filterUi: ctx.filterUi,
        });
        onNewsPostsChangeRef.current?.(items);
      })
      .catch((err) => {
        console.error('NewsPage load more failed', err);
        if (fetchGenRef.current === gen) setHasMore(false);
      })
      .finally(() => {
        if (fetchGenRef.current === gen) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      });
  };

  const posts = useMemo(() => {
    const base = fetchedPosts ?? [];
    const parentById = new Map(
      (postsFromParent ?? []).map((p) => [p.id, p])
    );
    return base
      .map((p) => {
        const overlay = parentById.get(p.id);
        if (!overlay) return p;
        return {
          ...p,
          liked: overlay.liked ?? p.liked,
          likes: overlay.likes ?? p.likes,
        };
      })
      .filter(isNewsSocialPost);
  }, [fetchedPosts, postsFromParent]);

  const scopedPortfolios = useMemo(() => {
    if (selectedPortfolioId === NEWS_ALL_PORTFOLIOS_ID) return portfolios;
    return portfolios.filter((p) => p.id === selectedPortfolioId);
  }, [portfolios, selectedPortfolioId]);

  const marketAssets = useNewsMarketAssets(posts, [...holdingsTickers]);
  usePostEnrichment(posts);
  const showSkeleton = loading && !posts.length;
  const newsView =
    scope === 'portfolio' ? 'foryou' : scope === 'custom' ? 'custom' : 'all';

  const holdingMetrics = useMemo(
    () => holdingMetricsByTicker(scopedPortfolios, marketAssets),
    [scopedPortfolios, marketAssets]
  );

  const stories = useMemo(
    () =>
      posts.map((post) => {
        const parsed = parseNewsSocialContent(post);
        const symbol = parsed.symbol ? parsed.symbol.toUpperCase() : null;
        const quote = symbol ? marketAssets.get(symbol) : null;
        const holding = symbol ? holdingMetrics.get(symbol) : null;
        const companyName = quote?.name || (symbol ? symbol : null);
        const showMetrics = newsView === 'foryou' && Boolean(symbol);
        return newsPostToStory(post, {
          companyName,
          allocationPct: holding?.allocationPct ?? null,
          changePct: quote?.changePct ?? holding?.changePct ?? null,
          logoIconUrl: quote?.logoIconUrl ?? holding?.logoIconUrl ?? null,
          assetType: quote?.assetType || holding?.assetType || parsed.assetType,
          showMetrics,
        });
      }),
    [posts, marketAssets, holdingMetrics, newsView]
  );

  const hasCustomFilters =
    (customDim === 'company' && companies.length > 0) ||
    (customDim === 'type' && types.length > 0) ||
    (customDim === 'industry' && industries.length > 0);
  const customFilterCount =
    customDim === 'company'
      ? companies.length
      : customDim === 'type'
        ? types.length
        : industries.length;
  const visibleStories = scope === 'custom' && !hasCustomFilters ? [] : stories;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || showSkeleton || !hasMore || loading || loadingMore) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreNews();
      },
      { root: null, rootMargin: '320px 0px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // loadMoreNews reads latest filters via refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, loadingMore, showSkeleton, visibleStories.length]);

  const clearCustomFilters = () => {
    setCompanies([]);
    setCompanyLabels({});
    setTypes([]);
    setIndustries([]);
    setCustomDim('company');
  };

  const applyCustomFilters = (draft) => {
    setCustomDim(draft.customDim || 'company');
    setCompanies(draft.companies ?? []);
    setCompanyLabels(draft.companyLabels ?? {});
    setTypes(draft.types ?? []);
    setIndustries(draft.industries ?? []);
  };

  useEffect(() => {
    if (scope === 'custom' && !hasCustomFilters) {
      setFilterDialogOpen(true);
    }
  }, [scope, hasCustomFilters]);

  const handleScopeChange = (next) => {
    if (next === scope) return;
    if (next !== 'portfolio') {
      setSelectedPortfolioId(NEWS_ALL_PORTFOLIOS_ID);
    }
    setScope(next);
  };

  const setNewsView = (next) => {
    if (next === 'foryou') {
      handleScopeChange('portfolio');
      return;
    }
    if (next === 'custom') {
      handleScopeChange('custom');
      return;
    }
    handleScopeChange('global');
  };

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden pb-8">
      <UnderlineTabs
        tabs={[
          { id: 'foryou', label: 'For You' },
          { id: 'all', label: 'All News' },
          {
            id: 'custom',
            label: hasCustomFilters ? `Custom (${customFilterCount})` : 'Custom',
            accessory: (
              <button
                type="button"
                onClick={() => setFilterDialogOpen(true)}
                className="rounded px-1.5 py-0.5 text-[12px] font-semibold text-pe-accent hover:bg-pe-accent/10"
              >
                Edit
              </button>
            ),
          },
        ]}
        active={newsView}
        onChange={setNewsView}
      />

      <NewsCustomFilterDialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        onApply={applyCustomFilters}
        customDim={customDim}
        companies={companies}
        companyLabels={companyLabels}
        types={types}
        typeOptions={typeOptions}
        industries={industries}
        industryOptions={industryOptions}
      />

      {showSkeleton ? (
        <FeedSkeleton count={4} />
      ) : (
        <div className="px-4 md:px-6">
          <div className="divide-y divide-pe-border">
            {visibleStories.map((story) => (
              <NewsStoryCard
                key={story.id}
                story={story}
                onOpen={(id) => onOpenPost?.(id)}
              />
            ))}
          </div>
          {hasMore ? (
            <div ref={sentinelRef} className="min-h-8" aria-busy={loadingMore}>
              {loadingMore ? (
                <p className="py-4 text-center text-sm text-pe-text-secondary">
                  Loading more news…
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {!showSkeleton && !visibleStories.length ? (
        scope === 'global' && !loading ? (
          <p className="px-4 py-16 text-center text-sm text-pe-text-secondary md:px-6">
            {guestMode ? 'No news yet. Check back soon.' : 'No news posts yet.'}
          </p>
        ) : scope === 'custom' && !loading && !hasCustomFilters ? (
          <div className="px-4 py-12 text-center md:px-6">
            <p className="text-sm text-pe-text-secondary">
              Choose filters to build your custom news feed.
            </p>
            <button
              type="button"
              onClick={() => setFilterDialogOpen(true)}
              className="mt-3 text-sm font-semibold text-pe-accent hover:underline"
            >
              Choose filters
            </button>
          </div>
        ) : (
          <div className="px-4 py-16 text-center md:px-6">
            <p className="text-sm text-pe-text-secondary">No news match these filters.</p>
            <button
              type="button"
              onClick={() => {
                if (scope === 'custom') clearCustomFilters();
                else handleScopeChange('global');
              }}
              className="mt-3 text-sm font-semibold text-pe-accent hover:underline"
            >
              Clear filters
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}

