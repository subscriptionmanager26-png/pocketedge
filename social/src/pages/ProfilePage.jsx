import { useEffect, useMemo, useState } from 'react';
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
  getUserTrades,
} from '../data/mockData';
import {
  discardLocalDraft,
  createDraftPortfolio,
  fetchUserPortfolio,
  fetchUserPortfolios,
  saveSocialPortfolio,
} from '../lib/socialPortfolioApi';
import { updateSocialProfile } from '../lib/socialProfileApi';
import { getAppCurrentUser, getHandleForUserIdSync, resolvePerson } from '../lib/socialIdentity';
import { isFollowing, toggleFollow, getFollowCounts, subscribeSocialGraph } from '../lib/socialGraphStore';
import { formatCount, formatPct, formatPrice, pnlClass, timeAgo } from '../lib/format';
import { formatTicker } from '../lib/tickers';
import PortfolioCard from '../components/PortfolioCard';
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
  WATCHLIST_BASE_INVESTMENT,
  buildLiveHoldings,
  buildWatchlistHoldings,
  fieldClass,
  isWatchlistKind,
  portfolioHasDraftWork,
  validatePortfolioDraft,
} from '../lib/portfolioEdit';
import {
  MARKET_MIN_SEARCH_CHARS,
} from '../lib/marketDataApi';
import {
  resolvePortfolioAssets,
  searchPortfolioAssets,
} from '../lib/portfolioAssetUniverse';
import {
  PortfolioKindMetaTags,
  PortfolioSourceAttribution,
} from '../components/PortfolioMetaTag';
import { profilePath } from '../lib/routes';

const PROFILE_TABS = [
  { id: 'about', label: 'About me' },
  { id: 'posts', label: 'Posts' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'portfolios', label: 'Portfolio' },
  { id: 'trades', label: 'Trades' },
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
  if (!isoDate) return '—';
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
}) {
  const appUser = getAppCurrentUser();
  const isOwn = mode === 'own';
  const [person, setPerson] = useState(() => (isOwn ? appUser : null));
  const isMePublic = !isOwn && person?.id === appUser.id;
  const canEdit = isOwn && !isMePublic;

  const [tab, setTab] = useState('about');
  const [aboutEditing, setAboutEditing] = useState(false);
  const [savedFlash, setSavedFlash] = useState(null);
  const [portfolioVersion, setPortfolioVersion] = useState(0);
  const [portfolios, setPortfolios] = useState([]);
  const [tradesVersion, setTradesVersion] = useState(0);
  const [reviewsVersion, setReviewsVersion] = useState(0);
  const [portfolioSocialTick, setPortfolioSocialTick] = useState(0);
  const [returnPeriod, setReturnPeriod] = useState(getStoredReturnPeriod);

  const bumpPortfolios = () => setPortfolioVersion((v) => v + 1);
  const bumpTrades = () => setTradesVersion((v) => v + 1);

  const [name, setName] = useState(CURRENT_USER.name ?? '');
  const [bio, setBio] = useState(CURRENT_USER.bio ?? '');
  const [location, setLocation] = useState(CURRENT_USER.location ?? '');
  const [focus, setFocus] = useState(CURRENT_USER.focus ?? '');
  const [following, setFollowingState] = useState(false);
  const [followListMode, setFollowListMode] = useState(null);
  const [graphTick, setGraphTick] = useState(0);

  useEffect(() => subscribeSocialGraph(() => setGraphTick((n) => n + 1)), []);
  useEffect(() => subscribeReviews(() => setReviewsVersion((n) => n + 1)), []);
  useEffect(() => subscribePortfolioEngagement(() => setPortfolioSocialTick((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;
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
    if (!person?.id) return;
    let cancelled = false;
    fetchUserPortfolios(person.id)
      .then((rows) => {
        if (!cancelled) setPortfolios(rows);
      })
      .catch(() => {});
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
    return (
      <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">Loading profile…</p>
    );
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
          bumpTrades();
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

  const showViewToggle = isOwn || isMePublic;

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
        onToggleFollow={() => {
          const next = toggleFollow(person.id);
          setFollowingState(next);
          onGraphChange?.();
        }}
        showFollowButton={!isOwn && !isMePublic}
        showViewToggle={showViewToggle}
        isPublicPreview={isMePublic}
        onToggleView={isMePublic ? onExitPublicPreview : onOpenPublicPreview}
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

      {tab === 'trades' && (
        <TradesPanel userId={person.id} tradesVersion={tradesVersion} />
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
    { label: 'Location', value: (canEdit ? location : person.location) || '—' },
    { label: 'Investment focus', value: (canEdit ? focus : person.focus) || '—' },
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
        Reviews and ratings you post on funds and stocks will show up here.
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
      <ReturnPeriodPicker value={returnPeriod} onChange={onReturnPeriodChange} />

      {!portfolios.length ? (
        <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
          {canEdit ? 'No portfolios yet.' : 'No portfolios published yet.'}
        </p>
      ) : (
        <div>
          {portfolios.map((portfolio) => (
            <PortfolioCard
              key={portfolio.id}
              portfolio={portfolio}
              returnPct={getPortfolioReturn(portfolio, returnPeriod)}
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

function TradesPanel({ userId, tradesVersion }) {
  void tradesVersion;
  const trades = getUserTrades(userId);

  if (!trades.length) {
    return (
      <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
        No trades yet. Portfolio changes will appear here automatically.
      </p>
    );
  }

  return (
    <div className="divide-y divide-pe-border">
      {trades.map((trade) => {
        const isBuy = trade.action === 'buy';
        return (
          <div key={trade.id} className="px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-pe-text">{trade.portfolioName}</p>
              <span className="text-xs text-pe-text-muted">{timeAgo(trade.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm text-pe-text">
              <span className={`font-bold uppercase ${isBuy ? 'text-pe-positive' : 'text-pe-negative'}`}>
                {trade.action}
              </span>{' '}
              <span className="font-semibold">{formatTicker(trade.ticker)}</span>{' '}
              <span className="text-pe-text-secondary">
                {trade.qty} @ {formatPrice(trade.price)}
              </span>
              {trade.pnlPct != null && (
                <span className={`ml-2 font-semibold ${pnlClass(trade.pnlPct)}`}>
                  {formatPct(trade.pnlPct)}
                </span>
              )}
            </p>
          </div>
        );
      })}
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
  const [fieldErrors, setFieldErrors] = useState({ name: false, objective: false, thesis: false, rows: {} });
  const [tickerSuggestionsFor, setTickerSuggestionsFor] = useState(null);
  const [tickerSuggestions, setTickerSuggestions] = useState([]);
  const [tickerSuggestionsLoading, setTickerSuggestionsLoading] = useState(false);
  const [socialTick, setSocialTick] = useState(0);
  const [commentDraft, setCommentDraft] = useState('');

  const isWatchlist = isWatchlistKind(portfolioKind);

  useEffect(() => subscribePortfolioEngagement(() => setSocialTick((n) => n + 1)), []);

  const social = useMemo(
    () => getPortfolioEngagementSync(portfolio.id),
    [portfolio.id, socialTick]
  );

  useEffect(() => {
    setName(portfolio.name);
    setObjective(portfolio.objective ?? '');
    setThesis(portfolio.thesis ?? '');
    setPortfolioKind(portfolio.kind ?? 'live');
    setFieldErrors({ name: false, objective: false, thesis: false, rows: {} });
    if (!startInEditMode) setEditing(false);
  }, [portfolio.id, portfolio.name, portfolio.objective, portfolio.thesis, portfolio.kind, startInEditMode]);

  const makeBlankRow = () => ({
    id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ticker: '',
    invested: '',
    qty: '',
    weight: '',
  });

  const holdingToRow = (h) => {
    if (isWatchlistKind(portfolio.kind)) {
      const weightPct =
        h.weightPct ??
        (() => {
          const total = (portfolio.holdings ?? []).reduce((sum, row) => sum + (row.value ?? 0), 0);
          return total > 0 ? ((h.value ?? 0) / total) * 100 : '';
        })();
      return {
        id: `hold_${h.ticker}`,
        ticker: h.ticker,
        weight: weightPct === '' ? '' : String(Number(weightPct).toFixed(1)),
        invested: '',
        qty: '',
      };
    }
    return {
      id: `hold_${h.ticker}`,
      ticker: h.ticker,
      invested: String((Number(h.qty) || 0) * (Number(h.avg) || 0) || ''),
      qty: String(h.qty ?? ''),
      weight: '',
    };
  };

  const initEditRows = (kind = portfolioKind) => {
    const watchlist = isWatchlistKind(kind);
    const source = watchlist
      ? portfolio.holdings?.length
        ? portfolio.holdings
        : (portfolio.tickers ?? []).map((ticker) => ({ ticker }))
      : portfolio.holdings ?? [];
    const rows = source.map((h) =>
      watchlist
        ? {
            id: `hold_${h.ticker}`,
            ticker: h.ticker,
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
    setEditRows([...rows, makeBlankRow()]);
    setTickerSuggestionsFor(null);
  };

  const startEditing = () => {
    initEditRows(portfolioKind);
    setFieldErrors({ name: false, objective: false, thesis: false, rows: {} });
    setEditing(true);
  };

  useEffect(() => {
    if (startInEditMode) {
      initEditRows(portfolio.kind ?? 'live');
      setEditing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio.id, startInEditMode]);

  useEffect(() => {
    if (!tickerSuggestionsFor) {
      setTickerSuggestions([]);
      setTickerSuggestionsLoading(false);
      return undefined;
    }

    const row = editRows.find((entry) => entry.id === tickerSuggestionsFor);
    const query = row?.ticker?.trim() ?? '';
    if (query.length < MARKET_MIN_SEARCH_CHARS) {
      setTickerSuggestions([]);
      setTickerSuggestionsLoading(false);
      return undefined;
    }

    const used = editRows
      .filter((entry) => entry.id !== tickerSuggestionsFor)
      .map((entry) => entry.ticker.trim())
      .filter(Boolean);

    let cancelled = false;
    setTickerSuggestionsLoading(true);

    const timer = setTimeout(() => {
      searchPortfolioAssets(query, { exclude: used, limit: 6 })
        .then((items) => {
          if (!cancelled) setTickerSuggestions(items);
        })
        .catch(() => {
          if (!cancelled) setTickerSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setTickerSuggestionsLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tickerSuggestionsFor, editRows]);

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
    setTickerSuggestionsFor(null);
    setFieldErrors({ name: false, objective: false, thesis: false, rows: {} });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

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
        'You have unsaved changes. Save is still required — discard your work and go back?'
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
          onCancel={cancelEdits}
          onSave={saveEdits}
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
    setEditRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
    );
  };

  const removeRow = (rowId) => {
    setEditRows((prev) => {
      const next = prev.filter((row) => row.id !== rowId);
      return next.length ? next : [makeBlankRow()];
    });
    setTickerSuggestionsFor((current) => (current === rowId ? null : current));
  };

  const addBlankRow = () => {
    setEditRows((prev) => [...prev, makeBlankRow()]);
  };

  const tickerMatches = tickerSuggestionsFor ? tickerSuggestions : [];

  const compactInputClass =
    'w-full min-w-0 rounded-md border border-pe-border-strong bg-pe-canvas px-2.5 py-2 text-[14px] text-pe-text outline-none focus:border-pe-accent focus:ring-1 focus:ring-pe-accent';

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
                    placeholder="Why these holdings — shown in portfolio detail"
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

      {!editing ? (
        <ReturnPeriodPicker value={returnPeriod} onChange={onReturnPeriodChange} />
      ) : null}

      {editing ? (
        <div className="px-4 py-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
            Holdings
          </p>
          <p className="mt-1 text-sm text-pe-text-secondary">
            {isWatchlist
              ? 'Search a stock, ETF, or fund and enter its share of total holdings (%). Weights must add up to 100%.'
              : 'Search a stock, ETF, or fund, then enter your total investment and quantity.'}
          </p>

          <div className="mt-4 space-y-2">
            <div className={`hidden items-center gap-2 px-0.5 md:flex ${isWatchlist ? 'grid-cols-[minmax(0,1fr)_5.5rem_auto]' : ''}`}>
              <p className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                Ticker
              </p>
              {isWatchlist ? (
                <p className="w-[5.5rem] shrink-0 text-right text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                  Weight %
                </p>
              ) : (
                <>
                  <p className="w-[8.75rem] shrink-0 text-right text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                    Total invested
                  </p>
                  <p className="w-[5.25rem] shrink-0 text-right text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                    Qty
                  </p>
                </>
              )}
              <span className="h-9 w-9 shrink-0" aria-hidden="true" />
            </div>

            {editRows.map((row) => {
              const suggestions = tickerSuggestionsFor === row.id ? tickerMatches : [];
              const rowErr = fieldErrors.rows[row.id] ?? {};
              return (
                <div key={row.id} className={rowGridClass}>
                  <div className="relative min-w-0">
                    <input
                      type="text"
                      value={row.ticker}
                      onChange={(e) => {
                        updateRow(row.id, { ticker: e.target.value.toUpperCase() });
                        setTickerSuggestionsFor(row.id);
                      }}
                      onFocus={() => setTickerSuggestionsFor(row.id)}
                      onBlur={() => {
                        window.setTimeout(() => {
                          setTickerSuggestionsFor((current) =>
                            current === row.id ? null : current
                          );
                        }, 120);
                      }}
                      placeholder="Search stock, ETF, or fund"
                      aria-label="Ticker"
                      autoComplete="off"
                      className={fieldClass(compactInputClass, rowErr.ticker)}
                    />
                    {tickerSuggestionsLoading && tickerSuggestionsFor === row.id ? (
                      <div className="absolute left-0 right-0 z-20 mt-1 rounded-md border border-pe-border-strong bg-pe-canvas px-2.5 py-2 text-[12px] text-pe-text-muted shadow-lg">
                        Searching…
                      </div>
                    ) : null}
                    {suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-pe-border-strong bg-pe-canvas shadow-lg">
                        {suggestions.map((asset) => (
                          <button
                            key={`${asset.kind}-${asset.key}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              updateRow(row.id, { ticker: asset.key });
                              setTickerSuggestionsFor(null);
                              setTickerSuggestions([]);
                            }}
                            className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-pe-surface"
                          >
                            <span className="min-w-0">
                              <span className="text-[14px] font-semibold text-pe-text">
                                {asset.kind === 'fund' ? asset.key : formatTicker(asset.key)}
                              </span>
                              <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-pe-text-muted">
                                {asset.kindLabel}
                              </span>
                            </span>
                            <span className="truncate text-[12px] text-pe-text-muted">
                              {asset.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

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
                        value={row.invested}
                        onChange={(e) => updateRow(row.id, { invested: e.target.value })}
                        placeholder="Total invested"
                        aria-label="Total amount you invested"
                        className={fieldClass(`${compactInputClass} text-right tabular-nums`, rowErr.invested)}
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
        <PortfolioHoldingsList portfolio={portfolio} returnPeriod={returnPeriod} />
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
          Be the first to discuss this portfolio — ask about allocation, thesis, or recent moves.
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

function PortfolioHoldingsList({ portfolio, returnPeriod }) {
  const HOLDINGS_PAGE_SIZE = 4;
  const [page, setPage] = useState(0);
  const [assetsByKey, setAssetsByKey] = useState({});
  const overallReturn = getPortfolioReturn(portfolio, returnPeriod);

  useEffect(() => {
    setPage(0);
  }, [portfolio.id, returnPeriod]);

  useEffect(() => {
    const keys = [
      ...(portfolio.holdings ?? []).map((holding) => holding.ticker),
      ...(portfolio.tickers ?? []),
    ].filter(Boolean);

    if (!keys.length) {
      setAssetsByKey({});
      return undefined;
    }

    let cancelled = false;
    resolvePortfolioAssets(keys).then((map) => {
      if (cancelled) return;
      const next = {};
      for (const [key, asset] of map.entries()) next[key] = asset;
      setAssetsByKey(next);
    });

    return () => {
      cancelled = true;
    };
  }, [portfolio.id, portfolio.holdings, portfolio.tickers]);

  const rows = useMemo(() => {
    const periodReturnForTicker = (ticker, fallbackPnl, asset) => {
      const changePct = asset?.item?.changePct ?? fallbackPnl ?? 0;
      const day = changePct ?? 0;
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
          title: asset?.kind === 'fund' ? h.ticker : formatTicker(h.ticker),
          subtitle: asset?.name ?? '',
          weight,
          itemReturn: periodReturnForTicker(h.ticker, h.pnlPct, asset),
        };
      });
    }

    const tickers = portfolio.tickers ?? [];
    if (!tickers.length) return [];
    const equal = 100 / tickers.length;
    return tickers.map((ticker) => {
      const asset = assetsByKey[ticker];
      return {
        key: ticker,
        title: asset?.kind === 'fund' ? ticker : formatTicker(ticker),
        subtitle: asset?.name ?? '',
        weight: equal,
        itemReturn: periodReturnForTicker(ticker, undefined, asset),
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
            {row.subtitle ? (
              <p className="mt-0.5 truncate text-sm font-normal text-pe-text-muted">{row.subtitle}</p>
            ) : null}
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
