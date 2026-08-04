import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownUp, Loader2, Search } from 'lucide-react';
import MarketingShell from '../../components/MarketingShell';
import ResourcesPageHeader from '../../components/ResourcesPageHeader';
import {
  ETF_INAV_CATEGORIES,
  ETF_INAV_CATEGORY_SHORT,
  formatPremiumPct,
  formatPrice,
  formatSnapshotTime,
  loadEtfInavSnapshot,
  premiumLabel,
  premiumTone,
} from '../../lib/etfInav/format';
import {
  ETF_INAV_POLL_MS,
  catalogItemsWithoutQuotes,
  fetchMergedLiveQuotes,
  mergeLiveIntoSnapshotItems,
  shouldPollEtfInav,
} from '../../lib/etfInav/liveQuotes';
import { etfPath } from '../../lib/routes';
import { useSeoMeta } from '../../hooks/useSeoMeta';
import '../../components/mfScreener/mfScreener.css';

const ALL_ID = 'all';

function SortHeader({ label, active, dir, onClick, align = 'left' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 font-semibold ${
        align === 'right' ? 'justify-end w-full' : ''
      } ${active ? 'text-[var(--fv-text)]' : 'text-[var(--fv-text-muted)]'}`}
    >
      {label}
      {active ? (
        <span className="text-[12px]">{dir === 'asc' ? '↑' : '↓'}</span>
      ) : (
        <ArrowDownUp className="h-3 w-3 opacity-40" aria-hidden strokeWidth={2} />
      )}
    </button>
  );
}

export default function EtfInavPage() {
  useSeoMeta({
    title: 'ETF iNAV tracker',
    description: 'Live LTP and NAV for NSE ETFs, with premium or discount versus NAV.',
    path: '/resources/etf-inav',
  });
  const [snapshot, setSnapshot] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quoteSyncedAt, setQuoteSyncedAt] = useState(null);
  const [quotesRefreshing, setQuotesRefreshing] = useState(false);
  const [categoryId, setCategoryId] = useState(ALL_ID);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('premiumPct');
  const [sortDir, setSortDir] = useState('desc');
  const snapshotRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    let catalog = null;

    async function refreshQuotes({ isRefresh = false } = {}) {
      const base = snapshotRef.current;
      if (!base?.items?.length) return;
      if (isRefresh) setQuotesRefreshing(true);
      try {
        const live = await fetchMergedLiveQuotes();
        if (cancelled) return;
        setItems(mergeLiveIntoSnapshotItems(base.items, live.items));
        setQuoteSyncedAt(live.syncedAt || new Date().toISOString());
        setError(null);
      } catch (err) {
        if (!cancelled && !isRefresh) {
          setError(err?.message || 'Failed to load ETF quotes');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setQuotesRefreshing(false);
        }
      }
    }

    function schedule() {
      if (timer) clearInterval(timer);
      timer = null;
      if (!shouldPollEtfInav()) return;
      timer = setInterval(() => {
        if (shouldPollEtfInav()) refreshQuotes({ isRefresh: true });
      }, ETF_INAV_POLL_MS);
    }

    (async () => {
      try {
        const dataPromise = loadEtfInavSnapshot();
        const livePromise = fetchMergedLiveQuotes().catch((err) => {
          console.warn('ETF LTP preload failed', err);
          return null;
        });

        const data = await dataPromise;
        if (cancelled) return;
        catalog = data;
        snapshotRef.current = data;
        setSnapshot(data);
        // Paint AMC iNAV immediately; LTP merges when DB returns.
        setItems(catalogItemsWithoutQuotes(data.items || []));
        setLoading(false);

        const live = await livePromise;
        if (cancelled) return;
        if (live?.items?.length) {
          setItems(mergeLiveIntoSnapshotItems(data.items || [], live.items));
          setQuoteSyncedAt(live.syncedAt || new Date().toISOString());
        } else {
          await refreshQuotes();
        }
        schedule();
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load ETF iNAV data');
          setLoading(false);
        }
      }
    })();

    function onVisibility() {
      if (document.hidden) {
        if (timer) clearInterval(timer);
        timer = null;
        return;
      }
      if (catalog || snapshotRef.current) {
        refreshQuotes({ isRefresh: true });
        schedule();
      }
    }

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const counts = Object.fromEntries(ETF_INAV_CATEGORIES.map((c) => [c, 0]));
    for (const item of items) {
      if (counts[item.category] != null) counts[item.category] += 1;
    }
    return [
      { id: ALL_ID, label: 'All', shortLabel: 'All', count: items.length },
      ...ETF_INAV_CATEGORIES.map((c) => ({
        id: c,
        label: c,
        shortLabel: ETF_INAV_CATEGORY_SHORT[c] || c,
        count: counts[c] || 0,
      })),
    ];
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = items;
    if (categoryId !== ALL_ID) {
      rows = rows.filter((r) => r.category === categoryId);
    }
    if (q) {
      rows = rows.filter(
        (r) =>
          r.symbol.toLowerCase().includes(q) ||
          (r.name || '').toLowerCase().includes(q) ||
          (r.etfName || '').toLowerCase().includes(q) ||
          (r.amc || '').toLowerCase().includes(q),
      );
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    const sorted = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return a.symbol.localeCompare(b.symbol);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string' || typeof bv === 'string') {
        return dir * String(av).localeCompare(String(bv));
      }
      return dir * (Number(av) - Number(bv));
    });
    return sorted;
  }, [items, categoryId, query, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'symbol' ? 'asc' : 'desc');
    }
  }

  const quotesLabel = formatSnapshotTime(quoteSyncedAt);

  const meta = quotesLabel ? (
    <p className="fv-caption">
      Last fetched{' '}
      <time dateTime={quoteSyncedAt} className="font-semibold tabular-nums text-[var(--fv-text)]">
        {quotesLabel}
      </time>
      {quotesRefreshing ? (
        <span className="ml-2 inline-flex items-center gap-1 text-[var(--fv-text-muted)]">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          refreshing
        </span>
      ) : (
        <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--fv-positive)]/12 px-2 py-0.5 text-[11px] font-semibold text-[var(--fv-positive)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--fv-positive)]" />
          Live
        </span>
      )}
    </p>
  ) : (
    <span className="inline-flex items-center gap-2 fv-caption">
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      Fetching live quotes…
    </span>
  );

  return (
    <MarketingShell wide>
      <ResourcesPageHeader title="ETF iNAV tracker" meta={meta} />

      {error ? (
        <p className="mb-4 rounded-[16px] bg-[var(--fv-negative)]/8 px-4 py-3 text-sm text-[var(--fv-negative)]">
          {error}
        </p>
      ) : null}

      {!error || items.length ? (
        <>
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-3">
              <label className="relative w-full max-w-[240px]">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-[var(--fv-text-muted)]"
                  aria-hidden
                  strokeWidth={2}
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search symbol or name"
                  className="fv-search"
                />
              </label>
              <p className="fv-caption shrink-0 tabular-nums">{filtered.length}</p>
            </div>

            <label className="block sm:hidden">
              <span className="sr-only">Category</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full appearance-none rounded-full border border-[var(--fv-border)] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[var(--fv-text)] outline-none focus:border-[var(--fv-accent)]"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                }}
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label} ({opt.count})
                  </option>
                ))}
              </select>
            </label>

            <div
              className="hidden gap-1.5 overflow-x-auto pb-1 sm:flex"
              role="tablist"
              aria-label="ETF categories"
            >
              {categoryOptions.map((opt) => {
                const active = opt.id === categoryId;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    title={opt.label}
                    onClick={() => setCategoryId(opt.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium transition duration-150 ${
                      active
                        ? 'bg-[var(--fv-text)] text-white'
                        : 'bg-black/[0.04] text-[var(--fv-text-secondary)] hover:bg-black/[0.06]'
                    }`}
                  >
                    {opt.shortLabel}
                    <span
                      className={`ml-1.5 tabular-nums ${active ? 'opacity-70' : 'text-[var(--fv-text-muted)]'}`}
                    >
                      {opt.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto rounded-[20px] bg-white shadow-[var(--fv-shadow)]">
            <table className="mf-screener-table w-full min-w-[480px]">
              <thead>
                <tr>
                  <th className="text-left">
                    <SortHeader
                      label="ETF"
                      active={sortKey === 'symbol'}
                      dir={sortDir}
                      onClick={() => toggleSort('symbol')}
                    />
                  </th>
                  <th className="text-right">
                    <SortHeader
                      label="Premium"
                      active={sortKey === 'premiumPct'}
                      dir={sortDir}
                      onClick={() => toggleSort('premiumPct')}
                      align="right"
                    />
                  </th>
                  <th className="text-right">
                    <SortHeader
                      label="LTP"
                      active={sortKey === 'ltp'}
                      dir={sortDir}
                      onClick={() => toggleSort('ltp')}
                      align="right"
                    />
                  </th>
                  <th className="text-right">
                    <SortHeader
                      label="iNAV"
                      active={sortKey === 'inav'}
                      dir={sortDir}
                      onClick={() => toggleSort('inav')}
                      align="right"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && !quoteSyncedAt ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-sm text-[var(--fv-text-muted)]">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Loading quotes…
                      </span>
                    </td>
                  </tr>
                ) : null}
                {filtered.map((row) => {
                  const tone = premiumTone(row.premium);
                  const etfName = row.etfName || row.name;
                  return (
                    <tr key={row.symbol}>
                      <td className="!whitespace-normal">
                        <Link
                          to={etfPath(row.symbol)}
                          className="font-semibold text-[var(--fv-accent)] hover:underline"
                        >
                          {row.symbol}
                        </Link>
                        {etfName ? (
                          <p className="mt-0.5 max-w-[220px] text-[12px] leading-snug text-[var(--fv-text-secondary)] sm:max-w-[280px]">
                            {etfName}
                          </p>
                        ) : null}
                      </td>
                      <td className={`text-right tabular-nums font-semibold ${tone}`}>
                        <span>{formatPremiumPct(row.premiumPct)}</span>
                        <span className="mt-0.5 block text-[12px] font-medium opacity-80">
                          {premiumLabel(row.premium)}
                        </span>
                      </td>
                      <td className="text-right tabular-nums">{formatPrice(row.ltp)}</td>
                      <td className="text-right tabular-nums">
                        {formatPrice(row.inav)}
                        {row.usedNseFallback ? (
                          <span
                            className="mt-0.5 block text-[12px] font-medium text-[var(--fv-text-muted)]"
                            title="AMC iNAV premium/discount exceeded 30%; using NSE iNAV"
                          >
                            NSE iNAV
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {!loading && quoteSyncedAt && !filtered.length ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-sm text-[var(--fv-text-muted)]">
                      No ETFs match this filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <p className="fv-caption mt-4 leading-relaxed">
            iNAV prefers AMC indicative NAV scrapes (refreshed ~every minute). LTP is live NSE. If
            |premium vs AMC| exceeds 30%, that row uses NSE iNAV instead. Both AMC and NSE iNAV are
            stored for analysis. Premium = LTP ÷ displayed iNAV. This is not investment advice.
            {snapshot?.counts?.items != null ? ` ${snapshot.counts.items} ETFs tracked.` : null}
          </p>
        </>
      ) : null}
    </MarketingShell>
  );
}
