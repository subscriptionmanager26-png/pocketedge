import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import PostCard from '../components/PostCard';
import ProfileHero from '../components/ProfileHero';
import FollowListView from '../components/FollowListView';
import UnderlineTabs from '../components/UnderlineTabs';
import {
  CURRENT_USER,
  POSTS,
  STOCKS,
  addUserPortfolio,
  applyPortfolioHoldingsUpdate,
  getPerson,
  getPortfolioReturn,
  getUserPortfolio,
  getUserPortfolios,
  getUserTrades,
  recalcHolding,
} from '../data/mockData';
import { isFollowing, toggleFollow, getFollowCounts, subscribeSocialGraph } from '../lib/socialGraphStore';
import { formatPct, formatPrice, pnlClass, timeAgo } from '../lib/format';
import { formatTicker } from '../lib/tickers';
import ReviewCard from '../components/ReviewCard';
import { getReviewsByAuthor, subscribeReviews } from '../lib/reviewStore';

const PROFILE_TABS = [
  { id: 'posts', label: 'Posts' },
  { id: 'about', label: 'About me' },
  { id: 'portfolios', label: 'Portfolios' },
  { id: 'reviews', label: 'Reviews' },
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
}) {
  const isOwn = mode === 'own';
  const person = isOwn ? CURRENT_USER : getPerson(userId);
  const isMePublic = !isOwn && person.id === CURRENT_USER.id;
  const canEdit = isOwn && !isMePublic;

  const [tab, setTab] = useState('posts');
  const [aboutEditing, setAboutEditing] = useState(false);
  const [savedFlash, setSavedFlash] = useState(null);
  const [portfolioVersion, setPortfolioVersion] = useState(0);
  const [tradesVersion, setTradesVersion] = useState(0);
  const [reviewsVersion, setReviewsVersion] = useState(0);
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

  useEffect(() => {
    if (!isOwn && !isMePublic) {
      setFollowingState(isFollowing(person.id));
    }
  }, [person.id, isOwn, isMePublic]);

  const authorPosts = (posts ?? POSTS).filter((p) => p.authorId === person.id);
  const tabs = PROFILE_TABS;
  const authoredReviews = useMemo(
    () => getReviewsByAuthor(person.id),
    [person.id, reviewsVersion]
  );
  const selectedPortfolio = useMemo(
    () =>
      selectedPortfolioId ? getUserPortfolio(person.id, selectedPortfolioId) : null,
    [person.id, selectedPortfolioId, portfolioVersion]
  );

  useEffect(() => {
    setTab('posts');
    setAboutEditing(false);
    setFollowListMode(null);
    onClearPortfolio?.();
  }, [userId, mode]);

  const handleAddPortfolio = (kind = 'live') => {
    const created = addUserPortfolio(CURRENT_USER.id, {
      id: `${kind === 'watchlist' ? 'wl' : 'pf'}_${Date.now()}`,
      kind,
      name: kind === 'watchlist' ? 'Untitled watchlist' : 'Untitled portfolio',
      objective: '',
      thesis: '',
      totalValue: 0,
      invested: 0,
      totalPnlPct: 0,
      xirr: 0,
      holdings: [],
      tickers: [],
    });
    bumpPortfolios();
    onSelectPortfolio?.(created.id);
  };

  const flashSaved = (section) => {
    setSavedFlash(section);
    setTimeout(() => setSavedFlash(null), 1600);
  };

  const saveAbout = () => {
    CURRENT_USER.name = name.trim() || CURRENT_USER.name;
    CURRENT_USER.bio = bio;
    CURRENT_USER.location = location;
    CURRENT_USER.focus = focus;
    setAboutEditing(false);
    flashSaved('about');
  };

  const cancelAbout = () => {
    setName(CURRENT_USER.name ?? '');
    setBio(CURRENT_USER.bio ?? '');
    setLocation(CURRENT_USER.location ?? '');
    setFocus(CURRENT_USER.focus ?? '');
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

  const followCounts = useMemo(() => {
    void graphTick;
    return getFollowCounts(person.id);
  }, [person.id, graphTick]);

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
        returnPeriod={returnPeriod}
        onReturnPeriodChange={handleReturnPeriodChange}
        onPortfolioUpdated={() => {
          bumpPortfolios();
          bumpTrades();
        }}
        onBack={onClearPortfolio}
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
          userId={person.id}
          canEdit={canEdit}
          portfolioVersion={portfolioVersion}
          returnPeriod={returnPeriod}
          onReturnPeriodChange={handleReturnPeriodChange}
          onSelectPortfolio={onSelectPortfolio}
          onAddPortfolio={handleAddPortfolio}
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
              className={`${inputClass} resize-none font-serif leading-6 text-pe-ink`}
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
        className={`text-sm text-pe-text ${multiline ? 'font-serif leading-6 text-pe-ink' : ''} ${
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
  userId,
  canEdit,
  portfolioVersion,
  returnPeriod,
  onReturnPeriodChange,
  onSelectPortfolio,
  onAddPortfolio,
}) {
  void portfolioVersion;
  const [addOpen, setAddOpen] = useState(false);
  const portfolios = getUserPortfolios(userId);

  return (
    <div className="px-4 pb-5">
      <div className="flex items-center justify-between gap-3 border-b border-pe-border py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
          Return period
        </p>
        <div className="flex gap-1 rounded-lg bg-pe-surface p-1">
          {RETURN_PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => onReturnPeriodChange(period)}
              className={`rounded-md px-2.5 py-1.5 text-[12px] font-bold transition ${
                returnPeriod === period
                  ? 'bg-pe-canvas text-pe-text shadow-sm'
                  : 'text-pe-text-secondary hover:text-pe-text'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {!portfolios.length ? (
        <p className="py-10 text-center text-sm text-pe-text-secondary">
          {canEdit ? 'No portfolios yet.' : 'No portfolios published yet.'}
        </p>
      ) : (
        <div className="divide-y divide-pe-border border-b border-pe-border">
          {portfolios.map((portfolio) => {
            const isWatchlist = portfolio.kind === 'watchlist';
            const ret = getPortfolioReturn(portfolio, returnPeriod);
            return (
              <button
                key={portfolio.id}
                type="button"
                onClick={() => onSelectPortfolio?.(portfolio.id)}
                className="flex w-full items-center justify-between gap-4 py-4 text-left transition hover:bg-pe-surface"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="text-[15px] font-semibold text-pe-text">{portfolio.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isWatchlist
                          ? 'bg-pe-surface text-pe-text-secondary'
                          : 'bg-pe-accent-wash text-pe-accent'
                      }`}
                    >
                      {isWatchlist ? 'Watchlist' : 'Live'}
                    </span>
                  </div>
                  {portfolio.thesis ? (
                    <p className="mt-1 font-serif text-sm leading-6 text-pe-text-secondary">
                      {portfolio.thesis}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className={`w-16 text-right text-[15px] font-bold ${pnlClass(ret)}`}>
                    {formatPct(ret)}
                  </p>
                  <ChevronRight className="h-4 w-4 text-pe-text-muted" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {canEdit && (
        <div className="mt-4">
          {!addOpen ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-pe-border-strong px-4 py-3.5 text-sm font-semibold text-pe-text-secondary transition hover:border-pe-accent hover:text-pe-accent"
            >
              <Plus className="h-4 w-4" />
              Add portfolio
            </button>
          ) : (
            <div className="overflow-hidden rounded-[10px] border border-pe-border">
              <button
                type="button"
                onClick={() => {
                  setAddOpen(false);
                  onAddPortfolio('live');
                }}
                className="flex w-full items-center justify-between gap-3 border-b border-pe-border px-4 py-3.5 text-left transition hover:bg-pe-surface"
              >
                <div>
                  <p className="text-[15px] font-semibold text-pe-text">Live</p>
                  <p className="mt-0.5 text-sm text-pe-text-secondary">Actual holdings with disclosure</p>
                </div>
                <span className="rounded-full bg-pe-accent-wash px-2 py-0.5 text-[11px] font-semibold text-pe-accent">
                  Live
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddOpen(false);
                  onAddPortfolio('watchlist');
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-pe-surface"
              >
                <div>
                  <p className="text-[15px] font-semibold text-pe-text">Watchlist</p>
                  <p className="mt-0.5 text-sm text-pe-text-secondary">Ideas you are tracking</p>
                </div>
                <span className="rounded-full bg-pe-surface px-2 py-0.5 text-[11px] font-semibold text-pe-text-secondary">
                  Watchlist
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="w-full border-t border-pe-border px-4 py-2.5 text-sm font-semibold text-pe-text-muted hover:bg-pe-surface"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
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
  returnPeriod = '1M',
  onReturnPeriodChange,
  onPortfolioUpdated,
  onBack,
}) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState(portfolio.name);
  const [objective, setObjective] = useState(portfolio.objective ?? '');
  const [thesis, setThesis] = useState(portfolio.thesis ?? '');
  const [editRows, setEditRows] = useState([]);
  const [tickerSuggestionsFor, setTickerSuggestionsFor] = useState(null);

  useEffect(() => {
    setName(portfolio.name);
    setObjective(portfolio.objective ?? '');
    setThesis(portfolio.thesis ?? '');
    setEditing(false);
  }, [portfolio.id, portfolio.name, portfolio.objective, portfolio.thesis]);

  const makeBlankRow = () => ({
    id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ticker: '',
    invested: '',
    qty: '',
  });

  const holdingToRow = (h) => ({
    id: `hold_${h.ticker}`,
    ticker: h.ticker,
    invested: String((Number(h.qty) || 0) * (Number(h.avg) || 0) || ''),
    qty: String(h.qty ?? ''),
  });

  const isRowComplete = (row) => {
    const ticker = row.ticker.trim().toUpperCase();
    const qty = Number(row.qty);
    const invested = Number(row.invested);
    return Boolean(ticker && STOCKS[ticker] && qty > 0 && invested >= 0 && row.invested !== '');
  };

  const startEditing = () => {
    const rows = (portfolio.holdings ?? []).map(holdingToRow);
    setEditRows([...rows, makeBlankRow()]);
    setTickerSuggestionsFor(null);
    setEditing(true);
  };

  const saveEdits = () => {
    const completeByTicker = new Map();
    for (const row of editRows) {
      if (!isRowComplete(row)) continue;
      const ticker = row.ticker.trim().toUpperCase();
      const qty = Number(row.qty) || 0;
      const invested = Number(row.invested) || 0;
      const avg = qty > 0 ? invested / qty : 0;
      const price = STOCKS[ticker]?.price ?? 0;
      completeByTicker.set(ticker, recalcHolding({ ticker, qty, avg, price }));
    }

    applyPortfolioHoldingsUpdate(userId, portfolio.id, [...completeByTicker.values()], {
      name: name.trim() || portfolio.name,
      objective: objective.trim(),
      thesis: thesis.trim(),
    });
    onPortfolioUpdated?.();
    setEditing(false);
    setEditRows([]);
    setTickerSuggestionsFor(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const cancelEdits = () => {
    setName(portfolio.name);
    setObjective(portfolio.objective ?? '');
    setThesis(portfolio.thesis ?? '');
    setEditRows([]);
    setTickerSuggestionsFor(null);
    setEditing(false);
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

  const tickerMatches = (query, excludeRowId) => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    const used = new Set(
      editRows
        .filter((row) => row.id !== excludeRowId)
        .map((row) => row.ticker.trim().toUpperCase())
        .filter(Boolean)
    );
    return Object.keys(STOCKS)
      .filter((ticker) => {
        if (used.has(ticker)) return false;
        const name = (STOCKS[ticker]?.name ?? '').toUpperCase();
        return ticker.includes(q) || name.includes(q);
      })
      .slice(0, 6);
  };

  const compactInputClass =
    'w-full min-w-0 rounded-md border border-pe-border-strong bg-pe-canvas px-2.5 py-2 text-[14px] text-pe-text outline-none focus:border-pe-accent focus:ring-1 focus:ring-pe-accent';

  return (
    <div>
      <PageHeader desktopOnly>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-pe-text-secondary hover:text-pe-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Portfolios
        </button>
      </PageHeader>

      <div className="border-b border-pe-border px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="space-y-4">
                <Field label="Portfolio name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Main portfolio"
                  />
                </Field>
                <Field label="Portfolio objective">
                  <input
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    className={inputClass}
                    placeholder="What this portfolio is for"
                  />
                </Field>
                <Field label="Investment thesis">
                  <textarea
                    value={thesis}
                    onChange={(e) => setThesis(e.target.value)}
                    rows={3}
                    placeholder="Why these holdings — shown on your portfolio card"
                    className={`${inputClass} resize-none font-serif leading-6 text-pe-ink`}
                  />
                </Field>
              </div>
            ) : (
              <>
                <h2 className="font-serif text-2xl font-bold text-pe-text">{portfolio.name}</h2>
                {portfolio.objective ? (
                  <p className="mt-2 text-sm text-pe-text-secondary">{portfolio.objective}</p>
                ) : null}
                {portfolio.thesis ? (
                  <p className="mt-2 font-serif text-sm leading-6 text-pe-ink">{portfolio.thesis}</p>
                ) : null}
              </>
            )}
          </div>

          {canEdit && (
            <div className="flex shrink-0 items-center gap-2">
              {editing ? (
                <>
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
                </>
              ) : (
                <button
                  type="button"
                  onClick={startEditing}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-semibold text-pe-text-secondary hover:bg-pe-surface hover:text-pe-accent"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              )}
            </div>
          )}
        </div>

        {!editing && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
              Return period
            </p>
            <div className="flex gap-1 rounded-lg bg-pe-surface p-1">
              {RETURN_PERIODS.map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => onReturnPeriodChange?.(period)}
                  className={`rounded-md px-2.5 py-1.5 text-[12px] font-bold transition ${
                    returnPeriod === period
                      ? 'bg-pe-canvas text-pe-text shadow-sm'
                      : 'text-pe-text-secondary hover:text-pe-text'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {editing ? (
        <div className="px-4 py-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
            Holdings
          </p>
          <p className="mt-1 text-sm text-pe-text-secondary">
            Search a ticker, enter total investment and quantity. Incomplete last rows are ignored on save.
          </p>

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 px-0.5">
              <p className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                Ticker
              </p>
              <p className="w-[8.75rem] shrink-0 text-right text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                Total Investment
              </p>
              <p className="w-[5.25rem] shrink-0 text-right text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                Qty
              </p>
              <span className="h-9 w-9 shrink-0" aria-hidden="true" />
            </div>

            {editRows.map((row) => {
              const suggestions =
                tickerSuggestionsFor === row.id ? tickerMatches(row.ticker, row.id) : [];
              return (
                <div key={row.id} className="flex items-start gap-2">
                  <div className="relative min-w-0 flex-1">
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
                      placeholder="Search ticker"
                      aria-label="Ticker"
                      autoComplete="off"
                      className={compactInputClass}
                    />
                    {suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-pe-border-strong bg-pe-canvas shadow-lg">
                        {suggestions.map((ticker) => (
                          <button
                            key={ticker}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              updateRow(row.id, { ticker });
                              setTickerSuggestionsFor(null);
                            }}
                            className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-pe-surface"
                          >
                            <span className="text-[14px] font-semibold text-pe-text">
                              {formatTicker(ticker)}
                            </span>
                            <span className="truncate text-[12px] text-pe-text-muted">
                              {STOCKS[ticker]?.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.invested}
                    onChange={(e) => updateRow(row.id, { invested: e.target.value })}
                    placeholder="0"
                    aria-label="Total Investment"
                    className={`${compactInputClass} w-[8.75rem] shrink-0 text-right tabular-nums`}
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={row.qty}
                    onChange={(e) => updateRow(row.id, { qty: e.target.value })}
                    placeholder="0"
                    aria-label="Quantity"
                    className={`${compactInputClass} w-[5.25rem] shrink-0 text-right tabular-nums`}
                  />
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
    </div>
  );
}

function PortfolioHoldingsList({ portfolio, returnPeriod }) {
  const overallReturn = getPortfolioReturn(portfolio, returnPeriod);
  const rows = useMemo(() => {
    const periodReturnForTicker = (ticker, fallbackPnl) => {
      const stock = STOCKS[ticker];
      if (!stock) return fallbackPnl ?? 0;
      const day = stock.changePct ?? 0;
      const month =
        typeof stock.return3M === 'number' ? Number((stock.return3M / 3).toFixed(1)) : Number((day * 8).toFixed(1));
      if (returnPeriod === '1D') return day;
      if (returnPeriod === '1W') return Number((day * 5).toFixed(1));
      if (returnPeriod === '1Y') return Number((month * 8).toFixed(1));
      return month;
    };

    const liveHoldings = (portfolio.holdings ?? []).filter(Boolean);
    if (liveHoldings.length) {
      const totalValue = liveHoldings.reduce((sum, h) => {
        const price = h.price ?? STOCKS[h.ticker]?.price ?? 0;
        const value = h.value ?? (h.qty ?? 0) * price;
        return sum + value;
      }, 0);
      return liveHoldings.map((h) => {
        const price = h.price ?? STOCKS[h.ticker]?.price ?? 0;
        const value = h.value ?? (h.qty ?? 0) * price;
        const weight = totalValue > 0 ? (value / totalValue) * 100 : 0;
        return {
          key: h.ticker,
          title: formatTicker(h.ticker),
          subtitle: STOCKS[h.ticker]?.name ?? '',
          weight,
          itemReturn: periodReturnForTicker(h.ticker, h.pnlPct),
        };
      });
    }

    const tickers = portfolio.tickers ?? [];
    if (!tickers.length) return [];
    const equal = 100 / tickers.length;
    return tickers.map((ticker) => ({
      key: ticker,
      title: formatTicker(ticker),
      subtitle: STOCKS[ticker]?.name ?? '',
      weight: equal,
      itemReturn: periodReturnForTicker(ticker),
    }));
  }, [portfolio, returnPeriod]);

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
          <p className="text-sm text-pe-text-muted">Portfolio return · {returnPeriod}</p>
        </div>
        <p className={`shrink-0 w-16 text-right text-[15px] font-bold ${pnlClass(overallReturn)}`}>
          {formatPct(overallReturn)}
        </p>
      </div>
      {rows.map((row) => (
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
    </div>
  );
}
