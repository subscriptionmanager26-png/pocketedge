import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Filter, Loader2, Search, X } from 'lucide-react';
import MarketingShell from '../../components/MarketingShell';
import UnderlineTabs from '../../components/UnderlineTabs';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { formatPct } from '../../lib/format';
import {
  fetchDistinctStockIndustries,
  lookupStockIndustries,
} from '../../lib/marketDataApi';
import { normalizeNewsSummaryMarkdown } from '../../lib/normalizeNewsSummaryMarkdown';
import { stockPath } from '../../lib/routes';
import {
  fetchExplanationFeed,
  isStockNewsConfigured,
} from '../../lib/stockNewsApi';
import { ensureSupabase, isSupabaseConfigured } from '../../lib/supabase';

const SCOPE_TABS = [
  { id: 'stock', label: 'Stocks' },
  { id: 'index', label: 'Indices' },
  { id: 'commodity', label: 'Commodities' },
  { id: 'economics', label: 'Country' },
];

const DIRECTION_OPTIONS = [
  { id: 'any', label: 'Any direction' },
  { id: 'up', label: 'Up only' },
  { id: 'down', label: 'Down only' },
];

const SCOPE_COPY = {
  stock: {
    title: 'Stock-wise insights',
    body: 'Daily explanation summaries for equities — search a ticker or browse by move, industry, and date.',
  },
  index: {
    title: 'Index-wise insights',
    body: 'Daily explainers for market and sector indices.',
  },
  commodity: {
    title: 'Commodity-wise insights',
    body: 'Daily summaries for commodities with recent news coverage.',
  },
  economics: {
    title: 'Country-wide insights',
    body: 'Macro and country-level economics digests.',
  },
};

function todayIstYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function shiftYmd(ymd, deltaDays) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function formatChipDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(dt);
}

function buildDateOptions() {
  const today = todayIstYmd();
  const yesterday = shiftYmd(today, -1);
  const before = shiftYmd(today, -2);
  return [
    { id: today, label: 'Today' },
    { id: yesterday, label: 'Yesterday' },
    { id: before, label: formatChipDate(before) },
  ];
}

function extractInsightBullets(summary, limit = 3) {
  const normalized = normalizeNewsSummaryMarkdown(String(summary ?? ''));
  if (!normalized.trim()) return [];

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const bullets = [];
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line) || /^---+$/.test(line)) continue;
    const match = line.match(/^[-*•]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
    const text = (match ? match[1] : line).replace(/\*\*/g, '').trim();
    if (!text) continue;
    bullets.push(text);
    if (bullets.length >= limit) break;
  }
  return bullets;
}

function matchesMovement(changePct, direction, threshold) {
  const min = Number(threshold);
  const floor = Number.isFinite(min) && min > 0 ? min : 0;
  if (!Number.isFinite(changePct)) return floor === 0 && direction === 'any';

  if (direction === 'up') return changePct >= floor;
  if (direction === 'down') return changePct <= -floor;
  return Math.abs(changePct) >= floor;
}

function pnlClass(n) {
  if (!Number.isFinite(n) || n === 0) return 'text-pe-text';
  return n > 0 ? 'text-pe-positive' : 'text-pe-negative';
}

function FilterSheet({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:hidden" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border border-pe-border bg-pe-canvas shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-pe-border bg-pe-canvas px-4 py-3.5">
          <p className="text-[15px] font-bold text-pe-text">Filters</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-pe-text-secondary hover:bg-pe-surface"
            aria-label="Close filters"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 px-4 py-4">{children}</div>
        <div className="sticky bottom-0 border-t border-pe-border bg-pe-canvas px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md bg-pe-accent py-3 text-[15px] font-bold text-white hover:bg-pe-accent-pressed"
          >
            Show results
          </button>
        </div>
      </div>
    </div>
  );
}

function DateChips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              active
                ? 'bg-pe-accent text-white'
                : 'border border-pe-border bg-pe-canvas text-pe-text-secondary hover:border-pe-border-strong hover:text-pe-text'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function StockFilterFields({
  direction,
  setDirection,
  threshold,
  setThreshold,
  industry,
  setIndustry,
  industries,
}) {
  return (
    <>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-pe-text-muted">
          Direction
        </span>
        <select
          value={direction}
          onChange={(event) => setDirection(event.target.value)}
          className="w-full rounded-lg border border-pe-border bg-pe-canvas px-3 py-2.5 text-[15px] outline-none ring-pe-accent focus:ring-2"
        >
          {DIRECTION_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-pe-text-muted">
          Min move %
        </span>
        <div className="relative">
          <input
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-pe-border bg-pe-canvas px-3 py-2.5 pr-10 text-[15px] outline-none ring-pe-accent focus:ring-2"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-pe-text-muted">
            %
          </span>
        </div>
        <p className="mt-1 text-xs text-pe-text-muted">
          {direction === 'up'
            ? `Show stocks up at least this much`
            : direction === 'down'
              ? `Show stocks down at least this much`
              : `Show stocks with |move| at least this much`}
        </p>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-pe-text-muted">
          Industry
        </span>
        <select
          value={industry}
          onChange={(event) => setIndustry(event.target.value)}
          className="w-full rounded-lg border border-pe-border bg-pe-canvas px-3 py-2.5 text-[15px] outline-none ring-pe-accent focus:ring-2"
        >
          <option value="">All industries</option>
          {industries.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function InsightCard({ row, scope }) {
  const bullets = extractInsightBullets(row.summary, 3);
  if (!bullets.length) return null;

  return (
    <article className="border-b border-pe-border px-4 py-4 last:border-b-0">
      <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {scope === 'stock' ? (
            <Link
              to={stockPath(row.ticker)}
              className="text-[15px] font-bold text-pe-text hover:text-pe-accent"
            >
              {row.ticker}
            </Link>
          ) : (
            <p className="text-[15px] font-bold text-pe-text">{row.ticker}</p>
          )}
          <p className="truncate text-xs text-pe-text-muted">
            {row.name}
            {row.industry ? ` · ${row.industry}` : ''}
          </p>
        </div>
        {Number.isFinite(row.changePct) ? (
          <span className={`shrink-0 text-sm font-semibold tabular-nums ${pnlClass(row.changePct)}`}>
            {formatPct(row.changePct)}
          </span>
        ) : null}
      </div>
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-pe-text-secondary">
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </article>
  );
}

export default function InsightsPage() {
  const configured = isStockNewsConfigured();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const dateOptions = useMemo(() => buildDateOptions(), []);

  const [scope, setScope] = useState('stock');
  const [asOfDate, setAsOfDate] = useState(dateOptions[0].id);
  const [direction, setDirection] = useState('any');
  const [threshold, setThreshold] = useState('0');
  const [industry, setIndustry] = useState('');
  const [industries, setIndustries] = useState([]);
  const [industryBySymbol, setIndustryBySymbol] = useState(() => new Map());
  const [query, setQuery] = useState('');
  const [marketBySymbol, setMarketBySymbol] = useState(() => new Map());
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const copy = SCOPE_COPY[scope] ?? SCOPE_COPY.stock;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isSupabaseConfigured()) await ensureSupabase();
        const res = await fetch('/data/markets/stocks-search.json');
        if (!res.ok) return;
        const payload = await res.json();
        const map = new Map();
        for (const item of payload.items ?? []) {
          const symbol = String(item.symbol ?? item.id ?? '')
            .trim()
            .toUpperCase();
          if (!symbol) continue;
          map.set(symbol, {
            name: item.name ?? symbol,
            changePct: Number(item.changePct),
            price: Number(item.price),
          });
        }
        if (!cancelled) setMarketBySymbol(map);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetchDistinctStockIndustries();
      if (!cancelled) setIndustries(list);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setQuery('');
    setIndustry('');
    setDirection('any');
    setThreshold('0');
  }, [scope]);

  useEffect(() => {
    let cancelled = false;
    if (!configured) {
      setLoading(false);
      setFeed([]);
      return undefined;
    }

    setLoading(true);
    setError('');

    (async () => {
      try {
        const rows = await fetchExplanationFeed({
          assetType: scope,
          asOfDate,
          limit: 300,
        });
        if (cancelled) return;

        // Only rows with real summary text (no empty insights).
        const withText = rows.filter((row) => extractInsightBullets(row.summary, 1).length > 0);
        setFeed(withText);

        if (scope === 'stock' && withText.length) {
          const map = await lookupStockIndustries(withText.map((row) => row.ticker));
          if (!cancelled) setIndustryBySymbol(map);
        } else if (!cancelled) {
          setIndustryBySymbol(new Map());
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Could not load insights.');
          setFeed([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [configured, scope, asOfDate]);

  const enrichedFeed = useMemo(() => {
    return feed
      .map((row) => {
        const meta = marketBySymbol.get(row.ticker);
        const changePct = Number(meta?.changePct);
        return {
          ...row,
          name: meta?.name || row.ticker,
          changePct: Number.isFinite(changePct) ? changePct : null,
          industry: industryBySymbol.get(row.ticker) || '',
        };
      })
      .filter((row) => extractInsightBullets(row.summary, 1).length > 0);
  }, [feed, marketBySymbol, industryBySymbol]);

  const filteredFeed = useMemo(() => {
    const q = query.trim().toUpperCase();
    return enrichedFeed
      .filter((row) => {
        if (scope === 'stock') {
          if (!matchesMovement(row.changePct, direction, threshold)) return false;
          if (industry && row.industry !== industry) return false;
        }
        if (!q) return true;
        return (
          row.ticker.includes(q) ||
          String(row.name).toUpperCase().includes(q) ||
          String(row.industry).toUpperCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (scope === 'stock' && (direction !== 'any' || Number(threshold) > 0)) {
          return Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0);
        }
        return String(a.ticker).localeCompare(String(b.ticker));
      });
  }, [enrichedFeed, query, scope, direction, threshold, industry]);

  // Search suggestions only among tickers that have an insight for the selected date.
  const searchHits = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (q.length < 1 || scope !== 'stock') return [];
    return enrichedFeed
      .filter(
        (row) =>
          row.ticker.includes(q) ||
          String(row.name).toUpperCase().includes(q)
      )
      .slice(0, 8);
  }, [query, enrichedFeed, scope]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (scope === 'stock') {
      if (direction !== 'any') count += 1;
      if (Number(threshold) > 0) count += 1;
      if (industry) count += 1;
    }
    if (asOfDate !== dateOptions[0]?.id) count += 1;
    return count;
  }, [scope, direction, threshold, industry, asOfDate, dateOptions]);

  const stockFilters = (
    <StockFilterFields
      direction={direction}
      setDirection={setDirection}
      threshold={threshold}
      setThreshold={setThreshold}
      industry={industry}
      setIndustry={setIndustry}
      industries={industries}
    />
  );

  return (
    <MarketingShell wide>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-pe-accent">Daily market insights</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-pe-text md:text-4xl">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-pe-text-secondary">{copy.body}</p>
      </div>

      <UnderlineTabs tabs={SCOPE_TABS} active={scope} onChange={setScope} className="mb-5 px-0" />

      {!configured ? (
        <div className="rounded-xl border border-pe-border bg-pe-surface px-4 py-6 text-sm text-pe-text-secondary">
          Insights data is not configured for this environment yet.
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-start gap-2">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pe-text-muted" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={scope === 'stock' ? 'Search tickers with insights…' : 'Filter by name'}
                className="w-full rounded-lg border border-pe-border bg-pe-canvas py-2.5 pl-10 pr-3 text-[15px] text-pe-text outline-none ring-pe-accent focus:ring-2"
              />
            </label>

            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="relative flex h-[46px] shrink-0 items-center gap-1.5 rounded-lg border border-pe-border bg-pe-canvas px-3 text-sm font-semibold text-pe-text md:hidden"
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount ? (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-pe-accent px-1 text-[11px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>

          {searchHits.length && query.trim() ? (
            <ul className="mb-4 overflow-hidden rounded-lg border border-pe-border bg-pe-canvas shadow-sm md:max-w-xl">
              {searchHits.map((hit) => (
                <li key={hit.ticker}>
                  <button
                    type="button"
                    onClick={() => setQuery(hit.ticker)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-pe-surface"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-pe-text">{hit.ticker}</span>
                      <span className="block truncate text-xs text-pe-text-muted">{hit.name}</span>
                    </span>
                    {Number.isFinite(hit.changePct) ? (
                      <span className={`shrink-0 text-sm font-semibold tabular-nums ${pnlClass(hit.changePct)}`}>
                        {formatPct(hit.changePct)}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Desktop filters */}
          <div className="mb-5 hidden space-y-4 md:block">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-pe-text-muted">Date</p>
              <DateChips options={dateOptions} value={asOfDate} onChange={setAsOfDate} />
            </div>
            {scope === 'stock' ? (
              <div className="grid grid-cols-3 gap-3">{stockFilters}</div>
            ) : null}
          </div>

          {/* Mobile: date chips stay visible (easy), other filters in sheet */}
          <div className="mb-4 md:hidden">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-pe-text-muted">Date</p>
            <DateChips options={dateOptions} value={asOfDate} onChange={setAsOfDate} />
          </div>

          <FilterSheet open={!isDesktop && filtersOpen} onClose={() => setFiltersOpen(false)}>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-pe-text-muted">Date</p>
              <DateChips options={dateOptions} value={asOfDate} onChange={setAsOfDate} />
            </div>
            {scope === 'stock' ? <div className="space-y-4">{stockFilters}</div> : null}
          </FilterSheet>

          {error ? <p className="mb-4 text-sm text-pe-negative">{error}</p> : null}

          {loading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-pe-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading insights…
            </div>
          ) : filteredFeed.length ? (
            <div className="overflow-hidden rounded-xl border border-pe-border bg-pe-canvas">
              {filteredFeed.map((row) => (
                <InsightCard key={row.id} row={row} scope={scope} />
              ))}
            </div>
          ) : (
            <p className="py-10 text-sm text-pe-text-muted">
              No insights for {formatChipDate(asOfDate)} with these filters.
            </p>
          )}
        </>
      )}
    </MarketingShell>
  );
}
