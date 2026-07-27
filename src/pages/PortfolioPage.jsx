import { useMemo, useState, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
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
import { holdingDisplayLabel, resolvePortfolioAssets, assetsFromHoldings, holdingsNeedClientResolve } from '../lib/portfolioAssetUniverse';
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
  onSelectStock,
  onSelectFund,
  onOpenProfile,
  onOpenPost,
  onOpenSourcePortfolio,
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

      fetchUserPortfolios(ownerId)
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
  }, [ownerId, portfolioTick]);

  const watchlists = useMemo(() => getWatchlists(), [watchlistTick]);

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

  useEffect(() => {
    let cancelled = false;
    if (!holdingKeys.length) {
      setAssetsByKey({});
      return undefined;
    }

    // Paint immediately from server-enriched holdings, then refresh gaps (quotes and/or logos).
    setAssetsByKey(assetsFromHoldings(activeList?.holdings));
    if (!holdingsNeedClientResolve(activeList?.holdings)) return undefined;

    resolvePortfolioAssets(holdingKeys).then((resolved) => {
      if (cancelled) return;
      setAssetsByKey((prev) => ({
        ...prev,
        ...Object.fromEntries(resolved.entries()),
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [holdingKeys, activeList?.holdings]);

  const refreshPortfolioAssets = useCallback(async () => {
    if (!holdingKeys.length) return;
    const batch = await lookupMarketAssetsBatch(holdingKeys);
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
        tick();
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
  }, [holdingKeys, refreshPortfolioAssets]);

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
    if (!tickers.length) {
      setPortfolioNews([]);
      return undefined;
    }

    if (isStockNewsConfigured()) {
      let cancelled = false;
      setNewsLoading(true);
      fetchStockNewsForTickers(tickers)
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
      setPortfolioNews(collectActivity(tickers).news);
      return undefined;
    }

    setPortfolioNews([]);
    return undefined;
  }, [tickers, contentTab]);

  useEffect(() => {
    if (contentTab !== 'corporate_actions') return undefined;
    if (!tickers.length) {
      setCorporateActions([]);
      return undefined;
    }

    if (!isStockNewsConfigured()) {
      setCorporateActions([]);
      return undefined;
    }

    let cancelled = false;
    setCorpActionsLoading(true);
    fetchCorporateActionsForTickers(tickers)
      .then((items) => {
        if (!cancelled) setCorporateActions(items);
      })
      .finally(() => {
        if (!cancelled) setCorpActionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tickers, contentTab]);

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

  if (useBackend() && portfoliosLoading) {
    return (
      <div>
        <PageHeader>
          <div className="h-10 animate-pulse rounded-md bg-pe-surface" aria-hidden="true" />
        </PageHeader>
        <PortfolioPageSkeleton />
      </div>
    );
  }

  if (useBackend() && !lists.length) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-lg font-semibold text-pe-text">No portfolios yet</p>
        <p className="mt-2 text-sm text-pe-text-secondary">
          Add a portfolio from your profile to track holdings here.
        </p>
        <button
          type="button"
          onClick={() => onOpenProfile?.(ownerId)}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-pe-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-pe-accent-pressed"
        >
          Go to profile
        </button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader>
        <UnderlineTabs
          embedded
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
      </PageHeader>

      <section className="border-b border-pe-border px-4 py-5">
        {metrics?.kind === 'portfolio' ? (
          <>
            <div>
              <div className="grid grid-cols-2 gap-x-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12px] font-semibold text-pe-text-muted">Current Value</p>
                    <PortfolioKindMetaTags portfolio={activeList} />
                  </div>
                  <p className="mt-1 text-[24px] font-bold tracking-tight tabular-nums text-pe-text">
                    {formatInr(metrics.totalValue)}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[12px] font-semibold text-pe-text-muted">Initial Investment</p>
                  <p className="mt-1 text-[24px] font-bold tracking-tight tabular-nums text-pe-text">
                    {formatInr(metrics.invested)}
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-[12px] border border-pe-border bg-white px-3 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col gap-1.5">
                  <PortfolioDeltaLine
                    label="Total PnL"
                    amount={metrics.totalPnl}
                    pct={metrics.totalPnlPct}
                  />
                  <PortfolioDeltaLine
                    label="Day's PnL"
                    amount={metrics.todayPnl}
                    pct={metrics.todayPnlPct}
                  />
                </div>
              </div>
            </div>
          </>
        ) : null}

        <div className="mt-5 rounded-[12px] border border-pe-border bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)]">
          <p className="text-[15px] font-semibold uppercase tracking-[0.04em] text-pe-text-muted">
            Signals
          </p>
          <div className="mt-2.5 grid grid-cols-3 items-stretch gap-2">
            {FORM_METRIC_ORDER.map((formId) => {
              const meta = FORM_META[formId];
              const count = formBuckets[formId]?.length ?? 0;
              return (
                <button
                  key={formId}
                  type="button"
                  onClick={() => setFormSheet(formId)}
                  className="flex h-full min-w-0 flex-col rounded-[12px] border border-transparent bg-white px-2.5 py-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.05),0_2px_8px_rgba(0,0,0,0.06)] transition hover:shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.08)]"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <FormStatusIcon form={formId} className="h-3.5 w-3.5 shrink-0" />
                    <p className="text-[15px] font-bold tabular-nums leading-none text-pe-text">
                      {count}
                    </p>
                  </div>
                  <p
                    className="mt-1.5 min-w-0 text-[12px] font-semibold uppercase leading-snug tracking-[0.04em] text-pe-text-muted"
                    title={meta.label}
                  >
                    {meta.label}
                  </p>
                </button>
              );
            })}
          </div>
          {formSheet && FORM_META[formSheet]?.description ? (
            <p className="mt-2.5 text-[12px] leading-snug text-pe-text-secondary">
              {FORM_META[formSheet].description}
            </p>
          ) : null}
        </div>
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

function formatSignedInr(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const value = Number(amount);
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatInr(Math.abs(value), { compact: true })}`;
}

function PortfolioDeltaLine({ label, amount, pct }) {
  const tone = amount ?? pct ?? 0;
  const amountText = formatSignedInr(amount);
  const pctText =
    pct != null && Number.isFinite(Number(pct))
      ? `${Math.abs(Number(pct)).toFixed(2)}%`
      : null;

  return (
    <div className="flex w-full items-baseline justify-between gap-3 text-[12px] font-semibold">
      <p className="shrink-0 text-pe-text-muted">{label}</p>
      <p className={`min-w-0 text-right tabular-nums ${pnlClass(tone)}`}>
        {amountText}
        {pctText ? ` (${pctText})` : ''}
      </p>
    </div>
  );
}

function FormBucketSheet({ formId, items, onClose, onSelectStock, onSelectFund }) {
  const meta = FORM_META[formId];
  // Icon (20px) + gap (8px) so body copy and list align under the heading.
  const bodyAlign = 'pl-7';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-pe-border bg-pe-canvas sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 border-b border-pe-border bg-pe-canvas px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <FormStatusIcon form={formId} className="h-5 w-5 shrink-0" />
              <p className="truncate text-[15px] font-semibold text-pe-text">{meta.label}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-pe-text-secondary hover:bg-pe-surface"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
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
          <div className={`divide-y divide-pe-border ${bodyAlign} pr-4`}>
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
                  className="flex w-full items-center justify-between gap-3 py-3.5 pl-0 pr-0 text-left transition hover:bg-pe-surface"
                >
                  <p className="truncate text-[15px] font-semibold text-pe-text">
                    {item.name || holdingDisplayLabel(item)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
