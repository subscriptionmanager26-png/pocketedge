import { useMemo, useState, useEffect, useCallback } from 'react';
import { Plus, X, RefreshCw } from 'lucide-react';
import AppModalOverlay from '../components/AppModalOverlay';
import GuestSignInCta from '../components/GuestSignInCta';
import UnderlineTabs from '../components/UnderlineTabs';
import WatchlistModal from '../components/WatchlistModal';
import {
  HoldingsSummary,
  NewsFeed,
  PostsFeed,
  collectActivity,
  postsToActivityItems,
} from '../components/ActivityFeed';
import { FormStatusIcon } from '../components/FormStatusIcons';
import { MY_PORTFOLIO, computePortfolioDisplayMetrics, getUserPortfolios } from '../data/mockData';
import { formatInr, formatPct, pnlClass } from '../lib/format';
import { holdingDisplayLabel, assetsFromHoldings, holdingsNeedLogoResolve, enrichPortfolioHoldingsLogos } from '../lib/portfolioAssetUniverse';
import { lookupMarketAssetsBatch } from '../lib/marketDataApi';
import {
  PORTFOLIO_POLL_INTERVAL_MS,
  shouldPollPortfolioRefresh,
} from '../lib/marketRefreshPolicy';
import { addWatchlist, getWatchlists, subscribeWatchlists } from '../lib/watchlistStore';
import { PortfolioPageSkeleton } from '../components/PortfolioSkeletons';
import { fetchUserPortfolios, peekUserPortfolios } from '../lib/socialPortfolioApi';
import { getAppCurrentUserId } from '../lib/socialIdentity';
import { markTabDataReady, markTabPaint } from '../lib/perfMarks';
import { isSupabaseConfigured } from '../lib/supabase';
import { isDevMockMode } from '../lib/appMode';
import { fetchStockNewsForTickers, fetchCorporateActionsForTickers, isStockNewsConfigured } from '../lib/stockNewsApi';
import { ASSET_POSTS_DAYS, loadPostsMentioning } from '../lib/assetDiscussions';
import CorporateActionsList from '../components/CorporateActionsList';
import { skipAuthForDev } from '../lib/sessionStore';
import { fetchPortfolioFormByTicker, FORM_META } from '../lib/portfolioForm';
import {
  PortfolioKindMetaTags,
} from '../components/PortfolioMetaTag';

function useBackend() {
  return isSupabaseConfigured() && !skipAuthForDev();
}

export default function PortfolioPage({
  guestMode = false,
  onSelectStock,
  onSelectFund,
  onOpenProfile,
  onOpenPost,
  onOpenSourcePortfolio,
  onCreatePortfolio,
  onUpdateHoldings,
}) {
  const [listId, setListId] = useState(null);
  const [contentTab, setContentTab] = useState('performance');
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [watchlistTick, setWatchlistTick] = useState(0);
  const [portfolioTick, setPortfolioTick] = useState(0);
  const [remotePortfolios, setRemotePortfolios] = useState(() => {
    const cached = peekUserPortfolios(getAppCurrentUserId());
    return Array.isArray(cached) ? cached.filter((p) => !p.isDraft) : [];
  });
  const [portfoliosLoading, setPortfoliosLoading] = useState(() => {
    const cached = peekUserPortfolios(getAppCurrentUserId());
    return !(Array.isArray(cached) && cached.length);
  });
  const [formByTicker, setFormByTicker] = useState({});
  const [formSheet, setFormSheet] = useState(null);
  const [assetsByKey, setAssetsByKey] = useState({});

  const ownerId = getAppCurrentUserId();

  useEffect(() => {
    markTabPaint('portfolio');
  }, []);

  useEffect(() => subscribeWatchlists(() => setWatchlistTick((n) => n + 1)), []);

  useEffect(() => {
    if (guestMode) return undefined;
    let cancelled = false;

    if (useBackend()) {
      const cached = peekUserPortfolios(ownerId);
      // Instant paint from cache; only block on cold load.
      if (Array.isArray(cached) && cached.length) {
        setRemotePortfolios(cached.filter((p) => !p.isDraft));
        setPortfoliosLoading(false);
      } else {
        setPortfoliosLoading(true);
      }

      fetchUserPortfolios(ownerId, { force: true })
        .then((rows) => {
          if (!cancelled) {
            setRemotePortfolios(rows.filter((p) => !p.isDraft));
            markTabDataReady('portfolio', 'network');
          }
        })
        .catch(() => {
          if (!cancelled && !(Array.isArray(cached) && cached.length)) {
            setRemotePortfolios([]);
          }
        })
        .finally(() => {
          if (!cancelled) setPortfoliosLoading(false);
        });
    } else {
      setRemotePortfolios(getUserPortfolios(ownerId).filter((p) => !p.isDraft));
      setPortfoliosLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [guestMode, ownerId, portfolioTick]);

  const watchlists = useMemo(() => (guestMode ? [] : getWatchlists()), [guestMode, watchlistTick]);

  const lists = useMemo(() => {
    if (useBackend()) {
      const livePortfolios = remotePortfolios.filter((p) => p.kind !== 'watchlist');
      const watchlistPortfolios = remotePortfolios.filter((p) => p.kind === 'watchlist');
      return [
        ...livePortfolios.map((p) => ({ ...p, kind: 'portfolio' })),
        ...watchlistPortfolios.map((w) => ({ ...w, kind: 'watchlist' })),
      ];
    }

    const portfolioLists = remotePortfolios.length
      ? remotePortfolios
          .filter((p) => p.kind !== 'watchlist')
          .map((p) => ({ ...p, kind: 'portfolio' }))
      : [
          {
            id: 'fallback_portfolio',
            name: 'Main portfolio',
            kind: 'portfolio',
            holdings: MY_PORTFOLIO.holdings,
            ...MY_PORTFOLIO,
          },
        ];

    return [
      ...portfolioLists,
      ...watchlists.map((w) => ({
        id: w.id,
        name: w.name,
        kind: 'watchlist',
        tickers: w.tickers,
        holdings: [],
      })),
    ];
  }, [remotePortfolios, watchlists]);

  useEffect(() => {
    if (!lists.length) return;
    if (!listId || !lists.some((l) => l.id === listId)) {
      setListId(lists[0].id);
    }
  }, [lists, listId]);

  const activeList = lists.find((l) => l.id === listId) ?? lists[0];
  const isPortfolio = activeList?.kind === 'portfolio' || activeList?.kind === 'watchlist';

  const holdingKeys = useMemo(
    () =>
      [...new Set((activeList?.holdings ?? []).map((holding) => holding?.ticker).filter(Boolean))],
    [activeList?.holdings]
  );
  const holdingKeysKey = holdingKeys.join('|');

  const refreshPortfolioAssets = useCallback(async () => {
    if (!holdingKeys.length) return;
    const batch = await lookupMarketAssetsBatch(holdingKeys, { force: true });
    if (!batch.size) return;

    setAssetsByKey((prev) => {
      const next = { ...prev };
      for (const key of holdingKeys) {
        const item = batch.get(key) ?? batch.get(String(key).toUpperCase());
        if (!item) continue;
        const price = item.price ?? item.nav ?? item.ltp ?? null;
        next[key] = {
          key,
          symbol: item.symbol ?? key,
          name: item.name ?? prev[key]?.name ?? '',
          kind: item.assetType ?? prev[key]?.kind ?? 'stock',
          kindLabel: prev[key]?.kindLabel ?? 'Stock',
          price,
          isin: item.isin ?? prev[key]?.isin ?? null,
          logoIconUrl: item.logoIconUrl ?? prev[key]?.logoIconUrl ?? null,
          item,
        };
      }
      return next;
    });
  }, [holdingKeys]);

  useEffect(() => {
    let cancelled = false;
    if (!holdingKeys.length) {
      setAssetsByKey({});
      return undefined;
    }

    // Paint immediately from server-enriched holdings, then always force-refresh
    // quotes from DB so ETF/stock marks are not stuck on a cached enrich snapshot.
    setAssetsByKey(assetsFromHoldings(activeList?.holdings));
    refreshPortfolioAssets().catch(() => {});

    // Logo fill is separate so missing logos never block live quote resolve.
    if (holdingsNeedLogoResolve(activeList?.holdings)) {
      enrichPortfolioHoldingsLogos(activeList?.holdings).then((holdings) => {
        if (cancelled) return;
        setAssetsByKey((prev) => {
          const fromLogos = assetsFromHoldings(holdings);
          const next = { ...prev };
          for (const [key, asset] of Object.entries(fromLogos)) {
            if (!asset?.logoIconUrl) continue;
            next[key] = {
              ...(next[key] ?? asset),
              logoIconUrl: asset.logoIconUrl,
              item: {
                ...(next[key]?.item ?? asset.item ?? {}),
                logoIconUrl: asset.logoIconUrl,
              },
            };
          }
          return next;
        });
      });
    }

    return () => {
      cancelled = true;
    };
  }, [holdingKeysKey, refreshPortfolioAssets]);

  useEffect(() => {
    if (!holdingKeys.length || !useBackend()) return undefined;

    let cancelled = false;
    let timer = null;

    const tick = async () => {
      if (cancelled || !shouldPollPortfolioRefresh()) return;
      try {
        await refreshPortfolioAssets();
      } catch {
        // Keep last successful quote if refresh fails.
      }
    };

    const schedule = () => {
      if (timer) window.clearInterval(timer);
      if (!shouldPollPortfolioRefresh()) return;
      timer = window.setInterval(tick, PORTFOLIO_POLL_INTERVAL_MS);
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (timer) {
          window.clearInterval(timer);
          timer = null;
        }
      } else {
        // Always refresh once when returning to the tab (incl. after hours).
        refreshPortfolioAssets().catch(() => {});
        schedule();
      }
    };

    schedule();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [holdingKeysKey, holdingKeys.length, refreshPortfolioAssets]);

  const liveActiveList = useMemo(() => {
    if (!activeList?.holdings?.length) return activeList;
    return {
      ...activeList,
      holdings: activeList.holdings.map((holding) => {
        const asset = assetsByKey[holding.ticker];
        const livePrice = Number(asset?.price);
        const savedPrice = Number(holding.price);
        const averagePrice = Number(holding.avg) || 0;
        const price =
          Number.isFinite(livePrice) && livePrice > 0
            ? livePrice
            : Number.isFinite(savedPrice) && savedPrice > 0
              ? savedPrice
              : averagePrice;

        return {
          ...holding,
          assetType: asset?.kind ?? holding.assetType,
          assetName: asset?.name ?? holding.assetName,
          logoIconUrl: asset?.logoIconUrl ?? holding.logoIconUrl ?? null,
          price,
          changePct: asset?.item?.changePct ?? holding.changePct ?? null,
          asOfDate: asset?.item?.asOfDate ?? asset?.item?.navDate ?? holding.asOfDate ?? null,
          navDate: asset?.item?.navDate ?? asset?.item?.asOfDate ?? holding.navDate ?? null,
          previousClose: asset?.item?.previousClose ?? holding.previousClose ?? null,
          previousNav:
            asset?.item?.previousNav ??
            asset?.item?.previousClose ??
            holding.previousNav ??
            holding.previousClose ??
            null,
          previousAsOfDate:
            asset?.item?.previousAsOfDate ?? holding.previousAsOfDate ?? null,
          previousChangePct:
            asset?.item?.previousChangePct ?? holding.previousChangePct ?? null,
        };
      }),
    };
  }, [activeList, assetsByKey]);

  const displayMetrics = useMemo(() => {
    if (!liveActiveList) return { metrics: null, holdingsRows: [] };
    const metricsSource =
      liveActiveList.kind === 'portfolio' || liveActiveList.kind === 'watchlist'
        ? liveActiveList
        : {
            ...liveActiveList,
            kind: 'portfolio',
            holdings: MY_PORTFOLIO.holdings,
          };
    const metrics = computePortfolioDisplayMetrics(metricsSource);
    const holdings = metrics.holdings ?? [];
    const totalValue = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0);
    const holdingsRows = holdings
      .map((h) => ({
        ...h,
        weight: totalValue > 0 ? ((h.value ?? 0) / totalValue) * 100 : 0,
      }))
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
    return { metrics, holdingsRows };
  }, [liveActiveList]);

  const { metrics, holdingsRows } = displayMetrics;

  const formItems = useMemo(
    () =>
      holdingsRows.map((h) => ({
        ticker: h.ticker,
        assetType: h.assetType,
      })),
    [holdingsRows]
  );
  const mentionKeys = useMemo(() => {
    const keys = new Set();
    for (const holding of holdingsRows) {
      if (holding?.ticker) keys.add(holding.ticker);
      if (holding?.assetName) keys.add(holding.assetName);
    }
    return [...keys];
  }, [holdingsRows]);
  const tickers = useMemo(() => holdingsRows.map((h) => h.ticker), [holdingsRows]);
  const tickersKey = useMemo(() => tickers.filter(Boolean).join('|'), [tickers]);
  const [portfolioNews, setPortfolioNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [corporateActions, setCorporateActions] = useState([]);
  const [corpActionsLoading, setCorpActionsLoading] = useState(false);
  const [portfolioPosts, setPortfolioPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);

  useEffect(() => {
    if (contentTab !== 'performance') return undefined;
    if (!formItems.length) {
      setFormByTicker({});
      return undefined;
    }

    let cancelled = false;
    const loadForm = () => {
      fetchPortfolioFormByTicker(formItems).then((map) => {
        if (!cancelled) setFormByTicker(map);
      });
    };

    if (typeof requestIdleCallback === 'function') {
      const idleId = requestIdleCallback(loadForm, { timeout: 2000 });
      return () => {
        cancelled = true;
        cancelIdleCallback(idleId);
      };
    }

    loadForm();
    return () => {
      cancelled = true;
    };
  }, [formItems, contentTab]);

  const formBuckets = useMemo(() => {
    const buckets = {
      in_form: [],
      out_of_form: [],
      unsure: [],
    };

    for (const holding of holdingsRows) {
      const form = formByTicker[holding.ticker] ?? 'unsure';
      const name = holdingDisplayLabel(holding, {
        kind: holding.assetType,
        name: holding.assetName,
      });
      buckets[form]?.push({
        ticker: holding.ticker,
        name,
        assetType: holding.assetType ?? null,
      });
    }

    return buckets;
  }, [holdingsRows, formByTicker]);

  useEffect(() => {
    if (contentTab !== 'news') return undefined;
    if (!tickersKey) {
      setPortfolioNews([]);
      return undefined;
    }

    const symbols = tickersKey.split('|').filter(Boolean);

    if (isStockNewsConfigured()) {
      let cancelled = false;
      setNewsLoading(true);
      fetchStockNewsForTickers(symbols)
        .then((items) => {
          if (!cancelled) setPortfolioNews(items);
        })
        .finally(() => {
          if (!cancelled) setNewsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }

    if (isDevMockMode()) {
      setPortfolioNews(collectActivity(symbols).news);
      return undefined;
    }

    setPortfolioNews([]);
    return undefined;
  }, [tickersKey, contentTab]);

  useEffect(() => {
    if (contentTab !== 'corporate_actions') return undefined;
    if (!tickersKey) {
      setCorporateActions([]);
      return undefined;
    }

    if (!isStockNewsConfigured()) {
      setCorporateActions([]);
      return undefined;
    }

    let cancelled = false;
    setCorpActionsLoading(true);
    const symbols = tickersKey.split('|').filter(Boolean);
    fetchCorporateActionsForTickers(symbols)
      .then((items) => {
        if (!cancelled) setCorporateActions(items);
      })
      .finally(() => {
        if (!cancelled) setCorpActionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tickersKey, contentTab]);

  useEffect(() => {
    if (contentTab !== 'posts') return undefined;
    if (!mentionKeys.length) {
      setPortfolioPosts([]);
      return undefined;
    }

    if (useBackend()) {
      let cancelled = false;
      setPostsLoading(true);
      loadPostsMentioning(mentionKeys, { days: ASSET_POSTS_DAYS, limit: 50 })
        .then((posts) => {
          if (!cancelled) setPortfolioPosts(postsToActivityItems(posts, mentionKeys));
        })
        .catch(() => {
          if (!cancelled) setPortfolioPosts([]);
        })
        .finally(() => {
          if (!cancelled) setPostsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }

    if (isDevMockMode()) {
      setPortfolioPosts(collectActivity(tickers).posts);
      return undefined;
    }

    setPortfolioPosts([]);
    return undefined;
  }, [mentionKeys, tickers, contentTab]);

  const activity = useMemo(() => {
    const base = collectActivity(tickers);
    return {
      ...base,
      news: isStockNewsConfigured() || !isDevMockMode() ? portfolioNews : base.news,
      posts: useBackend() || !isDevMockMode() ? portfolioPosts : base.posts,
    };
  }, [tickers, portfolioNews, portfolioPosts]);

  if (guestMode) {
    return (
      <div>
        <div className="px-4 pt-2 md:px-6">
          <UnderlineTabs
            tabs={[{ id: 'demo', label: 'My Portfolio' }]}
            active="demo"
            onChange={() => {}}
          />
        </div>

        <section className="px-4 py-5 md:px-6">
          <div className="relative overflow-hidden">
            <div className="pointer-events-none select-none blur-[4px]" aria-hidden>
              <div className="grid grid-cols-2 gap-x-3 sm:gap-x-4">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-pe-text-muted">Invested Value</p>
                  <p className="mt-1 truncate text-[20px] font-bold tracking-tight tabular-nums text-pe-text sm:text-[24px]">
                    ₹10,00,000
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[12px] font-semibold text-pe-text-muted">Current Value</p>
                  <p className="mt-1 truncate text-[20px] font-bold tracking-tight tabular-nums text-pe-text sm:text-[24px]">
                    ₹12,48,320
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-stretch gap-2 sm:gap-3">
                <PortfolioPnlCard label="Total PnL" amount={248320} pct={24.83} />
                <PortfolioPnlCard label="1D PnL" amount={8420} pct={0.68} />
              </div>
            </div>
          </div>
        </section>

        <GuestSignInCta
          variant="hero"
          title="See your real performance"
          description="Sign in to track live PnL, holdings, and form signals across every list you follow."
          action="unlock your portfolio"
          showExploreHint={false}
          benefits={[
            'Live value, PnL, and day moves',
            'Signals on what is in or out of form',
            'News & actions for your holdings only',
          ]}
        />

        <section className="px-4 pb-5 md:px-6">
          <PortfolioSignalsSection
            counts={{ out_of_form: 1, unsure: 2, in_form: 5 }}
            decorative
          />
        </section>
      </div>
    );
  }

  if (useBackend() && portfoliosLoading) {
    return (
      <div>
        <div className="px-4 pt-2 md:px-6">
          <div className="h-10 animate-pulse rounded-md bg-pe-surface" aria-hidden="true" />
        </div>
        <PortfolioPageSkeleton />
      </div>
    );
  }

  if (useBackend() && !lists.length) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-lg font-semibold text-pe-text">Create My Portfolio</p>
        <p className="mt-2 text-sm text-pe-text-secondary">
          Upload broker holdings in under 2 minutes. Form signals and PnL light up after your first
          import.
        </p>
        <button
          type="button"
          onClick={() => onCreatePortfolio?.() ?? onOpenProfile?.(ownerId)}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-pe-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-pe-accent-pressed"
        >
          Create / import my portfolio
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 pt-2 md:px-6">
        <UnderlineTabs
          tabs={lists.map((list) => ({ id: list.id, label: list.name }))}
          active={listId}
          onChange={(id) => {
            setListId(id);
            setContentTab('performance');
          }}
          trailing={
            !useBackend() ? (
              <div className="flex h-full shrink-0 items-center gap-1 pr-2">
                <button
                  type="button"
                  onClick={() => setWatchlistOpen(true)}
                  className="inline-flex h-full items-center gap-1 text-[15px] font-semibold text-pe-text-muted hover:text-pe-accent"
                >
                  <Plus className="h-4 w-4" />
                  New list
                </button>
              </div>
            ) : null
          }
        />
      </div>

      <section className="px-4 py-5 md:px-6">
        {metrics?.kind === 'portfolio' ? (
          <>
            <div>
              <div className="grid grid-cols-2 gap-x-3 sm:gap-x-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12px] font-semibold text-pe-text-muted">Invested Value</p>
                    <PortfolioKindMetaTags portfolio={activeList} />
                  </div>
                  <p className="mt-1 truncate text-[20px] font-bold tracking-tight tabular-nums text-pe-text sm:text-[24px]">
                    {formatInr(metrics.invested)}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[12px] font-semibold text-pe-text-muted">Current Value</p>
                  <p className="mt-1 truncate text-[20px] font-bold tracking-tight tabular-nums text-pe-text sm:text-[24px]">
                    {formatInr(metrics.totalValue)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-stretch gap-2 sm:gap-3">
                <PortfolioPnlCard
                  label="Total PnL"
                  amount={metrics.totalPnl}
                  pct={metrics.totalPnlPct}
                />
                <PortfolioPnlCard
                  label="1D PnL"
                  amount={metrics.todayPnl}
                  pct={metrics.todayPnlPct}
                />
              </div>
              {(activeList?.kind ?? 'live') !== 'watchlist' && false && onUpdateHoldings ? (
                <button
                  type="button"
                  onClick={() => onUpdateHoldings?.(activeList?.id ?? listId)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-pe-border bg-white py-2.5 text-sm font-semibold text-pe-text shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition hover:border-pe-accent hover:text-pe-accent sm:w-auto sm:px-4"
                >
                  <RefreshCw className="h-4 w-4" />
                  Update holdings
                </button>
              ) : null}
            </div>
          </>
        ) : null}

        <PortfolioSignalsSection
          counts={{
            out_of_form: formBuckets.out_of_form?.length ?? 0,
            unsure: formBuckets.unsure?.length ?? 0,
            in_form: formBuckets.in_form?.length ?? 0,
          }}
          activeFormId={formSheet}
          onSelect={setFormSheet}
        />
      </section>

      <UnderlineTabs tabs={CONTENT_TABS} active={contentTab} onChange={setContentTab} />

      {contentTab === 'performance' && (
        <HoldingsSummary
          holdings={holdingsRows}
          onSelectStock={onSelectStock}
          onSelectFund={onSelectFund}
          formByTicker={formByTicker}
        />
      )}
      {contentTab === 'news' && (
        newsLoading ? (
          <p className="px-6 py-14 text-center text-sm text-pe-text-secondary">Loading news…</p>
        ) : (
          <NewsFeed items={activity.news} />
        )
      )}
      {contentTab === 'corporate_actions' && (
        corpActionsLoading ? (
          <p className="px-6 py-14 text-center text-sm text-pe-text-secondary">
            Loading corporate actions…
          </p>
        ) : (
          <CorporateActionsList
            items={corporateActions}
            showTicker
            onSelectStock={onSelectStock}
          />
        )
      )}
      {contentTab === 'posts' && (
        postsLoading ? (
          <p className="px-6 py-14 text-center text-sm text-pe-text-secondary">Loading posts…</p>
        ) : (
          <PostsFeed items={activity.posts} onOpenProfile={onOpenProfile} onOpenPost={onOpenPost} />
        )
      )}

      <WatchlistModal
        open={watchlistOpen}
        onClose={() => setWatchlistOpen(false)}
        onSave={(payload) => {
          const created = addWatchlist(payload);
          setListId(created.id);
          setContentTab('performance');
        }}
      />

      {formSheet ? (
        <FormBucketSheet
          formId={formSheet}
          items={formBuckets[formSheet] ?? []}
          onClose={() => setFormSheet(null)}
          onSelectStock={(ticker, meta) => {
            setFormSheet(null);
            onSelectStock?.(ticker, meta);
          }}
          onSelectFund={(schemeCode) => {
            setFormSheet(null);
            onSelectFund?.(schemeCode);
          }}
        />
      ) : null}
    </div>
  );
}

const FORM_METRIC_ORDER = ['out_of_form', 'unsure', 'in_form'];
const CONTENT_TABS = [
  { id: 'performance', label: 'Performance' },
  { id: 'news', label: 'News' },
  { id: 'corporate_actions', label: 'Corporate Actions' },
  { id: 'posts', label: 'Posts' },
];

const CARD_SHADOW = 'shadow-[0_6px_24px_rgba(0,0,0,0.09),0_1px_3px_rgba(0,0,0,0.05)]';
const CARD_SHADOW_HOVER = 'hover:shadow-[0_12px_36px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.06)]';

function formatSignedInr(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const value = Number(amount);
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatInr(Math.abs(value), { compact: true })}`;
}

function PortfolioPnlCard({ label, amount, pct }) {
  const tone = amount ?? pct ?? 0;
  const amountText = formatSignedInr(amount);
  const pctText =
    pct != null && Number.isFinite(Number(pct))
      ? `${Number(pct) > 0 ? '+' : Number(pct) < 0 ? '-' : ''}${Math.abs(Number(pct)).toFixed(2)}%`
      : null;

  return (
    <div
      className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-[16px] bg-white px-3 py-3 ${CARD_SHADOW} sm:gap-3 sm:px-3.5 sm:py-3.5`}
    >
      <p className="min-w-0 max-w-[4.25rem] text-[12px] font-medium leading-snug text-pe-text-muted sm:max-w-[5.5rem]">
        {label}
      </p>
      <div className={`min-w-0 shrink-0 text-right tabular-nums ${pnlClass(tone)}`}>
        {pctText ? (
          <p className="text-[12px] font-semibold leading-none">{pctText}</p>
        ) : null}
        <p
          className={`truncate text-[15px] font-bold tracking-tight leading-none sm:text-[16px] ${
            pctText ? 'mt-1.5' : ''
          }`}
        >
          {amountText}
        </p>
      </div>
    </div>
  );
}

function PortfolioSignalsSection({ counts, activeFormId = null, onSelect = null, decorative = false }) {
  return (
    <div className="mt-5">
      <p className="text-[13px] font-semibold tracking-wide text-pe-text-muted">Signals</p>
      <div
        className={`mt-3 flex items-stretch gap-2${decorative ? ' pointer-events-none select-none blur-[3px]' : ''}`}
        aria-hidden={decorative || undefined}
      >
        {FORM_METRIC_ORDER.map((formId) => {
          const meta = FORM_META[formId];
          const count = counts?.[formId] ?? 0;
          const className = [
            // Grow equally across all widths; never shrink below label+icon (keeps "Out of Form" one line).
            'flex min-w-max flex-1 items-center gap-1.5 rounded-[16px] bg-white p-2 text-left',
            CARD_SHADOW,
            onSelect ? `transition ${CARD_SHADOW_HOVER}` : '',
          ]
            .filter(Boolean)
            .join(' ');

          const body = (
            <>
              <FormStatusIcon form={formId} className="h-8 w-8 shrink-0" />
              <div>
                <p className="text-[15px] font-bold tabular-nums leading-none text-pe-text">{count}</p>
                <p
                  className="mt-1.5 whitespace-nowrap text-[12px] font-medium leading-snug text-pe-text-muted"
                  title={meta.label}
                >
                  {meta.label}
                </p>
              </div>
            </>
          );

          if (onSelect) {
            return (
              <button key={formId} type="button" onClick={() => onSelect(formId)} className={className}>
                {body}
              </button>
            );
          }

          return (
            <div key={formId} className={className}>
              {body}
            </div>
          );
        })}
      </div>
      {!decorative && activeFormId && FORM_META[activeFormId]?.description ? (
        <p className="mt-3 text-[12px] leading-snug text-pe-text-secondary">
          {FORM_META[activeFormId].description}
        </p>
      ) : null}
    </div>
  );
}

function FormBucketSheet({ formId, items, onClose, onSelectStock, onSelectFund }) {
  const meta = FORM_META[formId];
  // Icon (20px) + gap (8px) so body copy and list align under the heading.
  const bodyAlign = 'pl-7';

  return (
    <AppModalOverlay open onClose={onClose} label={meta.label} panelClassName="max-w-md">
      <div className="sticky top-0 border-b border-[var(--fv-border,#ececec)] bg-white px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <FormStatusIcon form={formId} className="h-5 w-5 shrink-0" />
            <p className="truncate text-[15px] font-semibold text-pe-text">{meta.label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-pe-text-secondary hover:bg-black/[0.04]"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        {meta.description ? (
          <p className={`mt-1.5 text-xs leading-snug text-pe-text-secondary ${bodyAlign}`}>
            {meta.description}
          </p>
        ) : null}
        <p className={`mt-1 text-xs text-pe-text-muted ${bodyAlign}`}>
          {items.length} {items.length === 1 ? 'security' : 'securities'}
        </p>
      </div>

      {items.length === 0 ? (
        <p className={`px-4 py-10 text-sm text-pe-text-secondary ${bodyAlign}`}>
          No securities in this category yet.
        </p>
      ) : (
        <div className={`divide-y divide-[var(--fv-border,#ececec)] ${bodyAlign} pr-4`}>
          {items.map((item) => {
            const isFund =
              item.assetType === 'fund' || /^\d{6,}$/.test(String(item.ticker ?? '').trim());
            return (
              <button
                key={item.ticker}
                type="button"
                onClick={() => {
                  if (isFund) {
                    if (onSelectFund) onSelectFund(item.ticker);
                    else onSelectStock?.(item.ticker, { assetType: 'fund' });
                    return;
                  }
                  onSelectStock?.(item.ticker, { assetType: item.assetType });
                }}
                className="flex w-full items-center justify-between gap-3 py-3.5 pl-0 pr-0 text-left transition hover:bg-black/[0.03]"
              >
                <p className="truncate text-[15px] font-semibold text-pe-text">
                  {item.name || holdingDisplayLabel(item)}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </AppModalOverlay>
  );
}
