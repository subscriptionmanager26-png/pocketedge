import { useMemo, useState, useEffect } from 'react';
import { ArrowDown, ArrowUp, Plus, Sparkles, X } from 'lucide-react';
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
import { holdingDisplayLabel } from '../lib/portfolioAssetUniverse';
import { addWatchlist, getWatchlists, subscribeWatchlists } from '../lib/watchlistStore';
import { PortfolioPageSkeleton } from '../components/PortfolioSkeletons';
import { fetchUserPortfolios } from '../lib/socialPortfolioApi';
import { getAppCurrentUserId } from '../lib/socialIdentity';
import { isSupabaseConfigured } from '../lib/supabase';
import { isDevMockMode } from '../lib/appMode';
import { fetchStockNewsForTickers, fetchCorporateActionsForTickers, isStockNewsConfigured } from '../lib/stockNewsApi';
import { ASSET_POSTS_DAYS, loadPostsMentioning } from '../lib/assetDiscussions';
import CorporateActionsList from '../components/CorporateActionsList';
import { skipAuthForDev } from '../lib/sessionStore';
import { fetchPortfolioFormByTicker, FORM_META } from '../lib/portfolioForm';
import {
  PortfolioKindMetaTags,
  PortfolioSourceAttribution,
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
  const [remotePortfolios, setRemotePortfolios] = useState([]);
  const [portfoliosLoading, setPortfoliosLoading] = useState(false);
  const [formByTicker, setFormByTicker] = useState({});
  const [formSheet, setFormSheet] = useState(null);

  const ownerId = getAppCurrentUserId();

  useEffect(() => subscribeWatchlists(() => setWatchlistTick((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;

    if (useBackend()) {
      setPortfoliosLoading(true);
      fetchUserPortfolios(ownerId)
        .then((rows) => {
          if (!cancelled) setRemotePortfolios(rows.filter((p) => !p.isDraft));
        })
        .catch(() => {
          if (!cancelled) setRemotePortfolios([]);
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

  const holdingsRows = useMemo(() => {
    if (!activeList) return [];
    const metrics = computePortfolioDisplayMetrics(activeList);
    const holdings = metrics.holdings ?? [];
    const totalValue = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0);
    return holdings
      .map((h) => ({
        ...h,
        weight: totalValue > 0 ? ((h.value ?? 0) / totalValue) * 100 : 0,
      }))
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  }, [activeList]);

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
    if (!formItems.length) {
      setFormByTicker({});
      return undefined;
    }

    let cancelled = false;
    fetchPortfolioFormByTicker(formItems).then((map) => {
      if (!cancelled) setFormByTicker(map);
    });

    return () => {
      cancelled = true;
    };
  }, [formItems]);

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
  }, [tickers]);

  useEffect(() => {
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
  }, [tickers]);

  useEffect(() => {
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
  }, [mentionKeys, tickers]);

  const activity = useMemo(() => {
    const base = collectActivity(tickers);
    return {
      ...base,
      news: isStockNewsConfigured() || !isDevMockMode() ? portfolioNews : base.news,
      posts: useBackend() || !isDevMockMode() ? portfolioPosts : base.posts,
      trades: [],
    };
  }, [tickers, portfolioNews, portfolioPosts]);

  useEffect(() => {
    if (contentTab === 'trades') setContentTab('posts');
  }, [contentTab]);
  const metrics = useMemo(() => {
    if (!activeList) return null;
    if (activeList.kind === 'portfolio' || activeList.kind === 'watchlist') {
      return computePortfolioDisplayMetrics(activeList);
    }
    return computePortfolioDisplayMetrics({
      ...activeList,
      kind: 'portfolio',
      holdings: MY_PORTFOLIO.holdings,
    });
  }, [activeList]);

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
            <PortfolioSourceAttribution
              portfolio={activeList}
              onSeeOriginal={onOpenSourcePortfolio}
            />
            <div className="grid grid-cols-2 gap-x-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-semibold text-pe-text-muted">Current Value</p>
                  <PortfolioKindMetaTags portfolio={activeList} />
                </div>
                <p className="mt-1 text-[28px] font-bold tracking-tight tabular-nums text-pe-text">
                  {formatInr(metrics.totalValue)}
                </p>
                <PortfolioDeltaLine
                  amount={metrics.todayPnl}
                  pct={metrics.todayPnlPct}
                  suffix="today"
                />
              </div>
              <div className="min-w-0 text-right">
                <p className="text-[13px] font-semibold text-pe-text-muted">Initial Invested</p>
                <p className="mt-1 text-[28px] font-bold tracking-tight tabular-nums text-pe-text">
                  {formatInr(metrics.invested)}
                </p>
                <PortfolioDeltaLine
                  amount={metrics.totalPnl}
                  pct={metrics.totalPnlPct}
                  suffix="total"
                  align="right"
                />
              </div>
            </div>
          </>
        ) : null}

        <div className="mt-5 grid grid-cols-3 items-stretch gap-2">
          {FORM_METRIC_ORDER.map((formId) => {
            const meta = FORM_META[formId];
            const count = formBuckets[formId]?.length ?? 0;
            const selected = formSheet === formId;
            return (
              <button
                key={formId}
                type="button"
                onClick={() => setFormSheet(formId)}
                className={`flex h-full min-w-0 flex-col rounded-[12px] border bg-white px-2.5 py-2.5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)] transition hover:border-pe-border-strong hover:shadow-[0_2px_4px_rgba(0,0,0,0.1),0_6px_16px_rgba(0,0,0,0.08)] ${
                  selected ? 'border-pe-accent' : 'border-pe-border'
                }`}
              >
                <div className="flex min-w-0 items-center gap-1">
                  <FormStatusIcon form={formId} className="h-3.5 w-3.5 shrink-0" />
                  <p
                    className="truncate text-[10px] font-bold uppercase tracking-[0.04em] text-pe-text-muted"
                    title={meta.label}
                  >
                    {meta.label}
                  </p>
                </div>
                <p className="mt-1.5 text-[17px] font-bold tabular-nums leading-none text-pe-text">
                  {count}
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

        {/* Return period picker hidden for now - default 1D only.
        <div className="mt-5 flex gap-1 rounded-lg bg-pe-surface p-1">
          {['1D', '1W', '1M', '1Y'].map((per) => (
            <button key={per} type="button" className="flex-1 rounded-md py-2 text-sm font-semibold">
              {per}
            </button>
          ))}
        </div>
        */}
      </section>

      <UnderlineTabs tabs={CONTENT_TABS} active={contentTab} onChange={setContentTab} />

      {contentTab === 'summary' && <PortfolioSummaryComingSoon portfolioName={activeList?.name} />}
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
  { id: 'summary', label: 'Summary' },
  { id: 'performance', label: 'Performance' },
  { id: 'news', label: 'News' },
  { id: 'corporate_actions', label: 'Corporate Actions' },
  { id: 'posts', label: 'Posts' },
];

function formatDeltaAmount(n) {
  if (n == null || Number.isNaN(n)) return '-';
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${Math.round(abs).toLocaleString('en-IN')}`;
}

function PortfolioDeltaLine({ amount, pct, suffix, align = 'left' }) {
  const tone = amount ?? pct ?? 0;
  const up = tone > 0;
  const down = tone < 0;
  const Icon = up ? ArrowUp : down ? ArrowDown : null;
  const amountText = formatDeltaAmount(amount);
  const pctText =
    pct != null && Number.isFinite(Number(pct))
      ? `${Math.abs(Number(pct)).toFixed(Math.abs(Number(pct)) >= 10 ? 0 : 1)}%`
      : null;

  return (
    <p
      className={`mt-1.5 inline-flex items-center gap-0.5 text-[13px] font-semibold tabular-nums ${
        align === 'right' ? 'justify-end' : ''
      } ${pnlClass(tone)}`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} /> : null}
      <span>
        {amountText}
        {pctText ? ` ( ${pctText} )` : ''} {suffix}
      </span>
    </p>
  );
}

function PortfolioComingSoonCard({ title, description, showIcon = false }) {
  return (
    <div className="px-4 py-10">
      <div className="rounded-2xl border border-pe-border bg-pe-surface px-5 py-8 text-center">
        {showIcon ? (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pe-accent-wash">
            <Sparkles className="h-5 w-5 text-pe-accent" aria-hidden="true" />
          </div>
        ) : null}
        <p className={`text-[11px] font-bold uppercase tracking-[0.08em] text-pe-accent ${showIcon ? 'mt-4' : ''}`}>
          Coming soon
        </p>
        <h3 className="mt-2 text-lg font-semibold text-pe-text">{title}</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-pe-text-secondary">
          {description}
        </p>
        <p className="mx-auto mt-4 max-w-xs text-xs text-pe-text-muted">
          We&apos;re building this now. You&apos;ll see it here once it&apos;s ready.
        </p>
      </div>
    </div>
  );
}

function PortfolioSummaryComingSoon({ portfolioName }) {
  return (
    <PortfolioComingSoonCard
      showIcon
      title="AI portfolio summary"
      description={
        portfolioName ? (
          <>
            A concise AI read on <span className="font-semibold text-pe-text">{portfolioName}</span>
            {' '}
            - allocation, recent moves, and what to watch.
          </>
        ) : (
          'A concise AI read on your holdings - allocation, recent moves, and what to watch.'
        )
      }
    />
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
