import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Filter, Loader2, Search, X } from 'lucide-react';
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
  fetchIndustryExplanationFeed,
  isStockNewsConfigured,
} from '../../lib/stockNewsApi';
import { useSeoMeta } from '../../hooks/useSeoMeta';

const SCOPE_TABS = [
  { id: 'stock', label: 'Stocks' },
  { id: 'industry', label: 'Industry' },
  { id: 'index', label: 'Indices' },
  { id: 'commodity', label: 'Commodities' },
  { id: 'economics', label: 'Country' },
];

const DIRECTION_OPTIONS = [
  { id: 'any', label: 'Any' },
  { id: 'up', label: 'Up' },
  { id: 'down', label: 'Down' },
];

const SORT_OPTIONS = [
  { id: 'magnitude', label: 'Biggest move' },
  { id: 'desc', label: 'Highest %' },
  { id: 'asc', label: 'Lowest %' },
];

/** Number(null) === 0 — never coerce missing quotes into a real 0% move. */
function parseFiniteNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const SCOPE_COPY = {
  stock: {
    title: 'Stock-wise insights',
    body: 'Daily explanation summaries for equities — search a ticker or browse by move, industry, and date.',
  },
  industry: {
    title: 'Industry-wise insights',
    body: 'Daily digests across industries — what moved the sector and why.',
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
  if (!Number.isFinite(n) || n === 0) return 'text-[var(--fv-text)]';
  return n > 0 ? 'text-[var(--fv-positive)]' : 'text-[var(--fv-negative)]';
}

function FilterSheet({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:hidden" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-[20px] bg-white shadow-[var(--fv-shadow-hover)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--fv-border)] bg-white px-4 py-3.5">
          <p className="text-[15px] font-semibold text-[var(--fv-text)]">Filters</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[var(--fv-text-secondary)] transition hover:bg-black/[0.04]"
            aria-label="Close filters"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 px-4 py-4">{children}</div>
        <div className="sticky bottom-0 border-t border-[var(--fv-border)] bg-white px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-[var(--fv-accent)] py-3 text-[15px] font-semibold text-white transition hover:opacity-90"
          >
            Show results
          </button>
        </div>
      </div>
    </div>
  );
}

function DateSelect({ options, value, onChange, compact = false }) {
  const fieldClass = compact
    ? 'h-9 w-[110px] rounded-full border-0 bg-black/[0.04] px-3 text-xs font-medium text-[var(--fv-text)] outline-none transition hover:bg-black/[0.06] focus:shadow-[var(--fv-shadow)]'
    : 'w-full rounded-full border-0 bg-black/[0.04] px-3 py-2.5 text-[15px] font-medium text-[var(--fv-text)] outline-none transition focus:shadow-[var(--fv-shadow)]';

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Date"
      className={fieldClass}
    >
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function IndustryMultiSelect({ options, selected, onChange, compact = false }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((name) => name.toLowerCase().includes(q));
  }, [options, query]);

  const label =
    selected.length === 0
      ? 'Industry'
      : selected.length === 1
        ? selected[0]
        : `${selected.length} industries`;

  const toggle = (name) => {
    onChange(
      selected.includes(name)
        ? selected.filter((item) => item !== name)
        : [...selected, name]
    );
  };

  return (
    <div ref={rootRef} className={`relative ${compact ? 'min-w-[140px]' : 'w-full'}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-full border-0 bg-black/[0.04] text-left outline-none transition hover:bg-black/[0.06] focus:shadow-[var(--fv-shadow)] ${
          compact ? 'h-9 px-3 text-xs' : 'px-3 py-2.5 text-[15px]'
        } ${selected.length ? 'text-[var(--fv-text)]' : 'text-[var(--fv-text-secondary)]'}`}
      >
        <span className="truncate font-medium">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="absolute left-0 z-20 mt-1 w-[min(100vw-2rem,320px)] overflow-hidden rounded-[16px] bg-white shadow-[var(--fv-shadow-hover)]">
          <div className="border-b border-[var(--fv-border)] p-2">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search industries…"
              autoFocus
              className="w-full rounded-full border-0 bg-black/[0.04] px-3 py-1.5 text-sm outline-none focus:shadow-[var(--fv-shadow)]"
            />
          </div>
          <div className="flex items-center justify-between border-b border-[var(--fv-border)] px-3 py-2">
            <span className="fv-caption">
              {selected.length ? `${selected.length} selected` : 'Select one or more'}
            </span>
            {selected.length ? (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs font-semibold text-[var(--fv-accent)] hover:underline"
              >
                Clear
              </button>
            ) : null}
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length ? (
              filtered.map((name) => {
                const checked = selected.includes(name);
                return (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => toggle(name)}
                      className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-black/[0.03]"
                    >
                      <span
                        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${
                          checked
                            ? 'border-[var(--fv-accent)] bg-[var(--fv-accent)] text-white'
                            : 'border-[var(--fv-border)] bg-white'
                        }`}
                      >
                        {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                      </span>
                      <span className="text-sm leading-snug text-[var(--fv-text)]">{name}</span>
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-3 text-sm text-[var(--fv-text-muted)]">No matching industries</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function StockFilterFields({
  direction,
  setDirection,
  threshold,
  setThreshold,
  sortBy,
  setSortBy,
  selectedIndustries,
  setSelectedIndustries,
  industries,
  dateOptions,
  asOfDate,
  setAsOfDate,
  compact = false,
}) {
  const fieldClass = compact
    ? 'h-9 rounded-full border-0 bg-black/[0.04] px-3 text-xs font-medium text-[var(--fv-text)] outline-none transition hover:bg-black/[0.06] focus:shadow-[var(--fv-shadow)]'
    : 'w-full rounded-full border-0 bg-black/[0.04] px-3 py-2.5 text-[15px] font-medium text-[var(--fv-text)] outline-none transition focus:shadow-[var(--fv-shadow)]';

  if (compact) {
    return (
      <>
        <IndustryMultiSelect
          options={industries}
          selected={selectedIndustries}
          onChange={setSelectedIndustries}
          compact
        />
        <select
          value={direction}
          onChange={(event) => setDirection(event.target.value)}
          className={`${fieldClass} w-[72px]`}
          aria-label="Direction"
        >
          {DIRECTION_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="relative w-[72px]">
          <input
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            placeholder="0"
            aria-label="Minimum move percent"
            className={`${fieldClass} w-full pr-6`}
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-[var(--fv-text-muted)]">
            %
          </span>
        </div>
        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          className={`${fieldClass} w-[118px]`}
          aria-label="Sort by change"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <DateSelect options={dateOptions} value={asOfDate} onChange={setAsOfDate} compact />
      </>
    );
  }

  return (
    <>
      <div className="block">
        <span className="mb-1.5 block fv-label">Industry</span>
        <IndustryMultiSelect
          options={industries}
          selected={selectedIndustries}
          onChange={setSelectedIndustries}
        />
      </div>

      <label className="block">
        <span className="mb-1.5 block fv-label">Direction</span>
        <select value={direction} onChange={(event) => setDirection(event.target.value)} className={fieldClass}>
          {DIRECTION_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.id === 'any' ? 'Any direction' : opt.id === 'up' ? 'Up only' : 'Down only'}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block fv-label">Min move %</span>
        <div className="relative">
          <input
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            placeholder="0"
            className={`${fieldClass} pr-10`}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--fv-text-muted)]">
            %
          </span>
        </div>
      </label>

      <label className="block">
        <span className="mb-1.5 block fv-label">Sort</span>
        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className={fieldClass}>
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block fv-label">Date</span>
        <DateSelect options={dateOptions} value={asOfDate} onChange={setAsOfDate} />
      </label>
    </>
  );
}

function InsightCard({ row, scope }) {
  const bullets = extractInsightBullets(row.summary, 3);
  if (!bullets.length) return null;

  const subtitle =
    scope === 'industry'
      ? ''
      : [row.name, row.industry].filter(Boolean).join(' · ');

  return (
    <article className="border-b border-[var(--fv-border)] px-4 py-4 last:border-b-0 md:px-5">
      <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {scope === 'stock' ? (
            <Link
              to={stockPath(row.ticker)}
              className="text-[15px] font-semibold text-[var(--fv-text)] transition hover:text-[var(--fv-accent)]"
            >
              {row.ticker}
            </Link>
          ) : (
            <p className="text-[15px] font-semibold text-[var(--fv-text)]">{row.ticker}</p>
          )}
          {subtitle ? (
            <p className="fv-caption mt-0.5 truncate">{subtitle}</p>
          ) : null}
        </div>
        {scope === 'stock' && Number.isFinite(row.changePct) ? (
          <span className={`shrink-0 text-sm font-semibold tabular-nums ${pnlClass(row.changePct)}`}>
            {formatPct(row.changePct)}
          </span>
        ) : null}
      </div>
      <ul className="list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-[var(--fv-text-secondary)]">
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </article>
  );
}

export default function InsightsPage() {
  useSeoMeta({
    title: 'Market Insights',
    description:
      'AI-assisted daily stock insights — see what moved and why, with plain-language summaries for Indian equities.',
    path: '/insights',
  });
  const configured = isStockNewsConfigured();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const dateOptions = useMemo(() => buildDateOptions(), []);

  const [scope, setScope] = useState('stock');
  const [asOfDate, setAsOfDate] = useState(dateOptions[0].id);
  const [direction, setDirection] = useState('any');
  const [threshold, setThreshold] = useState('0');
  const [sortBy, setSortBy] = useState('magnitude');
  const [selectedIndustries, setSelectedIndustries] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [industryBySymbol, setIndustryBySymbol] = useState(() => new Map());
  const [query, setQuery] = useState('');
  const [nameBySymbol, setNameBySymbol] = useState(() => new Map());
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const copy = SCOPE_COPY[scope] ?? SCOPE_COPY.stock;

  // Names only — move % comes from explanation price_context with the feed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/data/markets/stocks-search.json');
        if (!res.ok) return;
        const payload = await res.json();
        const map = new Map();
        for (const item of payload.items ?? []) {
          const symbol = String(item.symbol ?? item.id ?? '')
            .trim()
            .toUpperCase();
          if (!symbol) continue;
          map.set(symbol, item.name ?? symbol);
        }
        if (!cancelled) setNameBySymbol(map);
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
    setSelectedIndustries([]);
    setDirection('any');
    setThreshold('0');
    setSortBy('magnitude');
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
        const rows =
          scope === 'industry'
            ? await fetchIndustryExplanationFeed({ asOfDate, limit: 300 })
            : await fetchExplanationFeed({
                assetType: scope,
                asOfDate,
                limit: 300,
              });
        if (cancelled) return;

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
        if (scope === 'industry') {
          return {
            ...row,
            name: '',
            changePct: null,
            industry: '',
          };
        }
        const name =
          nameBySymbol.get(row.ticker) ||
          nameBySymbol.get(String(row.ticker).toUpperCase()) ||
          row.ticker;
        return {
          ...row,
          name,
          // Move % only applies to equities; indices/commodities/economy/industry never show it.
          changePct: scope === 'stock' ? parseFiniteNumber(row.changePct) : null,
          industry: industryBySymbol.get(row.ticker) || '',
        };
      })
      .filter((row) => extractInsightBullets(row.summary, 1).length > 0)
      .filter((row) => (scope === 'stock' ? Number.isFinite(row.changePct) : true));
  }, [feed, nameBySymbol, industryBySymbol, scope]);

  const filteredFeed = useMemo(() => {
    const q = query.trim().toUpperCase();
    return enrichedFeed
      .filter((row) => {
        if (scope === 'stock') {
          if (!matchesMovement(row.changePct, direction, threshold)) return false;
          if (selectedIndustries.length && !selectedIndustries.includes(row.industry)) return false;
        }
        if (!q) return true;
        return (
          row.ticker.toUpperCase().includes(q) ||
          String(row.name).toUpperCase().includes(q) ||
          String(row.industry).toUpperCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (scope !== 'stock') return String(a.ticker).localeCompare(String(b.ticker));
        const aPct = parseFiniteNumber(a.changePct);
        const bPct = parseFiniteNumber(b.changePct);
        const aMissing = aPct == null;
        const bMissing = bPct == null;
        if (aMissing && bMissing) return String(a.ticker).localeCompare(String(b.ticker));
        if (aMissing) return 1;
        if (bMissing) return -1;

        if (sortBy === 'desc') return bPct - aPct;
        if (sortBy === 'asc') return aPct - bPct;
        // Default / "no choice": descending magnitude of change
        const mag = Math.abs(bPct) - Math.abs(aPct);
        if (mag !== 0) return mag;
        return String(a.ticker).localeCompare(String(b.ticker));
      });
  }, [enrichedFeed, query, scope, direction, threshold, selectedIndustries, sortBy]);

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
      if (selectedIndustries.length) count += 1;
      if (sortBy !== 'magnitude') count += 1;
    }
    if (asOfDate !== dateOptions[0]?.id) count += 1;
    return count;
  }, [scope, direction, threshold, selectedIndustries, sortBy, asOfDate, dateOptions]);

  const stockFilterProps = {
    direction,
    setDirection,
    threshold,
    setThreshold,
    sortBy,
    setSortBy,
    selectedIndustries,
    setSelectedIndustries,
    industries,
    dateOptions,
    asOfDate,
    setAsOfDate,
  };

  return (
    <MarketingShell wide>
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--fv-text)] md:text-[28px]">
          {copy.title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-[var(--fv-text-secondary)]">
          {copy.body}
        </p>
      </div>

      <UnderlineTabs tabs={SCOPE_TABS} active={scope} onChange={setScope} className="mb-4 px-0" />

      {!configured ? (
        <div className="rounded-[16px] bg-black/[0.03] px-4 py-6 text-sm text-[var(--fv-text-secondary)]">
          Insights data is not configured for this environment yet.
        </div>
      ) : (
        <>
          {/* Desktop: compact single toolbar */}
          <div className="mb-4 hidden flex-wrap items-center gap-2 md:flex">
            <label className="relative w-full max-w-[240px] shrink-0">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-[var(--fv-text-muted)]"
                strokeWidth={2}
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  scope === 'stock'
                    ? 'Search tickers…'
                    : scope === 'industry'
                      ? 'Search industries…'
                      : 'Filter by name…'
                }
                className="fv-search h-10 text-[14px]"
              />
            </label>

            {scope === 'stock' ? (
              <StockFilterFields {...stockFilterProps} compact />
            ) : (
              <DateSelect options={dateOptions} value={asOfDate} onChange={setAsOfDate} compact />
            )}
          </div>

          {/* Mobile: search + filters button */}
          <div className="mb-3 flex items-center gap-2 md:hidden">
            <label className="relative min-w-0 max-w-[240px] flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-[var(--fv-text-muted)]"
                strokeWidth={2}
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  scope === 'stock'
                    ? 'Search tickers…'
                    : scope === 'industry'
                      ? 'Search industries…'
                      : 'Filter by name'
                }
                className="fv-search h-10 text-[14px]"
              />
            </label>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="relative flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-black/[0.04] px-3.5 text-sm font-semibold text-[var(--fv-text)] transition hover:bg-black/[0.06]"
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount ? (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--fv-accent)] px-1 text-[12px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>

          {searchHits.length && query.trim() ? (
            <ul className="mb-4 max-w-[240px] overflow-hidden rounded-[16px] bg-white shadow-[var(--fv-shadow)]">
              {searchHits.map((hit) => (
                <li key={hit.ticker}>
                  <button
                    type="button"
                    onClick={() => setQuery(hit.ticker)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-black/[0.03]"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--fv-text)]">{hit.ticker}</span>
                      <span className="block truncate text-xs text-[var(--fv-text-muted)]">{hit.name}</span>
                    </span>
                    {scope === 'stock' && Number.isFinite(hit.changePct) ? (
                      <span className={`shrink-0 text-sm font-semibold tabular-nums ${pnlClass(hit.changePct)}`}>
                        {formatPct(hit.changePct)}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <FilterSheet open={!isDesktop && filtersOpen} onClose={() => setFiltersOpen(false)}>
            {scope === 'stock' ? (
              <StockFilterFields {...stockFilterProps} />
            ) : (
              <label className="block">
                <span className="mb-1.5 block fv-label">Date</span>
                <DateSelect options={dateOptions} value={asOfDate} onChange={setAsOfDate} />
              </label>
            )}
          </FilterSheet>

          {error ? <p className="mb-4 text-sm text-[var(--fv-negative)]">{error}</p> : null}

          {loading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-[var(--fv-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading insights…
            </div>
          ) : filteredFeed.length ? (
            <div className="overflow-hidden rounded-[20px] bg-white shadow-[var(--fv-shadow)]">
              {filteredFeed.map((row) => (
                <InsightCard key={row.id} row={row} scope={scope} />
              ))}
            </div>
          ) : (
            <p className="py-10 text-sm text-[var(--fv-text-muted)]">
              No insights for {formatChipDate(asOfDate)} with these filters.
            </p>
          )}
        </>
      )}
    </MarketingShell>
  );
}
