import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowDownUp, Loader2, Search } from 'lucide-react';
import MarketingShell from '../../components/MarketingShell';
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
import { etfPath, resourcesPath } from '../../lib/routes';
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
      } ${active ? 'text-pe-text' : 'text-pe-text-muted'}`}
    >
      {label}
      {active ? (
        <span className="text-[10px]">{dir === 'asc' ? '↑' : '↓'}</span>
      ) : (
        <ArrowDownUp className="h-3 w-3 opacity-40" aria-hidden />
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

  return (
    <MarketingShell wide>
      <div className="mb-6">
        <Link
          to={resourcesPath()}
          className="inline-flex items-center gap-2 text-sm font-semibold text-pe-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Resources
        </Link>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-pe-accent">
          Resources
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-pe-text md:text-4xl">
          ETF iNAV tracker
        </h1>
        <p className="mt-3 text-sm text-pe-text-secondary">
          {quotesLabel ? (
            <>
              Last fetched{' '}
              <time dateTime={quoteSyncedAt} className="font-semibold tabular-nums text-pe-text">
                {quotesLabel}
              </time>
              {quotesRefreshing ? (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-pe-text-muted">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  refreshing
                </span>
              ) : null}
            </>
          ) : (
            <span className="inline-flex items-center gap-2 text-pe-text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Fetching live quotes…
            </span>
          )}
        </p>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {!error || items.length ? (
        <>
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-2">
              <label className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pe-text-muted"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search symbol or name"
                  className="w-full rounded-lg border border-pe-border bg-pe-canvas py-2.5 pl-9 pr-3 text-sm text-pe-text outline-none ring-pe-accent focus:ring-2"
                />
              </label>
              <p className="shrink-0 text-xs tabular-nums text-pe-text-muted">{filtered.length}</p>
            </div>

            <label className="block sm:hidden">
              <span className="sr-only">Category</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full appearance-none rounded-lg border border-pe-border bg-pe-canvas py-2.5 pl-3 pr-8 text-sm font-medium text-pe-text outline-none ring-pe-accent focus:ring-2"
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
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'bg-pe-text text-pe-canvas'
                        : 'bg-pe-surface text-pe-text-secondary hover:bg-pe-border/60'
                    }`}
                  >
                    {opt.shortLabel}
                    <span
                      className={`ml-1.5 tabular-nums ${active ? 'opacity-70' : 'text-pe-text-muted'}`}
                    >
                      {opt.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-pe-border bg-pe-canvas shadow-sm">
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
                    <td colSpan={4} className="py-10 text-center text-sm text-pe-text-muted">
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
                          className="font-semibold text-pe-accent hover:underline"
                        >
                          {row.symbol}
                        </Link>
                        {etfName ? (
                          <p className="mt-0.5 max-w-[220px] text-[12px] leading-snug text-pe-text-secondary sm:max-w-[280px]">
                            {etfName}
                          </p>
                        ) : null}
                      </td>
                      <td className={`text-right tabular-nums font-semibold ${tone}`}>
                        <span>{formatPremiumPct(row.premiumPct)}</span>
                        <span className="mt-0.5 block text-[10px] font-medium opacity-80">
                          {premiumLabel(row.premium)}
                        </span>
                      </td>
                      <td className="text-right tabular-nums">{formatPrice(row.ltp)}</td>
                      <td className="text-right tabular-nums">
                        {formatPrice(row.inav)}
                        {row.usedNseFallback ? (
                          <span
                            className="mt-0.5 block text-[10px] font-medium text-pe-text-muted"
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
                    <td colSpan={4} className="py-10 text-center text-sm text-pe-text-muted">
                      No ETFs match this filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-pe-text-muted">
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
