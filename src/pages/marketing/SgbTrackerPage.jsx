import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, Loader2, Search } from 'lucide-react';
import MarketingShell from '../../components/MarketingShell';
import ResourcesPageHeader from '../../components/ResourcesPageHeader';
import { listSgbMarketQuotes } from '../../lib/marketDataApi';
import { shouldPollMarket } from '../../lib/marketRefreshPolicy';
import {
  formatInr,
  formatPremiumPct,
  formatSyncedAt,
  loadSgbUniverse,
  maturityYearFromSymbol,
  premiumTone,
  sgbPremiumPct,
} from '../../lib/sgb/format';
import { useSeoMeta } from '../../hooks/useSeoMeta';
import '../../components/mfScreener/mfScreener.css';

const ALL_YEARS = 'all';
const POLL_MS = 60_000;

function SortHeader({ label, active, dir, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`sgb-sort ${active ? 'text-[var(--fv-text)]' : 'text-[var(--fv-text-muted)]'}`}
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

function buildRows(bondItems, goldPerGram, universeBySymbol) {
  return (bondItems || []).map((quote) => {
    const symbol = String(quote.symbol || '').toUpperCase();
    const uni = universeBySymbol.get(symbol);
    const ltp = quote.ltp ?? quote.price ?? null;
    return {
      symbol,
      isin: uni?.isin || quote.isin || null,
      name: quote.name || symbol,
      ltp,
      premiumPct: sgbPremiumPct(ltp, goldPerGram),
      maturityYear: maturityYearFromSymbol(symbol),
      syncedAt: quote.syncedAt || null,
    };
  });
}

export default function SgbTrackerPage() {
  useSeoMeta({
    title: 'SGB tracker',
    description:
      'Live Sovereign Gold Bond series prices, coupons, and maturity years on PocketEdge.',
    path: '/resources/sgb',
  });
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
    let universeBySymbol = new Map();

    async function refreshQuotes({ isRefresh = false } = {}) {
      if (isRefresh) setRefreshing(true);
      try {
        const live = await listSgbMarketQuotes();
        if (cancelled) return;
        const goldPerGram =
          live.gold?.price != null && Number.isFinite(Number(live.gold.price))
            ? Number(live.gold.price)
            : null;
        setGoldSpot(
          goldPerGram != null
            ? {
                price: goldPerGram,
                syncedAt: live.gold?.syncedAt || null,
                asOfDate: live.gold?.asOfDate || null,
              }
            : null,
        );
        setItems(buildRows(live.items, goldPerGram, universeBySymbol));
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
        if (shouldPollMarket('bond')) refreshQuotes({ isRefresh: true });
      }, POLL_MS);
    }

    (async () => {
      try {
        // Universe (static) + quotes (BE) in parallel — one RPC scan for all SGBs + gold.
        const [data, live] = await Promise.all([
          loadSgbUniverse().catch(() => null),
          listSgbMarketQuotes(),
        ]);
        if (cancelled) return;

        if (data?.items?.length) {
          setUniverse(data);
          universeBySymbol = new Map(
            data.items.map((row) => [String(row.symbol).toUpperCase(), row]),
          );
        }

        const goldPerGram =
          live.gold?.price != null && Number.isFinite(Number(live.gold.price))
            ? Number(live.gold.price)
            : null;
        setGoldSpot(
          goldPerGram != null
            ? {
                price: goldPerGram,
                syncedAt: live.gold?.syncedAt || null,
                asOfDate: live.gold?.asOfDate || null,
              }
            : null,
        );
        setItems(buildRows(live.items, goldPerGram, universeBySymbol));
        setError(null);
        setLoading(false);
        schedule();
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load SGB data');
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
      refreshQuotes({ isRefresh: true });
      schedule();
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
      setSortDir('asc');
    }
  }

  const goldSyncedLabel = formatSyncedAt(goldSpot?.syncedAt);

  const meta =
    goldSpot?.price != null ? (
      <p className="fv-caption">
        IBJA Fine Gold (999){' '}
        <span className="font-semibold tabular-nums text-[var(--fv-text)]">
          ₹{formatInr(goldSpot.price, 0)}/g
        </span>
        <span className="text-[var(--fv-text-muted)]"> excl. GST</span>
        {goldSyncedLabel ? (
          <>
            {' '}
            ·{' '}
            <time dateTime={goldSpot.syncedAt} className="tabular-nums text-[var(--fv-text)]">
              {goldSyncedLabel}
            </time>
          </>
        ) : null}
        {refreshing ? (
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
    ) : loading ? (
      <p className="inline-flex items-center gap-2 fv-caption">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Loading gold rate and SGB prices…
      </p>
    ) : (
      <p className="fv-caption">IBJA gold rate unavailable</p>
    );

  return (
    <MarketingShell wide>
      <ResourcesPageHeader title="SGB tracker" meta={meta} />

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
                  placeholder="Search symbol or series"
                  className="fv-search"
                />
              </label>
              <p className="fv-caption shrink-0 tabular-nums">{filtered.length}</p>
            </div>

            <label className="block sm:hidden">
              <span className="sr-only">Maturity year</span>
              <select
                value={yearId}
                onChange={(e) => setYearId(e.target.value)}
                className="w-full appearance-none rounded-full border border-[var(--fv-border)] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[var(--fv-text)] outline-none focus:border-[var(--fv-accent)]"
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

            <div
              className="hidden gap-1.5 overflow-x-auto pb-1 sm:flex"
              role="tablist"
              aria-label="Maturity year"
            >
              {yearOptions.map((opt) => {
                const active = opt.id === yearId;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setYearId(opt.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium transition duration-150 ${
                      active
                        ? 'bg-[var(--fv-text)] text-white'
                        : 'bg-black/[0.04] text-[var(--fv-text-secondary)] hover:bg-black/[0.06]'
                    }`}
                  >
                    {opt.label}
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
            <table className="mf-screener-table sgb-tracker-table w-full min-w-[360px]">
              <thead>
                <tr>
                  <th className="sgb-col-symbol">
                    <SortHeader
                      label="SGB"
                      active={sortKey === 'symbol'}
                      dir={sortDir}
                      onClick={() => toggleSort('symbol')}
                    />
                  </th>
                  <th className="sgb-col-prem">
                    <SortHeader
                      label="Premium / Discount"
                      active={sortKey === 'premiumPct'}
                      dir={sortDir}
                      onClick={() => toggleSort('premiumPct')}
                    />
                  </th>
                  <th className="sgb-col-ltp">
                    <SortHeader
                      label="LTP"
                      active={sortKey === 'ltp'}
                      dir={sortDir}
                      onClick={() => toggleSort('ltp')}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && !items.length ? (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-sm text-[var(--fv-text-muted)]">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Loading…
                      </span>
                    </td>
                  </tr>
                ) : null}
                {filtered.map((row) => (
                  <tr key={row.symbol}>
                    <td className="sgb-col-symbol font-semibold text-[var(--fv-text)]">
                      {row.symbol}
                    </td>
                    <td
                      className={`sgb-col-prem tabular-nums font-semibold ${premiumTone(row.premiumPct)}`}
                    >
                      {formatPremiumPct(row.premiumPct)}
                    </td>
                    <td className="sgb-col-ltp tabular-nums">{formatInr(row.ltp)}</td>
                  </tr>
                ))}
                {!loading && !filtered.length ? (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-sm text-[var(--fv-text-muted)]">
                      No SGBs match this filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <p className="fv-caption mt-4 leading-relaxed">
            SGB prices and IBJA Fine Gold (999) come from PocketEdge market data. Premium/discount is
            SGB LTP vs IBJA ₹/g (excl. GST). Gold is refreshed hourly 10:00–19:00 IST from{' '}
            <a
              href="https://ibja.co/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[var(--fv-accent)] hover:underline"
            >
              ibja.co
            </a>
            .{' '}
            {universe?.counts?.items != null
              ? `${universe.counts.items} series in universe.`
              : items.length
                ? `${items.length} series tracked.`
                : null}{' '}
            This is not investment advice.
          </p>
        </>
      ) : null}
    </MarketingShell>
  );
}
