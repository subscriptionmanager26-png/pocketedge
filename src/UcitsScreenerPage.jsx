import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpDown, ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from 'lucide-react';
import SiteHeader from './components/SiteHeader';
import { edgeX } from './designTokens';
import {
  INDEX_CATEGORIES,
  compareFundsByAum,
  formatAumDisplay,
  fundMatchesIndexCategories,
  getIndexCategoryLabel,
} from './ucitsScreenerUtils';

const wideContent = `max-w-[90rem] mx-auto ${edgeX}`;
const SCREENER_DATA_URL = '/data/ucits-screener.json';
const PAGE_SIZE = 50;

const DESKTOP_GRID_BASE =
  'lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_4.5rem_3.5rem_minmax(5.75rem,0.65fr)_minmax(0,1fr)_minmax(0,1fr)_2rem] lg:gap-x-4 lg:items-start';

const DESKTOP_GRID_SECTOR =
  'lg:grid lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)_4.5rem_3.5rem_minmax(5.75rem,0.65fr)_4rem_minmax(0,1fr)_minmax(0,1fr)_2rem] lg:gap-x-4 lg:items-start';

function decodeName(name = '') {
  return name.replace(/&amp;/g, '&');
}

function fundDisplayName(fund) {
  return decodeName(fund.longName || fund.name);
}

function getSectorWeight(fund, sectorKey) {
  if (!sectorKey || sectorKey === 'All') return null;
  return fund.sectorWeightings?.find((s) => s.key === sectorKey) ?? null;
}

function formatWeight(holding) {
  return holding.weightFmt || (holding.weightPct != null ? `${holding.weightPct}%` : '—');
}

function countActiveFilters({ sectorFilter, minAumMillions, indexCategories, exchange }) {
  let count = 0;
  if (sectorFilter !== 'All') count += 1;
  if (Number(minAumMillions) > 0) count += 1;
  if (indexCategories.length > 0) count += 1;
  if (exchange !== 'All') count += 1;
  return count;
}

function aumSortLabel(aumSort) {
  if (aumSort === 'desc') return 'AUM ↓';
  if (aumSort === 'asc') return 'AUM ↑';
  return 'Default';
}

function IndexCategoryFilter({ selected, onChange, layout = 'dropdown' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (layout !== 'dropdown' || !open) return undefined;
    const onDocClick = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, layout]);

  const toggle = (id) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  const summary =
    selected.length === 0
      ? 'All index types'
      : selected.length === 1
        ? getIndexCategoryLabel(selected[0])
        : `${selected.length} selected`;

  if (layout === 'list') {
    return (
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-pe-text-muted">
            Index type
          </span>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-pe-text-muted hover:text-pe-text"
            >
              Clear
            </button>
          )}
        </div>
        <div className="rounded-lg border border-pe-border bg-black/20 p-2 max-h-48 overflow-y-auto space-y-0.5">
          {INDEX_CATEGORIES.map((category) => (
            <label
              key={category.id}
              className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.04] cursor-pointer text-sm text-pe-text-secondary"
            >
              <input
                type="checkbox"
                checked={selected.includes(category.id)}
                onChange={() => toggle(category.id)}
                className="rounded border-pe-border"
              />
              <span>{category.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <span className="text-xs font-medium uppercase tracking-wider text-pe-text-muted">
        Index type
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pe-input py-2.5 w-full mt-1.5 flex items-center justify-between gap-2 text-left"
      >
        <span className="truncate text-sm">{summary}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[14rem] rounded-lg border border-pe-border bg-[#111] shadow-xl p-2 max-h-64 overflow-y-auto">
          <button
            type="button"
            onClick={() => onChange([])}
            className="w-full text-left px-2 py-1.5 text-xs text-pe-text-muted hover:text-pe-text rounded"
          >
            Clear selection
          </button>
          {INDEX_CATEGORIES.map((category) => (
            <label
              key={category.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.04] cursor-pointer text-sm text-pe-text-secondary"
            >
              <input
                type="checkbox"
                checked={selected.includes(category.id)}
                onChange={() => toggle(category.id)}
                className="rounded border-pe-border"
              />
              <span>{category.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function ScreenerFilterFields({
  sectorFilter,
  setSectorFilter,
  sectorOptions,
  minSectorPct,
  setMinSectorPct,
  minAumMillions,
  setMinAumMillions,
  aumSort,
  setAumSort,
  exchange,
  setExchange,
  exchanges,
  indexCategories,
  setIndexCategories,
  indexCategoryLayout = 'dropdown',
}) {
  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-pe-text-muted">Sector</span>
        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="pe-input py-2.5"
        >
          <option value="All">All sectors</option>
          {sectorOptions.map((sector) => (
            <option key={sector.key} value={sector.key}>
              {sector.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-pe-text-muted">
          Min exposure
        </span>
        <div className="relative">
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={minSectorPct}
            disabled={sectorFilter === 'All'}
            onChange={(e) => setMinSectorPct(e.target.value)}
            className="pe-input py-2.5 pr-8 w-full disabled:opacity-40"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-pe-text-muted">%</span>
        </div>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-pe-text-muted">Min AUM</span>
        <div className="relative">
          <input
            type="number"
            min={0}
            step={1}
            value={minAumMillions}
            onChange={(e) => setMinAumMillions(e.target.value)}
            placeholder="Any"
            className="pe-input py-2.5 pr-8 w-full"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-pe-text-muted">M</span>
        </div>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-pe-text-muted">Sort by AUM</span>
        <select value={aumSort} onChange={(e) => setAumSort(e.target.value)} className="pe-input py-2.5">
          <option value="none">Default order</option>
          <option value="desc">Largest first</option>
          <option value="asc">Smallest first</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-pe-text-muted">Exchange</span>
        <select value={exchange} onChange={(e) => setExchange(e.target.value)} className="pe-input py-2.5">
          {exchanges.map((ex) => (
            <option key={ex} value={ex}>
              {ex === 'All' ? 'All exchanges' : ex}
            </option>
          ))}
        </select>
      </label>

      <IndexCategoryFilter
        selected={indexCategories}
        onChange={setIndexCategories}
        layout={indexCategoryLayout}
      />
    </>
  );
}

function MobileFilterSheet({
  open,
  onClose,
  filteredCount,
  activeFilterCount,
  aumSort,
  onClear,
  children,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters and sort">
      <button
        type="button"
        aria-label="Close filters"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[min(88vh,720px)] flex-col rounded-t-2xl border border-pe-border border-b-0 bg-[#0a0a0a] shadow-[0_-16px_48px_rgba(0,0,0,0.45)]">
        <div className="flex shrink-0 items-center justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-pe-border" aria-hidden />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 border-b border-pe-border">
          <div>
            <h2 className="text-base font-semibold text-pe-text">Filters & sort</h2>
            <p className="text-xs text-pe-text-muted mt-0.5">
              {filteredCount.toLocaleString()} funds
              {activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}` : ''}
              {aumSort !== 'none' ? ` · ${aumSortLabel(aumSort)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-pe-text-muted hover:text-pe-text hover:bg-white/[0.05]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">{children}</div>
        <div className="shrink-0 border-t border-pe-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2 bg-[#0a0a0a]">
          <button
            type="button"
            onClick={onClear}
            className="flex-1 py-3 rounded-xl border border-pe-border text-sm font-medium text-pe-text-secondary hover:text-pe-text hover:bg-white/[0.03]"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-pe-text text-pe-canvas text-sm font-semibold hover:opacity-90"
          >
            Show results
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileFilterBar({ activeFilterCount, aumSort, filteredCount, onOpenFilters }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden border-t border-pe-border bg-[#0a0a0a]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className={`${edgeX} max-w-[90rem] mx-auto px-4 py-2.5 flex items-center gap-2`}>
        <button
          type="button"
          onClick={onOpenFilters}
          className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-pe-border bg-white/[0.03] text-sm font-medium text-pe-text"
        >
          <SlidersHorizontal className="w-4 h-4 shrink-0" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="inline-flex min-w-[1.25rem] h-5 px-1.5 items-center justify-center rounded-full bg-pe-text text-pe-canvas text-[11px] font-semibold">
              {activeFilterCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onOpenFilters}
          className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-pe-border bg-white/[0.03] text-sm font-medium text-pe-text-secondary"
        >
          <ArrowUpDown className="w-4 h-4 shrink-0" />
          <span>{aumSortLabel(aumSort)}</span>
        </button>
        <p className="text-xs text-pe-text-muted tabular-nums shrink-0 w-14 text-right">
          {filteredCount > 999 ? `${Math.round(filteredCount / 1000)}k` : filteredCount}
        </p>
      </div>
    </div>
  );
}

/** Label wraps; weight stays fixed on the right. */
function MetricRow({ label, value, compact = false, labelClassName = 'text-pe-text-secondary' }) {
  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_minmax(2.75rem,max-content)] gap-x-2 items-start ${
        compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'
      }`}
    >
      <span
        className={`min-w-0 break-words [overflow-wrap:anywhere] leading-snug ${labelClassName}`}
      >
        {label}
      </span>
      <span className="shrink-0 tabular-nums text-pe-text-muted whitespace-nowrap text-right leading-snug self-start">
        {value}
      </span>
    </li>
  );
}

function TopHoldingsList({ holdings, limit = 4, compact = false }) {
  const rows = holdings?.slice(0, limit) ?? [];
  if (!rows.length) {
    return <p className="text-xs text-pe-text-muted">—</p>;
  }

  return (
    <ul className={`min-w-0 ${compact ? 'space-y-2' : 'space-y-1.5'}`}>
      {rows.map((holding) => (
        <MetricRow
          key={holding.symbol || holding.name}
          label={holding.symbol || holding.name}
          value={formatWeight(holding)}
          compact={compact}
        />
      ))}
    </ul>
  );
}

function TopSectorsList({ sectors, limit = 4, highlightKey, compact = false }) {
  const rows = sectors?.slice(0, limit) ?? [];
  if (!rows.length) {
    return <p className="text-xs text-pe-text-muted">—</p>;
  }

  return (
    <ul className={`min-w-0 ${compact ? 'space-y-2' : 'space-y-1.5'}`}>
      {rows.map((sector) => (
        <MetricRow
          key={sector.key}
          label={sector.label}
          value={`${sector.weightPct}%`}
          compact={compact}
          labelClassName={
            highlightKey === sector.key ? 'text-pe-text font-medium' : 'text-pe-text-secondary'
          }
        />
      ))}
    </ul>
  );
}

function FundDetailPanel({ fund, highlightSector }) {
  return (
    <div className="px-4 sm:px-5 py-5 border-t border-pe-border bg-black/30 grid gap-6 sm:grid-cols-2">
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-pe-text-muted mb-3">
          All holdings
        </h4>
        <ul className="space-y-2">
          {fund.topHoldings?.map((holding) => (
            <li
              key={`${fund.id}-hold-${holding.symbol}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-start text-sm"
            >
              <div className="min-w-0 break-words [overflow-wrap:anywhere]">
                <p className="font-medium text-pe-text leading-snug">{holding.name}</p>
                {holding.symbol && (
                  <p className="text-xs text-pe-text-muted leading-snug mt-0.5">{holding.symbol}</p>
                )}
              </div>
              <span className="text-pe-text-secondary shrink-0 tabular-nums whitespace-nowrap text-right leading-snug">
                {formatWeight(holding)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-pe-text-muted mb-3">
          All sectors
        </h4>
        <TopSectorsList sectors={fund.sectorWeightings} limit={99} highlightKey={highlightSector} />

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          {fund.assetMix?.stock && (
            <div className="rounded-lg border border-pe-border px-3 py-2">
              <p className="text-xs text-pe-text-muted">Equities</p>
              <p className="font-medium text-pe-text">{fund.assetMix.stock}</p>
            </div>
          )}
          {fund.assetMix?.bond && (
            <div className="rounded-lg border border-pe-border px-3 py-2">
              <p className="text-xs text-pe-text-muted">Bonds</p>
              <p className="font-medium text-pe-text">{fund.assetMix.bond}</p>
            </div>
          )}
          {fund.assetMix?.cash && (
            <div className="rounded-lg border border-pe-border px-3 py-2">
              <p className="text-xs text-pe-text-muted">Cash</p>
              <p className="font-medium text-pe-text">{fund.assetMix.cash}</p>
            </div>
          )}
          {(fund.aum != null || fund.aumFmt) && (
            <div className="rounded-lg border border-pe-border px-3 py-2">
              <p className="text-xs text-pe-text-muted">AUM (USD)</p>
              <p className="font-medium text-pe-text">{formatAumDisplay(fund)}</p>
            </div>
          )}
          {fund.turnover && (
            <div className="rounded-lg border border-pe-border px-3 py-2">
              <p className="text-xs text-pe-text-muted">Turnover</p>
              <p className="font-medium text-pe-text">{fund.turnover}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const FundCard = React.memo(function FundCard({
  fund,
  expanded,
  onToggle,
  sectorFilter,
  sectorFilterLabel,
  highlightSector,
}) {
  const sectorMatch = getSectorWeight(fund, sectorFilter);
  const desktopGrid = sectorFilter !== 'All' ? DESKTOP_GRID_SECTOR : DESKTOP_GRID_BASE;

  return (
    <article className="rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full min-w-0 text-left px-4 sm:px-5 py-4 sm:py-5 hover:bg-white/[0.02] transition-colors"
      >
        {/* Desktop table header row is global; this is the card body */}
        <div className={`${desktopGrid} min-w-0`}>
          <div className="min-w-0 lg:pr-2">
            <div className="flex items-start justify-between gap-3 lg:block">
              <p className="font-medium text-pe-text text-sm sm:text-base leading-snug">
                {fundDisplayName(fund)}
              </p>
              <span className="lg:hidden shrink-0 mt-0.5 text-pe-text-muted">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </div>
            <p className="mt-1.5 text-xs sm:text-sm text-pe-text-secondary lg:hidden">
              {fund.trackedIndex || '—'}
            </p>
            <p className="mt-1 text-xs sm:text-sm text-pe-text-muted lg:hidden">
              <span className="font-medium text-pe-text">{fund.symbol}</span>
              {fund.expenseRatio ? ` · TER ${fund.expenseRatio}` : ''}
              {fund.aum != null ? ` · AUM ${formatAumDisplay(fund)}` : ''}
              {sectorFilter !== 'All' && sectorMatch && (
                <span className="text-pe-text-secondary">
                  {' '}
                  · {sectorFilterLabel} {sectorMatch.weightPct}%
                </span>
              )}
            </p>
          </div>

          <p className="hidden lg:block min-w-0 text-sm text-pe-text-secondary truncate pt-0.5" title={fund.trackedIndex || undefined}>
            {fund.trackedIndex || '—'}
          </p>

          <p className="hidden lg:block min-w-0 text-sm font-medium text-pe-text tabular-nums pt-0.5">
            {fund.symbol}
          </p>

          <p className="hidden lg:block min-w-0 text-sm text-pe-text-secondary tabular-nums pt-0.5">
            {fund.expenseRatio || '—'}
          </p>

          <p
            className="hidden lg:block min-w-0 text-sm text-pe-text-secondary tabular-nums truncate pt-0.5"
            title={formatAumDisplay(fund) !== '—' ? formatAumDisplay(fund) : undefined}
          >
            {formatAumDisplay(fund)}
          </p>

          {sectorFilter !== 'All' && (
            <p className="hidden lg:block min-w-0 text-sm font-medium text-pe-text tabular-nums pt-0.5">
              {sectorMatch ? `${sectorMatch.weightPct}%` : '—'}
            </p>
          )}

          <div className="hidden lg:block min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-pe-text-muted mb-1.5">
              Holdings
            </p>
            <TopHoldingsList holdings={fund.topHoldings} limit={4} compact />
          </div>

          <div className="hidden lg:block min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-pe-text-muted mb-1.5">
              Sectors
            </p>
            <TopSectorsList
              sectors={fund.sectorWeightings}
              limit={4}
              highlightKey={highlightSector}
              compact
            />
          </div>

          <div className="hidden lg:flex justify-end pt-1">
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-pe-text-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-pe-text-muted" />
            )}
          </div>

          {/* Mobile: holdings + sectors — stack on narrow screens for readable wraps */}
          <div className="lg:hidden col-span-full mt-4 grid grid-cols-1 min-[420px]:grid-cols-2 gap-4 border-t border-pe-border pt-4 min-w-0">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-pe-text-muted mb-2">
                Top holdings
              </p>
              <TopHoldingsList holdings={fund.topHoldings} limit={4} compact />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-pe-text-muted mb-2">
                Top sectors
              </p>
              <TopSectorsList
                sectors={fund.sectorWeightings}
                limit={4}
                highlightKey={highlightSector}
                compact
              />
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <FundDetailPanel fund={fund} highlightSector={highlightSector} />
      )}
    </article>
  );
});

export function UcitsScreenerSiteHeader() {
  return (
    <SiteHeader logoHref="/" embedded sticky={false}>
      <a
        href="/"
        className="inline-flex items-center gap-2 text-sm text-pe-text-secondary hover:text-pe-text transition-colors"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        Back to home
      </a>
    </SiteHeader>
  );
}

export default function UcitsScreenerPage() {
  const [query, setQuery] = useState('');
  const [exchange, setExchange] = useState('All');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [minSectorPct, setMinSectorPct] = useState(10);
  const [minAumMillions, setMinAumMillions] = useState('');
  const [indexCategories, setIndexCategories] = useState([]);
  const [aumSort, setAumSort] = useState('none');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [screenerData, setScreenerData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetch(SCREENER_DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load screener data (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setScreenerData(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const funds = screenerData?.funds || [];

  const exchanges = useMemo(() => {
    const set = new Set(funds.map((f) => f.exchange).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [funds]);

  const sectorOptions = useMemo(() => {
    const map = new Map();
    for (const fund of funds) {
      for (const sector of fund.sectorWeightings || []) {
        if (!map.has(sector.key)) map.set(sector.key, sector.label);
      }
    }
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [funds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sectorActive = sectorFilter !== 'All';
    const minPct = Number(minSectorPct) || 0;
    const minAum = Number(minAumMillions);
    const minAumUsd = Number.isFinite(minAum) && minAum > 0 ? minAum * 1_000_000 : 0;

    const rows = funds.filter((fund) => {
      if (exchange !== 'All' && fund.exchange !== exchange) return false;

      if (sectorActive) {
        const sector = getSectorWeight(fund, sectorFilter);
        if (!sector || sector.weightPct < minPct) return false;
      }

      if (minAumUsd > 0) {
        if (fund.aum == null || fund.aum < minAumUsd) return false;
      }

      if (!fundMatchesIndexCategories(fund, indexCategories)) return false;

      if (!q) return true;
      const haystack = [
        fund.name,
        fund.longName,
        fund.symbol,
        fund.trackedIndex,
        fund.yahooSymbol,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    if (aumSort === 'desc' || aumSort === 'asc') {
      return [...rows].sort((a, b) => compareFundsByAum(a, b, aumSort));
    }
    return rows;
  }, [funds, query, exchange, sectorFilter, minSectorPct, minAumMillions, indexCategories, aumSort]);

  const visibleFunds = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );
  const hasMore = visibleCount < filtered.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setExpandedId(null);
  }, [query, exchange, sectorFilter, minSectorPct, minAumMillions, indexCategories, aumSort]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((count) => Math.min(count + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: '600px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, filtered.length]);

  const sectorFilterLabel =
    sectorOptions.find((s) => s.key === sectorFilter)?.label ?? 'Sector';
  const headerGrid = sectorFilter !== 'All' ? DESKTOP_GRID_SECTOR : DESKTOP_GRID_BASE;
  const activeFilterCount = countActiveFilters({
    sectorFilter,
    minAumMillions,
    indexCategories,
    exchange,
  });

  const clearAllFilters = () => {
    setSectorFilter('All');
    setMinSectorPct(10);
    setMinAumMillions('');
    setIndexCategories([]);
    setExchange('All');
    setAumSort('none');
  };

  const filterFieldProps = {
    sectorFilter,
    setSectorFilter,
    sectorOptions,
    minSectorPct,
    setMinSectorPct,
    minAumMillions,
    setMinAumMillions,
    aumSort,
    setAumSort,
    exchange,
    setExchange,
    exchanges,
    indexCategories,
    setIndexCategories,
  };

  useEffect(() => {
    document.title = 'UCITS Screener · PocketEdge';
    return () => {
      document.title = 'PocketEdge';
    };
  }, []);

  if (loadError) {
    return (
      <div className={`${wideContent} py-20 text-center`}>
        <p className="text-pe-text-secondary">Could not load UCITS data.</p>
        <p className="text-sm text-pe-text-muted mt-2">{loadError}</p>
      </div>
    );
  }

  if (!screenerData) {
    return (
      <div className={`${wideContent} py-20 flex justify-center`}>
        <div className="w-10 h-10 border-2 border-pe-border border-t-pe-text rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pe-canvas text-pe-text">
      <section className={`${wideContent} pt-10 sm:pt-14 pb-8 border-b border-pe-border`}>
        <p className="pe-eyebrow">Research</p>
        <h1 className="pe-title mt-2 text-balance">UCITS Screener</h1>
        <p className="text-base sm:text-lg text-pe-text-secondary mt-3 max-w-3xl leading-relaxed">
          Filter UCITS by sector exposure, then inspect holdings and sector weights.{' '}
          {funds.length.toLocaleString()} funds with Yahoo data from a universe of{' '}
          {screenerData.universeSize?.toLocaleString() || '4,000+'} UCITS.
        </p>

        <div className="mt-8 relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pe-text-muted pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by fund name, ticker, or index tracked…"
            className="pe-input pl-12 pr-4 py-3.5 sm:py-4 w-full text-base sm:text-lg"
          />
        </div>

        {/* Mobile: compact active-filter summary */}
        <div className="mt-3 lg:hidden flex flex-wrap items-center gap-2">
          <p className="text-sm text-pe-text-muted">
            {filtered.length.toLocaleString()} fund{filtered.length === 1 ? '' : 's'}
          </p>
          {activeFilterCount > 0 || aumSort !== 'none' ? (
            <>
              <span className="text-pe-border">·</span>
              {sectorFilter !== 'All' && (
                <span className="text-xs px-2 py-1 rounded-full border border-pe-border text-pe-text-secondary">
                  {sectorFilterLabel}
                </span>
              )}
              {Number(minAumMillions) > 0 && (
                <span className="text-xs px-2 py-1 rounded-full border border-pe-border text-pe-text-secondary">
                  ≥{minAumMillions}M AUM
                </span>
              )}
              {exchange !== 'All' && (
                <span className="text-xs px-2 py-1 rounded-full border border-pe-border text-pe-text-secondary">
                  {exchange}
                </span>
              )}
              {indexCategories.length > 0 && (
                <span className="text-xs px-2 py-1 rounded-full border border-pe-border text-pe-text-secondary">
                  {indexCategories.length} index type{indexCategories.length === 1 ? '' : 's'}
                </span>
              )}
              {aumSort !== 'none' && (
                <span className="text-xs px-2 py-1 rounded-full border border-pe-border text-pe-text-secondary">
                  {aumSortLabel(aumSort)}
                </span>
              )}
            </>
          ) : null}
        </div>

        {/* Desktop filters */}
        <div className="mt-4 hidden lg:grid grid-cols-6 gap-3">
          <ScreenerFilterFields {...filterFieldProps} />
        </div>

        <p className="mt-3 hidden lg:block text-sm text-pe-text-muted">
          {filtered.length} fund{filtered.length === 1 ? '' : 's'}
          {sectorFilter !== 'All' && (
            <>
              {' '}
              with ≥{minSectorPct}% {sectorFilterLabel}
            </>
          )}
          {Number(minAumMillions) > 0 && (
            <>
              {' '}
              · min AUM {minAumMillions}M USD
            </>
          )}
          {indexCategories.length > 0 && (
            <>
              {' '}
              · {indexCategories.length} index type{indexCategories.length === 1 ? '' : 's'}
            </>
          )}
        </p>
      </section>

      <main className={`${wideContent} py-6 sm:py-8 pb-28 lg:pb-16`}>
        <div
          className={`hidden lg:grid ${headerGrid} gap-x-4 px-5 py-3 mb-3 text-[10px] font-semibold uppercase tracking-wider text-pe-text-muted`}
        >
          <span>Fund</span>
          <span>Index</span>
          <span>Ticker</span>
          <span>TER</span>
          <span>AUM (USD)</span>
          {sectorFilter !== 'All' && <span>{sectorFilterLabel}</span>}
          <span>Top holdings</span>
          <span>Top sectors</span>
          <span />
        </div>

        <ul className="space-y-3 sm:space-y-4">
          {visibleFunds.map((fund) => (
            <li key={fund.id}>
              <FundCard
                fund={fund}
                expanded={expandedId === fund.id}
                onToggle={() => setExpandedId((id) => (id === fund.id ? null : fund.id))}
                sectorFilter={sectorFilter}
                sectorFilterLabel={sectorFilterLabel}
                highlightSector={sectorFilter !== 'All' ? sectorFilter : null}
              />
            </li>
          ))}
        </ul>

        {filtered.length > 0 && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <p className="text-sm text-pe-text-muted">
              Showing {visibleFunds.length.toLocaleString()} of {filtered.length.toLocaleString()} funds
            </p>
            {hasMore && (
              <>
                <div ref={loadMoreRef} className="h-1 w-full" aria-hidden />
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((count) => Math.min(count + PAGE_SIZE, filtered.length))
                  }
                  className="px-5 py-2.5 rounded-lg border border-pe-border text-sm font-medium text-pe-text-secondary hover:text-pe-text hover:bg-white/[0.03] transition-colors"
                >
                  Load more
                </button>
              </>
            )}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="py-16 text-center text-pe-text-muted border border-pe-border rounded-xl">
            No UCITS match your filters.
          </div>
        )}
      </main>

      <MobileFilterBar
        activeFilterCount={activeFilterCount}
        aumSort={aumSort}
        filteredCount={filtered.length}
        onOpenFilters={() => setMobileFiltersOpen(true)}
      />

      <MobileFilterSheet
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        filteredCount={filtered.length}
        activeFilterCount={activeFilterCount}
        aumSort={aumSort}
        onClear={clearAllFilters}
      >
        <ScreenerFilterFields {...filterFieldProps} indexCategoryLayout="list" />
      </MobileFilterSheet>
    </div>
  );
}
