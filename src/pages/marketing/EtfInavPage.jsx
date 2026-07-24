import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowDownUp, Loader2, Search } from 'lucide-react';
import MarketingShell from '../../components/MarketingShell';
import { ScreenerCategoryTabs } from '../../components/mfScreener/ScreenerCategoryTabs';
import {
  ETF_INAV_CATEGORIES,
  formatPremiumPct,
  formatPremiumRatio,
  formatPrice,
  formatSnapshotTime,
  loadEtfInavSnapshot,
  premiumLabel,
  premiumTone,
} from '../../lib/etfInav/format';
import {
  ETF_INAV_POLL_MS,
  fetchMergedLiveQuotes,
  mergeLiveIntoSnapshotItems,
  shouldPollEtfInav,
} from '../../lib/etfInav/liveQuotes';
import { etfPath, resourcesPath } from '../../lib/routes';
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
    (async () => {
      try {
        const data = await loadEtfInavSnapshot();
        if (cancelled) return;
        snapshotRef.current = data;
        setSnapshot(data);
        setItems(data.items || []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load ETF iNAV data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!snapshot?.items?.length) return undefined;

    let cancelled = false;
    let timer = null;

    async function refreshQuotes() {
      const base = snapshotRef.current;
      if (!base?.items?.length) return;
      setQuotesRefreshing(true);
      try {
        const symbols = base.items.map((row) => row.symbol);
        const live = await fetchMergedLiveQuotes(symbols);
        if (cancelled) return;
        const merged = mergeLiveIntoSnapshotItems(base.items, live.items);
        setItems(merged);
        setQuoteSyncedAt(live.syncedAt || new Date().toISOString());
      } catch {
        // Keep last good snapshot/live merge; don't wipe the table.
      } finally {
        if (!cancelled) setQuotesRefreshing(false);
      }
    }

    function schedule() {
      if (timer) clearInterval(timer);
      timer = null;
      if (!shouldPollEtfInav()) return;
      timer = setInterval(() => {
        if (shouldPollEtfInav()) refreshQuotes();
      }, ETF_INAV_POLL_MS);
    }

    refreshQuotes();
    schedule();

    function onVisibility() {
      if (document.hidden) {
        if (timer) clearInterval(timer);
        timer = null;
        return;
      }
      refreshQuotes();
      schedule();
    }

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [snapshot]);

  const categoryOptions = useMemo(() => {
    const counts = Object.fromEntries(ETF_INAV_CATEGORIES.map((c) => [c, 0]));
    for (const item of items) {
      if (counts[item.category] != null) counts[item.category] += 1;
    }
    return [
      { id: ALL_ID, label: 'All', count: items.length },
      ...ETF_INAV_CATEGORIES.map((c) => ({ id: c, label: c, count: counts[c] || 0 })),
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
      setSortDir(key === 'symbol' || key === 'etfName' ? 'asc' : 'desc');
    }
  }

  const quotesLabel = formatSnapshotTime(quoteSyncedAt);
  const withBoth = items.filter((r) => r.ltp != null && r.inav != null).length;

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
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-pe-text-secondary">
          Compare exchange last traded price with NAV. Premium is LTP ÷ NAV — above 1 is a
          premium (red), below 1 is a discount (green).
        </p>
        <p className="mt-2 text-xs text-pe-text-muted">
          {quotesLabel ? (
            <>
              Quotes {quotesLabel}
              {quotesRefreshing ? ' · refreshing…' : ' · live every minute in session'}
            </>
          ) : (
            'Loading live quotes…'
          )}
          {withBoth != null ? ` · ${withBoth} ETFs with LTP + NAV` : null}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-pe-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading ETF iNAV data…
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {!loading && !error ? (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block w-full max-w-md">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pe-text-muted"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search symbol, name, or AMC"
                className="w-full rounded-lg border border-pe-border bg-pe-canvas py-2.5 pl-9 pr-3 text-sm text-pe-text outline-none ring-pe-accent focus:ring-2"
              />
            </label>
            <p className="text-xs text-pe-text-muted">{filtered.length} shown</p>
          </div>

          <div className="mb-4 border-b border-pe-border">
            <ScreenerCategoryTabs
              options={categoryOptions}
              activeId={categoryId}
              onChange={setCategoryId}
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-pe-border bg-pe-canvas shadow-sm">
            <table className="mf-screener-table min-w-[720px]">
              <thead>
                <tr>
                  <th className="text-left">
                    <SortHeader
                      label="Symbol"
                      active={sortKey === 'symbol'}
                      dir={sortDir}
                      onClick={() => toggleSort('symbol')}
                    />
                  </th>
                  <th className="text-left">
                    <SortHeader
                      label="ETF"
                      active={sortKey === 'etfName'}
                      dir={sortDir}
                      onClick={() => toggleSort('etfName')}
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
                      label="NAV"
                      active={sortKey === 'inav'}
                      dir={sortDir}
                      onClick={() => toggleSort('inav')}
                      align="right"
                    />
                  </th>
                  <th className="text-right">
                    <SortHeader
                      label="LTP / NAV"
                      active={sortKey === 'premium'}
                      dir={sortDir}
                      onClick={() => toggleSort('premium')}
                      align="right"
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
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const tone = premiumTone(row.premium);
                  return (
                    <tr key={row.symbol}>
                      <td>
                        <Link
                          to={etfPath(row.symbol)}
                          className="font-semibold text-pe-accent hover:underline"
                        >
                          {row.symbol}
                        </Link>
                        {row.amc ? (
                          <p className="mt-0.5 text-[11px] text-pe-text-muted">{row.amc}</p>
                        ) : null}
                      </td>
                      <td>
                        <p className="max-w-[240px] truncate text-sm text-pe-text" title={row.etfName}>
                          {row.etfName || row.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-pe-text-muted">{row.category}</p>
                      </td>
                      <td className="text-right tabular-nums">{formatPrice(row.ltp)}</td>
                      <td className="text-right tabular-nums">{formatPrice(row.inav)}</td>
                      <td className={`text-right tabular-nums font-semibold ${tone}`}>
                        {formatPremiumRatio(row.premium)}
                      </td>
                      <td className={`text-right tabular-nums font-semibold ${tone}`}>
                        <span>{formatPremiumPct(row.premiumPct)}</span>
                        <span className="mt-0.5 block text-[10px] font-medium opacity-80">
                          {premiumLabel(row.premium)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-pe-text-muted">
                      No ETFs match this filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-pe-text-muted">
            LTP prefers live prices from PocketEdge (refreshed through the session); NAV is from
            NSE and refreshes about every minute while the market is open. If NSE NAV is missing,
            AMC indicative NAV is used. Premium = LTP ÷ NAV. This is not investment advice.
          </p>
        </>
      ) : null}
    </MarketingShell>
  );
}
