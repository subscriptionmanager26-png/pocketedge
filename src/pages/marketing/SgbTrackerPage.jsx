import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowDownUp, Loader2, Search } from 'lucide-react';
import MarketingShell from '../../components/MarketingShell';
import { lookupMarketAssetsBatch } from '../../lib/marketDataApi';
import { shouldPollMarket } from '../../lib/marketRefreshPolicy';
import {
  formatInr,
  formatPremiumPct,
  formatSyncedAt,
  IBJA_GOLD_999_KEY,
  loadSgbUniverse,
  maturityYearFromSymbol,
  premiumTone,
  sgbPremiumPct,
} from '../../lib/sgb/format';
import { resourcesPath } from '../../lib/routes';
import '../../components/mfScreener/mfScreener.css';

const ALL_YEARS = 'all';
const POLL_MS = 60_000;

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

function mergeUniverseWithQuotes(universeItems, quoteMap, goldPerGram) {
  return (universeItems || []).map((row) => {
    const key = String(row.symbol).toUpperCase();
    const quote = quoteMap.get(key) || quoteMap.get(row.symbol) || null;
    const ltp = quote?.price ?? quote?.ltp ?? null;
    return {
      symbol: key,
      isin: row.isin || quote?.isin || null,
      name: quote?.name || key,
      ltp,
      premiumPct: sgbPremiumPct(ltp, goldPerGram),
      maturityYear: maturityYearFromSymbol(key),
      syncedAt: quote?.syncedAt || null,
    };
  });
}

export default function SgbTrackerPage() {
  const [universe, setUniverse] = useState(null);
  const [items, setItems] = useState([]);
  const [goldSpot, setGoldSpot] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [yearId, setYearId] = useState(ALL_YEARS);
  const [sortKey, setSortKey] = useState('premiumPct');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function refreshQuotes(baseItems, { isRefresh = false } = {}) {
      if (!baseItems?.length) return;
      if (isRefresh) setRefreshing(true);
      try {
        // SGB LTP + IBJA gold both come from social_market_assets (BE).
        const symbols = [...baseItems.map((row) => row.symbol), IBJA_GOLD_999_KEY];
        const map = await lookupMarketAssetsBatch(symbols);
        if (cancelled) return;
        const goldQuote = map.get(IBJA_GOLD_999_KEY) || null;
        const goldPerGram =
          goldQuote?.price != null && Number.isFinite(Number(goldQuote.price))
            ? Number(goldQuote.price)
            : null;
        setGoldSpot(
          goldPerGram != null
            ? {
                price: goldPerGram,
                syncedAt: goldQuote?.syncedAt || null,
                asOfDate: goldQuote?.asOfDate || null,
              }
            : null,
        );
        setItems(mergeUniverseWithQuotes(baseItems, map, goldPerGram));
        setError(null);
      } catch (err) {
        if (!cancelled && !isRefresh) {
          setError(err?.message || 'Failed to load SGB prices');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    function schedule() {
      if (timer) clearInterval(timer);
      timer = null;
      if (!shouldPollMarket('bond')) return;
      timer = setInterval(() => {
        if (shouldPollMarket('bond') && universeItems) {
          refreshQuotes(universeItems, { isRefresh: true });
        }
      }, POLL_MS);
    }

    let universeItems = null;

    (async () => {
      try {
        const data = await loadSgbUniverse();
        if (cancelled) return;
        universeItems = data.items || [];
        setUniverse(data);
        await refreshQuotes(universeItems);
        schedule();
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load SGB universe');
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
      if (universeItems) {
        refreshQuotes(universeItems, { isRefresh: true });
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

  const yearOptions = useMemo(() => {
    const years = [...new Set(items.map((r) => r.maturityYear).filter(Boolean))].sort(
      (a, b) => a - b,
    );
    return [
      { id: ALL_YEARS, label: 'All years', count: items.length },
      ...years.map((y) => ({
        id: String(y),
        label: String(y),
        count: items.filter((r) => r.maturityYear === y).length,
      })),
    ];
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = items;
    if (yearId !== ALL_YEARS) {
      rows = rows.filter((r) => String(r.maturityYear) === yearId);
    }
    if (q) {
      rows = rows.filter(
        (r) =>
          r.symbol.toLowerCase().includes(q) ||
          (r.name || '').toLowerCase().includes(q) ||
          (r.isin || '').toLowerCase().includes(q),
      );
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
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
  }, [items, yearId, query, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'symbol' ? 'asc' : 'asc');
    }
  }

  const goldSyncedLabel = formatSyncedAt(goldSpot?.syncedAt);

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
          SGB tracker
        </h1>
        {goldSpot?.price != null ? (
          <p className="mt-3 text-sm text-pe-text-secondary">
            IBJA Fine Gold (999){' '}
            <span className="font-semibold tabular-nums text-pe-text">
              ₹{formatInr(goldSpot.price, 0)}/g
            </span>
            <span className="text-pe-text-muted"> excl. GST</span>
            {goldSyncedLabel ? (
              <>
                {' '}
                ·{' '}
                <time dateTime={goldSpot.syncedAt} className="tabular-nums text-pe-text">
                  {goldSyncedLabel}
                </time>
              </>
            ) : null}
            {refreshing ? (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-pe-text-muted">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                refreshing
              </span>
            ) : null}
          </p>
        ) : loading ? (
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-pe-text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Loading gold rate and SGB prices…
          </p>
        ) : (
          <p className="mt-3 text-sm text-pe-text-muted">IBJA gold rate unavailable</p>
        )}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
                  placeholder="Search symbol or series"
                  className="w-full rounded-lg border border-pe-border bg-pe-canvas py-2.5 pl-9 pr-3 text-sm text-pe-text outline-none ring-pe-accent focus:ring-2"
                />
              </label>
              <p className="shrink-0 text-xs tabular-nums text-pe-text-muted">{filtered.length}</p>
            </div>

            <label className="block sm:hidden">
              <span className="sr-only">Maturity year</span>
              <select
                value={yearId}
                onChange={(e) => setYearId(e.target.value)}
                className="w-full appearance-none rounded-lg border border-pe-border bg-pe-canvas py-2.5 pl-3 pr-8 text-sm font-medium text-pe-text outline-none ring-pe-accent focus:ring-2"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                }}
              >
                {yearOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label} ({opt.count})
                  </option>
                ))}
              </select>
            </label>

            <div className="hidden gap-1.5 overflow-x-auto pb-1 sm:flex" role="tablist" aria-label="Maturity year">
              {yearOptions.map((opt) => {
                const active = opt.id === yearId;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setYearId(opt.id)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'bg-pe-text text-pe-canvas'
                        : 'bg-pe-surface text-pe-text-secondary hover:bg-pe-border/60'
                    }`}
                  >
                    {opt.label}
                    <span className={`ml-1.5 tabular-nums ${active ? 'opacity-70' : 'text-pe-text-muted'}`}>
                      {opt.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-pe-border bg-pe-canvas shadow-sm">
            <table className="mf-screener-table w-full min-w-[360px]">
              <thead>
                <tr>
                  <th className="text-left">
                    <SortHeader
                      label="SGB"
                      active={sortKey === 'symbol'}
                      dir={sortDir}
                      onClick={() => toggleSort('symbol')}
                    />
                  </th>
                  <th className="text-right">
                    <SortHeader
                      label="Premium / Discount"
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
                </tr>
              </thead>
              <tbody>
                {loading && !items.length ? (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-sm text-pe-text-muted">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Loading…
                      </span>
                    </td>
                  </tr>
                ) : null}
                {filtered.map((row) => (
                  <tr key={row.symbol}>
                    <td className="font-semibold text-pe-text">{row.symbol}</td>
                    <td className={`text-right tabular-nums font-semibold ${premiumTone(row.premiumPct)}`}>
                      {formatPremiumPct(row.premiumPct)}
                    </td>
                    <td className="text-right tabular-nums">{formatInr(row.ltp)}</td>
                  </tr>
                ))}
                {!loading && !filtered.length ? (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-sm text-pe-text-muted">
                      No SGBs match this filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-pe-text-muted">
            SGB prices and IBJA Fine Gold (999) come from PocketEdge market data. Premium/discount is
            SGB LTP vs IBJA ₹/g (excl. GST). Gold is refreshed hourly 10:00–19:00 IST from{' '}
            <a
              href="https://ibja.co/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-pe-accent hover:underline"
            >
              ibja.co
            </a>
            .{' '}
            {universe?.counts?.items != null ? `${universe.counts.items} series tracked.` : null}{' '}
            This is not investment advice.
          </p>
        </>
      ) : null}
    </MarketingShell>
  );
}
