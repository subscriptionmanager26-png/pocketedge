import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ClipboardCheck,
  Copy,
  FileSpreadsheet,
  Heart,
  ImagePlus,
  Pencil,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import PostCard from '../components/PostCard';
import ProfileHero from '../components/ProfileHero';
import FollowListView from '../components/FollowListView';
import UnderlineTabs from '../components/UnderlineTabs';
import { isDevMockMode } from '../lib/appMode';
import {
  CURRENT_USER,
  POSTS,
  getPortfolioTotalReturnPct,
  getHoldingTotalReturnPct,
} from '../data/mockData';
import {
  discardLocalDraft,
  createDraftPortfolio,
  fetchUserPortfolio,
  fetchUserPortfolios,
  peekUserPortfolios,
  saveSocialPortfolio,
  isLocalDraftId,
} from '../lib/socialPortfolioApi';
import { updateSocialProfile, fetchProfileHeader } from '../lib/socialProfileApi';
import { getAppCurrentUser, getHandleForUserIdSync, peekPerson, resolvePerson } from '../lib/socialIdentity';
import { usePostEnrichment } from '../lib/usePostEnrichment';
import { isFollowing, toggleFollow, getFollowCounts, subscribeSocialGraph, hydrateFollowGraph } from '../lib/socialGraphStore';
import { formatCount, formatPct, formatPrice, pnlClass, timeAgo } from '../lib/format';
import { holdingDisplayLabel, resolvePortfolioAssets, assetsFromHoldings, holdingsNeedClientResolve } from '../lib/portfolioAssetUniverse';
import AssetLogo from '../components/AssetLogo';
import PortfolioCard from '../components/PortfolioCard';
import PortfolioShareSheet from '../components/PortfolioShareSheet';
import {
  PortfoliosListSkeleton,
  PortfolioHoldingsSkeleton,
} from '../components/PortfolioSkeletons';
import { ProfilePageSkeleton } from '../components/PageSkeletons';
import CommentEngagementButton from '../components/CommentEngagementButton';
import CommentRow from '../components/CommentRow';
import { fetchInfluencingAmount } from '../lib/influencingApi';
import { peekInfluencingCache, writeProfileGraphCache } from '../lib/tabCache';
import { markTabDataReady, markTabPaint } from '../lib/perfMarks';
import {
  addPortfolioComment,
  getPortfolioEngagementSync,
  markPortfolioCommentsRead,
  subscribePortfolioEngagement,
  togglePortfolioCopy,
  togglePortfolioLike,
} from '../lib/portfolioEngagementApi';
import {
  COST_MODES,
  WATCHLIST_BASE_INVESTMENT,
  buildLiveHoldings,
  buildWatchlistHoldings,
  fieldClass,
  isWatchlistKind,
  patchLiveCostFields,
  portfolioHasDraftWork,
  validatePortfolioDraft,
  withSyncedAvg,
} from '../lib/portfolioEdit';
import PortfolioAssetSearchField from '../components/PortfolioAssetSearchField';
import CostModeToggle from '../components/CostModeToggle';
import { parseZerodhaHoldingsScreenshots } from './onboarding/onboardingHoldings';
import { parseZerodhaHoldingsWorkbook } from './onboarding/zerodhaHoldingsWorkbook';
import {
  PortfolioKindMetaTags,
} from '../components/PortfolioMetaTag';

const PROFILE_TABS = [
  { id: 'posts', label: 'Posts' },
  { id: 'portfolios', label: 'Portfolio' },
];

const RETURN_PERIODS = ['1D', '1W', '1M', '1Y'];
const RETURN_PERIOD_LABELS = {
  '1D': '1D',
  '1W': '1W',
  '1M': '1M',
  '1Y': '1Y',
};
const RETURN_PERIOD_KEY = 'pe_profile_return_period';
const ISIN_RE = /^[A-Z0-9]{12}$/;

function holdingIsin(value) {
  const isin = String(value ?? '').trim().toUpperCase();
  return ISIN_RE.test(isin) ? isin : null;
}

function holdingFallbackName(row) {
  const value = String(row?.name ?? row?.ticker ?? '').trim().toUpperCase();
  // Broker/exchange series badges are temporary suffixes: GOLDBEES-X,
  // GOLDBEES - SE, etc. Keep the stable root for non-ISIN matching.
  return value.replace(/\s*-\s*[A-Z]{1,3}$/, '').trim();
}

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
  posts,
  selectedPortfolioId,
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

  const [tab, setTab] = useState('posts');
  const [portfolioVersion, setPortfolioVersion] = useState(0);
  const [portfolios, setPortfolios] = useState([]);
  const [portfoliosLoading, setPortfoliosLoading] = useState(false);
  const [portfolioSocialTick, setPortfolioSocialTick] = useState(0);
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
      onMobileHeaderActionsChange?.(<span className="sr-only">Follow list</span>);
    } else {
      onRegisterFollowListBackHandler?.(null);
    }
    return () => {
      onFollowListModeChange?.(null);
      onRegisterFollowListBackHandler?.(null);
      if (followListMode) onMobileHeaderActionsChange?.(null);
    };
  }, [
    followListMode,
    onFollowListModeChange,
    onRegisterFollowListBackHandler,
    onMobileHeaderActionsChange,
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
    if (!person?.id) return;
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
  }, [person?.id, portfolioVersion]);

  useEffect(() => {
    if (!person?.id || !selectedPortfolioId) return;
    if (portfolios.some((p) => p.id === selectedPortfolioId)) return;
    let cancelled = false;
    fetchUserPortfolio(person.id, selectedPortfolioId)
      .then((row) => {
        if (!cancelled && row) setPortfolios((prev) => [...prev, row]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [person?.id, selectedPortfolioId, portfolios, portfolioVersion]);

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

  const selectedPortfolio = useMemo(
    () => (selectedPortfolioId ? portfolios.find((p) => p.id === selectedPortfolioId) ?? null : null),
    [portfolios, selectedPortfolioId]
  );

  useEffect(() => {
    setTab('posts');
    setFollowListMode(null);
  }, [userId, mode]);

  useEffect(() => {
    if (selectedPortfolioId) {
      setTab('portfolios');
      setFollowListMode(null);
    }
  }, [selectedPortfolioId]);

  const followCounts = useMemo(() => {
    void graphTick;
    if (!person?.id) return { followers: 0, following: 0 };
    return getFollowCounts(person.id);
  }, [person?.id, graphTick]);

  if (!person) {
    return <ProfilePageSkeleton />;
  }

  const handleAddPortfolio = async () => {
    const created = await createDraftPortfolio(person.id);
    setPortfolios((prev) => [created, ...prev]);
    bumpPortfolios();
    onSelectPortfolio?.(created.id);
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
    if (selectedPortfolioId) onClearPortfolio?.();
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
    return (
      <div className="px-4 py-6">
        <PortfolioHoldingsSkeleton rows={4} />
      </div>
    );
  }

  if (selectedPortfolio) {
    return (
      <PortfolioDetailView
        portfolio={selectedPortfolio}
        userId={person.id}
        canEdit={canEdit}
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
            return;
          }
          bumpPortfolios();
        }}
        onBack={onClearPortfolio}
        canCopy={!canEdit}
        returnPeriod={returnPeriod}
        onReturnPeriodChange={handleReturnPeriodChange}
        onMobileHeaderActionsChange={onMobileHeaderActionsChange}
        startInEditMode={Boolean(selectedPortfolio.isDraft)}
        onRegisterPortfolioBackHandler={onRegisterPortfolioBackHandler}
        onOpenSourcePortfolio={onOpenSourcePortfolio}
        onSelectPortfolio={onSelectPortfolio}
      />
    );
  }

  return (
    <div>
      {!isOwn && !isMePublic && (
        <div className="hidden items-center px-4 py-3 md:flex md:px-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-pe-text-secondary transition hover:text-pe-text"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Back
          </button>
        </div>
      )}

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

      <div className="sticky top-14 z-20 border-b border-[var(--fv-border,#ececec)] bg-white/95 backdrop-blur-md md:top-0">
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
        <div className="md:pt-2">
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
        <PortfoliosListPanel
          portfolios={publishedPortfolios}
          loading={portfoliosLoading}
          person={person}
          canEdit={canEdit}
          portfolioSocialTick={portfolioSocialTick}
          returnPeriod={returnPeriod}
          onReturnPeriodChange={handleReturnPeriodChange}
          onSelectPortfolio={onSelectPortfolio}
          onAddPortfolio={handleAddPortfolio}
          onPortfolioCopied={bumpPortfolios}
        />
      )}
    </div>
  );
}

function PortfoliosListPanel({
  portfolios,
  loading = false,
  person,
  canEdit,
  portfolioSocialTick,
  returnPeriod,
  onReturnPeriodChange,
  onSelectPortfolio,
  onAddPortfolio,
  onPortfolioCopied,
}) {
  void portfolioSocialTick;

  return (
    <div>
      {loading ? (
        <PortfoliosListSkeleton count={2} />
      ) : !portfolios.length ? (
        <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
          {canEdit ? 'No portfolios yet.' : 'No portfolios published yet.'}
        </p>
      ) : (
        <div>
          {portfolios.map((portfolio) => (
            <PortfolioCard
              key={portfolio.id}
              portfolio={portfolio}
              social={getPortfolioEngagementSync(portfolio.id)}
              canCopy={!canEdit}
              showUnreadComments={canEdit}
              sourceOwnerId={person.id}
              sourceOwnerName={canEdit ? undefined : person.name}
              onPortfolioCopied={onPortfolioCopied}
              onOpen={onSelectPortfolio}
              onDiscuss={onSelectPortfolio}
            />
          ))}
        </div>
      )}

      {canEdit ? (
        <div className="px-4 pb-5 md:px-6">
          <button
            type="button"
            onClick={onAddPortfolio}
            className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-[var(--fv-border,#ececec)] bg-white px-4 py-3.5 text-[13px] font-semibold text-pe-text-secondary shadow-[0_6px_24px_rgba(0,0,0,0.05)] transition hover:border-pe-accent hover:text-pe-accent"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add portfolio
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PortfolioDetailView({
  portfolio,
  userId,
  canEdit,
  onPortfolioUpdated,
  onBack,
  canCopy = false,
  returnPeriod = '1M',
  onReturnPeriodChange,
  onMobileHeaderActionsChange,
  onRegisterPortfolioBackHandler,
  startInEditMode = false,
  onOpenSourcePortfolio,
  onSelectPortfolio,
}) {
  const isDraft = Boolean(portfolio.isDraft);
  const [editing, setEditing] = useState(startInEditMode);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(portfolio.name);
  const [objective, setObjective] = useState(portfolio.objective ?? '');
  const [thesis, setThesis] = useState(portfolio.thesis ?? '');
  const [portfolioKind, setPortfolioKind] = useState(portfolio.kind ?? 'live');
  const [editRows, setEditRows] = useState([]);
  const [costMode, setCostMode] = useState(COST_MODES.invested);
  const [fieldErrors, setFieldErrors] = useState({ name: false, objective: false, thesis: false, rows: {} });
  const [importNotice, setImportNotice] = useState('');
  const [importingHoldings, setImportingHoldings] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [socialTick, setSocialTick] = useState(0);
  const [commentDraft, setCommentDraft] = useState('');
  const editSessionRef = useRef(0);
  const excelInputRef = useRef(null);
  const screenshotInputRef = useRef(null);
  const saveEditsRef = useRef(async () => {});
  const cancelEditsRef = useRef(() => {});

  const isWatchlist = isWatchlistKind(portfolioKind);

  useEffect(() => subscribePortfolioEngagement(() => setSocialTick((n) => n + 1)), []);

  const social = useMemo(
    () => getPortfolioEngagementSync(portfolio.id),
    [portfolio.id, socialTick]
  );

  const portfolioTotalReturn = useMemo(
    () => getPortfolioTotalReturnPct(portfolio),
    [portfolio]
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
    const avg = Number(h.avg) || 0;
    const invested = qty * avg;
    return {
      id: rowId,
      ticker: h.ticker,
      name: fundName,
      isin: holdingIsin(h.isin),
      invested: invested ? String(invested) : '',
      qty: String(h.qty ?? ''),
      avg: avg ? String(avg) : '',
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
    setEditRows(rows);
    setFieldErrors({ name: false, objective: false, thesis: false, rows: {} });
    setImportNotice('');
    setEditing(true);
  };

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
      const current = editRows.filter((row) => String(row.ticker ?? '').trim());
      const assetsByToken = await resolvePortfolioAssets([
        ...current.map((row) => row.ticker),
        ...incoming.map((row) => row.ticker),
      ]);
      const importedByIsin = new Map();
      const importedByFallbackName = new Map();
      const importedRowsByKey = new Map();
      for (const row of incoming) {
        const asset = assetsByToken.get(row.ticker);
        const key = asset?.key ?? row.ticker;
        const isin = holdingIsin(row.isin);
        const prepared = {
          ...row,
          ticker: key,
          name: asset ? (asset.kind === 'fund' ? asset.name : asset.symbol ?? '') : row.name,
          isin,
          unmapped: !asset,
          missingFromImport: false,
        };
        importedRowsByKey.set(key, prepared);
        if (isin) {
          importedByIsin.set(isin, prepared);
        } else {
          const fallbackName = holdingFallbackName(prepared);
          if (fallbackName) importedByFallbackName.set(fallbackName, prepared);
        }
      }

      setEditRows((previous) => {
        const merged = [];
        const consumed = new Set();
        for (const row of previous) {
          if (!String(row.ticker ?? '').trim()) continue;
          const asset = assetsByToken.get(row.ticker);
          const key = asset?.key ?? row.ticker;
          const existingIsin = holdingIsin(row.isin) ?? holdingIsin(asset?.isin);
          // When an ISIN was provided by the import it is the sole identity.
          // Name/symbol matching is only a fallback for rows with no ISIN.
          const imported = existingIsin
            ? importedByIsin.get(existingIsin)
            : importedByFallbackName.get(holdingFallbackName(row));
          if (imported) {
            merged.push({
              ...row,
              ...imported,
              isin: imported.isin ?? existingIsin,
              id: row.id,
              missingFromImport: false,
            });
            consumed.add(imported.ticker);
          } else {
            merged.push({ ...row, isin: existingIsin, missingFromImport: true });
          }
        }
        for (const [key, imported] of importedRowsByKey) {
          if (consumed.has(key)) continue;
          merged.push({ ...imported, id: makeRowId(), missingFromImport: false });
        }
        return [...merged, makeBlankRow()];
      });
      setFieldErrors((previous) => ({ ...previous, rows: {} }));
      const unmappedCount = incoming.filter((row) => !assetsByToken.has(row.ticker)).length;
      const unmappedText = unmappedCount
        ? ` ${unmappedCount} unmapped ${
            unmappedCount === 1 ? 'security was' : 'securities were'
          } kept at their average cost.`
        : '';
      setImportNotice(
        `${sourceLabel} applied. Holdings not present in the import are highlighted in amber.${unmappedText}`
      );
    } catch (error) {
      setImportNotice(error?.message ?? `Could not read that ${sourceLabel}.`);
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
      setEditRows(rows);
      setEditing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio.id, startInEditMode]);

  const saveEdits = async () => {
    if (saving) return;

    const validation = validatePortfolioDraft({
      kind: portfolioKind,
      name,
      objective,
      thesis,
      rows: editRows,
    });
    setFieldErrors(validation.errors);
    if (!validation.valid) return;

    setSaving(true);
    try {
      // Live portfolios: skip client market resolve — server enrich_portfolio_holdings
      // already maps tickers/ISINs and fills prices. Watchlists need prices to derive qty.
      const tickers = validation.completeRows.map((row) => row.ticker.trim());
      const assetsByKey = isWatchlist
        ? await resolvePortfolioAssets(tickers)
        : new Map();

      const holdings = isWatchlist
        ? buildWatchlistHoldings(validation.completeRows, assetsByKey)
        : buildLiveHoldings(validation.completeRows, assetsByKey);

      const savedPortfolio = await saveSocialPortfolio(userId, portfolio.id, {
        name: name.trim(),
        objective: '',
        thesis: '',
        kind: portfolioKind,
        isDraft: false,
        tickers: holdings.map((h) => h.ticker),
        holdings,
        ...(isWatchlist ? { watchlistBaseInvestment: WATCHLIST_BASE_INVESTMENT } : {}),
      });
      onPortfolioUpdated?.(savedPortfolio);
      if (savedPortfolio?.id && savedPortfolio.id !== portfolio.id) {
        onSelectPortfolio?.(savedPortfolio.id);
      }
      setEditing(false);
      setEditRows([]);
      setFieldErrors({ name: false, objective: false, thesis: false, rows: {} });
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch (error) {
      console.error('Failed to save portfolio', error);
      window.alert(error?.message ?? 'Could not save portfolio. Please try again.');
    } finally {
      setSaving(false);
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
  };

  const cancelEdits = () => {
    requestBack(() => {
      if (isDraft) onBack();
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
      return undefined;
    }

    onMobileHeaderActionsChange(
      editing ? (
        <PortfolioDetailMobileActions
          editing
          saved={saved}
          saving={saving}
          onCancel={() => {
            if (!saving) cancelEditsRef.current();
          }}
          onSave={() => {
            void saveEditsRef.current();
          }}
        />
      ) : (
        <PortfolioDetailMobileActions onEdit={startEditing} />
      )
    );

    return () => onMobileHeaderActionsChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, editing, saved, saving, onMobileHeaderActionsChange]);

  const handleKindChange = (nextKind) => {
    setPortfolioKind(nextKind);
    if (editing) initEditRows(nextKind);
  };

  const updateRow = (rowId, patch) => {
    if (patch.ticker !== undefined) {
      editSessionRef.current += 1;
    }

    setEditRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        if (isWatchlist) return { ...row, ...patch };
        return patchLiveCostFields(row, patch, costMode);
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

  const handleCostModeChange = (mode) => {
    setCostMode(mode);
    if (mode === COST_MODES.avg) {
      setEditRows((prev) => prev.map((row) => withSyncedAvg(row)));
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
    ? 'grid grid-cols-[minmax(0,1fr)_5.5rem_auto] items-start gap-2'
    : 'grid grid-cols-[minmax(0,1fr)_7.25rem_4.5rem_auto] items-start gap-2';

  return (
    <div>
      <PageHeader desktopOnly>
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => requestBack(onBack)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-pe-text-secondary hover:text-pe-text"
          >
            <ArrowLeft className="h-4 w-4" />
            Portfolios
          </button>

          {canEdit ? (
            editing ? (
              <div className="flex items-center gap-2">
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
              </div>
            ) : (
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-semibold text-pe-text-secondary hover:bg-pe-surface hover:text-pe-accent"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )
          ) : null}
        </div>
      </PageHeader>

      <div className="border-b border-pe-border px-4 py-5">
        {!editing ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold text-pe-text">{portfolio.name}</h2>
                <PortfolioKindMetaTags portfolio={portfolio} />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                Unrealised gains
              </p>
              <p
                className={`mt-0.5 text-lg font-bold tabular-nums ${pnlClass(portfolioTotalReturn)}`}
              >
                {formatPct(portfolioTotalReturn)}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-stretch gap-4">
            <PortfolioKindToggle value={portfolioKind} onChange={handleKindChange} />
            <div className="min-w-0 w-full flex-1">
              <div className="space-y-4">
                <Field label="Portfolio name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={fieldClass(inputClass, fieldErrors.name)}
                    placeholder="e.g. Main portfolio"
                  />
                </Field>
              </div>
            </div>
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
                  ? 'Search a stock, ETF, or fund and enter its share of total holdings (%). Weights must add up to 100%.'
                  : 'Search a stock, ETF, or fund, then enter cost and quantity. Switch between total invested and avg price depending on what your broker shows.'}
              </p>
            </div>
            {!isWatchlist ? (
              <CostModeToggle value={costMode} onChange={handleCostModeChange} />
            ) : null}
          </div>

          {!isWatchlist ? (
            <div className="mt-5 rounded-lg border border-pe-border bg-pe-surface p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-pe-text">Update from broker export</p>
                  <p className="mt-0.5 text-[12px] text-pe-text-muted">
                    Imported symbols update matching holdings. Unlisted existing holdings stay and
                    are marked for review.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={importingHoldings}
                    onClick={() => excelInputRef.current?.click()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-pe-border-strong px-2.5 text-[12px] font-semibold text-pe-text-secondary hover:bg-pe-canvas disabled:opacity-60"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Upload Excel
                  </button>
                  <button
                    type="button"
                    disabled={importingHoldings}
                    onClick={() => screenshotInputRef.current?.click()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-pe-border-strong px-2.5 text-[12px] font-semibold text-pe-text-secondary hover:bg-pe-canvas disabled:opacity-60"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    Upload screenshot
                  </button>
                </div>
              </div>
              {importingHoldings && importProgress ? (
                <div className="mt-3" role="status" aria-live="polite">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <p className="font-semibold text-pe-text">{importProgress.label}</p>
                    <p className="shrink-0 tabular-nums text-pe-text-muted">
                      {Math.round(importProgress.percent)}%
                    </p>
                  </div>
                  {importProgress.fileName ? (
                    <p className="mt-1 truncate text-[12px] text-pe-text-muted">
                      {importProgress.fileName}
                    </p>
                  ) : null}
                  <div className="relative mt-2.5">
                    <div className="h-2 overflow-hidden rounded-full bg-pe-canvas">
                      <div
                        className="h-full rounded-full bg-pe-accent transition-all duration-300"
                        style={{ width: `${Math.max(2, importProgress.percent)}%` }}
                      />
                    </div>
                    {(importProgress.total ?? 1) > 1 ? (
                      <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-0.5">
                        {Array.from({ length: importProgress.total }).map((_, index) => {
                          const done =
                            importProgress.percent >=
                            ((index + 1) / importProgress.total) * 85;
                          const active = importProgress.current === index + 1;
                          return (
                            <span
                              key={`import-mile-${index}`}
                              className={`h-2.5 w-2.5 rounded-full border-2 border-pe-surface ${
                                done || active ? 'bg-pe-accent' : 'bg-pe-border-strong'
                              }`}
                              aria-hidden
                            />
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : importNotice ? (
                <p className="mt-2 text-[12px] text-pe-text-secondary">{importNotice}</p>
              ) : null}
              <input
                ref={excelInputRef}
                type="file"
                className="hidden"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(event) => importExcelHoldings(event.target.files?.[0])}
              />
              <input
                ref={screenshotInputRef}
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={(event) => importScreenshotHoldings(event.target.files)}
              />
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            <div className={`${rowGridClass} px-0.5`}>
              <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                Ticker
              </p>
              {isWatchlist ? (
                <p className="text-right text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                  Weight %
                </p>
              ) : (
                <>
                  <p className="text-right text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                    {costMode === COST_MODES.avg ? 'Avg price' : 'Total invested'}
                  </p>
                  <p className="text-right text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                    Qty
                  </p>
                </>
              )}
              <span className="h-4 w-9 shrink-0" aria-hidden="true" />
            </div>

            {editRows.map((row) => {
              const rowErr = fieldErrors.rows[row.id] ?? {};
              const usedTickers = editRows
                .filter((entry) => entry.id !== row.id)
                .map((entry) => entry.ticker.trim())
                .filter(Boolean);
              const costLabel = costMode === COST_MODES.avg ? 'Avg price' : 'Total invested';
              const costValue = costMode === COST_MODES.avg ? row.avg ?? '' : row.invested;
              const costHasError = Boolean(rowErr.invested || rowErr.avg);

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
                        })
                      }
                    />

                    {isWatchlist ? (
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={row.weight}
                        onChange={(e) => updateRow(row.id, { weight: e.target.value })}
                        placeholder="Weight %"
                        aria-label="Weight percentage"
                        className={fieldClass(`${compactInputClass} text-right tabular-nums`, rowErr.weight)}
                      />
                    ) : (
                      <>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={costValue}
                          onChange={(e) =>
                            updateRow(
                              row.id,
                              costMode === COST_MODES.avg
                                ? { avg: e.target.value }
                                : { invested: e.target.value }
                            )
                          }
                          placeholder={costLabel}
                          aria-label={costLabel}
                          className={fieldClass(
                            `${compactInputClass} text-right tabular-nums`,
                            costHasError
                          )}
                        />
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.qty}
                          onChange={(e) => updateRow(row.id, { qty: e.target.value })}
                          placeholder="Qty"
                          aria-label="Quantity"
                          className={fieldClass(`${compactInputClass} text-right tabular-nums`, rowErr.qty)}
                        />
                      </>
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
      ) : (
        <PortfolioHoldingsList portfolio={portfolio} />
      )}

      {!editing ? (
        <PortfolioSocialBar
          portfolio={portfolio}
          social={social}
          canCopy={canCopy}
          ownerUserId={userId}
          showUnreadComments={canEdit}
          onOpenDiscussion={() => {
            document.getElementById('portfolio-discussion')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      ) : null}

      {!editing ? (
        <PortfolioDiscussion
          portfolioId={portfolio.id}
          comments={social.comments ?? []}
          commentDraft={commentDraft}
          onCommentDraftChange={setCommentDraft}
          onSubmitComment={() => {
            addPortfolioComment(portfolio.id, commentDraft);
            setCommentDraft('');
          }}
          markReadOnMount={canEdit}
        />
      ) : null}
    </div>
  );
}

function PortfolioKindToggle({ value, onChange }) {
  return (
    <div className="flex w-fit gap-1 rounded-lg bg-pe-surface p-1">
      {[
        { id: 'live', label: 'Live' },
        { id: 'watchlist', label: 'Watchlist' },
      ].map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-md px-3 py-1.5 text-[12px] font-bold transition ${
            value === option.id
              ? 'bg-pe-canvas text-pe-text shadow-sm'
              : 'text-pe-text-secondary hover:text-pe-text'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PortfolioDetailMobileActions({
  editing = false,
  saved = false,
  saving = false,
  onEdit,
  onCancel,
  onSave,
}) {
  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-semibold text-pe-text-secondary hover:bg-pe-surface disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md bg-pe-accent px-2.5 py-1.5 text-sm font-bold text-white hover:bg-pe-accent-pressed disabled:opacity-70"
        >
          {saved && !saving ? <Check className="h-3.5 w-3.5" /> : null}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-semibold text-pe-text-secondary hover:bg-pe-surface hover:text-pe-accent"
    >
      <Pencil className="h-3.5 w-3.5" />
      Edit
    </button>
  );
}

function PortfolioSocialBar({
  portfolio,
  social,
  canCopy,
  ownerUserId,
  showUnreadComments = false,
  onOpenDiscussion,
}) {
  const [liked, setLiked] = useState(social.liked);
  const [copied, setCopied] = useState(social.copied);
  const [likes, setLikes] = useState(social.likes);
  const [copies, setCopies] = useState(social.copies);
  const [shares, setShares] = useState(social.shares);
  const [shareOpen, setShareOpen] = useState(false);
  const commentCount = social.comments?.length ?? 0;

  const handleLike = () => {
    const next = togglePortfolioLike(portfolio.id);
    setLiked(next.liked);
    setLikes(next.likes);
  };

  const handleCopy = () => {
    if (!canCopy) return;
    const next = togglePortfolioCopy(portfolio.id);
    setCopied(next.copied);
    setCopies(next.copies);
  };

  const handleShare = () => {
    setShareOpen(true);
  };

  return (
    <div className="border-t border-pe-border px-4 py-4">
      <div className="flex flex-wrap items-center gap-5 text-pe-text-secondary">
        <button
          type="button"
          onClick={handleLike}
          aria-pressed={liked}
          className={`inline-flex items-center gap-1.5 text-sm transition ${
            liked ? 'text-pe-accent' : 'hover:text-pe-accent'
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? 'fill-current text-pe-accent' : ''}`} />
          {formatCount(likes)}
        </button>
        <CommentEngagementButton
          count={commentCount}
          unreadCount={showUnreadComments ? social.unreadComments ?? 0 : 0}
          onClick={onOpenDiscussion}
        />
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 text-sm transition hover:text-pe-text"
        >
          <Share2 className="h-4 w-4" />
          {formatCount(shares)}
        </button>
        {canCopy ? (
          <button
            type="button"
            onClick={handleCopy}
            aria-pressed={copied}
            className={`inline-flex items-center gap-1.5 text-sm transition ${
              copied ? 'text-pe-accent' : 'hover:text-pe-text'
            }`}
          >
            {copied ? (
              <ClipboardCheck className="h-4 w-4 text-pe-accent" />
            ) : (
              <Copy className="h-4 w-4 text-pe-text-secondary" />
            )}
            {formatCount(copies)}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-pe-text-muted">
            <Copy className="h-4 w-4 opacity-40" />
            {formatCount(copies)}
          </span>
        )}
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

function PortfolioDiscussion({
  portfolioId,
  comments,
  commentDraft,
  onCommentDraftChange,
  onSubmitComment,
  markReadOnMount = false,
}) {
  useEffect(() => {
    if (markReadOnMount) {
      markPortfolioCommentsRead(portfolioId);
    }
  }, [markReadOnMount, portfolioId]);

  return (
    <section id="portfolio-discussion" className="border-t border-pe-border px-4 py-5">
      <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
        Discussion · {comments.length}
      </p>

      {comments.length === 0 ? (
        <p className="mt-4 text-sm text-pe-text-secondary">
          Be the first to discuss this portfolio - ask about allocation, thesis, or recent moves.
        </p>
      ) : (
        <div className="mt-2 divide-y divide-pe-border border-y border-pe-border">
          {comments.map((comment) => (
            <CommentRow key={comment.id} comment={comment} />
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <input
          value={commentDraft}
          onChange={(e) => onCommentDraftChange(e.target.value)}
          placeholder="Add to the discussion…"
          className={`${inputClass} flex-1`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmitComment();
            }
          }}
        />
        <button
          type="button"
          onClick={onSubmitComment}
          disabled={!commentDraft.trim()}
          className="shrink-0 rounded-md bg-pe-accent px-4 py-2 text-sm font-bold text-white transition hover:bg-pe-accent-pressed disabled:opacity-40"
        >
          Post
        </button>
      </div>
    </section>
  );
}

function portfolioHoldingsNeedClientResolve(portfolio) {
  const holdings = portfolio.holdings ?? [];
  if (holdings.length) return holdingsNeedClientResolve(holdings);
  return (portfolio.tickers ?? []).length > 0;
}

function PortfolioHoldingsList({ portfolio }) {
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
    if (liveHoldings.length) {
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
          isWatchlist && Number.isFinite(fromWeight) && fromWeight > 0
            ? fromWeight
            : totalValue > 0
              ? (value / totalValue) * 100
              : Number.isFinite(fromWeight) && fromWeight > 0
                ? fromWeight
                : 0;
        const pricedHolding = { ...h, price };
        return {
          key: h.ticker,
          title: holdingDisplayLabel(h, asset),
          subtitle:
            (h.assetType ?? asset?.kind) === 'fund'
              ? ''
              : h.assetName && h.assetName !== holdingDisplayLabel(h, asset)
                ? h.assetName
                : asset?.name && asset.name !== holdingDisplayLabel(h, asset)
                  ? asset.name
                  : '',
          weight,
          itemReturn: getHoldingTotalReturnPct(pricedHolding, asset),
          assetType: h.assetType ?? asset?.kind ?? 'stock',
          logoIconUrl: h.logoIconUrl ?? h.logo_icon_url ?? asset?.logoIconUrl ?? null,
        };
      });
    }

    const tickers = portfolio.tickers ?? [];
    if (!tickers.length) return [];
    const equal = 100 / tickers.length;
    return tickers.map((ticker) => {
      const asset = assetsByKey[ticker];
      const title = holdingDisplayLabel({ ticker, assetType: asset?.kind }, asset);
      return {
        key: ticker,
        title,
        subtitle:
          asset?.kind === 'fund'
            ? ''
            : asset?.name && asset.name !== title
              ? asset.name
              : '',
        weight: equal,
        itemReturn: getHoldingTotalReturnPct({ ticker, changePct: asset?.item?.changePct }, asset),
        assetType: asset?.kind ?? 'stock',
        logoIconUrl: asset?.logoIconUrl ?? null,
      };
    });
  }, [portfolio, assetsByKey]);

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
      <p className="px-4 py-10 text-center text-sm text-pe-text-secondary">
        No holdings yet. Tap Edit to add stocks.
      </p>
    );
  }

  const periodLabel = 'Total';

  return (
    <div>
      <section className="px-4 pt-4">
        <div className="grid grid-cols-[minmax(0,1fr)_88px_72px] items-end gap-2 border-b border-pe-border py-3">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
            Holdings
          </p>
          <p className="text-right text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
            Allocation
          </p>
          <p className="text-right text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
            {periodLabel} return
          </p>
        </div>
        <div className="divide-y divide-pe-border">
          {pageRows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[minmax(0,1fr)_88px_72px] items-center gap-2 py-3.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <AssetLogo
                  logoIconUrl={row.logoIconUrl}
                  assetType={row.assetType}
                  assetKey={row.key}
                  name={row.title}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-pe-text">{row.title}</p>
                </div>
              </div>
              <p className="w-[88px] text-right text-sm font-semibold tabular-nums text-pe-text-secondary">
                {row.weight.toFixed(1)}%
              </p>
              <p
                className={`w-[72px] text-right text-[15px] font-bold tabular-nums ${pnlClass(row.itemReturn)}`}
              >
                {formatPct(row.itemReturn)}
              </p>
            </div>
          ))}
        </div>
      {sortedRows.length > HOLDINGS_PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-3 border-t border-pe-border py-3.5">
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
