import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, ExternalLink } from 'lucide-react';
import PageHeader from './PageHeader';
import Avatar from './Avatar';
import NewsList from './NewsList';
import CorporateActionsList from './CorporateActionsList';
import GuestSignInCta from './GuestSignInCta';
import { DiscussionsList, HoldersList } from './InvestmentSections';
import { getPersonSync, resolvePeople } from '../lib/socialIdentity';
import { formatNewsDate } from '../lib/format';
import {
  formatInsightChange,
  isInsightForToday,
  pickLatestInsight,
  splitCorporateActions,
} from '../lib/assetDetailHelpers';
import { fetchAssetHolders, holderDisplayLabel } from '../lib/assetHoldersApi';
import { loadPostsMentioning } from '../lib/assetDiscussions';
import {
  fetchCorporateActions,
  fetchStockExplanations,
  fetchStockNews,
  isStockNewsConfigured,
} from '../lib/stockNewsApi';
import { isDevMockMode } from '../lib/appMode';

const NewsSummaryMarkdown = lazy(() => import('./NewsSummaryMarkdown'));

const PREVIEW_COUNT = 4;

const RAIL_CARD =
  'flex h-full w-[min(260px,78vw)] min-w-[min(260px,78vw)] shrink-0 flex-col overflow-hidden rounded-xl border border-pe-border bg-white p-3.5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]';

const RAIL_SCROLL =
  'flex gap-3 overflow-x-auto px-4 pb-3 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

function MarkdownFallback() {
  return <p className="text-sm text-pe-text-muted">Loading…</p>;
}

function SectionBlock({ title, actionLabel, onAction, children }) {
  return (
    <section className="border-b border-pe-border py-5 last:border-b-0">
      <div className="mb-3 flex items-center justify-between gap-3 px-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-pe-text">{title}</h2>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-pe-accent hover:underline"
          >
            {actionLabel}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EmptyRail({ message }) {
  return <p className="px-4 text-[13px] leading-relaxed text-pe-text-secondary">{message}</p>;
}

function LoadingRail() {
  return <p className="px-4 text-[13px] text-pe-text-secondary">Loading…</p>;
}

function PanelBackHeader({ assetLabel, onBack, desktopOnly = false }) {
  return (
    <PageHeader desktopOnly={desktopOnly}>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-pe-text-secondary hover:text-pe-text"
      >
        <ArrowLeft className="h-4 w-4" />
        {assetLabel || 'Back'}
      </button>
    </PageHeader>
  );
}

function InsightRailCard({ insight, onOpen }) {
  if (!insight) return null;
  const change = formatInsightChange(insight);
  const dateLabel = formatNewsDate(insight.asOfDate || insight.publishedAt) || '';
  const preview = String(insight.summary ?? '')
    .replace(/[#*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <button type="button" onClick={() => onOpen?.(insight)} className={RAIL_CARD}>
      {dateLabel ? (
        <p className="text-[12px] font-medium text-pe-text-muted">{dateLabel}</p>
      ) : null}
      <p className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug text-pe-text">
        {insight.title || dateLabel || 'Insight'}
      </p>
      {preview ? (
        <p className="mt-2 line-clamp-3 flex-1 text-[12px] leading-relaxed text-pe-text-secondary">
          {preview}
        </p>
      ) : (
        <div className="flex-1" />
      )}
      {change ? (
        <p className={`mt-3 text-[13px] font-semibold tabular-nums ${change.className}`}>
          {change.text}
        </p>
      ) : null}
    </button>
  );
}

function PostRailCard({ post, onOpenProfile, enrichmentTick = 0 }) {
  void enrichmentTick;
  const author = getPersonSync(post.authorId) ?? {
    id: post.authorId,
    name: 'Member',
    handle: 'member',
    avatar: 'M',
  };

  return (
    <button
      type="button"
      onClick={() => onOpenProfile?.(post.authorId)}
      className={RAIL_CARD}
    >
      <div className="flex items-center gap-2">
        <Avatar person={author} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-pe-text">{author.name}</p>
          <p className="truncate text-[11px] text-pe-text-muted">@{author.handle}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-4 flex-1 text-[13px] leading-relaxed text-pe-text">
        {post.body}
      </p>
      <p className="mt-3 text-[11px] font-semibold text-pe-accent">
        {(post.comments ?? []).length}{' '}
        {(post.comments ?? []).length === 1 ? 'reply' : 'replies'}
        {(post.likes ?? 0) > 0 ? ` · ${post.likes} likes` : ''}
      </p>
    </button>
  );
}

function HolderRailCard({ holder, onOpenProfile, onOpenPortfolio, enrichmentTick = 0 }) {
  void enrichmentTick;
  const userId = holder.userId ?? holder;
  const person = getPersonSync(userId) ?? {
    id: userId,
    name: holder.displayName || holder.firstName || 'Member',
    handle: 'member',
    avatarUrl: holder.avatarUrl ?? null,
    avatar: (holder.displayName || holder.firstName || 'M').charAt(0).toUpperCase(),
  };
  const label = holderDisplayLabel(holder, person);
  const portfolioName = holder.portfolioName?.trim() || 'Portfolio';
  const extra = Number(holder.extraPortfolios) || 0;
  const subtitle = extra > 0 ? `${portfolioName} +${extra}` : portfolioName;

  return (
    <button
      type="button"
      onClick={() => {
        if (holder.portfolioId && onOpenPortfolio) {
          onOpenPortfolio(userId, holder.portfolioId);
          return;
        }
        onOpenProfile?.(userId);
      }}
      className={`${RAIL_CARD} justify-center`}
    >
      <Avatar person={{ ...person, name: label, avatarUrl: holder.avatarUrl ?? person.avatarUrl }} />
      <p className="mt-3 truncate text-[15px] font-semibold text-pe-text">{label}</p>
      <p className="mt-1 truncate text-[12px] text-pe-text-muted">{subtitle}</p>
    </button>
  );
}

function NewsRailCard({ item, onOpen }) {
  const date = formatNewsDate(item.publishedAt) || item.time || '';
  return (
    <button type="button" onClick={() => onOpen?.(item)} className={RAIL_CARD}>
      <p className="line-clamp-3 text-[15px] font-semibold leading-snug text-pe-text">
        {item.title}
      </p>
      {date ? <p className="mt-auto pt-3 text-[12px] text-pe-text-muted">{date}</p> : null}
    </button>
  );
}

function CorporateActionRailCard({ item, onOpen }) {
  if (!item) return null;
  const title = item.details?.trim() || item.eventType;
  return (
    <button type="button" onClick={() => onOpen?.(item)} className={RAIL_CARD}>
      <p className="line-clamp-3 text-[15px] font-semibold leading-snug text-pe-text">{title}</p>
      {item.displayDate ? (
        <p className="mt-auto pt-3 text-[12px] text-pe-text-muted">
          {item.dateLabel ? `${item.dateLabel}: ` : ''}
          {item.displayDate}
        </p>
      ) : null}
      {item.documentUrl ? (
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-pe-text-secondary">
          Document <ExternalLink className="h-3 w-3" />
        </span>
      ) : null}
    </button>
  );
}

export function AssetInsightsView({
  assetLabel,
  insights,
  loading,
  onBack,
  initialMode = 'today',
  panelBackDesktopOnly = false,
}) {
  const latest = pickLatestInsight(insights);
  const [mode, setMode] = useState(() =>
    initialMode === 'archives' || !latest ? 'archives' : 'today'
  );

  const archives = useMemo(() => {
    if (!insights?.length) return [];
    if (!latest) return insights;
    return insights.filter((item) => item.id !== latest.id);
  }, [insights, latest]);

  const showToday = mode === 'today' && latest;
  const change = latest ? formatInsightChange(latest) : null;

  return (
    <div>
      <PanelBackHeader
        assetLabel={assetLabel}
        onBack={onBack}
        desktopOnly={panelBackDesktopOnly}
      />

      <div className="border-b border-pe-border px-4 pb-3 pt-2">
        <h1 className="text-[20px] font-semibold tracking-tight text-pe-text">Insights</h1>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('today')}
            disabled={!latest}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
              mode === 'today'
                ? 'border-pe-text bg-pe-text text-pe-canvas'
                : 'border-pe-border bg-pe-canvas text-pe-text-secondary hover:border-pe-border-strong'
            } disabled:opacity-40`}
          >
            {latest && isInsightForToday(latest) ? 'Today' : 'Latest'}
          </button>
          <button
            type="button"
            onClick={() => setMode('archives')}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
              mode === 'archives'
                ? 'border-pe-text bg-pe-text text-pe-canvas'
                : 'border-pe-border bg-pe-canvas text-pe-text-secondary hover:border-pe-border-strong'
            }`}
          >
            Archives
          </button>
        </div>
      </div>

      {loading ? (
        <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">Loading insights…</p>
      ) : showToday ? (
        <div className="px-4 py-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[15px] font-semibold text-pe-text">
              {formatNewsDate(latest.asOfDate || latest.publishedAt) || latest.title}
            </p>
            {change ? (
              <p className={`shrink-0 text-[15px] font-semibold tabular-nums ${change.className}`}>
                {change.text}
              </p>
            ) : null}
          </div>
          <div className="mt-4">
            <Suspense fallback={<MarkdownFallback />}>
              <NewsSummaryMarkdown content={latest.summary} />
            </Suspense>
          </div>
        </div>
      ) : !insights.length ? (
        <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
          No insights yet for {assetLabel || 'this security'}.
        </p>
      ) : (
        <div className="pb-8">
          {!archives.length && latest ? (
            <div className="px-4 py-5">
              <NewsList items={[latest]} />
            </div>
          ) : (
            <NewsList items={archives.length ? archives : insights} />
          )}
        </div>
      )}
    </div>
  );
}

export function AssetCorporateActionsView({
  assetLabel,
  upcoming,
  past,
  loading,
  onBack,
  preferPast = false,
  panelBackDesktopOnly = false,
}) {
  const [mode, setMode] = useState(() =>
    preferPast || !upcoming.length ? 'previous' : 'upcoming'
  );

  return (
    <div>
      <PanelBackHeader
        assetLabel={assetLabel}
        onBack={onBack}
        desktopOnly={panelBackDesktopOnly}
      />

      <div className="border-b border-pe-border px-4 pb-3 pt-2">
        <h1 className="text-[20px] font-semibold tracking-tight text-pe-text">
          Corporate actions
        </h1>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('upcoming')}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
              mode === 'upcoming'
                ? 'border-pe-text bg-pe-text text-pe-canvas'
                : 'border-pe-border bg-pe-canvas text-pe-text-secondary hover:border-pe-border-strong'
            }`}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={() => setMode('previous')}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
              mode === 'previous'
                ? 'border-pe-text bg-pe-text text-pe-canvas'
                : 'border-pe-border bg-pe-canvas text-pe-text-secondary hover:border-pe-border-strong'
            }`}
          >
            Previous
          </button>
        </div>
      </div>

      {loading ? (
        <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
          Loading corporate actions…
        </p>
      ) : mode === 'upcoming' ? (
        upcoming.length ? (
          <CorporateActionsList items={upcoming} />
        ) : (
          <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
            No upcoming corporate actions.
          </p>
        )
      ) : past.length ? (
        <CorporateActionsList items={past} />
      ) : (
        <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
          No previous corporate actions.
        </p>
      )}
    </div>
  );
}

function AssetListPanel({ title, assetLabel, onBack, panelBackDesktopOnly = false, children }) {
  return (
    <div>
      <PanelBackHeader
        assetLabel={assetLabel}
        onBack={onBack}
        desktopOnly={panelBackDesktopOnly}
      />
      <div className="border-b border-pe-border px-4 pb-3 pt-2">
        <h1 className="text-[20px] font-semibold tracking-tight text-pe-text">{title}</h1>
      </div>
      <div className="pb-8">{children}</div>
    </div>
  );
}

/**
 * Stacked sections with horizontal card rails for any security detail page.
 */
export default function AssetDetailSections({
  kind = 'stock',
  assetKey,
  mentionKeys,
  assetLabel,
  guestMode = false,
  showCorporateActions = false,
  mockDiscussions = null,
  mockNews = null,
  holdersKind = 'stock',
  supportsHolders = true,
  supportsNews = true,
  supportsInsights = true,
  onOpenProfile,
  onOpenPortfolio,
  onPanelChange,
  shellOwnsMobileBack = false,
}) {
  const [panel, setPanel] = useState(null);
  const [corpPreferPast, setCorpPreferPast] = useState(false);
  const [insightsInitialMode, setInsightsInitialMode] = useState('today');

  const setActivePanel = (next, options = {}) => {
    if (next === 'insights' && options.insightsMode) {
      setInsightsInitialMode(options.insightsMode);
    }
    if (next === 'corporate_actions' && options.preferPast != null) {
      setCorpPreferPast(Boolean(options.preferPast));
    }
    setPanel(next);
    onPanelChange?.(next, {
      close: () => {
        setCorpPreferPast(false);
        setPanel(null);
        onPanelChange?.(null, { close: null });
      },
    });
  };

  const [insights, setInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(Boolean(supportsInsights));
  const [posts, setPosts] = useState(() =>
    isDevMockMode() && Array.isArray(mockDiscussions) ? mockDiscussions : []
  );
  const [postsLoading, setPostsLoading] = useState(false);
  const [holders, setHolders] = useState([]);
  const [holdersLoading, setHoldersLoading] = useState(Boolean(supportsHolders));
  const [news, setNews] = useState(() =>
    isDevMockMode() && Array.isArray(mockNews) ? mockNews : []
  );
  const [newsLoading, setNewsLoading] = useState(false);
  const [corporateActions, setCorporateActions] = useState([]);
  const [corpLoading, setCorpLoading] = useState(Boolean(showCorporateActions));
  const [postEnrichTick, setPostEnrichTick] = useState(0);
  const [holderEnrichTick, setHolderEnrichTick] = useState(0);
  const [newsSheetItem, setNewsSheetItem] = useState(null);

  const keys = useMemo(() => {
    const list = mentionKeys?.length ? mentionKeys : [assetKey];
    return [...new Set(list.map((k) => String(k ?? '').trim()).filter(Boolean))];
  }, [mentionKeys, assetKey]);

  useEffect(() => {
    if (!supportsInsights) {
      setInsights([]);
      setInsightsLoading(false);
      return undefined;
    }
    if (!isStockNewsConfigured() || kind === 'fund') {
      setInsights([]);
      setInsightsLoading(false);
      return undefined;
    }
    if (kind !== 'stock' && kind !== 'etf') {
      setInsights([]);
      setInsightsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setInsightsLoading(true);
    fetchStockExplanations(assetKey, { limit: 90 })
      .then((items) => {
        if (!cancelled) setInsights(items);
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assetKey, kind, supportsInsights]);

  useEffect(() => {
    let cancelled = false;
    if (isDevMockMode() && Array.isArray(mockDiscussions)) {
      setPosts(mockDiscussions);
      return undefined;
    }
    setPostsLoading(true);
    loadPostsMentioning(keys)
      .then((rows) => {
        if (!cancelled) setPosts(rows);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      })
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [keys, mockDiscussions]);

  useEffect(() => {
    if (!supportsHolders) {
      setHolders([]);
      setHoldersLoading(false);
      return undefined;
    }
    let cancelled = false;
    setHoldersLoading(true);
    fetchAssetHolders(assetKey, { kind: holdersKind })
      .then((rows) => {
        if (!cancelled) setHolders(rows);
      })
      .catch(() => {
        if (!cancelled) setHolders([]);
      })
      .finally(() => {
        if (!cancelled) setHoldersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assetKey, holdersKind, supportsHolders]);

  useEffect(() => {
    if (!supportsNews) {
      setNews([]);
      setNewsLoading(false);
      return undefined;
    }
    if (isDevMockMode() && Array.isArray(mockNews)) {
      setNews(mockNews);
      return undefined;
    }
    if (!isStockNewsConfigured() || (kind !== 'stock' && kind !== 'etf')) {
      setNews(Array.isArray(mockNews) ? mockNews : []);
      return undefined;
    }

    let cancelled = false;
    setNewsLoading(true);
    fetchStockNews(assetKey)
      .then((items) => {
        if (!cancelled) setNews(items);
      })
      .finally(() => {
        if (!cancelled) setNewsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assetKey, kind, mockNews, supportsNews]);

  useEffect(() => {
    if (!showCorporateActions) {
      setCorporateActions([]);
      setCorpLoading(false);
      return undefined;
    }
    if (!isStockNewsConfigured()) {
      setCorporateActions([]);
      setCorpLoading(false);
      return undefined;
    }
    let cancelled = false;
    setCorpLoading(true);
    fetchCorporateActions(assetKey)
      .then((items) => {
        if (!cancelled) setCorporateActions(items);
      })
      .finally(() => {
        if (!cancelled) setCorpLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assetKey, showCorporateActions]);

  useEffect(() => {
    const ids = [...new Set((posts ?? []).map((p) => p?.authorId).filter(Boolean).map(String))];
    if (!ids.length) return undefined;
    let cancelled = false;
    resolvePeople(ids)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPostEnrichTick((n) => n + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [posts]);

  useEffect(() => {
    const ids = [
      ...new Set((holders ?? []).map((h) => h?.userId ?? h).filter(Boolean).map(String)),
    ];
    if (!ids.length) return undefined;
    let cancelled = false;
    resolvePeople(ids)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHolderEnrichTick((n) => n + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [holders]);

  const latestInsight = pickLatestInsight(insights);
  const { upcoming, past, next: nextCorp } = useMemo(
    () => splitCorporateActions(corporateActions),
    [corporateActions]
  );

  const previewPosts = posts.slice(0, PREVIEW_COUNT);
  const previewHolders = holders.slice(0, PREVIEW_COUNT);
  const previewNews = news.slice(0, PREVIEW_COUNT);

  const corpActionLabel = nextCorp ? 'See more' : past.length ? 'See previous' : null;
  // When the app shell owns mobile back, hide in-panel back on small screens.
  const panelBackDesktopOnly = Boolean(shellOwnsMobileBack);

  if (panel === 'insights') {
    return (
      <AssetInsightsView
        assetLabel={assetLabel}
        insights={insights}
        loading={insightsLoading}
        initialMode={insightsInitialMode}
        panelBackDesktopOnly={panelBackDesktopOnly}
        onBack={() => setActivePanel(null)}
      />
    );
  }

  if (panel === 'corporate_actions') {
    return (
      <AssetCorporateActionsView
        assetLabel={assetLabel}
        upcoming={upcoming}
        past={past}
        loading={corpLoading}
        preferPast={corpPreferPast}
        panelBackDesktopOnly={panelBackDesktopOnly}
        onBack={() => {
          setCorpPreferPast(false);
          setActivePanel(null);
        }}
      />
    );
  }

  if (panel === 'posts') {
    return (
      <AssetListPanel
        title="Posts"
        assetLabel={assetLabel}
        panelBackDesktopOnly={panelBackDesktopOnly}
        onBack={() => setActivePanel(null)}
      >
        {guestMode ? (
          <GuestSignInCta action="join discussions" showExploreHint={false} />
        ) : (
          <DiscussionsList
            posts={posts}
            onOpenProfile={onOpenProfile}
            emptyMessage="No posts yet — mentions of this security will show up here."
          />
        )}
      </AssetListPanel>
    );
  }

  if (panel === 'holders') {
    return (
      <AssetListPanel
        title="Holders"
        assetLabel={assetLabel}
        panelBackDesktopOnly={panelBackDesktopOnly}
        onBack={() => setActivePanel(null)}
      >
        <HoldersList
          holders={holders}
          loading={holdersLoading}
          onOpenProfile={guestMode ? undefined : onOpenProfile}
          onOpenPortfolio={guestMode ? undefined : onOpenPortfolio}
          emptyMessage="No disclosed holders yet."
        />
        {guestMode ? (
          <GuestSignInCta action="follow holders and open portfolios" showExploreHint={false} />
        ) : null}
      </AssetListPanel>
    );
  }

  if (panel === 'news') {
    return (
      <AssetListPanel
        title="News"
        assetLabel={assetLabel}
        panelBackDesktopOnly={panelBackDesktopOnly}
        onBack={() => setActivePanel(null)}
      >
        {news.length ? (
          <NewsList items={news} />
        ) : (
          <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">No recent news.</p>
        )}
      </AssetListPanel>
    );
  }

  return (
    <div className="pb-6">
      <SectionBlock
        title="Insights"
        actionLabel={insights.length > 1 ? 'Archives' : latestInsight ? 'See more' : null}
        onAction={
          latestInsight
            ? () =>
                setActivePanel('insights', {
                  insightsMode: insights.length > 1 ? 'archives' : 'today',
                })
            : undefined
        }
      >
        {insightsLoading ? (
          <LoadingRail />
        ) : latestInsight ? (
          <div className={RAIL_SCROLL}>
            <div className="h-[168px]">
              <InsightRailCard
                insight={latestInsight}
                onOpen={() => setActivePanel('insights', { insightsMode: 'today' })}
              />
            </div>
          </div>
        ) : (
          <EmptyRail message={`No insights yet for ${assetLabel || 'this security'}.`} />
        )}
      </SectionBlock>

      <SectionBlock
        title="Posts"
        actionLabel={!guestMode && posts.length > PREVIEW_COUNT ? 'See more' : null}
        onAction={
          !guestMode && posts.length > PREVIEW_COUNT
            ? () => setActivePanel('posts')
            : undefined
        }
      >
        {guestMode ? (
          <div className="px-4">
            <GuestSignInCta action="join discussions" showExploreHint={false} />
          </div>
        ) : postsLoading ? (
          <LoadingRail />
        ) : previewPosts.length ? (
          <div className={RAIL_SCROLL}>
            {previewPosts.map((post) => (
              <div key={post.id} className="h-[188px]">
                <PostRailCard
                  post={post}
                  onOpenProfile={onOpenProfile}
                  enrichmentTick={postEnrichTick}
                />
              </div>
            ))}
          </div>
        ) : (
          <EmptyRail message="No posts yet — mentions of this security will show up here." />
        )}
      </SectionBlock>

      <SectionBlock
        title="Holders"
        actionLabel={
          supportsHolders && holders.length > PREVIEW_COUNT ? 'See more' : null
        }
        onAction={
          supportsHolders && holders.length > PREVIEW_COUNT
            ? () => setActivePanel('holders')
            : undefined
        }
      >
        {!supportsHolders ? (
          <EmptyRail message="No disclosed holders yet." />
        ) : holdersLoading ? (
          <LoadingRail />
        ) : previewHolders.length ? (
          <>
            <div className={RAIL_SCROLL}>
              {previewHolders.map((holder) => (
                <div
                  key={`${holder.userId ?? holder}:${holder.portfolioId ?? 'none'}`}
                  className="h-[148px]"
                >
                  <HolderRailCard
                    holder={holder}
                    enrichmentTick={holderEnrichTick}
                    onOpenProfile={guestMode ? undefined : onOpenProfile}
                    onOpenPortfolio={guestMode ? undefined : onOpenPortfolio}
                  />
                </div>
              ))}
            </div>
            {guestMode ? (
              <div className="mt-3 px-4">
                <GuestSignInCta
                  action="follow holders and open portfolios"
                  showExploreHint={false}
                />
              </div>
            ) : null}
          </>
        ) : (
          <EmptyRail message="No disclosed holders yet." />
        )}
      </SectionBlock>

      <SectionBlock
        title="News"
        actionLabel={supportsNews && news.length > PREVIEW_COUNT ? 'See more' : null}
        onAction={
          supportsNews && news.length > PREVIEW_COUNT
            ? () => setActivePanel('news')
            : undefined
        }
      >
        {!supportsNews ? (
          <EmptyRail message="No recent news." />
        ) : newsLoading ? (
          <LoadingRail />
        ) : previewNews.length ? (
          <div className={RAIL_SCROLL}>
            {previewNews.map((item) => (
              <div key={item.id} className="h-[140px]">
                <NewsRailCard item={item} onOpen={setNewsSheetItem} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyRail message="No recent news." />
        )}
      </SectionBlock>

      {showCorporateActions ? (
        <SectionBlock
          title="Corporate actions"
          actionLabel={corpActionLabel}
          onAction={
            corpActionLabel
              ? () =>
                  setActivePanel('corporate_actions', {
                    preferPast: !nextCorp,
                  })
              : undefined
          }
        >
          {corpLoading ? (
            <LoadingRail />
          ) : nextCorp ? (
            <div className={RAIL_SCROLL}>
              <div className="h-[148px]">
                <CorporateActionRailCard
                  item={nextCorp}
                  onOpen={() => {
                    if (nextCorp.documentUrl) {
                      window.open(nextCorp.documentUrl, '_blank', 'noopener,noreferrer');
                      return;
                    }
                    setActivePanel('corporate_actions', { preferPast: false });
                  }}
                />
              </div>
            </div>
          ) : (
            <EmptyRail message="No upcoming corporate actions." />
          )}
        </SectionBlock>
      ) : null}

      {newsSheetItem ? (
        <NewsSummarySheet item={newsSheetItem} onClose={() => setNewsSheetItem(null)} />
      ) : null}
    </div>
  );
}

function NewsSummarySheet({ item, onClose }) {
  const date = formatNewsDate(item.publishedAt) || item.time || '';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border border-pe-border bg-pe-canvas"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-pe-border bg-pe-canvas px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold leading-snug text-pe-text">{item.title}</p>
            {date ? <p className="mt-1 text-sm text-pe-text-muted">{date}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-pe-text-secondary hover:bg-pe-surface"
          >
            Close
          </button>
        </div>
        <div className="px-4 py-4">
          <Suspense fallback={<MarkdownFallback />}>
            <NewsSummaryMarkdown content={item.summary} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
