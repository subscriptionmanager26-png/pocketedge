import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ClipboardCheck,
  Copy,
  Pencil,
  Plus,
  Share2,
  Trash2,
  X,
  RefreshCw,
} from 'lucide-react';
import PostCard from '../components/PostCard';
import ProfileHero from '../components/ProfileHero';
import FollowListView from '../components/FollowListView';
import UnderlineTabs from '../components/UnderlineTabs';
import { isDevMockMode } from '../lib/appMode';
import {
  CURRENT_USER,
  POSTS,
  copyPortfolioForUser,
  computePortfolioDisplayMetrics,
} from '../data/mockData';
import {
  discardLocalDraft,
  createDraftPortfolio,
  fetchUserPortfolio,
  fetchUserPortfolios,
  fetchPublicPortfolioShare,
  fetchPublicUserPortfolios,
  peekUserPortfolios,
  saveSocialPortfolio,
  isLocalDraftId,
} from '../lib/socialPortfolioApi';
import { updateSocialProfile, fetchProfileHeader } from '../lib/socialProfileApi';
import {
  getAppCurrentUser,
  getAppCurrentUserId,
  getHandleForUserIdSync,
  peekPerson,
  rememberPerson,
  resolvePerson,
} from '../lib/socialIdentity';
import { usePostEnrichment } from '../lib/usePostEnrichment';
import { isFollowing, toggleFollow, getFollowCounts, subscribeSocialGraph, hydrateFollowGraph } from '../lib/socialGraphStore';
import { formatCount } from '../lib/format';
import GuestSignInCta from '../components/GuestSignInCta';
import UpdateHoldingsSheet from '../components/UpdateHoldingsSheet';
import HoldingsSaveDiffSheet from '../components/HoldingsSaveDiffSheet';
import AppMessageDialog from '../components/AppMessageDialog';
import {
  holdingIsin,
  previewPortfolioImportMerge,
} from '../lib/portfolioImportMerge';
import { resolvePortfolioAssets, assetsFromHoldings, holdingsNeedClientResolve } from '../lib/portfolioAssetUniverse';
import AssetLogo from '../components/AssetLogo';
import PortfolioShareSheet from '../components/PortfolioShareSheet';
import {
  PortfoliosListSkeleton,
  PortfolioHoldingsSkeleton,
} from '../components/PortfolioSkeletons';
import { ProfilePageSkeleton } from '../components/PageSkeletons';
import { fetchInfluencingAmount } from '../lib/influencingApi';
import { peekInfluencingCache, writeProfileGraphCache } from '../lib/tabCache';
import { markTabDataReady, markTabPaint } from '../lib/perfMarks';
import {
  confirmPortfolioCopy,
  getPortfolioEngagementSync,
  subscribePortfolioEngagement,
  togglePortfolioCopy,
} from '../lib/portfolioEngagementApi';
import {
  PORTFOLIO_NAME_MAX_LENGTH,
  QTY_MAX_DECIMALS,
  WATCHLIST_BASE_INVESTMENT,
  buildLiveHoldings,
  buildWatchlistHoldings,
  fieldClass,
  findPublishedLivePortfolio,
  formatPortfolioSaveValidationMessage,
  isWatchlistKind,
  livePortfolioDisplayName,
  patchLiveCostFields,
  portfolioHasDraftWork,
  sanitizeDecimalInput,
  summarizeHoldingsChange,
  truncatePortfolioName,
  validatePortfolioDraft,
} from '../lib/portfolioEdit';
import PortfolioAssetSearchField from '../components/PortfolioAssetSearchField';
import { parseZerodhaHoldingsScreenshots } from './onboarding/onboardingHoldings';
import { parseZerodhaHoldingsWorkbook } from './onboarding/zerodhaHoldingsWorkbook';
import {
  PortfolioKindMetaTags,
} from '../components/PortfolioMetaTag';

const PROFILE_TABS = [
  { id: 'portfolios', label: 'Portfolio' },
  { id: 'watchlists', label: 'Watchlists' },
  { id: 'posts', label: 'Posts' },
];

const RETURN_PERIODS = ['1D', '1W', '1M', '1Y'];
const RETURN_PERIOD_LABELS = {
  '1D': '1D',
  '1W': '1W',
  '1M': '1M',
  '1Y': '1Y',
};
const RETURN_PERIOD_KEY = 'pe_profile_return_period';

function getStoredReturnPeriod() {
  try {
    const stored = localStorage.getItem(RETURN_PERIOD_KEY);
    if (RETURN_PERIODS.includes(stored)) return stored;
  } catch {
    /* ignore */
  }
  return '1M';
}

const inputClass =
  'w-full rounded-lg border border-pe-border-strong bg-pe-canvas px-3 py-2 text-[15px] text-pe-text outline-none focus:border-pe-accent focus:ring-1 focus:ring-pe-accent';

function Field({ label, children }) {
  return (
    <div>
      <label className="text-sm font-semibold text-pe-text-muted">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export default function ProfilePage({
  mode = 'own',
  userId = CURRENT_USER.id,
  guestMode = false,
  posts,
  selectedPortfolioId,
  startUpdateHoldings = false,
  onUpdateHoldingsConsumed,
  initialPerson = null,
  onSelectPortfolio,
  onClearPortfolio,
  onBack,
  onOpenPublicPreview,
  onExitPublicPreview,
  onOpenProfile,
  onOpenPost,
  onOpenStock,
  onGraphChange,
  onMobileHeaderActionsChange,
  onHideMobileActivityChange,
  onRegisterPortfolioBackHandler,
  onOpenSourcePortfolio,
  onFollowListModeChange,
  onRegisterFollowListBackHandler,
  onRequireSignIn,
}) {
  const appUser = getAppCurrentUser();
  const isOwn = mode === 'own';
  const [person, setPerson] = useState(() => {
    if (initialPerson && String(initialPerson.id) === String(userId)) return initialPerson;
    if (isOwn) return appUser;
    return peekPerson(userId);
  });
  const isMePublic = !isOwn && person?.id === appUser.id;
  const canEdit = isOwn && !isMePublic;

  const [tab, setTab] = useState('portfolios');
  const [portfolioVersion, setPortfolioVersion] = useState(0);
  const [portfolios, setPortfolios] = useState([]);
  const [portfoliosLoading, setPortfoliosLoading] = useState(false);
  const [portfolioSocialTick, setPortfolioSocialTick] = useState(0);
  /** 'edit' | 'update' — opens full-page editor from inline listing actions */
  const [pendingEditorAction, setPendingEditorAction] = useState(null);
  /** Stay on PortfolioDetailView until back — don't bounce when the update-holdings one-shot clears. */
  const [forcePortfolioEditor, setForcePortfolioEditor] = useState(false);
  const [returnPeriod, setReturnPeriod] = useState(getStoredReturnPeriod);
  const [influencingAmount, setInfluencingAmount] = useState(() => {
    const cached = peekInfluencingCache(userId);
    return cached ?? '< 1 Cr';
  });

  useEffect(() => {
    markTabPaint('profile');
  }, []);

  const bumpPortfolios = () => setPortfolioVersion((v) => v + 1);

  const [bio, setBio] = useState(CURRENT_USER.bio ?? '');
  const [following, setFollowingState] = useState(false);
  const [followListMode, setFollowListMode] = useState(null);

  useEffect(() => {
    onFollowListModeChange?.(followListMode);
    if (followListMode) {
      onRegisterFollowListBackHandler?.(() => setFollowListMode(null));
    } else {
      onRegisterFollowListBackHandler?.(null);
    }
    return () => {
      onFollowListModeChange?.(null);
      onRegisterFollowListBackHandler?.(null);
    };
  }, [
    followListMode,
    onFollowListModeChange,
    onRegisterFollowListBackHandler,
  ]);
  const [graphTick, setGraphTick] = useState(0);

  useEffect(() => subscribeSocialGraph(() => setGraphTick((n) => n + 1)), []);
  useEffect(() => subscribePortfolioEngagement(() => setPortfolioSocialTick((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;
    if (initialPerson && String(initialPerson.id) === String(userId)) {
      setPerson(initialPerson);
    }
    const cached = peekPerson(userId);
    if (cached) setPerson(cached);

    resolvePerson(userId)
      .then((resolved) => {
        if (!cancelled && resolved) setPerson(resolved);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, mode, initialPerson]);

  useEffect(() => {
    if (!person?.id) return undefined;
    setFollowingState(isFollowing(person.id));
    let cancelled = false;
    hydrateFollowGraph(person.id)
      .then(() => {
        if (!cancelled) setFollowingState(isFollowing(person.id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [person?.id]);

  useEffect(() => {
    if (!person?.id) return undefined;
    if (guestMode) {
      let cancelled = false;
      setPortfoliosLoading(true);
      fetchPublicUserPortfolios(person.id)
        .then((rows) => {
          if (!cancelled) {
            setPortfolios(rows);
            markTabDataReady('profile', 'network');
          }
        })
        .catch(() => {
          if (!cancelled) setPortfolios([]);
        })
        .finally(() => {
          if (!cancelled) setPortfoliosLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }
    let cancelled = false;
    const cached = peekUserPortfolios(person.id);
    if (Array.isArray(cached) && cached.length) {
      setPortfolios(cached);
      setPortfoliosLoading(false);
    } else {
      setPortfoliosLoading(true);
    }
    fetchUserPortfolios(person.id)
      .then((rows) => {
        if (!cancelled) {
          setPortfolios(rows);
          markTabDataReady('profile', 'network');
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPortfoliosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [person?.id, portfolioVersion, guestMode]);

  useEffect(() => {
    if (!selectedPortfolioId) return undefined;
    if (!guestMode) {
      if (!person?.id) return undefined;
      if (portfolios.some((p) => p.id === selectedPortfolioId)) return undefined;
      let cancelled = false;
      fetchUserPortfolio(person.id, selectedPortfolioId)
        .then((row) => {
          if (!cancelled && row) setPortfolios((prev) => [...prev, row]);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }

    if (portfolios.some((p) => p.id === selectedPortfolioId)) return undefined;
    let cancelled = false;
    setPortfoliosLoading(true);
    fetchPublicPortfolioShare(selectedPortfolioId)
      .then((share) => {
        if (cancelled || !share?.portfolio) return;
        if (share.ownerId && share.ownerHandle) {
          rememberPerson({
            id: share.ownerId,
            name: share.ownerName || share.ownerHandle,
            handle: share.ownerHandle,
          });
        }
        setPortfolios((prev) => {
          if (prev.some((p) => p.id === share.portfolio.id)) return prev;
          return [...prev, share.portfolio];
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPortfoliosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [person?.id, selectedPortfolioId, portfolios, portfolioVersion, guestMode]);

  useEffect(() => {
    if (!person || !isOwn) return;
    setBio(person.bio ?? '');
  }, [person, isOwn]);

  useEffect(() => {
    if (!person?.id) return undefined;
    const cached = peekInfluencingCache(person.id);
    if (cached != null) setInfluencingAmount(cached);
    let cancelled = false;

    fetchProfileHeader(person.id)
      .then((header) => {
        if (cancelled || !header) return;
        if (header.influencing != null) setInfluencingAmount(header.influencing);
        if (header.follow_counts) {
          writeProfileGraphCache(person.id, {
            counts: header.follow_counts,
            source: 'header',
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        fetchInfluencingAmount(person.id)
          .then((amount) => {
            if (!cancelled) setInfluencingAmount(amount);
          })
          .catch(() => {
            if (!cancelled) setInfluencingAmount('< 1 Cr');
          });
      });

    return () => {
      cancelled = true;
    };
  }, [person?.id, graphTick]);

  useEffect(() => {
    if (!isOwn && person?.id) {
      setFollowingState(isFollowing(person.id));
    }
  }, [person?.id, isOwn, isMePublic]);

  const authorPosts = (posts ?? (isDevMockMode() ? POSTS : [])).filter((p) => p.authorId === person?.id);
  const enrichmentTick = usePostEnrichment(authorPosts);
  const tabs = PROFILE_TABS;
  const publishedPortfolios = useMemo(
    () => portfolios.filter((p) => !p.isDraft),
    [portfolios]
  );
  const livePortfolio = useMemo(
    () => findPublishedLivePortfolio(publishedPortfolios),
    [publishedPortfolios]
  );
  const watchlistPortfolios = useMemo(
    () =>
      publishedPortfolios.filter((p) => isWatchlistKind(p.kind ?? 'live')),
    [publishedPortfolios]
  );

  const selectedPortfolio = useMemo(
    () => (selectedPortfolioId ? portfolios.find((p) => p.id === selectedPortfolioId) ?? null : null),
    [portfolios, selectedPortfolioId]
  );

  useEffect(() => {
    setTab('portfolios');
    setFollowListMode(null);
  }, [userId, mode]);

  useEffect(() => {
    if (!selectedPortfolioId) {
      setPendingEditorAction(null);
      setForcePortfolioEditor(false);
      return;
    }
    setFollowListMode(null);
    const selected = portfolios.find((p) => p.id === selectedPortfolioId);
    if (selected && isWatchlistKind(selected.kind ?? 'live')) {
      setTab('watchlists');
    } else {
      setTab('portfolios');
    }
  }, [selectedPortfolioId, portfolios]);

  useEffect(() => {
    if (!startUpdateHoldings || guestMode || !canEdit) return;
    setForcePortfolioEditor(true);
  }, [startUpdateHoldings, guestMode, canEdit]);

  const openPortfolioEditor = (portfolioId, action) => {
    if (!portfolioId) return;
    setPendingEditorAction(action);
    setForcePortfolioEditor(true);
    onSelectPortfolio?.(portfolioId, { updateHoldings: action === 'update' });
  };

  const followCounts = useMemo(() => {
    void graphTick;
    if (!person?.id) return { followers: 0, following: 0 };
    return getFollowCounts(person.id);
  }, [person?.id, graphTick]);

  if (!person) {
    return <ProfilePageSkeleton />;
  }

  const handleAddPortfolio = async () => {
    if (livePortfolio) {
      onSelectPortfolio?.(livePortfolio.id);
      return;
    }
    try {
      const created = await createDraftPortfolio(person.id, {
        kind: 'live',
        name: livePortfolioDisplayName(person.name),
      });
      setPortfolios((prev) => [created, ...prev]);
      bumpPortfolios();
      onSelectPortfolio?.(created.id);
    } catch (error) {
      window.alert(error?.message ?? 'Could not create portfolio.');
    }
  };

  const handleAddWatchlist = async (watchlistName) => {
    const name = truncatePortfolioName(String(watchlistName ?? '').trim());
    if (!name) return;
    try {
      const created = await createDraftPortfolio(person.id, {
        kind: 'watchlist',
        name,
      });
      setPortfolios((prev) => [created, ...prev]);
      bumpPortfolios();
      onSelectPortfolio?.(created.id);
    } catch (error) {
      window.alert(error?.message ?? 'Could not create watchlist.');
    }
  };

  const saveBio = async (nextBio) => {
    const updated = await updateSocialProfile({
      display_name: person.name,
      bio: nextBio,
      location: person.location ?? '',
      focus: person.focus ?? '',
    });
    setPerson((prev) =>
      prev
        ? {
            ...prev,
            bio: updated.bio ?? '',
          }
        : prev
    );
    setBio(updated.bio ?? '');
  };

  const handleReturnPeriodChange = (period) => {
    setReturnPeriod(period);
    try {
      localStorage.setItem(RETURN_PERIOD_KEY, period);
    } catch {
      /* ignore */
    }
  };

  const handleTabChange = (next) => {
    setTab(next);
    setFollowListMode(null);
  };

  if (followListMode) {
    return (
      <FollowListView
        userId={person.id}
        mode={followListMode}
        graphTick={graphTick}
        onBack={() => setFollowListMode(null)}
        onOpenProfile={onOpenProfile}
        onGraphChange={() => {
          setGraphTick((n) => n + 1);
          onGraphChange?.();
        }}
      />
    );
  }

  if (selectedPortfolioId && !selectedPortfolio) {
    if (guestMode && !portfoliosLoading) {
      return (
        <div className="px-4 py-16 text-center md:px-6">
          <p className="text-lg font-semibold text-pe-text">Portfolio unavailable</p>
          <p className="mt-2 text-sm text-pe-text-secondary">
            This shared portfolio may be private, archived, or no longer exists.
          </p>
        </div>
      );
    }
    return (
      <div className="px-4 py-6">
        <PortfolioHoldingsSkeleton rows={4} />
      </div>
    );
  }

  // Full-page editor only for drafts / Update holdings / Edit. Share links land on the
  // profile listing (inline book) so guests and visitors stay on the profile.
  const shouldOpenPortfolioEditor =
    Boolean(selectedPortfolio?.isDraft) ||
    pendingEditorAction != null ||
    Boolean(startUpdateHoldings) ||
    forcePortfolioEditor;

  if (selectedPortfolio && shouldOpenPortfolioEditor) {
    return (
      <PortfolioDetailView
        portfolio={selectedPortfolio}
        userId={person?.id}
        canEdit={canEdit}
        guestMode={guestMode}
        startUpdateHoldings={Boolean(startUpdateHoldings)}
        onUpdateHoldingsConsumed={() => {
          // Keep forcePortfolioEditor; only clear the one-shot App flag + update action tag.
          setPendingEditorAction((prev) => (prev === 'update' ? null : prev));
          onUpdateHoldingsConsumed?.();
        }}
        onPortfolioUpdated={(updated) => {
          if (updated) {
            setPortfolios((prev) => {
              const without = prev.filter(
                (p) =>
                  p.id !== updated.id &&
                  !(isLocalDraftId(p.id) && selectedPortfolioId && p.id === selectedPortfolioId)
              );
              return [updated, ...without];
            });
            // Stay in the editor after save; back still clears via selectedPortfolioId unset.
            return;
          }
          bumpPortfolios();
        }}
        onBack={onClearPortfolio}
        canCopy={false}
        returnPeriod={returnPeriod}
        onReturnPeriodChange={handleReturnPeriodChange}
        onMobileHeaderActionsChange={onMobileHeaderActionsChange}
        onHideMobileActivityChange={onHideMobileActivityChange}
        startInEditMode={
          (Boolean(selectedPortfolio.isDraft) || pendingEditorAction === 'edit') && !guestMode
        }
        onRegisterPortfolioBackHandler={onRegisterPortfolioBackHandler}
        onOpenStock={onOpenStock}
      />
    );
  }

  return (
    <div>
      <ProfileHero
        person={person}
        name={canEdit ? person.name : undefined}
        bio={canEdit ? bio : undefined}
        following={following}
        followerCount={followCounts.followers}
        followingCount={followCounts.following}
        influencingAmount={influencingAmount}
        canEditBio={canEdit}
        onSaveBio={saveBio}
        onOpenFollowers={() => setFollowListMode('followers')}
        onOpenFollowing={() => setFollowListMode('following')}
        onToggleFollow={async () => {
          if (onRequireSignIn) {
            onRequireSignIn();
            return;
          }
          const next = await toggleFollow(person.id);
          setFollowingState(next);
          onGraphChange?.();
        }}
        showFollowButton={!isOwn && !isMePublic}
      />

      <div className="sticky top-14 z-20 isolate border-b border-[var(--fv-border,#ececec)] bg-white md:top-0">
        <div className="flex h-12 items-center px-4 md:h-14 md:px-6">
          <UnderlineTabs
            embedded
            tabs={tabs}
            active={tab}
            onChange={handleTabChange}
          />
        </div>
      </div>

      {tab === 'posts' && (
        <div className="pt-1 md:pt-2">
          {authorPosts.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
              {isOwn
                ? 'Posts you compose will show up here with full position disclosure.'
                : 'No posts yet.'}
            </p>
          ) : (
            authorPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                variant="feed"
                enrichmentTick={enrichmentTick}
                onOpenProfile={onOpenProfile}
                onOpenPost={onOpenPost}
                onOpenStock={onOpenStock}
              />
            ))
          )}
        </div>
      )}

      {tab === 'portfolios' && (
        <PortfolioSectionPanel
          livePortfolio={livePortfolio}
          loading={portfoliosLoading}
          person={person}
          canEdit={canEdit}
          guestMode={guestMode}
          portfolioSocialTick={portfolioSocialTick}
          onAddPortfolio={handleAddPortfolio}
          onPortfolioCopied={bumpPortfolios}
          onOpenStock={onOpenStock}
          onUpdateHoldings={(id) => openPortfolioEditor(id, 'update')}
        />
      )}

      {tab === 'watchlists' && (
        <WatchlistsSectionPanel
          watchlists={watchlistPortfolios}
          loading={portfoliosLoading}
          person={person}
          canEdit={canEdit}
          guestMode={guestMode}
          portfolioSocialTick={portfolioSocialTick}
          onAddWatchlist={handleAddWatchlist}
          onPortfolioCopied={bumpPortfolios}
          onOpenStock={onOpenStock}
          onEditWatchlist={(id) => openPortfolioEditor(id, 'edit')}
        />
      )}
    </div>
  );
}

function InlinePortfolioBook({
  portfolio,
  person,
  canEdit,
  guestMode = false,
  canCopy = false,
  showUpdateHoldings = false,
  onUpdateHoldings,
  onPortfolioCopied,
  onOpenStock,
}) {
  const isWatchlist = isWatchlistKind(portfolio.kind ?? 'live');
  const social = getPortfolioEngagementSync(portfolio.id);
  const holdingCount =
    portfolio.holdings?.length || portfolio.tickers?.length || 0;
  const dayChangePct = useMemo(() => {
    if (!isWatchlist) return null;
    const pct = Number(computePortfolioDisplayMetrics(portfolio).todayPnlPct);
    return Number.isFinite(pct) ? pct : null;
  }, [portfolio, isWatchlist]);
  const displayName = isWatchlist
    ? portfolio.name
    : canEdit
      ? livePortfolioDisplayName(getAppCurrentUser()?.name || person?.name)
      : portfolio.name;

  return (
    <article className="border-b border-[var(--fv-border,#ececec)] last:border-b-0">
      <div className="px-4 pb-2 pt-5 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-2xl font-bold text-pe-text">{displayName}</h3>
          <PortfolioKindMetaTags portfolio={portfolio} />
        </div>

        {isWatchlist ? (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-pe-text-muted">
              1D change
            </p>
            <p
              className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${
                dayChangePct == null
                  ? 'text-pe-text'
                  : dayChangePct > 0
                    ? 'text-pe-positive'
                    : dayChangePct < 0
                      ? 'text-pe-negative'
                      : 'text-pe-text'
              }`}
            >
              {dayChangePct == null
                ? '—'
                : `${dayChangePct > 0 ? '+' : dayChangePct < 0 ? '−' : ''}${Math.abs(dayChangePct).toFixed(2)}%`}
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-pe-text-muted">
              Total holdings
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-pe-text">
              {holdingCount.toLocaleString('en-IN')}
            </p>
          </div>
        )}
      </div>

      {guestMode ? (
        <div className="pb-6 pt-1">
          <p className="px-4 text-[12px] font-bold uppercase tracking-[0.08em] text-pe-text-muted md:px-6">
            Holdings
          </p>
          <GuestSignInCta
            variant="hero"
            title="See the full book"
            description="Sign in to view holdings and weights on this shared portfolio."
            action="unlock holdings"
            showExploreHint={false}
            benefits={[
              'See every holding and weight',
              'Follow the investor’s next moves',
              'Share or copy this book',
            ]}
          />
        </div>
      ) : (
        <PortfolioHoldingsList portfolio={portfolio} onOpenStock={onOpenStock} />
      )}

      {!guestMode ? (
        <PortfolioSocialBar
          portfolio={portfolio}
          social={social}
          canCopy={canCopy}
          ownerUserId={person?.id}
          sourceOwnerId={person?.id}
          sourceOwnerName={canEdit ? undefined : person?.name}
          onPortfolioCopied={onPortfolioCopied}
          showUpdateHoldings={showUpdateHoldings}
          onUpdateHoldings={() => onUpdateHoldings?.(portfolio.id)}
        />
      ) : (
        <div className="border-t border-pe-border px-4 py-3 md:px-6">
          <p className="text-[13px] text-pe-text-secondary">
            Sign in to share, copy, or follow this book.
          </p>
        </div>
      )}
    </article>
  );
}

function PortfolioSectionPanel({
  livePortfolio,
  loading = false,
  person,
  canEdit,
  guestMode = false,
  portfolioSocialTick,
  onAddPortfolio,
  onPortfolioCopied,
  onOpenStock,
  onUpdateHoldings,
}) {
  void portfolioSocialTick;

  if (loading) {
    return (
      <div className="pt-1 md:pt-2">
        <PortfoliosListSkeleton count={1} />
      </div>
    );
  }

  if (!livePortfolio) {
    return (
      <div className="px-4 py-12 text-center md:px-6">
        <p className="text-lg font-semibold text-pe-text">
          {canEdit ? 'Create My Portfolio' : 'No portfolio published yet.'}
        </p>
        {canEdit ? (
          <>
            <p className="mt-2 text-sm text-pe-text-secondary">
              Upload broker holdings in under 2 minutes — Excel or screenshots from Zerodha.
            </p>
            <button
              type="button"
              onClick={onAddPortfolio}
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-pe-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-pe-accent-pressed"
            >
              Create / import my portfolio
            </button>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="pt-1 md:pt-2">
      <InlinePortfolioBook
        portfolio={livePortfolio}
        person={person}
        canEdit={canEdit}
        guestMode={guestMode}
        canCopy={!canEdit && !guestMode}
        showUpdateHoldings={canEdit}
        onUpdateHoldings={onUpdateHoldings}
        onPortfolioCopied={onPortfolioCopied}
        onOpenStock={onOpenStock}
      />
    </div>
  );
}

function WatchlistsSectionPanel({
  watchlists = [],
  loading = false,
  person,
  canEdit,
  guestMode = false,
  portfolioSocialTick,
  onAddWatchlist,
  onPortfolioCopied,
  onOpenStock,
  onEditWatchlist,
}) {
  void portfolioSocialTick;

  const [watchlistNameOpen, setWatchlistNameOpen] = useState(false);
  const [watchlistName, setWatchlistName] = useState('');
  const [creatingWatchlist, setCreatingWatchlist] = useState(false);

  const submitWatchlist = async () => {
    const name = watchlistName.trim();
    if (!name || creatingWatchlist) return;
    setCreatingWatchlist(true);
    try {
      await onAddWatchlist?.(name);
      setWatchlistName('');
      setWatchlistNameOpen(false);
    } finally {
      setCreatingWatchlist(false);
    }
  };

  if (loading) {
    return (
      <div className="pt-1 md:pt-2">
        <PortfoliosListSkeleton count={2} />
      </div>
    );
  }

  return (
    <div className="pt-1 md:pt-2">
      {watchlists.length ? (
        watchlists.map((portfolio) => (
          <InlinePortfolioBook
            key={portfolio.id}
            portfolio={portfolio}
            person={person}
            canEdit={canEdit}
            guestMode={guestMode}
            canCopy={!canEdit && !guestMode}
            showUpdateHoldings={canEdit}
            onUpdateHoldings={() => onEditWatchlist?.(portfolio.id)}
            onPortfolioCopied={onPortfolioCopied}
            onOpenStock={onOpenStock}
          />
        ))
      ) : (
        <div className="px-4 py-12 text-center md:px-6">
          <p className="text-lg font-semibold text-pe-text">
            {canEdit ? 'Create a watchlist' : 'No watchlists published yet.'}
          </p>
          {canEdit ? (
            <p className="mt-2 text-sm text-pe-text-secondary">
              Track ideas with weight targets — separate from your live portfolio.
            </p>
          ) : null}
        </div>
      )}

      {canEdit ? (
        <div className="px-4 pb-5 pt-3 md:px-6">
          {watchlistNameOpen ? (
            <div className="rounded-[20px] border border-[var(--fv-border,#ececec)] bg-white p-4 shadow-[0_6px_24px_rgba(0,0,0,0.05)]">
              <label className="block text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                Watchlist name
              </label>
              <input
                autoFocus
                value={watchlistName}
                maxLength={PORTFOLIO_NAME_MAX_LENGTH}
                onChange={(e) => setWatchlistName(truncatePortfolioName(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void submitWatchlist();
                  }
                  if (e.key === 'Escape') {
                    setWatchlistNameOpen(false);
                    setWatchlistName('');
                  }
                }}
                placeholder="e.g. Banks to watch"
                className="mt-2 w-full rounded-lg border border-pe-border bg-pe-canvas px-3 py-2.5 text-sm text-pe-text outline-none focus:border-pe-accent"
              />
              <p className="mt-1.5 text-[12px] text-pe-text-muted">
                {watchlistName.length}/{PORTFOLIO_NAME_MAX_LENGTH}
              </p>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWatchlistNameOpen(false);
                    setWatchlistName('');
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-pe-text-secondary hover:text-pe-text"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!watchlistName.trim() || creatingWatchlist}
                  onClick={() => void submitWatchlist()}
                  className="rounded-lg bg-pe-accent px-3.5 py-2 text-sm font-bold text-white hover:bg-pe-accent-pressed disabled:opacity-50"
                >
                  {creatingWatchlist ? 'Creating…' : 'Continue'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setWatchlistNameOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-[var(--fv-border,#ececec)] bg-white px-4 py-3.5 text-[13px] font-semibold text-pe-text-secondary shadow-[0_6px_24px_rgba(0,0,0,0.05)] transition hover:border-pe-accent hover:text-pe-accent"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Create watchlist
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PortfolioDetailView({
  portfolio,
  userId,
  canEdit,
  guestMode = false,
  startUpdateHoldings = false,
  onUpdateHoldingsConsumed,
  onPortfolioUpdated,
  onBack,
  canCopy = false,
  returnPeriod = '1M',
  onReturnPeriodChange,
  onMobileHeaderActionsChange,
  onHideMobileActivityChange,
  onRegisterPortfolioBackHandler,
  startInEditMode = false,
  onOpenStock,
}) {
  const isDraft = Boolean(portfolio.isDraft);
  const [editing, setEditing] = useState(startInEditMode);
  const [updateSheetOpen, setUpdateSheetOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(portfolio.name);
  const [objective, setObjective] = useState(portfolio.objective ?? '');
  const [thesis, setThesis] = useState(portfolio.thesis ?? '');
  const [portfolioKind, setPortfolioKind] = useState(portfolio.kind ?? 'live');
  const [editRows, setEditRows] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({ name: false, objective: false, thesis: false, rows: {} });
  const [importNotice, setImportNotice] = useState('');
  const [importingHoldings, setImportingHoldings] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [saveDiff, setSaveDiff] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [socialTick, setSocialTick] = useState(0);
  const editSessionRef = useRef(0);
  const editBaselineHoldingsRef = useRef([]);
  const excelInputRef = useRef(null);
  const screenshotInputRef = useRef(null);
  const saveEditsRef = useRef(async () => {});
  const cancelEditsRef = useRef(() => {});

  const isWatchlist = isWatchlistKind(portfolioKind);

  const watchlistDayChangePct = useMemo(() => {
    if (!isWatchlist) return null;
    const pct = Number(computePortfolioDisplayMetrics(portfolio).todayPnlPct);
    return Number.isFinite(pct) ? pct : null;
  }, [isWatchlist, portfolio]);

  useEffect(() => subscribePortfolioEngagement(() => setSocialTick((n) => n + 1)), []);

  const social = useMemo(
    () => getPortfolioEngagementSync(portfolio.id),
    [portfolio.id, socialTick]
  );

  useEffect(() => {
    if (editing) return;
    setName(portfolio.name);
    setObjective(portfolio.objective ?? '');
    setThesis(portfolio.thesis ?? '');
    setPortfolioKind(portfolio.kind ?? 'live');
    setFieldErrors({ name: false, objective: false, thesis: false, rows: {} });
    if (!startInEditMode) setEditing(false);
  }, [portfolio.id, portfolio.name, portfolio.objective, portfolio.thesis, portfolio.kind, startInEditMode, editing]);

  const makeRowId = () => `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const makeBlankRow = () => ({
    id: makeRowId(),
    ticker: '',
    name: '',
    isin: null,
    invested: '',
    qty: '',
    avg: '',
    weight: '',
  });

  const holdingToRow = (h) => {
    const rowId = makeRowId();
    const fundName =
      h.assetType === 'fund' || /^\d{6,}$/.test(String(h.ticker ?? ''))
        ? h.assetName ?? ''
        : '';
    if (isWatchlistKind(portfolio.kind)) {
      const weightPct =
        h.weightPct ??
        (() => {
          const total = (portfolio.holdings ?? []).reduce((sum, row) => sum + (row.value ?? 0), 0);
          return total > 0 ? ((h.value ?? 0) / total) * 100 : '';
        })();
      return {
        id: rowId,
        ticker: h.ticker,
        name: fundName,
        isin: holdingIsin(h.isin),
        weight: weightPct === '' ? '' : String(Number(weightPct).toFixed(1)),
        invested: '',
        qty: '',
        avg: '',
      };
    }
    const qty = Number(h.qty) || 0;
    return {
      id: rowId,
      ticker: h.ticker,
      name: fundName,
      isin: holdingIsin(h.isin),
      invested: '',
      qty: qty ? String(h.qty ?? '') : '',
      avg: '',
      weight: '',
    };
  };

  const buildEditRows = (kind = portfolioKind) => {
    const watchlist = isWatchlistKind(kind);
    const source = watchlist
      ? portfolio.holdings?.length
        ? portfolio.holdings
        : (portfolio.tickers ?? []).map((ticker) => ({ ticker }))
      : portfolio.holdings ?? [];
    const rows = source.map((h) =>
      watchlist
        ? {
            id: makeRowId(),
            ticker: h.ticker,
            name:
              h.assetType === 'fund' || /^\d{6,}$/.test(String(h.ticker ?? ''))
                ? h.assetName ?? ''
                : '',
          isin: holdingIsin(h.isin),
            weight:
              h.weightPct != null
                ? String(h.weightPct)
                : portfolio.tickers?.length
                  ? String((100 / portfolio.tickers.length).toFixed(1))
                  : '',
            invested: '',
            qty: '',
          }
        : holdingToRow(h)
    );
    return [...rows, makeBlankRow()];
  };

  const initEditRows = (kind = portfolioKind) => {
    editSessionRef.current += 1;
    setEditRows(buildEditRows(kind));
  };

  const startEditing = () => {
    editSessionRef.current += 1;
    const rows = buildEditRows(portfolioKind);
    editBaselineHoldingsRef.current = [...(portfolio.holdings ?? [])];
    setEditRows(rows);
    setFieldErrors({ name: false, objective: false, thesis: false, rows: {} });
    setImportNotice('');
    setEditing(true);
  };

  /** Listing "Update Holdings" → manual edit page (file upload is a secondary CTA there). */
  const enterHoldingsEdit = () => {
    if (!editing) startEditing();
  };

  /** Opens the Excel / screenshot upload sheet from the edit page. */
  const openFileUploader = () => {
    if (isWatchlistKind(portfolioKind)) return;
    if (!editing) startEditing();
    setUpdateSheetOpen(true);
  };

  useEffect(() => {
    if (!startUpdateHoldings || !canEdit || guestMode) return;
    if (isWatchlistKind(portfolio.kind ?? 'live')) {
      onUpdateHoldingsConsumed?.();
      return;
    }
    enterHoldingsEdit();
    onUpdateHoldingsConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once when flagged from routing
  }, [startUpdateHoldings, portfolio.id, canEdit, guestMode]);

  const applyImportedHoldings = async (importedRows, sourceLabel) => {
    const incoming = importedRows.filter((row) => String(row.ticker ?? '').trim());
    if (!incoming.length) {
      setImportNotice(`No usable holdings were found in the ${sourceLabel}.`);
      return;
    }

    setImportNotice('');
    setImportProgress((prev) => ({
      percent: Math.max(prev?.percent ?? 0, 85),
      current: prev?.current ?? 1,
      total: prev?.total ?? 1,
      fileName: prev?.fileName ?? '',
      label: 'Matching holdings…',
    }));
    try {
      const { merged, unmappedCount } = await previewPortfolioImportMerge({
        currentRows: editRows,
        importedRows: incoming,
        makeRowId,
      });
      setEditRows([...merged, makeBlankRow()]);
      setFieldErrors((previous) => ({ ...previous, rows: {} }));
      const unmappedText = unmappedCount
        ? ` ${unmappedCount} unmapped ${
            unmappedCount === 1 ? 'security was' : 'securities were'
          } kept for review.`
        : '';
      setImportNotice(
        `${sourceLabel} applied. Holdings not present in the import are highlighted in amber.${unmappedText}`
      );
    } catch (error) {
      setImportNotice(error?.message ?? `Could not read that ${sourceLabel}.`);
    }
  };

  const applyUpdateSheetRows = async (finalRows, meta) => {
    const nextRows = [
      ...finalRows.filter((row) => String(row.ticker ?? '').trim()),
      makeBlankRow(),
    ];
    setEditRows(nextRows);
    setFieldErrors((previous) => ({ ...previous, rows: {} }));
    setImportNotice('');
    await persistPortfolioRows(nextRows, {
      sourceLabel: meta?.sourceLabel ?? 'Import',
    });
  };

  const persistPortfolioRows = async (rows, { sourceLabel } = {}) => {
    if (saving) throw new Error('Save already in progress.');

    const validation = validatePortfolioDraft({
      kind: portfolioKind,
      name,
      objective,
      thesis,
      rows,
    });
    setFieldErrors(validation.errors);
    if (!validation.valid) {
      const message = formatPortfolioSaveValidationMessage(validation.errors, { isWatchlist });
      setSaveError({
        title: "Can't save yet",
        message,
      });
      throw new Error(message);
    }

    setSaving(true);
    try {
      const tickers = validation.completeRows.map((row) => row.ticker.trim());
      const assetsByKey = isWatchlist
        ? await resolvePortfolioAssets(tickers)
        : new Map();

      const holdings = isWatchlist
        ? buildWatchlistHoldings(validation.completeRows, assetsByKey)
        : buildLiveHoldings(validation.completeRows, assetsByKey);

      const liveName = livePortfolioDisplayName(getAppCurrentUser()?.name);
      const beforeHoldings = editBaselineHoldingsRef.current ?? [];
      const savedPortfolio = await saveSocialPortfolio(userId, portfolio.id, {
        name: isWatchlist ? truncatePortfolioName(name.trim()) : liveName,
        objective: '',
        thesis: '',
        kind: portfolioKind,
        isDraft: false,
        tickers: holdings.map((h) => h.ticker),
        holdings,
        ownerDisplayName: getAppCurrentUser()?.name,
        ...(isWatchlist ? { watchlistBaseInvestment: WATCHLIST_BASE_INVESTMENT } : {}),
      });
      if (!isWatchlist) setName(liveName);
      onPortfolioUpdated?.(savedPortfolio);
      setEditing(false);
      setEditRows([]);
      setFieldErrors({ name: false, objective: false, thesis: false, rows: {} });
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);

      if (!isWatchlist) {
        setSaveDiff({
          ...summarizeHoldingsChange(beforeHoldings, savedPortfolio?.holdings ?? holdings),
          sourceLabel: sourceLabel || null,
        });
      } else {
        onBack?.();
      }
    } catch (error) {
      console.error('Failed to save portfolio', error);
      setSaveError({
        title: "Couldn't save",
        message: error?.message ?? 'Could not save portfolio. Please try again.',
      });
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const importExcelHoldings = async (file) => {
    if (!file) return;
    setImportingHoldings(true);
    setImportNotice('');
    setImportProgress({
      percent: 12,
      current: 1,
      total: 1,
      fileName: file.name || '',
      label: 'Reading Excel file…',
    });
    try {
      const rows = await parseZerodhaHoldingsWorkbook(file);
      setImportProgress({
        percent: 55,
        current: 1,
        total: 1,
        fileName: file.name || '',
        label: 'Matching holdings…',
      });
      await applyImportedHoldings(rows, 'Zerodha Excel file');
      setImportProgress((prev) => (prev ? { ...prev, percent: 100, label: 'Done' } : null));
    } catch (error) {
      setImportNotice(error?.message ?? 'Could not read that Zerodha Excel file.');
    } finally {
      setImportingHoldings(false);
      setImportProgress(null);
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  const importScreenshotHoldings = async (files) => {
    const images = [...(files ?? [])];
    if (!images.length) return;
    setImportingHoldings(true);
    setImportNotice('');
    setImportProgress({
      percent: 0,
      current: 1,
      total: images.length,
      fileName: images[0]?.name || '',
      label: `Reading screenshot 1 of ${images.length}…`,
    });
    try {
      const rows = await parseZerodhaHoldingsScreenshots(images, {
        onProgress: (next) => {
          if (typeof next === 'number') {
            setImportProgress((prev) => ({
              ...(prev ?? { current: 1, total: images.length, fileName: '' }),
              percent: Math.min(84, Math.round(next * 0.85)),
              label: prev?.label ?? 'Reading screenshots…',
            }));
            return;
          }
          const current = next.current ?? 1;
          const total = next.total ?? images.length;
          setImportProgress({
            percent: Math.min(84, Math.round((next.percent ?? 0) * 0.85)),
            current,
            total,
            fileName: next.fileName ?? '',
            label: `Reading screenshot ${current} of ${total}…`,
          });
        },
      });
      await applyImportedHoldings(rows, 'holdings screenshot');
      setImportProgress((prev) => (prev ? { ...prev, percent: 100, label: 'Done' } : null));
    } catch (error) {
      setImportNotice(error?.message ?? 'Could not read those holdings screenshots.');
    } finally {
      setImportingHoldings(false);
      setImportProgress(null);
      if (screenshotInputRef.current) screenshotInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (startInEditMode) {
      editSessionRef.current += 1;
      const rows = buildEditRows(portfolio.kind ?? 'live');
      editBaselineHoldingsRef.current = [...(portfolio.holdings ?? [])];
      setEditRows(rows);
      setEditing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio.id, startInEditMode]);

  const saveEdits = async () => {
    try {
      await persistPortfolioRows(editRows);
    } catch {
      /* persistPortfolioRows already surfaces saveError */
    }
  };

  saveEditsRef.current = saveEdits;

  const discardAndExit = async (proceed) => {
    if (isDraft) {
      discardLocalDraft(userId, portfolio.id);
      onPortfolioUpdated?.();
      proceed();
      return;
    }
    setName(portfolio.name);
    setObjective(portfolio.objective ?? '');
    setThesis(portfolio.thesis ?? '');
    setPortfolioKind(portfolio.kind ?? 'live');
    setEditing(false);
    setEditRows([]);
    setFieldErrors({ name: false, objective: false, thesis: false, rows: {} });
    proceed();
  };

  const cancelEdits = () => {
    // Leave the editor and return to the profile page (portfolio deep links are retired).
    requestBack(() => {
      onBack?.();
    });
  };

  cancelEditsRef.current = cancelEdits;

  const requestBack = (proceed) => {
    if (saving) return;
    if (!editing && !isDraft) {
      proceed();
      return;
    }

    const validation = validatePortfolioDraft({
      kind: portfolioKind,
      name,
      objective,
      thesis,
      rows: editRows,
    });
    const hasWork = portfolioHasDraftWork({
      name,
      objective,
      thesis,
      rows: editRows,
      isWatchlist,
    });

    if (!hasWork && isDraft) {
      discardAndExit(proceed);
      return;
    }

    if (validation.valid) {
      const leave = window.confirm(
        'You have unsaved changes. Save is still required - discard your work and go back?'
      );
      if (leave) discardAndExit(proceed);
      return;
    }

    const leave = window.confirm(
      'Your portfolio is incomplete. Unless all mandatory fields are filled, your work will be discarded. Go back anyway?'
    );
    if (leave) discardAndExit(proceed);
  };

  useEffect(() => {
    if (!onRegisterPortfolioBackHandler) return undefined;
    onRegisterPortfolioBackHandler((proceed) => requestBack(proceed));
    return () => onRegisterPortfolioBackHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterPortfolioBackHandler, editing, isDraft, portfolioKind, name, objective, thesis, editRows]);

  useEffect(() => {
    if (!canEdit || !onMobileHeaderActionsChange) {
      onMobileHeaderActionsChange?.(null);
      onHideMobileActivityChange?.(false);
      return undefined;
    }

    onMobileHeaderActionsChange(
      editing ? (
        <PortfolioDetailMobileActions
          editing
          saved={saved}
          saving={saving}
          showUpdate={false}
          onCancel={() => {
            if (!saving) cancelEditsRef.current();
          }}
          onSave={() => {
            void saveEditsRef.current();
          }}
        />
      ) : (
        <PortfolioDetailMobileActions
          showUpdate
          onUpdate={isWatchlistKind(portfolioKind) ? startEditing : enterHoldingsEdit}
        />
      )
    );
    onHideMobileActivityChange?.(editing);

    return () => {
      onMobileHeaderActionsChange(null);
      onHideMobileActivityChange?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canEdit,
    editing,
    saved,
    saving,
    onMobileHeaderActionsChange,
    onHideMobileActivityChange,
    portfolio.kind,
    portfolioKind,
  ]);

  const updateRow = (rowId, patch) => {
    if (patch.ticker !== undefined) {
      editSessionRef.current += 1;
    }

    setEditRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        if (isWatchlist) return { ...row, ...patch };
        return patchLiveCostFields(row, patch);
      })
    );

    if (patch.ticker !== undefined) {
      setFieldErrors((prev) => {
        const rows = { ...prev.rows };
        if (!rows[rowId]) return prev;
        const next = { ...rows[rowId] };
        delete next.ticker;
        if (Object.keys(next).length) rows[rowId] = next;
        else delete rows[rowId];
        return { ...prev, rows };
      });
    }
  };

  const removeRow = (rowId) => {
    setEditRows((prev) => {
      const next = prev.filter((row) => row.id !== rowId);
      return next.length ? next : [makeBlankRow()];
    });
  };

  const addBlankRow = () => {
    setEditRows((prev) => [...prev, makeBlankRow()]);
  };

  const compactInputClass =
    'w-full min-w-0 rounded-md border border-pe-border-strong bg-pe-canvas px-2.5 py-2 text-base text-pe-text outline-none focus:border-pe-accent focus:ring-1 focus:ring-pe-accent md:text-[15px]';

  const rowGridClass = isWatchlist
    ? 'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2'
    : 'grid grid-cols-[minmax(0,1fr)_5.5rem_auto] items-start gap-2';

  return (
    <div>
      {canEdit ? (
        <div className="hidden items-center justify-end gap-2 px-4 py-3 md:flex md:px-6">
          {editing ? (
            <>
              <button
                type="button"
                onClick={cancelEdits}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-semibold text-pe-text-secondary hover:bg-pe-surface disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdits}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-md bg-pe-accent px-2.5 py-1.5 text-sm font-bold text-white hover:bg-pe-accent-pressed disabled:opacity-70"
              >
                {saved && !saving ? <Check className="h-3.5 w-3.5" /> : null}
                {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={isWatchlist ? startEditing : enterHoldingsEdit}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-semibold text-pe-text-secondary hover:bg-pe-surface hover:text-pe-accent"
            >
              <Pencil className="h-3.5 w-3.5" />
              Update Holdings
            </button>
          )}
        </div>
      ) : null}

      <div className="border-b border-pe-border px-4 py-5">
        {!editing ? (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold text-pe-text">
                {isWatchlist
                  ? portfolio.name
                  : canEdit
                    ? livePortfolioDisplayName(getAppCurrentUser()?.name)
                    : portfolio.name}
              </h2>
              <PortfolioKindMetaTags portfolio={portfolio} />
            </div>

            {isWatchlist ? (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-pe-text-muted">
                  1D change
                </p>
                <p
                  className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${
                    watchlistDayChangePct == null
                      ? 'text-pe-text'
                      : watchlistDayChangePct > 0
                        ? 'text-pe-positive'
                        : watchlistDayChangePct < 0
                          ? 'text-pe-negative'
                          : 'text-pe-text'
                  }`}
                >
                  {watchlistDayChangePct == null
                    ? '—'
                    : `${watchlistDayChangePct > 0 ? '+' : watchlistDayChangePct < 0 ? '−' : ''}${Math.abs(watchlistDayChangePct).toFixed(2)}%`}
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-pe-text-muted">
                  Total holdings
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-pe-text">
                  {(portfolio.holdings?.length || portfolio.tickers?.length || 0).toLocaleString(
                    'en-IN'
                  )}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-stretch gap-4">
            {isWatchlist ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
                    Watchlist
                  </p>
                  <PortfolioKindMetaTags portfolio={{ ...portfolio, kind: portfolioKind }} />
                </div>
                <Field label="Watchlist name">
                  <input
                    value={name}
                    maxLength={PORTFOLIO_NAME_MAX_LENGTH}
                    onChange={(e) => setName(truncatePortfolioName(e.target.value))}
                    className={fieldClass(inputClass, fieldErrors.name)}
                    placeholder="e.g. Banks to watch"
                  />
                  <p className="mt-1.5 text-[12px] text-pe-text-muted">
                    {String(name ?? '').length}/{PORTFOLIO_NAME_MAX_LENGTH}
                  </p>
                </Field>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-2xl font-bold text-pe-text">
                  {livePortfolioDisplayName(getAppCurrentUser()?.name)}
                </p>
                <PortfolioKindMetaTags portfolio={{ ...portfolio, kind: portfolioKind }} />
              </div>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div className="px-4 py-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
                Holdings
              </p>
              <p className="mt-1 text-sm text-pe-text-secondary">
                {isWatchlist
                  ? 'Search stocks, ETFs, or funds to track. Allocations default to equal weight.'
                  : 'Upload latest file or edit manually'}
              </p>
            </div>
          </div>

          {!isWatchlist ? (
            <div className="mt-5 rounded-lg border border-pe-border bg-pe-surface p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-pe-text">Import holdings</p>
                  <p className="mt-0.5 text-[12px] text-pe-text-muted">
                    Excel, screenshots, or CDSL / CAMS / KFin PDF statements.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={importingHoldings}
                  onClick={openFileUploader}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-pe-accent px-2.5 text-[12px] font-bold text-white hover:bg-pe-accent-pressed disabled:opacity-60"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Upload New File
                </button>
              </div>
              {importNotice ? (
                <p className="mt-3 text-[12px] leading-relaxed text-pe-text-secondary">{importNotice}</p>
              ) : null}
            </div>
          ) : null}

          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(event) => importExcelHoldings(event.target.files?.[0])}
          />
          <input
            ref={screenshotInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/*"
            multiple
            className="hidden"
            onChange={(event) => importScreenshotHoldings(event.target.files)}
          />

          <UpdateHoldingsSheet
            open={updateSheetOpen}
            currentRows={editRows}
            makeRowId={makeRowId}
            onClose={() => setUpdateSheetOpen(false)}
            onApply={applyUpdateSheetRows}
          />

          <div className="mt-4 space-y-2">
            <div className={`${rowGridClass} px-0.5`}>
              <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                Ticker
              </p>
              {isWatchlist ? null : (
                <p className="text-right text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                  Qty
                </p>
              )}
              <span className="h-4 w-9 shrink-0" aria-hidden="true" />
            </div>

            {editRows.map((row) => {
              const rowErr = fieldErrors.rows[row.id] ?? {};
              const usedTickers = editRows
                .filter((entry) => entry.id !== row.id)
                .map((entry) => entry.ticker.trim())
                .filter(Boolean);

              return (
                <div key={row.id} className="space-y-1">
                  <div
                    className={`${rowGridClass} ${
                      row.missingFromImport
                        ? 'rounded-md border border-amber-400 bg-amber-50/50 p-2'
                        : ''
                    }`}
                  >
                    <PortfolioAssetSearchField
                      value={row.name || row.ticker}
                      exclude={usedTickers}
                      placeholder="Search stock, ETF, or fund"
                      inputClassName={fieldClass(compactInputClass, rowErr.ticker)}
                      onValueChange={(next) =>
                        updateRow(row.id, { ticker: next.toUpperCase(), name: '' })
                      }
                      onSelect={(asset) =>
                        updateRow(row.id, {
                          ticker: asset.key,
                          name: asset.kind === 'fund' ? asset.name : asset.symbol ?? '',
                          isin: asset.isin ?? null,
                        })
                      }
                    />

                    {isWatchlist ? null : (
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={row.qty}
                        onChange={(e) =>
                          updateRow(row.id, {
                            qty: sanitizeDecimalInput(e.target.value, QTY_MAX_DECIMALS),
                          })
                        }
                        placeholder="Qty"
                        aria-label="Quantity"
                        className={fieldClass(
                          `${compactInputClass} text-right tabular-nums`,
                          rowErr.qty
                        )}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-pe-text-muted transition hover:bg-pe-surface hover:text-pe-negative"
                      aria-label="Delete holding row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {rowErr.ticker ? (
                    <p className="px-0.5 text-[12px] text-pe-negative">
                      {row.ticker.trim()
                        ? `${row.ticker.trim()} is not a valid stock, ETF, or fund - search to replace it.`
                        : 'Pick a stock, ETF, or fund from search results.'}
                    </p>
                  ) : null}
                  {row.missingFromImport ? (
                    <p className="px-0.5 text-[12px] font-medium text-amber-700">
                      Symbol not found in file
                    </p>
                  ) : null}
                </div>
              );
            })}

            <button
              type="button"
              onClick={addBlankRow}
              className="mt-1 inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm font-semibold text-pe-accent transition hover:bg-pe-accent-wash"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </div>
      ) : guestMode ? (
        <div className="pb-6 pt-1">
          <p className="px-4 text-[12px] font-bold uppercase tracking-[0.08em] text-pe-text-muted md:px-6">
            Holdings
          </p>
          <GuestSignInCta
            variant="hero"
            title="See the full book"
            description="Sign in to view holdings and weights on this shared portfolio."
            action="unlock holdings"
            showExploreHint={false}
            benefits={[
              'See every holding and weight',
              'Follow the investor’s next moves',
              'Share or copy this book',
            ]}
          />
        </div>
      ) : (
        <PortfolioHoldingsList portfolio={portfolio} onOpenStock={onOpenStock} />
      )}

      {!editing && !guestMode ? (
        <PortfolioSocialBar
          portfolio={portfolio}
          social={social}
          canCopy={canCopy}
          ownerUserId={userId}
        />
      ) : null}

      {saveDiff ? (
        <HoldingsSaveDiffSheet
          summary={saveDiff}
          onClose={() => {
            setSaveDiff(null);
            onBack?.();
          }}
        />
      ) : null}

      {saveError ? (
        <AppMessageDialog
          title={saveError.title}
          message={saveError.message}
          onClose={() => setSaveError(null)}
        />
      ) : null}
    </div>
  );
}

function PortfolioDetailMobileActions({
  editing = false,
  saved = false,
  saving = false,
  showUpdate = false,
  onUpdate,
  onEdit,
  onCancel,
  onSave,
}) {
  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        {showUpdate ? (
          <button
            type="button"
            onClick={onUpdate}
            disabled={saving}
            className="inline-flex h-10 items-center gap-1 rounded-full bg-white px-3 text-sm font-semibold text-[var(--fv-text-secondary)] shadow-[var(--fv-shadow)] transition hover:text-[var(--fv-text)] disabled:opacity-50"
            aria-label="Upload new file"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={2} />
            Upload
          </button>
        ) : null}
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex h-10 items-center gap-1 rounded-full bg-white px-3 text-sm font-semibold text-[var(--fv-text-secondary)] shadow-[var(--fv-shadow)] transition hover:text-[var(--fv-text)] disabled:opacity-50"
        >
          <X className="h-4 w-4" strokeWidth={2} />
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex h-10 items-center gap-1 rounded-full bg-[var(--fv-accent)] px-3.5 text-sm font-bold text-white shadow-[var(--fv-shadow)] transition hover:opacity-90 disabled:opacity-70"
        >
          {saved && !saving ? <Check className="h-4 w-4" strokeWidth={2} /> : null}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onUpdate}
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-semibold text-[var(--fv-text)] shadow-[var(--fv-shadow)] transition hover:opacity-90"
        aria-label="Update Holdings"
      >
        <Pencil className="h-4 w-4" strokeWidth={2} />
        Update Holdings
      </button>
    </div>
  );
}

function PortfolioSocialBar({
  portfolio,
  social,
  canCopy,
  ownerUserId,
  sourceOwnerId,
  sourceOwnerName,
  onPortfolioCopied,
  showUpdateHoldings = false,
  onUpdateHoldings,
}) {
  const [copied, setCopied] = useState(social.copied);
  const [copies, setCopies] = useState(social.copies);
  const [shares, setShares] = useState(social.shares);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    setCopied(social.copied);
    setCopies(social.copies);
    setShares(social.shares);
  }, [social.copied, social.copies, social.shares, portfolio.id]);

  const handleCopy = async () => {
    if (!canCopy) return;
    const wasCopied = copied;
    const next = togglePortfolioCopy(portfolio.id);
    setCopied(next.copied);
    setCopies(next.copies);
    if (!wasCopied) {
      try {
        const confirmed = await confirmPortfolioCopy(portfolio.id);
        if (confirmed.copied) {
          copyPortfolioForUser(getAppCurrentUserId(), portfolio, {
            sourceUserId: sourceOwnerId ?? ownerUserId,
            sourceUserName: sourceOwnerName,
          });
          onPortfolioCopied?.();
        }
      } catch (err) {
        console.error('confirmPortfolioCopy failed', err);
      }
    }
  };

  return (
    <div className="border-t border-pe-border px-4 py-3 md:px-6">
      <div className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 text-pe-text-secondary">
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="inline-flex h-8 items-center justify-start gap-1.5 rounded-lg text-[13px] font-medium transition hover:bg-black/[0.04]"
        >
          <Share2 className="h-[18px] w-[18px]" strokeWidth={2} />
          {formatCount(shares)}
        </button>
        {canCopy ? (
          <button
            type="button"
            onClick={() => void handleCopy()}
            aria-pressed={copied}
            className={`inline-flex h-8 items-center justify-start gap-1.5 rounded-lg text-[13px] font-medium transition hover:bg-black/[0.04] ${
              copied ? 'text-pe-accent' : ''
            }`}
          >
            {copied ? (
              <ClipboardCheck className="h-[18px] w-[18px] text-pe-accent" strokeWidth={2} />
            ) : (
              <Copy className="h-[18px] w-[18px]" strokeWidth={2} />
            )}
            {formatCount(copies)}
          </button>
        ) : null}
        {showUpdateHoldings ? (
          <button
            type="button"
            onClick={() => onUpdateHoldings?.()}
            className="inline-flex h-8 items-center justify-start gap-1.5 rounded-lg text-[13px] font-medium text-pe-text-secondary transition hover:bg-black/[0.04] hover:text-pe-accent"
          >
            <Pencil className="h-[18px] w-[18px]" strokeWidth={2} />
            Update Holdings
          </button>
        ) : null}
      </div>

      <PortfolioShareSheet
        open={shareOpen}
        portfolio={portfolio}
        ownerHandle={getHandleForUserIdSync(ownerUserId)}
        onClose={() => setShareOpen(false)}
        onSharesUpdated={setShares}
      />
    </div>
  );
}

function portfolioHoldingsNeedClientResolve(portfolio) {
  const holdings = portfolio.holdings ?? [];
  if (holdings.length) return holdingsNeedClientResolve(holdings);
  return (portfolio.tickers ?? []).length > 0;
}

function PortfolioHoldingsList({ portfolio, onOpenStock }) {
  const HOLDINGS_PAGE_SIZE = 4;
  const [page, setPage] = useState(0);
  const [assetsByKey, setAssetsByKey] = useState(() => assetsFromHoldings(portfolio.holdings));

  const holdingKeys = useMemo(() => {
    const keys = [];
    const seen = new Set();
    for (const holding of portfolio.holdings ?? []) {
      if (!holding?.ticker || seen.has(holding.ticker)) continue;
      seen.add(holding.ticker);
      keys.push(holding.ticker);
    }
    for (const ticker of portfolio.tickers ?? []) {
      if (!ticker || seen.has(ticker)) continue;
      seen.add(ticker);
      keys.push(ticker);
    }
    return keys;
  }, [portfolio.holdings, portfolio.tickers]);

  const isWatchlist = portfolio.kind === 'watchlist';

  const needsClientResolve = useMemo(
    () => isWatchlist
      ? portfolioHoldingsNeedClientResolve(portfolio)
      : (holdingKeys.length > 0),
    [portfolio.holdings, portfolio.tickers, portfolio.kind, holdingKeys.length, isWatchlist]
  );

  useEffect(() => {
    setPage(0);
  }, [portfolio.id]);

  useEffect(() => {
    // Paint holdings immediately, then fill live quotes for live books.
    setAssetsByKey(assetsFromHoldings(portfolio.holdings));
    if (!holdingKeys.length || !needsClientResolve) return undefined;

    let cancelled = false;
    resolvePortfolioAssets(holdingKeys).then((map) => {
      if (cancelled) return;
      setAssetsByKey((prev) => {
        const next = { ...prev, ...assetsFromHoldings(portfolio.holdings) };
        for (const [key, asset] of map.entries()) next[key] = asset;
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [portfolio.id, holdingKeys, needsClientResolve, portfolio.holdings]);

  const rows = useMemo(() => {
    const liveHoldings = (portfolio.holdings ?? []).filter(Boolean);

    const toListRow = (h, weight, asset, extras = {}) => {
      const ticker = String(h.ticker ?? '').trim().toUpperCase();
      const assetType = h.assetType ?? asset?.kind ?? 'stock';
      const name = String(h.assetName ?? h.name ?? asset?.name ?? '').trim();
      const isFund =
        assetType === 'fund' || asset?.kind === 'fund' || (/^\d{6,}$/.test(ticker) && Boolean(name));
      const title = isFund ? name || ticker || 'Unknown' : name || ticker || 'Unknown';
      const amfiCode = String(
        h.amfiCode ?? h.schemeCode ?? asset?.amfiCode ?? asset?.schemeCode ?? ticker ?? ''
      ).trim();
      const subtitle = isFund
        ? amfiCode && title.toUpperCase() !== amfiCode.toUpperCase()
          ? amfiCode
          : ''
        : name && ticker && name.toUpperCase() !== ticker
          ? ticker
          : '';
      return {
        key: h.ticker || ticker,
        title,
        subtitle,
        weight,
        assetType,
        logoIconUrl: h.logoIconUrl ?? h.logo_icon_url ?? asset?.logoIconUrl ?? null,
        dayChangePct: (() => {
          const fromHolding = Number(h.todayPnlPct ?? h.changePct ?? asset?.item?.changePct);
          return Number.isFinite(fromHolding) ? fromHolding : null;
        })(),
        ...extras,
      };
    };

    if (liveHoldings.length) {
      if (isWatchlist) {
        const explicit = liveHoldings.map((h) => Number(h.weightPct ?? h.weight));
        const allExplicit = explicit.every((w) => Number.isFinite(w) && w > 0);
        const equal = 100 / liveHoldings.length;
        return liveHoldings.map((h, index) =>
          toListRow(h, allExplicit ? explicit[index] : equal, assetsByKey[h.ticker])
        );
      }

      const totalValue = liveHoldings.reduce((sum, h) => {
        const asset = assetsByKey[h.ticker];
        const livePrice = Number(asset?.price);
        const savedPrice = Number(h.price);
        const price =
          Number.isFinite(livePrice) && livePrice > 0
            ? livePrice
            : Number.isFinite(savedPrice) && savedPrice > 0
              ? savedPrice
              : Number(h.avg) || 0;
        const value = (Number(h.qty) || 0) * price;
        return sum + value;
      }, 0);
      return liveHoldings.map((h) => {
        const asset = assetsByKey[h.ticker];
        const livePrice = Number(asset?.price);
        const savedPrice = Number(h.price);
        const price =
          Number.isFinite(livePrice) && livePrice > 0
            ? livePrice
            : Number.isFinite(savedPrice) && savedPrice > 0
              ? savedPrice
              : Number(h.avg) || 0;
        const value = (Number(h.qty) || 0) * price;
        const fromWeight = Number(h.weightPct ?? h.weight);
        const weight =
          totalValue > 0
            ? (value / totalValue) * 100
            : Number.isFinite(fromWeight) && fromWeight > 0
              ? fromWeight
              : 0;
        return toListRow(h, weight, asset);
      });
    }

    const tickers = portfolio.tickers ?? [];
    if (!tickers.length) return [];
    const equal = 100 / tickers.length;
    return tickers.map((ticker) => {
      const asset = assetsByKey[ticker];
      return toListRow({ ticker }, equal, asset);
    });
  }, [portfolio, assetsByKey, isWatchlist]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => b.weight - a.weight),
    [rows]
  );
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / HOLDINGS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = sortedRows.slice(
    safePage * HOLDINGS_PAGE_SIZE,
    safePage * HOLDINGS_PAGE_SIZE + HOLDINGS_PAGE_SIZE
  );

  if (!rows.length) {
    return (
      <p className="px-4 py-10 text-center text-sm text-pe-text-secondary md:px-6">
        No holdings yet.
      </p>
    );
  }

  const openHolding = (row) => {
    if (!onOpenStock || !row?.key) return;
    onOpenStock(row.key, { assetType: row.assetType || 'stock' });
  };

  return (
    <div>
      <section className="px-4 pt-1 md:px-6">
        <div className="border-b border-[var(--fv-border,#ececec)] pb-2 pt-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-pe-text-muted">
            Holdings
          </p>
        </div>
        <div className="divide-y divide-[var(--fv-border,#ececec)]">
          {pageRows.map((row) => (
            <div key={row.key} className="flex items-start gap-2.5 py-3.5 sm:gap-3">
              <AssetLogo
                logoIconUrl={row.logoIconUrl}
                assetType={row.assetType}
                assetKey={row.key}
                name={row.title}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                {onOpenStock ? (
                  <button
                    type="button"
                    onClick={() => openHolding(row)}
                    className="w-full text-left text-[15px] font-semibold leading-snug text-pe-text break-words transition hover:text-pe-accent hover:underline"
                  >
                    {row.title}
                  </button>
                ) : (
                  <p className="text-[15px] font-semibold leading-snug text-pe-text break-words">
                    {row.title}
                  </p>
                )}
                {row.subtitle ? (
                  <p className="mt-0.5 text-[12px] font-medium tabular-nums text-pe-text-muted">
                    {row.subtitle}
                  </p>
                ) : null}

                <div className={`mt-2.5 grid gap-x-4 gap-y-1 ${isWatchlist ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-pe-text-muted">
                      Alloc.
                    </p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-pe-text">
                      {Number.isFinite(row.weight) ? `${row.weight.toFixed(1)}%` : '—'}
                    </p>
                  </div>
                  {isWatchlist ? (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-pe-text-muted">
                        1D change
                      </p>
                      <p
                        className={`mt-0.5 text-sm font-semibold tabular-nums ${
                          row.dayChangePct == null
                            ? 'text-pe-text'
                            : row.dayChangePct > 0
                              ? 'text-pe-positive'
                              : row.dayChangePct < 0
                                ? 'text-pe-negative'
                                : 'text-pe-text'
                        }`}
                      >
                        {row.dayChangePct == null
                          ? '—'
                          : `${row.dayChangePct > 0 ? '+' : row.dayChangePct < 0 ? '−' : ''}${Math.abs(row.dayChangePct).toFixed(2)}%`}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      {sortedRows.length > HOLDINGS_PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-3 border-t border-[var(--fv-border,#ececec)] py-3.5">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-pe-text-secondary transition hover:bg-pe-surface hover:text-pe-text disabled:opacity-40"
          >
            Previous
          </button>
          <p className="text-sm text-pe-text-muted">
            {safePage + 1} / {totalPages}
            <span className="mx-1.5">·</span>
            {sortedRows.length} holdings
          </p>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-pe-text-secondary transition hover:bg-pe-surface hover:text-pe-text disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
      </section>
    </div>
  );
}
