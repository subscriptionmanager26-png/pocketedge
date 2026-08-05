import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, MessageSquare, Plus, Search, X } from 'lucide-react';
import {
  getRailIndexIds,
  getRailSectorIds,
  setRailIndexIds,
  setRailSectorIds,
  RAIL_MAX_INDICES,
  RAIL_MAX_SECTORS,
} from '../../lib/feedRailPrefs';
import {
  isSectoralIndex,
  loadIndexCatalog,
  loadRailOverviewIndices,
  loadRailTrackedIndices,
  loadRailTrackedSectors,
} from '../../lib/feedRailData';
import { useMarketQuotePolling } from '../../hooks/useMarketQuoteRefresh';
import { isFollowing, toggleFollow } from '../../lib/socialGraphStore';
import { getAppCurrentUserId } from '../../lib/socialIdentity';
import { fetchUserPortfolios, peekUserPortfolios } from '../../lib/socialPortfolioApi';

function formatPct(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function pctClass(pct) {
  if (Number(pct) > 0) return 'text-[var(--fv-positive)]';
  if (Number(pct) < 0) return 'text-[var(--fv-negative)]';
  return 'text-[var(--fv-text-muted)]';
}

function Sparkline({ up = true, width = 56 }) {
  const stroke = up ? 'var(--fv-positive)' : 'var(--fv-negative)';
  return (
    <svg width={width} height="24" viewBox="0 0 64 28" fill="none" aria-hidden className="shrink-0">
      <path
        d={
          up
            ? 'M1 22 C10 20, 14 18, 20 14 S32 6, 40 10 S52 18, 63 4'
            : 'M1 6 C12 8, 16 14, 24 16 S40 12, 48 18 S56 24, 63 22'
        }
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

const MARKET_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'indices', label: 'Indices' },
  { id: 'sector', label: 'Sector' },
];

function IndexPicker({
  open,
  onClose,
  options,
  selectedIds,
  max,
  onChange,
  title,
}) {
  const rootRef = useRef(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) onClose();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 40);
    return options
      .filter((opt) => {
        const hay = `${opt.name} ${opt.symbol} ${opt.id}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 40);
  }, [options, query]);

  if (!open) return null;

  const toggle = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
      return;
    }
    if (selectedIds.length >= max) return;
    onChange([...selectedIds, id]);
  };

  return (
    <div
      ref={rootRef}
      className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-[14px] border border-[var(--fv-border)] bg-white shadow-[var(--fv-shadow-hover)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--fv-border)] px-3 py-2">
        <p className="text-[12px] font-semibold text-[var(--fv-text)]">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-[var(--fv-text-muted)] hover:bg-black/[0.04]"
          aria-label="Close picker"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <div className="relative border-b border-[var(--fv-border)] px-3 py-2">
        <Search
          className="pointer-events-none absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--fv-text-muted)]"
          strokeWidth={2}
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search…"
          className="w-full rounded-lg border border-[var(--fv-border)] bg-white py-1.5 pl-8 pr-2 text-[13px] outline-none focus:border-pe-accent"
          autoFocus
        />
      </div>
      <ul className="max-h-56 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <li className="px-3 py-3 text-[12px] text-[var(--fv-text-muted)]">No matches.</li>
        ) : (
          filtered.map((opt) => {
            const active = selectedIds.includes(opt.id);
            const disabled = !active && selectedIds.length >= max;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(opt.id)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition ${
                    disabled
                      ? 'cursor-not-allowed text-[var(--fv-text-muted)] opacity-50'
                      : 'hover:bg-black/[0.03]'
                  } ${active ? 'text-[var(--fv-accent)]' : 'text-[var(--fv-text)]'}`}
                >
                  <span className="min-w-0 truncate font-medium">{opt.name}</span>
                  {active ? <Check className="h-4 w-4 shrink-0" strokeWidth={2} /> : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
      <p className="border-t border-[var(--fv-border)] px-3 py-2 text-[11px] text-[var(--fv-text-muted)]">
        {selectedIds.length}/{max} selected
      </p>
    </div>
  );
}

function MarketRow({ row, onOpen }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen?.(row)}
        className="flex w-full items-center justify-between gap-3 rounded-lg text-left transition hover:bg-black/[0.03]"
      >
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold uppercase tracking-wide text-[var(--fv-text)]">
            {row.name}
          </p>
          <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-[var(--fv-text)]">
            {row.value}
          </p>
          <p className={`text-[12px] font-semibold tabular-nums ${pctClass(row.changePct)}`}>
            {formatPct(row.changePct)}
          </p>
        </div>
        <Sparkline up={Number(row.changePct) >= 0} />
      </button>
    </li>
  );
}

export default function FeedRightRail({
  trending = [],
  discussions = [],
  people = [],
  stacked = false,
  live = false,
  guestMode = false,
  onOpenIndex,
  onOpenStock,
  onOpenPost,
  onOpenProfile,
  onCreatePortfolio,
  onRequireSignIn,
  onFollowChange,
}) {
  const [marketTab, setMarketTab] = useState('overview');
  const [overviewRows, setOverviewRows] = useState([]);
  const [indexRows, setIndexRows] = useState([]);
  const [sectorRows, setSectorRows] = useState([]);
  const [indexIds, setIndexIds] = useState(() => getRailIndexIds());
  const [sectorIds, setSectorIds] = useState(() => getRailSectorIds());
  const [catalog, setCatalog] = useState([]);
  const [picker, setPicker] = useState(null); // 'indices' | 'sector' | null
  const [peopleState, setPeopleState] = useState(people);
  const [showPortfolioCta, setShowPortfolioCta] = useState(() => guestMode);

  useEffect(() => {
    setPeopleState(people);
  }, [people]);

  useEffect(() => {
    if (guestMode) {
      setShowPortfolioCta(true);
      return undefined;
    }

    const ownerId = getAppCurrentUserId();
    if (!ownerId) {
      setShowPortfolioCta(true);
      return undefined;
    }

    const hasPortfolio = (rows) =>
      (rows ?? []).some((p) => p && !p.isDraft && !p.isArchived);

    const cached = peekUserPortfolios(ownerId);
    if (Array.isArray(cached)) {
      setShowPortfolioCta(!hasPortfolio(cached));
      if (hasPortfolio(cached)) return undefined;
    }

    let cancelled = false;
    fetchUserPortfolios(ownerId)
      .then((rows) => {
        if (!cancelled) setShowPortfolioCta(!hasPortfolio(rows));
      })
      .catch(() => {
        if (!cancelled) setShowPortfolioCta(true);
      });

    return () => {
      cancelled = true;
    };
  }, [guestMode]);

  useEffect(() => {
    let cancelled = false;
    loadRailOverviewIndices()
      .then((rows) => {
        if (!cancelled) setOverviewRows(rows);
      })
      .catch(() => {
        if (!cancelled) setOverviewRows([]);
      });
    loadIndexCatalog()
      .then((rows) => {
        if (!cancelled) setCatalog(rows);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshMarketToday = useCallback(async () => {
    const [overview, indices, sectors] = await Promise.all([
      loadRailOverviewIndices().catch(() => null),
      loadRailTrackedIndices().catch(() => null),
      loadRailTrackedSectors().catch(() => null),
    ]);
    if (overview) setOverviewRows(overview);
    if (indices) setIndexRows(indices);
    if (sectors) setSectorRows(sectors);
  }, []);

  useMarketQuotePolling({
    assetType: 'index',
    enabled: true,
    onRefresh: refreshMarketToday,
    deps: [indexIds, sectorIds],
  });

  // One forced refresh when returning to the tab after hours / overnight so we
  // are not stuck on a mid-session quote from the previous session.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) return;
      void refreshMarketToday();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refreshMarketToday]);

  useEffect(() => {
    let cancelled = false;
    loadRailTrackedIndices()
      .then((rows) => {
        if (!cancelled) setIndexRows(rows);
      })
      .catch(() => {
        if (!cancelled) setIndexRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [indexIds]);

  useEffect(() => {
    let cancelled = false;
    loadRailTrackedSectors()
      .then((rows) => {
        if (!cancelled) setSectorRows(rows);
      })
      .catch(() => {
        if (!cancelled) setSectorRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sectorIds]);

  const indexOptions = useMemo(
    () => catalog.filter((item) => !isSectoralIndex(item)),
    [catalog]
  );
  const sectorOptions = useMemo(() => catalog.filter((item) => isSectoralIndex(item)), [catalog]);

  const marketRows =
    marketTab === 'overview' ? overviewRows : marketTab === 'indices' ? indexRows : sectorRows;

  const shellClass = stacked
    ? 'flex flex-col gap-5'
    : 'hidden h-dvh w-[min(420px,32vw)] flex-col overflow-y-auto overscroll-y-contain bg-white px-4 py-4 md:fixed md:right-0 md:top-0 md:z-30 md:flex';

  const handleIndexIdsChange = (ids) => {
    const next = setRailIndexIds(ids);
    setIndexIds(next);
  };

  const handleSectorIdsChange = (ids) => {
    const next = setRailSectorIds(ids);
    setSectorIds(next);
  };

  const openPickerForTab = () => {
    if (marketTab === 'indices') setPicker('indices');
    if (marketTab === 'sector') setPicker('sector');
  };

  const emptyCopy =
    marketTab === 'indices'
      ? 'Track up to 2 indices you care about.'
      : marketTab === 'sector'
        ? 'Track up to 2 sector indices.'
        : null;

  return (
    <aside className={shellClass}>
      <div className={`flex flex-col gap-5 ${stacked ? '' : 'pb-8 pt-[72px]'}`}>
        {/* Market Today */}
        <section className="relative fv-card-rail p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[16px] font-semibold text-[var(--fv-text)]">Market Today</h2>
            {live ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fv-positive)]/12 px-2.5 py-1 text-[11px] font-semibold text-[var(--fv-positive)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--fv-positive)]" />
                Live
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex gap-1">
            {MARKET_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setMarketTab(t.id);
                  setPicker(null);
                }}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition duration-150 ${
                  marketTab === t.id
                    ? 'bg-[var(--fv-text)] text-white'
                    : 'text-[var(--fv-text-secondary)] hover:bg-black/[0.04]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {marketRows.length ? (
            <ul className="mt-4 space-y-3">
              {marketRows.map((row) => (
                <MarketRow
                  key={row.id}
                  row={row}
                  onOpen={() => onOpenIndex?.(row.id || row.symbol, row.seed ?? null)}
                />
              ))}
            </ul>
          ) : marketTab !== 'overview' ? (
            <div className="mt-4 rounded-[14px] border border-dashed border-[var(--fv-border)] px-3 py-4 text-center">
              <p className="text-[13px] text-[var(--fv-text-secondary)]">{emptyCopy}</p>
              <button
                type="button"
                onClick={openPickerForTab}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--fv-accent)]/10 px-3.5 py-1.5 text-[12px] font-semibold text-[var(--fv-accent)] transition hover:bg-[var(--fv-accent)] hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                {marketTab === 'indices' ? 'Add indices' : 'Add sectors'}
              </button>
            </div>
          ) : (
            <p className="mt-4 text-[13px] text-[var(--fv-text-muted)]">Loading Nifty 50 &amp; Nifty 500…</p>
          )}

          {marketTab !== 'overview' && marketRows.length ? (
            <button
              type="button"
              onClick={openPickerForTab}
              className="mt-3 text-[12px] font-semibold text-[var(--fv-accent)] hover:underline"
            >
              Edit {marketTab === 'indices' ? 'indices' : 'sectors'}
            </button>
          ) : null}

          <IndexPicker
            open={picker === 'indices'}
            onClose={() => setPicker(null)}
            options={indexOptions}
            selectedIds={indexIds}
            max={RAIL_MAX_INDICES}
            onChange={handleIndexIdsChange}
            title="Choose indices (max 2)"
          />
          <IndexPicker
            open={picker === 'sector'}
            onClose={() => setPicker(null)}
            options={sectorOptions}
            selectedIds={sectorIds}
            max={RAIL_MAX_SECTORS}
            onChange={handleSectorIdsChange}
            title="Choose sectors (max 2)"
          />
        </section>

        {/* Trending */}
        <section className="fv-card-rail p-5">
          <h2 className="text-[16px] font-semibold text-[var(--fv-text)]">
            Trending on PocketEdge
          </h2>
          {trending.length ? (
            <ul className="mt-3 space-y-3">
              {trending.map((row) => (
                <li key={row.ticker}>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenStock?.(row.ticker, {
                        kind: 'stock',
                        assetType: row.assetType || 'stock',
                        seed: row.seed,
                      })
                    }
                    className="flex w-full items-center gap-3 rounded-lg text-left transition hover:bg-black/[0.03]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--fv-accent)]/10 text-[12px] font-bold text-[var(--fv-accent)]">
                      {String(row.ticker).slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-[var(--fv-text)]">
                        {row.name}
                      </p>
                      <p className="fv-caption">{row.ticker}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-[13px] font-semibold tabular-nums ${pctClass(row.changePct)}`}>
                        {formatPct(row.changePct)}
                      </p>
                      <Sparkline up={Number(row.changePct) >= 0} width={48} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-[var(--fv-text-muted)]">No movers yet.</p>
          )}
        </section>

        {/* Top Discussions */}
        <section className="fv-card-rail p-5">
          <h2 className="text-[16px] font-semibold text-[var(--fv-text)]">Top Discussions</h2>
          {discussions.length ? (
            <ul className="mt-3 space-y-3">
              {discussions.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => onOpenPost?.(d.id)}
                    className="flex w-full items-start gap-2.5 rounded-lg text-left transition hover:bg-black/[0.03]"
                  >
                    <MessageSquare
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fv-text-muted)]"
                      strokeWidth={2}
                    />
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium leading-snug text-[var(--fv-text)]">
                        {d.title}
                      </p>
                      <p className="fv-caption mt-0.5">
                        {d.likes ?? 0} likes
                        {d.replies != null ? ` · ${d.replies} replies` : ''}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-[var(--fv-text-muted)]">No discussions yet.</p>
          )}
        </section>

        {/* People to Follow */}
        <section className="fv-card-rail p-5">
          <h2 className="text-[16px] font-semibold text-[var(--fv-text)]">People to Follow</h2>
          {peopleState.length ? (
            <ul className="mt-3 space-y-3.5">
              {peopleState.map((p) => {
                const following = p.following ?? isFollowing(p.id);
                return (
                  <li key={p.id} className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onOpenProfile?.(p.id)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition hover:opacity-90"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--fv-accent)]/12 text-[14px] font-semibold text-[var(--fv-accent)]">
                        {p.avatar}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-[var(--fv-text)]">
                          {p.name}
                        </p>
                        <p className="fv-caption truncate">
                          {p.followerCount != null
                            ? `${p.followerCount} followers`
                            : p.role || p.focus}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (guestMode) {
                          onRequireSignIn?.();
                          return;
                        }
                        const next = await toggleFollow(p.id);
                        setPeopleState((prev) =>
                          prev.map((row) =>
                            row.id === p.id ? { ...row, following: next } : row
                          )
                        );
                        onFollowChange?.();
                      }}
                      className={`shrink-0 rounded-full border-0 px-3 py-1.5 text-[12px] font-semibold transition ${
                        following
                          ? 'bg-black/[0.06] text-[var(--fv-text-secondary)]'
                          : 'bg-[var(--fv-accent)]/10 text-[var(--fv-accent)] hover:bg-[var(--fv-accent)] hover:text-white'
                      }`}
                    >
                      {following ? 'Following' : 'Follow'}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-[var(--fv-text-muted)]">No people to suggest yet.</p>
          )}
        </section>

        {/* Portfolio CTA — only when the signed-in user has no published portfolio yet */}
        {showPortfolioCta ? (
          <section className="fv-card-rail overflow-hidden bg-gradient-to-br from-[#fff4ec] via-white to-[#ffe8d6] p-5">
            <h2 className="text-[16px] font-semibold text-[var(--fv-text)]">Create My Portfolio</h2>
            <p className="fv-meta mt-1.5 leading-relaxed">
              Upload broker holdings in under 2 minutes. Form signals and PnL light up after your
              first import.
            </p>
            <button
              type="button"
              onClick={() => {
                if (guestMode) {
                  onRequireSignIn?.();
                  return;
                }
                void onCreatePortfolio?.();
              }}
              className="fv-btn-primary mt-4 h-10 w-full text-[14px]"
            >
              Get started
            </button>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
