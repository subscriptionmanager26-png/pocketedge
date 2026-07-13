import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, ClipboardCheck, Copy, Heart, Pencil, Plus, Share2, Trash2, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import PostCard from '../components/PostCard';
import ProfileHero from '../components/ProfileHero';
import FollowListView from '../components/FollowListView';
import UnderlineTabs from '../components/UnderlineTabs';
import { isDevMockMode } from '../lib/appMode';
import {
  CURRENT_USER,
  POSTS,
  getPortfolioReturn,
} from '../data/mockData';
import {
  discardLocalDraft,
  createDraftPortfolio,
  fetchUserPortfolio,
  fetchUserPortfolios,
  saveSocialPortfolio,
} from '../lib/socialPortfolioApi';
import { updateSocialProfile } from '../lib/socialProfileApi';
import { getAppCurrentUser, getHandleForUserIdSync, peekPerson, resolvePerson } from '../lib/socialIdentity';
import { usePostEnrichment } from '../lib/usePostEnrichment';
import { isFollowing, toggleFollow, getFollowCounts, subscribeSocialGraph, hydrateFollowGraph } from '../lib/socialGraphStore';
import { formatCount, formatPct, formatPrice, pnlClass, timeAgo } from '../lib/format';
import { holdingDisplayLabel } from '../lib/portfolioAssetUniverse';
import { FormStatusTag } from '../components/FormStatusIcons';
import { fetchPortfolioFormByTicker } from '../lib/portfolioForm';
import PortfolioCard from '../components/PortfolioCard';
import {
  PortfoliosListSkeleton,
  PortfolioHoldingsSkeleton,
} from '../components/PortfolioSkeletons';
import { ProfilePageSkeleton } from '../components/PageSkeletons';
import CommentEngagementButton from '../components/CommentEngagementButton';
import CommentRow from '../components/CommentRow';
import ReviewCard from '../components/ReviewCard';
import { getReviewsByAuthor, subscribeReviews } from '../lib/reviewStore';
import {
  addPortfolioComment,
  getPortfolioEngagementSync,
  markPortfolioCommentsRead,
  recordPortfolioShare,
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
import { resolvePortfolioAssets } from '../lib/portfolioAssetUniverse';
import {
  PortfolioKindMetaTags,
  PortfolioSourceAttribution,
} from '../components/PortfolioMetaTag';
import { profilePath } from '../lib/routes';

const PROFILE_TABS = [
  { id: 'about', label: 'About me' },
  { id: 'posts', label: 'Posts' },
  { id: 'reviews', label: 'Signals' },
  { id: 'portfolios', label: 'Portfolio' },
];

const RETURN_PERIODS = ['1D', '1W', '1M', '1Y'];
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

function ReturnPeriodPicker({ value, onChange, className = '' }) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b border-pe-border px-4 py-3 ${className}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
        Return period
      </p>
      <div className="flex gap-1 rounded-lg bg-pe-surface p-1">
        {RETURN_PERIODS.map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => onChange(period)}
            className={`rounded-md px-2.5 py-1.5 text-[12px] font-bold transition ${
              value === period
                ? 'bg-pe-canvas text-pe-text shadow-sm'
                : 'text-pe-text-secondary hover:text-pe-text'
            }`}
          >
            {period}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatJoined(isoDate) {
  if (!isoDate) return '-';
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

const inputClass =
  'w-full rounded-lg border border-pe-border-strong bg-pe-canvas px-3 py-2 text-[15px] text-pe-text outline-none focus:border-pe-accent focus:ring-1 focus:ring-pe-accent';

export default function ProfilePage({
  mode = 'own',
  userId = CURRENT_USER.id,
  posts,
  selectedPortfolioId,
  onSelectPortfolio,
  onClearPortfolio,
  onBack,
  onOpenPublicPreview,
  onExitPublicPreview,
  onOpenProfile,
  onOpenPost,
  onGraphChange,
  onMobileHeaderActionsChange,
  onRegisterPortfolioBackHandler,
  onOpenSourcePortfolio,
  onFollowListModeChange,
  onRegisterFollowListBackHandler,
}) {
  const appUser = getAppCurrentUser();
  const isOwn = mode === 'own';
  const [person, setPerson] = useState(() => {
    if (isOwn) return appUser;
    return peekPerson(userId);
  });
  const isMePublic = !isOwn && person?.id === appUser.id;
  const canEdit = isOwn && !isMePublic;

  const [tab, setTab] = useState('about');
  const [aboutEditing, setAboutEditing] = useState(false);
  const [savedFlash, setSavedFlash] = useState(null);
  const [portfolioVersion, setPortfolioVersion] = useState(0);
  const [portfolios, setPortfolios] = useState([]);
  const [portfoliosLoading, setPortfoliosLoading] = useState(false);
  const [reviewsVersion, setReviewsVersion] = useState(0);
  const [portfolioSocialTick, setPortfolioSocialTick] = useState(0);
  const [returnPeriod, setReturnPeriod] = useState(getStoredReturnPeriod);

  const bumpPortfolios = () => setPortfolioVersion((v) => v + 1);

  const [name, setName] = useState(CURRENT_USER.name ?? '');
  const [bio, setBio] = useState(CURRENT_USER.bio ?? '');
  const [location, setLocation] = useState(CURRENT_USER.location ?? '');
  const [focus, setFocus] = useState(CURRENT_USER.focus ?? '');
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
  useEffect(() => subscribeReviews(() => setReviewsVersion((n) => n + 1)), []);
  useEffect(() => subscribePortfolioEngagement(() => setPortfolioSocialTick((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;
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
  }, [userId, mode]);

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
    setPortfoliosLoading(true);
    fetchUserPortfolios(person.id)
      .then((rows) => {
        if (!cancelled) setPortfolios(rows);
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
    setName(person.name ?? '');
    setBio(person.bio ?? '');
    setLocation(person.location ?? '');
    setFocus(person.focus ?? '');
  }, [person, isOwn]);

  useEffect(() => {
    if (!isOwn && person?.id) {
      setFollowingState(isFollowing(person.id));
    }
  }, [person?.id, isOwn, isMePublic]);

  const authorPosts = (posts ?? (isDevMockMode() ? POSTS : [])).filter((p) => p.authorId === person?.id);
  const enrichmentTick = usePostEnrichment(authorPosts);
  const tabs = PROFILE_TABS;
  const authoredReviews = useMemo(
    () => getReviewsByAuthor(person?.id),
    [person?.id, reviewsVersion]
  );
  const publishedPortfolios = useMemo(
    () => portfolios.filter((p) => !p.isDraft),
    [portfolios]
  );

  const selectedPortfolio = useMemo(
    () => (selectedPortfolioId ? portfolios.find((p) => p.id === selectedPortfolioId) ?? null : null),
    [portfolios, selectedPortfolioId]
  );

  useEffect(() => {
    setTab(selectedPortfolioId ? 'portfolios' : 'about');
    setAboutEditing(false);
    setFollowListMode(null);
  }, [userId, mode, selectedPortfolioId]);

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

  const flashSaved = (section) => {
    setSavedFlash(section);
    setTimeout(() => setSavedFlash(null), 1600);
  };

  const saveAbout = async () => {
    try {
      const updated = await updateSocialProfile({
        display_name: name.trim() || person.name,
        bio,
        location,
        focus,
      });
      setPerson((prev) =>
        prev
          ? {
              ...prev,
              name: updated.display_name ?? prev.name,
              bio: updated.bio ?? '',
              location: updated.location ?? '',
              focus: updated.focus ?? '',
            }
          : prev
      );
      setAboutEditing(false);
      flashSaved('about');
    } catch {
      /* keep editing open on failure */
    }
  };

  const cancelAbout = () => {
    setName(person.name ?? '');
    setBio(person.bio ?? '');
    setLocation(person.location ?? '');
    setFocus(person.focus ?? '');
    setAboutEditing(false);
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
    setAboutEditing(false);
    setFollowListMode(null);
    onClearPortfolio?.();
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

  if (selectedPortfolio) {
    return (
      <PortfolioDetailView
        portfolio={selectedPortfolio}
        userId={person.id}
        canEdit={canEdit}
        onPortfolioUpdated={() => {
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
        <PageHeader desktopOnly>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-pe-text-secondary hover:text-pe-text"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </PageHeader>
      )}

      <ProfileHero
        person={person}
        name={canEdit ? name : undefined}
        bio={canEdit ? bio : undefined}
        following={following}
        followerCount={followCounts.followers}
        followingCount={followCounts.following}
        onOpenFollowers={() => setFollowListMode('followers')}
        onOpenFollowing={() => setFollowListMode('following')}
        onToggleFollow={async () => {
          const next = await toggleFollow(person.id);
          setFollowingState(next);
          onGraphChange?.();
        }}
        showFollowButton={!isOwn && !isMePublic}
      />

      <PageHeader>
        <UnderlineTabs
          embedded
          tabs={tabs}
          active={tab}
          onChange={handleTabChange}
        />
      </PageHeader>

      {tab === 'posts' && (
        <div>
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
              />
            ))
          )}
        </div>
      )}

      {tab === 'about' && (
        <AboutPanel
          person={person}
          canEdit={canEdit}
          editing={aboutEditing}
          onEdit={() => setAboutEditing(true)}
          onSave={saveAbout}
          onCancel={cancelAbout}
          saved={savedFlash === 'about'}
          name={name}
          bio={bio}
          location={location}
          focus={focus}
          onNameChange={setName}
          onBioChange={setBio}
          onLocationChange={setLocation}
          onFocusChange={setFocus}
        />
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

      {tab === 'reviews' && (
        <ReviewsPanel
          reviews={authoredReviews}
          onOpenProfile={onOpenProfile}
          onGraphChange={onGraphChange}
        />
      )}
    </div>
  );
}

function SectionHeader({ title, canEdit, editing, onEdit, onSave, onCancel, saved }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
        {title}
      </p>
      {canEdit && (
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-semibold text-pe-text-secondary hover:bg-pe-surface hover:text-pe-text"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                className="inline-flex items-center gap-1 rounded-md bg-pe-accent px-2.5 py-1.5 text-sm font-bold text-white hover:bg-pe-accent-pressed"
              >
                {saved ? <Check className="h-3.5 w-3.5" /> : null}
                {saved ? 'Saved' : 'Save'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-semibold text-pe-text-secondary hover:bg-pe-surface hover:text-pe-accent"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AboutPanel({
  person,
  canEdit,
  editing,
  onEdit,
  onSave,
  onCancel,
  saved,
  name,
  bio,
  location,
  focus,
  onNameChange,
  onBioChange,
  onLocationChange,
  onFocusChange,
}) {
  const readOnlyRows = [
    { label: 'Joined', value: formatJoined(person.joinedAt) },
    { label: 'XIRR', value: formatPct(person.xirr, { signed: false }), tone: person.xirr },
  ];

  if (editing) {
    return (
      <div className="px-4 py-5">
        <SectionHeader
          title="About me"
          canEdit={canEdit}
          editing={editing}
          onEdit={onEdit}
          onSave={onSave}
          onCancel={onCancel}
          saved={saved}
        />
        <div className="space-y-4">
          <Field label="Name">
            <input value={name} onChange={(e) => onNameChange(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Bio">
            <textarea
              value={bio}
              onChange={(e) => onBioChange(e.target.value)}
              rows={3}
              className={`${inputClass} resize-none leading-6 text-pe-ink`}
            />
          </Field>
          <Field label="Location">
            <input
              value={location}
              onChange={(e) => onLocationChange(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Investment focus">
            <input value={focus} onChange={(e) => onFocusChange(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <dl className="mt-6 divide-y divide-pe-border border-y border-pe-border">
          {readOnlyRows.map((row) => (
            <ReadOnlyRow key={row.label} label={row.label} value={row.value} tone={row.tone} />
          ))}
        </dl>
      </div>
    );
  }

  const viewRows = [
    { label: 'Location', value: (canEdit ? location : person.location) || '-' },
    { label: 'Investment focus', value: (canEdit ? focus : person.focus) || '-' },
    ...readOnlyRows,
  ];

  return (
    <div className="px-4 py-5">
      <SectionHeader
        title="About me"
        canEdit={canEdit}
        editing={editing}
        onEdit={onEdit}
        onSave={onSave}
        onCancel={onCancel}
        saved={saved}
      />
      <dl className="divide-y divide-pe-border border-y border-pe-border">
        {viewRows.map((row) => (
          <ReadOnlyRow
            key={row.label}
            label={row.label}
            value={row.value}
            multiline={row.multiline}
            tone={row.tone}
          />
        ))}
      </dl>
    </div>
  );
}

function ReadOnlyRow({ label, value, multiline, tone }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-3.5">
      <dt className="text-sm font-semibold text-pe-text-muted">{label}</dt>
      <dd
        className={`text-sm text-pe-text ${multiline ? 'leading-6 text-pe-ink' : ''} ${
          tone != null ? `${pnlClass(tone)} font-semibold` : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-sm font-semibold text-pe-text-muted">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function ReviewsPanel({ reviews, onOpenProfile, onGraphChange }) {
  if (!reviews.length) {
    return (
      <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
        Signals you post on funds and stocks will show up here.
      </p>
    );
  }

  return (
    <div className="divide-y divide-pe-border border-t border-pe-border">
      {reviews.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          locked={false}
          onAddComment={() => {}}
          onOpenProfile={onOpenProfile}
          onGraphChange={onGraphChange}
          onReviewChange={() => {}}
        />
      ))}
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
      {/* Return period picker hidden for now - always show 1D returns.
      <ReturnPeriodPicker value={returnPeriod} onChange={onReturnPeriodChange} />
      */}

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
              returnPct={getPortfolioReturn(portfolio, '1D')}
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
        <div className="px-4 pb-5">
          <button
            type="button"
            onClick={onAddPortfolio}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-pe-border-strong px-4 py-3.5 text-sm font-semibold text-pe-text-secondary transition hover:border-pe-accent hover:text-pe-accent"
          >
            <Plus className="h-4 w-4" />
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
  const [name, setName] = useState(portfolio.name);
  const [objective, setObjective] = useState(portfolio.objective ?? '');
  const [thesis, setThesis] = useState(portfolio.thesis ?? '');
  const [portfolioKind, setPortfolioKind] = useState(portfolio.kind ?? 'live');
  const [editRows, setEditRows] = useState([]);
  const [costMode, setCostMode] = useState(COST_MODES.invested);
  const [fieldErrors, setFieldErrors] = useState({ name: false, objective: false, thesis: false, rows: {} });
  const [socialTick, setSocialTick] = useState(0);
  const [commentDraft, setCommentDraft] = useState('');
  const editSessionRef = useRef(0);
  const saveEditsRef = useRef(async () => {});
  const cancelEditsRef = useRef(() => {});

  const isWatchlist = isWatchlistKind(portfolioKind);

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

  const markUnknownTickerErrors = async (rows, session) => {
    const tickers = rows.map((row) => row.ticker.trim()).filter(Boolean);
    if (!tickers.length) return;

    const assetsByKey = await resolvePortfolioAssets(tickers);
    if (session !== editSessionRef.current) return;

    const rowErrors = {};
    for (const row of rows) {
      const ticker = row.ticker.trim();
      if (ticker && !assetsByKey.has(ticker)) {
        rowErrors[row.id] = { ticker: true };
      }
    }

    if (Object.keys(rowErrors).length) {
      setFieldErrors((prev) => ({ ...prev, rows: { ...prev.rows, ...rowErrors } }));
    }
  };

  const initEditRows = (kind = portfolioKind) => {
    editSessionRef.current += 1;
    setEditRows(buildEditRows(kind));
  };

  const startEditing = () => {
    const session = ++editSessionRef.current;
    const rows = buildEditRows(portfolioKind);
    setEditRows(rows);
    setFieldErrors({ name: false, objective: false, thesis: false, rows: {} });
    setEditing(true);
    markUnknownTickerErrors(rows, session);
  };

  useEffect(() => {
    if (startInEditMode) {
      const session = ++editSessionRef.current;
      const rows = buildEditRows(portfolio.kind ?? 'live');
      setEditRows(rows);
      setEditing(true);
      markUnknownTickerErrors(rows, session);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio.id, startInEditMode]);

  const saveEdits = async () => {
    const validation = validatePortfolioDraft({
      kind: portfolioKind,
      name,
      objective,
      thesis,
      rows: editRows,
    });
    setFieldErrors(validation.errors);
    if (!validation.valid) return;

    const assetsByKey = await resolvePortfolioAssets(
      validation.completeRows.map((row) => row.ticker.trim())
    );

    const rowErrors = { ...validation.errors.rows };
    let assetsValid = true;
    for (const row of validation.completeRows) {
      const ticker = row.ticker.trim();
      if (!assetsByKey.has(ticker)) {
        rowErrors[row.id] = { ...(rowErrors[row.id] ?? {}), ticker: true };
        assetsValid = false;
      }
    }

    if (!assetsValid) {
      setFieldErrors({ ...validation.errors, rows: rowErrors });
      return;
    }

    const holdings = isWatchlist
      ? buildWatchlistHoldings(validation.completeRows, assetsByKey)
      : buildLiveHoldings(validation.completeRows, assetsByKey);

    try {
      const savedPortfolio = await saveSocialPortfolio(userId, portfolio.id, {
        name: name.trim(),
        objective: objective.trim(),
        thesis: thesis.trim(),
        kind: portfolioKind,
        isDraft: false,
        tickers: holdings.map((h) => h.ticker),
        holdings,
        ...(isWatchlist ? { watchlistBaseInvestment: WATCHLIST_BASE_INVESTMENT } : {}),
      });
      onPortfolioUpdated?.();
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
          onCancel={() => cancelEditsRef.current()}
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
  }, [canEdit, editing, saved, onMobileHeaderActionsChange]);

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
    'w-full min-w-0 rounded-md border border-pe-border-strong bg-pe-canvas px-2.5 py-2 text-base text-pe-text outline-none focus:border-pe-accent focus:ring-1 focus:ring-pe-accent md:text-[14px]';

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
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-semibold text-pe-text-secondary hover:bg-pe-surface"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdits}
                  className="inline-flex items-center gap-1 rounded-md bg-pe-accent px-2.5 py-1.5 text-sm font-bold text-white hover:bg-pe-accent-pressed"
                >
                  {saved ? <Check className="h-3.5 w-3.5" /> : null}
                  {saved ? 'Saved' : 'Save'}
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
        <div className="flex flex-col items-stretch gap-4">
          {!editing ? (
            <PortfolioKindMetaTags portfolio={portfolio} />
          ) : (
            <PortfolioKindToggle value={portfolioKind} onChange={handleKindChange} />
          )}

          <div className="min-w-0 w-full flex-1">
            {editing ? (
              <div className="space-y-4">
                <Field label="Portfolio name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={fieldClass(inputClass, fieldErrors.name)}
                    placeholder="e.g. Main portfolio"
                  />
                </Field>
                <Field label="Portfolio objective">
                  <input
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    className={fieldClass(inputClass, fieldErrors.objective)}
                    placeholder="What this portfolio is for"
                  />
                </Field>
                <Field label="Investment thesis">
                  <textarea
                    value={thesis}
                    onChange={(e) => setThesis(e.target.value)}
                    rows={3}
                    placeholder="Why these holdings - shown in portfolio detail"
                    className={fieldClass(
                      `${inputClass} resize-none leading-6 text-pe-ink`,
                      fieldErrors.thesis
                    )}
                  />
                </Field>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-pe-text">{portfolio.name}</h2>
                {portfolio.objective ? (
                  <p className="mt-2 text-sm text-pe-text-secondary">{portfolio.objective}</p>
                ) : null}
                {portfolio.thesis ? (
                  <p className="mt-2 text-sm leading-6 text-pe-ink">{portfolio.thesis}</p>
                ) : null}
                <PortfolioSourceAttribution
                  portfolio={portfolio}
                  onSeeOriginal={onOpenSourcePortfolio}
                />
              </>
            )}
          </div>
        </div>
      </div>

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

      {editing ? (
        <div className="px-4 py-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
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

          <div className="mt-4 space-y-2">
            <div className={`${rowGridClass} px-0.5`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                Ticker
              </p>
              {isWatchlist ? (
                <p className="text-right text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                  Weight %
                </p>
              ) : (
                <>
                  <p className="text-right text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                    {costMode === COST_MODES.avg ? 'Avg price' : 'Total invested'}
                  </p>
                  <p className="text-right text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
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
                  <div className={rowGridClass}>
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
                          name: asset.kind === 'fund' ? asset.name : '',
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
        <PortfolioHoldingsList portfolio={portfolio} returnPeriod="1D" />
      )}

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

function PortfolioDetailMobileActions({ editing = false, saved = false, onEdit, onCancel, onSave }) {
  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-semibold text-pe-text-secondary hover:bg-pe-surface"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className="inline-flex items-center gap-1 rounded-md bg-pe-accent px-2.5 py-1.5 text-sm font-bold text-white hover:bg-pe-accent-pressed"
        >
          {saved ? <Check className="h-3.5 w-3.5" /> : null}
          {saved ? 'Saved' : 'Save'}
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

  const handleShare = async () => {
    const ownerHandle = getHandleForUserIdSync(ownerUserId);
    const url = `${window.location.origin}${profilePath(ownerHandle, { portfolioId: portfolio.id })}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: portfolio.name,
          text: portfolio.thesis || portfolio.objective || 'Portfolio on PocketEdge',
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
      }
      const next = await recordPortfolioShare(portfolio.id);
      setShares(next.shares);
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="border-b border-pe-border px-4 py-4">
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
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
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
  if (!holdings.length && (portfolio.tickers ?? []).length) return true;
  return holdings.some((h) => h.ticker && !h.assetName);
}

function PortfolioHoldingsList({ portfolio, returnPeriod }) {
  const HOLDINGS_PAGE_SIZE = 4;
  const [page, setPage] = useState(0);
  const [assetsByKey, setAssetsByKey] = useState({});
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [formByTicker, setFormByTicker] = useState({});
  const overallReturn = getPortfolioReturn(portfolio, returnPeriod);

  const holdingFormItems = useMemo(() => {
    const items = [];
    const seen = new Set();
    for (const holding of portfolio.holdings ?? []) {
      if (!holding?.ticker || seen.has(holding.ticker)) continue;
      seen.add(holding.ticker);
      items.push({ ticker: holding.ticker, assetType: holding.assetType });
    }
    for (const ticker of portfolio.tickers ?? []) {
      if (!ticker || seen.has(ticker)) continue;
      seen.add(ticker);
      items.push({ ticker });
    }
    return items;
  }, [portfolio.holdings, portfolio.tickers]);

  const holdingKeys = useMemo(
    () => holdingFormItems.map((item) => item.ticker),
    [holdingFormItems]
  );

  const needsClientResolve = useMemo(
    () => portfolioHoldingsNeedClientResolve(portfolio),
    [portfolio.holdings, portfolio.tickers]
  );

  useEffect(() => {
    setPage(0);
  }, [portfolio.id, returnPeriod]);

  useEffect(() => {
    if (!holdingFormItems.length) {
      setFormByTicker({});
      return undefined;
    }

    let cancelled = false;
    fetchPortfolioFormByTicker(holdingFormItems).then((map) => {
      if (!cancelled) setFormByTicker(map);
    });

    return () => {
      cancelled = true;
    };
  }, [holdingFormItems]);

  useEffect(() => {
    if (!holdingKeys.length || !needsClientResolve) {
      setAssetsByKey({});
      setAssetsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setAssetsLoading(true);
    resolvePortfolioAssets(holdingKeys)
      .then((map) => {
        if (cancelled) return;
        const next = {};
        for (const [key, asset] of map.entries()) next[key] = asset;
        setAssetsByKey(next);
      })
      .finally(() => {
        if (!cancelled) setAssetsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [portfolio.id, holdingKeys, needsClientResolve]);

  const rows = useMemo(() => {
    const periodReturnForChangePct = (changePct, fallbackPnl = 0) => {
      const day = changePct ?? fallbackPnl ?? 0;
      const month = Number((day * 8).toFixed(1));
      if (returnPeriod === '1D') return day;
      if (returnPeriod === '1W') return Number((day * 5).toFixed(1));
      if (returnPeriod === '1Y') return Number((month * 8).toFixed(1));
      return month;
    };

    const liveHoldings = (portfolio.holdings ?? []).filter(Boolean);
    if (liveHoldings.length) {
      const totalValue = liveHoldings.reduce((sum, h) => {
        const asset = assetsByKey[h.ticker];
        const price = h.price ?? asset?.price ?? 0;
        const value = h.value ?? (h.qty ?? 0) * price;
        return sum + value;
      }, 0);
      return liveHoldings.map((h) => {
        const asset = assetsByKey[h.ticker];
        const price = h.price ?? asset?.price ?? 0;
        const value = h.value ?? (h.qty ?? 0) * price;
        const weight = totalValue > 0 ? (value / totalValue) * 100 : 0;
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
          itemReturn: periodReturnForChangePct(h.changePct ?? asset?.item?.changePct, h.pnlPct),
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
        itemReturn: periodReturnForChangePct(asset?.item?.changePct),
      };
    });
  }, [portfolio, returnPeriod, assetsByKey]);

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

  if (assetsLoading && holdingKeys.length) {
    return (
      <PortfolioHoldingsSkeleton rows={Math.min(holdingKeys.length, HOLDINGS_PAGE_SIZE)} />
    );
  }

  if (!rows.length) {
    return (
      <p className="px-4 py-10 text-center text-sm text-pe-text-secondary">
        No holdings yet. Tap Edit to add stocks.
      </p>
    );
  }

  return (
    <div className="divide-y divide-pe-border px-4">
      <div className="flex items-center justify-between gap-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-pe-text">Overall</p>
          <p className="text-sm text-pe-text-muted">Return</p>
        </div>
        <p className={`shrink-0 w-16 text-right text-[15px] font-bold ${pnlClass(overallReturn)}`}>
          {formatPct(overallReturn)}
        </p>
      </div>
      {pageRows.map((row) => (
        <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_88px_72px] items-center gap-2 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-pe-text">{row.title}</p>
            <div className="mt-1">
              <FormStatusTag form={formByTicker[row.key] ?? 'unsure'} />
            </div>
          </div>
          <p className="w-[88px] text-right text-sm font-semibold tabular-nums text-pe-text-secondary">
            {row.weight.toFixed(1)}%
          </p>
          <p className={`w-[72px] text-right text-[15px] font-bold tabular-nums ${pnlClass(row.itemReturn)}`}>
            {formatPct(row.itemReturn)}
          </p>
        </div>
      ))}
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
    </div>
  );
}
