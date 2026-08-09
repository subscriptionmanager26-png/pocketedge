import { useEffect, useMemo, useState } from 'react';
import PostCard from '../components/PostCard';
import NewsFilters from '../components/NewsFilters';
import { FeedSkeleton } from '../components/PageSkeletons';
import { isDevMockMode } from '../lib/appMode';
import { isNewsSocialPost, parseNewsSocialContent } from '../lib/newsPostBody';
import {
  NEWS_ALL_PORTFOLIOS_ID,
  tickersFromPortfolios,
} from '../lib/newsFilters';
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
import { useNewsCompanyNames } from '../lib/useNewsCompanyNames';
import { usePostEnrichment } from '../lib/usePostEnrichment';

const NEWS_PAGE_LIMIT = 100;

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
}) {
  const [fetchedPosts, setFetchedPosts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portfolios, setPortfolios] = useState([]);
  const [portfoliosReady, setPortfoliosReady] = useState(guestMode);

  /** @type {['global'|'portfolio'|'custom', Function]} */
  const [scope, setScope] = useState('global');
  const [selectedPortfolioId, setSelectedPortfolioId] = useState(NEWS_ALL_PORTFOLIOS_ID);
  const [customDim, setCustomDim] = useState('company');
  const [companies, setCompanies] = useState([]);
  const [companyLabels, setCompanyLabels] = useState({});
  const [types, setTypes] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [typeOptions, setTypeOptions] = useState([]);
  const [industryOptions, setIndustryOptions] = useState([]);

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

  // Server-side fetch: top 100 for the active filter.
  useEffect(() => {
    let cancelled = false;

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
      setLoading(false);
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

    setLoading(true);

    const load = !useLive
      ? isDevMockMode()
        ? seedMockNews()
        : Promise.resolve([])
      : guestMode
        ? fetchPublicNewsPosts(filterArgs)
        : fetchNewsPosts(filterArgs);

    load
      .then((next) => {
        if (!cancelled) setFetchedPosts(Array.isArray(next) ? next : []);
      })
      .catch((err) => {
        console.error('NewsPage load failed', err);
        if (!cancelled) setFetchedPosts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
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
  ]);

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

  const companyNames = useNewsCompanyNames(posts);
  const enrichmentTick = usePostEnrichment(posts);
  const showSkeleton = loading && !posts.length;

  const handleCompaniesChange = (keys, labels) => {
    setCompanies(keys);
    if (labels) setCompanyLabels(labels);
    else {
      setCompanyLabels((prev) => {
        const next = {};
        for (const k of keys) {
          if (prev[k]) next[k] = prev[k];
        }
        return next;
      });
    }
  };

  const handleScopeChange = (next) => {
    if (next === scope) return;
    if (next !== 'custom') {
      setCompanies([]);
      setCompanyLabels({});
      setTypes([]);
      setIndustries([]);
      setCustomDim('company');
    }
    if (next !== 'portfolio') {
      setSelectedPortfolioId(NEWS_ALL_PORTFOLIOS_ID);
    }
    setScope(next);
  };

  const clearCustomFromEmpty = () => {
    setCompanies([]);
    setCompanyLabels({});
    setTypes([]);
    setIndustries([]);
    setScope('global');
  };

  if (showSkeleton) {
    return (
      <div className="pt-2">
        <FeedSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="pb-8">
      <NewsFilters
        guestMode={guestMode}
        scope={scope}
        onScopeChange={handleScopeChange}
        portfolios={portfolios}
        selectedPortfolioId={selectedPortfolioId}
        onSelectedPortfolioChange={setSelectedPortfolioId}
        customDim={customDim}
        onCustomDimChange={setCustomDim}
        companies={companies}
        companyLabels={companyLabels}
        onCompaniesChange={handleCompaniesChange}
        types={types}
        typeOptions={typeOptions}
        onTypesChange={setTypes}
        industries={industries}
        industryOptions={industryOptions}
        onIndustriesChange={setIndustries}
        resultCount={posts.length}
      />

      {!posts.length ? (
        scope === 'global' && !loading ? (
          <p className="px-4 py-16 text-center text-sm text-pe-text-secondary md:px-6">
            {guestMode ? 'No news yet. Check back soon.' : 'No news posts yet.'}
          </p>
        ) : (
          <div className="px-4 py-16 text-center md:px-6">
            <p className="text-sm text-pe-text-secondary">No news match these filters.</p>
            <button
              type="button"
              onClick={() => {
                if (scope === 'custom') clearCustomFromEmpty();
                else handleScopeChange('global');
              }}
              className="mt-3 text-sm font-semibold text-pe-accent hover:underline"
            >
              Clear filters
            </button>
          </div>
        )
      ) : (
        <div className="pt-1">
          {posts.map((post) => {
            const { symbol } = parseNewsSocialContent(post);
            const companyName = symbol
              ? companyNames.get(symbol.toUpperCase()) || symbol
              : null;
            return (
              <PostCard
                key={post.id}
                post={post}
                variant="news"
                companyName={companyName}
                enrichmentTick={enrichmentTick}
                onOpenPost={onOpenPost}
                onOpenStock={onOpenStock}
                onToggleLike={onToggleLike}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
