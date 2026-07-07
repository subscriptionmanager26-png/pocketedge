import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Pencil, Plus, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import PostCard from '../components/PostCard';
import ProfileHero from '../components/ProfileHero';
import UnderlineTabs from '../components/UnderlineTabs';
import {
  CURRENT_USER,
  POSTS,
  STOCKS,
  addUserPortfolio,
  applyPortfolioHoldingsUpdate,
  getPerson,
  getUserPortfolio,
  getUserPortfolios,
  getUserTrades,
  recalcHolding,
} from '../data/mockData';
import { isFollowing, toggleFollow } from '../lib/socialGraphStore';
import { formatInr, formatPct, formatPrice, pnlClass, timeAgo } from '../lib/format';
import { formatTicker } from '../lib/tickers';

const PROFILE_TABS = [
  { id: 'posts', label: 'Posts' },
  { id: 'about', label: 'About me' },
  { id: 'portfolios', label: 'Portfolios' },
  { id: 'trades', label: 'Trades' },
];

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

  const bumpPortfolios = () => setPortfolioVersion((v) => v + 1);
  const bumpTrades = () => setTradesVersion((v) => v + 1);

  const [name, setName] = useState(CURRENT_USER.name ?? '');
  const [bio, setBio] = useState(CURRENT_USER.bio ?? '');
  const [location, setLocation] = useState(CURRENT_USER.location ?? '');
  const [focus, setFocus] = useState(CURRENT_USER.focus ?? '');
  const [following, setFollowingState] = useState(false);

  useEffect(() => {
    if (!isOwn && !isMePublic) {
      setFollowingState(isFollowing(person.id));
    }
  }, [person.id, isOwn, isMePublic]);

  const authorPosts = (posts ?? POSTS).filter((p) => p.authorId === person.id);
  const tabs = PROFILE_TABS;
  const selectedPortfolio = useMemo(
    () =>
      selectedPortfolioId ? getUserPortfolio(person.id, selectedPortfolioId) : null,
    [person.id, selectedPortfolioId, portfolioVersion]
  );

  useEffect(() => {
    setTab('posts');
    setAboutEditing(false);
    onClearPortfolio?.();
  }, [userId, mode]);

  const handleAddPortfolio = () => {
    const created = addUserPortfolio(CURRENT_USER.id, {
      id: `pf_${Date.now()}`,
      name: 'Untitled portfolio',
      objective: '',
      thesis: '',
      totalValue: 0,
      invested: 0,
      totalPnlPct: 0,
      xirr: 0,
      holdings: [],
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

  const handleTabChange = (next) => {
    setTab(next);
    setAboutEditing(false);
    onClearPortfolio?.();
  };

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
          onSelectPortfolio={onSelectPortfolio}
          onAddPortfolio={handleAddPortfolio}
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

function PortfoliosListPanel({
  userId,
  canEdit,
  portfolioVersion,
  onSelectPortfolio,
  onAddPortfolio,
}) {
  void portfolioVersion;
  const portfolios = getUserPortfolios(userId);

  return (
    <div className="px-4 pb-5">
      {!portfolios.length ? (
        <p className="py-10 text-center text-sm text-pe-text-secondary">
          {canEdit ? 'No portfolios yet.' : 'No portfolios published yet.'}
        </p>
      ) : (
        <div className="divide-y divide-pe-border border-b border-pe-border">
          {portfolios.map((portfolio) => (
            <button
              key={portfolio.id}
              type="button"
              onClick={() => onSelectPortfolio?.(portfolio.id)}
              className="flex w-full items-center justify-between gap-4 py-4 text-left transition hover:bg-pe-surface"
            >
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-pe-text">{portfolio.name}</p>
                {portfolio.thesis ? (
                  <p className="mt-1 font-serif text-sm leading-6 text-pe-text-secondary">
                    {portfolio.thesis}
                  </p>
                ) : null}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-pe-text-muted" />
            </button>
          ))}
        </div>
      )}

      {canEdit && (
        <button
          type="button"
          onClick={onAddPortfolio}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-pe-border-strong px-4 py-3.5 text-sm font-semibold text-pe-text-secondary transition hover:border-pe-accent hover:text-pe-accent"
        >
          <Plus className="h-4 w-4" />
          Add portfolio
        </button>
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
  onPortfolioUpdated,
  onBack,
}) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState(portfolio.name);
  const [objective, setObjective] = useState(portfolio.objective ?? '');
  const [thesis, setThesis] = useState(portfolio.thesis ?? '');
  const [editHoldings, setEditHoldings] = useState([]);
  const [addTicker, setAddTicker] = useState('');

  useEffect(() => {
    setName(portfolio.name);
    setObjective(portfolio.objective ?? '');
    setThesis(portfolio.thesis ?? '');
    setEditing(false);
  }, [portfolio.id, portfolio.name, portfolio.objective, portfolio.thesis]);

  const startEditing = () => {
    setEditHoldings(portfolio.holdings.map((h) => ({ ...h })));
    setAddTicker('');
    setEditing(true);
  };

  const saveEdits = () => {
    applyPortfolioHoldingsUpdate(userId, portfolio.id, editHoldings, {
      name: name.trim() || portfolio.name,
      objective: objective.trim(),
      thesis: thesis.trim(),
    });
    onPortfolioUpdated?.();
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const cancelEdits = () => {
    setName(portfolio.name);
    setObjective(portfolio.objective ?? '');
    setThesis(portfolio.thesis ?? '');
    setEditHoldings([]);
    setAddTicker('');
    setEditing(false);
  };

  const updateHolding = (ticker, patch) => {
    setEditHoldings((prev) =>
      prev.map((h) => (h.ticker === ticker ? recalcHolding({ ...h, ...patch }) : h))
    );
  };

  const removeHolding = (ticker) => {
    setEditHoldings((prev) => prev.filter((h) => h.ticker !== ticker));
  };

  const addHolding = () => {
    const ticker = addTicker.trim().toUpperCase();
    if (!ticker || !STOCKS[ticker] || editHoldings.some((h) => h.ticker === ticker)) return;
    const price = STOCKS[ticker].price ?? 0;
    setEditHoldings((prev) => [
      ...prev,
      recalcHolding({ ticker, qty: 1, avg: price, price }),
    ]);
    setAddTicker('');
  };

  const availableTickers = Object.keys(STOCKS).filter(
    (t) => !editHoldings.some((h) => h.ticker === t)
  );

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
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pe-accent">
              Portfolio
            </p>
            {editing ? (
              <div className="mt-3 space-y-4">
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
                <h2 className="mt-0.5 font-serif text-2xl font-bold text-pe-text">{portfolio.name}</h2>
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
          <div className="mt-4 grid grid-cols-2 gap-3">
            {portfolio.totalValue != null && portfolio.totalValue > 0 && (
              <MetricTile
                label="Total value"
                value={formatInr(portfolio.totalValue, { compact: true })}
                sub={
                  portfolio.totalPnlPct != null
                    ? `${formatPct(portfolio.totalPnlPct)} all-time`
                    : undefined
                }
                tone={portfolio.totalPnlPct}
              />
            )}
            <MetricTile
              label="XIRR"
              value={formatPct(portfolio.xirr, { signed: false })}
              sub="Track record"
              tone={portfolio.xirr}
            />
            <MetricTile
              label="Holdings"
              value={String(portfolio.holdings.length)}
              sub="Positions"
            />
          </div>
        )}
      </div>

      {editing ? (
        <div className="px-4 py-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
            Holdings
          </p>
          <p className="mt-1 text-sm text-pe-text-secondary">
            Add, update, or remove stocks. Changes are logged in Trades automatically.
          </p>

          <div className="mt-4 space-y-3">
            {editHoldings.map((h) => {
              const stock = STOCKS[h.ticker];
              return (
                <div
                  key={h.ticker}
                  className="rounded-[10px] border border-pe-border px-3.5 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[15px] font-semibold text-pe-text">{formatTicker(h.ticker)}</p>
                      <p className="text-sm text-pe-text-muted">{stock?.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeHolding(h.ticker)}
                      className="text-sm font-semibold text-pe-negative hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label="Quantity">
                      <input
                        type="number"
                        min="1"
                        value={h.qty}
                        onChange={(e) =>
                          updateHolding(h.ticker, { qty: Number(e.target.value) || 0 })
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Avg cost">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={h.avg}
                        onChange={(e) =>
                          updateHolding(h.ticker, { avg: Number(e.target.value) || 0 })
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex gap-2">
            <select
              value={addTicker}
              onChange={(e) => setAddTicker(e.target.value)}
              className={`${inputClass} min-w-0 flex-1`}
            >
              <option value="">Add a stock…</option>
              {availableTickers.map((t) => (
                <option key={t} value={t}>
                  {t} — {STOCKS[t]?.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addHolding}
              disabled={!addTicker}
              className="shrink-0 rounded-md bg-pe-accent px-4 py-2 text-sm font-bold text-white hover:bg-pe-accent-pressed disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-pe-border px-4">
          {portfolio.holdings.length === 0 ? (
            <p className="py-10 text-center text-sm text-pe-text-secondary">
              No holdings yet. Tap Edit to add stocks.
            </p>
          ) : (
            portfolio.holdings.map((h) => {
              const stock = STOCKS[h.ticker];
              return (
                <div key={h.ticker} className="flex items-center justify-between py-3.5">
                  <div>
                    <p className="text-[15px] font-semibold text-pe-text">{formatTicker(h.ticker)}</p>
                    <p className="text-sm text-pe-text-muted">{stock?.name}</p>
                    <p className="mt-0.5 text-xs text-pe-text-secondary">
                      {h.qty} shares · avg {formatPrice(h.avg)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-semibold text-pe-text">
                      {formatPrice(h.price ?? stock?.price)}
                    </p>
                    <p className={`text-sm font-semibold ${pnlClass(h.pnlPct)}`}>
                      {formatPct(h.pnlPct)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function MetricTile({ label, value, sub, tone }) {
  return (
    <div className="rounded-[10px] border border-pe-border bg-pe-surface px-3.5 py-3.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
        {label}
      </p>
      <p className={`mt-1.5 font-serif text-lg font-bold ${tone != null ? pnlClass(tone) : 'text-pe-text'}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-sm ${tone != null ? pnlClass(tone) : 'text-pe-text-muted'}`}>{sub}</p>
      )}
    </div>
  );
}
