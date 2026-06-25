import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Search } from 'lucide-react';
import SiteHeader from './components/SiteHeader';
import { edgeX } from './designTokens';

const wideContent = `max-w-[90rem] mx-auto ${edgeX}`;
const SCREENER_DATA_URL = '/data/ucits-screener.json';

const DESKTOP_GRID_BASE =
  'lg:grid lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)_4.5rem_4rem_minmax(0,1.05fr)_minmax(0,1.05fr)_2rem] lg:gap-x-4 lg:items-start';

const DESKTOP_GRID_SECTOR =
  'lg:grid lg:grid-cols-[minmax(0,1.9fr)_minmax(0,0.95fr)_4.5rem_4rem_4rem_minmax(0,1fr)_minmax(0,1fr)_2rem] lg:gap-x-4 lg:items-start';

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

function TopHoldingsList({ holdings, limit = 4, compact = false }) {
  const rows = holdings?.slice(0, limit) ?? [];
  if (!rows.length) {
    return <p className="text-xs text-pe-text-muted">—</p>;
  }

  return (
    <ul className={compact ? 'space-y-1' : 'space-y-1.5'}>
      {rows.map((holding) => (
        <li
          key={holding.symbol || holding.name}
          className={`flex items-center justify-between gap-2 ${
            compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'
          }`}
        >
          <span className="text-pe-text-secondary truncate">{holding.symbol || holding.name}</span>
          <span className="text-pe-text-muted tabular-nums shrink-0">{formatWeight(holding)}</span>
        </li>
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
    <ul className={compact ? 'space-y-1' : 'space-y-1.5'}>
      {rows.map((sector) => (
        <li
          key={sector.key}
          className={`flex items-center justify-between gap-2 ${
            compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'
          } ${highlightKey === sector.key ? 'text-pe-text font-medium' : 'text-pe-text-secondary'}`}
        >
          <span className="truncate">{sector.label}</span>
          <span className="tabular-nums shrink-0">{sector.weightPct}%</span>
        </li>
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
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-pe-text truncate">{holding.name}</p>
                <p className="text-xs text-pe-text-muted">{holding.symbol || '—'}</p>
              </div>
              <span className="text-pe-text-secondary shrink-0 tabular-nums">
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

function FundCard({ fund, expanded, onToggle, sectorFilter, sectorFilterLabel, highlightSector }) {
  const sectorMatch = getSectorWeight(fund, sectorFilter);
  const desktopGrid = sectorFilter !== 'All' ? DESKTOP_GRID_SECTOR : DESKTOP_GRID_BASE;

  return (
    <article className="rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 sm:px-5 py-4 sm:py-5 hover:bg-white/[0.02] transition-colors"
      >
        {/* Desktop table header row is global; this is the card body */}
        <div className={desktopGrid}>
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
              {sectorFilter !== 'All' && sectorMatch && (
                <span className="text-pe-text-secondary">
                  {' '}
                  · {sectorFilterLabel} {sectorMatch.weightPct}%
                </span>
              )}
            </p>
          </div>

          <p className="hidden lg:block text-sm text-pe-text-secondary truncate pt-0.5">
            {fund.trackedIndex || '—'}
          </p>

          <p className="hidden lg:block text-sm font-medium text-pe-text tabular-nums pt-0.5">
            {fund.symbol}
          </p>

          <p className="hidden lg:block text-sm text-pe-text-secondary tabular-nums pt-0.5">
            {fund.expenseRatio || '—'}
          </p>

          {sectorFilter !== 'All' && (
            <p className="hidden lg:block text-sm font-medium text-pe-text tabular-nums pt-0.5">
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

          {/* Mobile: holdings + sectors side by side */}
          <div className="lg:hidden col-span-full mt-4 grid grid-cols-2 gap-4 border-t border-pe-border pt-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-pe-text-muted mb-2">
                Top holdings
              </p>
              <TopHoldingsList holdings={fund.topHoldings} limit={4} compact />
            </div>
            <div>
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
}

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
  const [expandedId, setExpandedId] = useState(null);
  const [screenerData, setScreenerData] = useState(null);
  const [loadError, setLoadError] = useState(null);

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

    return funds.filter((fund) => {
      if (exchange !== 'All' && fund.exchange !== exchange) return false;

      if (sectorActive) {
        const sector = getSectorWeight(fund, sectorFilter);
        if (!sector || sector.weightPct < minPct) return false;
      }

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
  }, [funds, query, exchange, sectorFilter, minSectorPct]);

  const sectorFilterLabel =
    sectorOptions.find((s) => s.key === sectorFilter)?.label ?? 'Sector';
  const headerGrid = sectorFilter !== 'All' ? DESKTOP_GRID_SECTOR : DESKTOP_GRID_BASE;

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

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-pe-text-muted">
              Sector
            </span>
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
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-pe-text-muted">
                %
              </span>
            </div>
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
            <span className="text-xs font-medium uppercase tracking-wider text-pe-text-muted">
              Exchange
            </span>
            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value)}
              className="pe-input py-2.5"
            >
              {exchanges.map((ex) => (
                <option key={ex} value={ex}>
                  {ex === 'All' ? 'All exchanges' : ex}
                </option>
              ))}
            </select>
          </label>

          <p className="flex items-end text-sm text-pe-text-muted sm:col-span-2 lg:col-span-1 pb-2.5">
            {filtered.length} fund{filtered.length === 1 ? '' : 's'}
            {sectorFilter !== 'All' && (
              <>
                {' '}
                with ≥{minSectorPct}% {sectorFilterLabel}
              </>
            )}
          </p>
        </div>
      </section>

      <main className={`${wideContent} py-6 sm:py-8 pb-16`}>
        <div
          className={`hidden lg:grid ${headerGrid} gap-x-4 px-5 py-3 mb-3 text-[10px] font-semibold uppercase tracking-wider text-pe-text-muted`}
        >
          <span>Fund</span>
          <span>Tracks</span>
          <span>Ticker</span>
          <span>TER</span>
          {sectorFilter !== 'All' && <span>{sectorFilterLabel}</span>}
          <span>Top holdings</span>
          <span>Top sectors</span>
          <span />
        </div>

        <ul className="space-y-3 sm:space-y-4">
          {filtered.map((fund) => (
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

        {filtered.length === 0 && (
          <div className="py-16 text-center text-pe-text-muted border border-pe-border rounded-xl">
            No UCITS match your filters.
          </div>
        )}
      </main>
    </div>
  );
}
