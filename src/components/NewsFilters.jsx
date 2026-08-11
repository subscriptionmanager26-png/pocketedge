import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import AssetLogo from './AssetLogo';
import {
  MARKET_MIN_SEARCH_CHARS,
  NEWS_ALL_PORTFOLIOS_ID,
  searchNewsFilterCompanies,
} from '../lib/newsFilters';
import { formatTicker } from '../lib/tickers';

const CUSTOM_DIMS = [
  { id: 'company', label: 'Ticker' },
  { id: 'type', label: 'Type' },
  { id: 'industry', label: 'Industry' },
];

/**
 * Compact News filter chrome — mutually exclusive scopes:
 * Global | Portfolio (+ name dropdown) | Custom (one dimension inside panel).
 * Clear and selections live inside Custom only (no chip row).
 */
export default function NewsFilters({
  guestMode = false,
  scope = 'global',
  onScopeChange,
  portfolios = [],
  selectedPortfolioId = NEWS_ALL_PORTFOLIOS_ID,
  onSelectedPortfolioChange,
  customDim = 'company',
  onCustomDimChange,
  companies = [],
  companyLabels = {},
  onCompaniesChange,
  types = [],
  typeOptions = [],
  onTypesChange,
  industries = [],
  industryOptions = [],
  onIndustriesChange,
  resultCount = 0,
}) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [panelOpen, setPanelOpen] = useState(false);
  const customBtnRef = useRef(null);

  const customCount =
    customDim === 'company'
      ? companies.length
      : customDim === 'type'
        ? types.length
        : customDim === 'industry'
          ? industries.length
          : 0;
  const showClear = scope === 'custom' && customCount > 0;

  const selectedPortfolioLabel = useMemo(() => {
    if (selectedPortfolioId === NEWS_ALL_PORTFOLIOS_ID) return 'All portfolios';
    return (
      portfolios.find((p) => p.id === selectedPortfolioId)?.name || 'Portfolio'
    );
  }, [portfolios, selectedPortfolioId]);

  const clearCustom = () => {
    onCompaniesChange?.([]);
    onTypesChange?.([]);
    onIndustriesChange?.([]);
  };

  const setCustomDimExclusive = (dim) => {
    if (dim === customDim) return;
    clearCustom();
    onCustomDimChange?.(dim);
  };

  const goGlobal = () => {
    setPanelOpen(false);
    onScopeChange?.('global');
  };

  const goPortfolio = () => {
    setPanelOpen(false);
    onScopeChange?.('portfolio');
  };

  const goCustom = () => {
    onScopeChange?.('custom');
    setPanelOpen(true);
  };

  const panel = (
    <FilterPanelBody
      customDim={customDim || 'company'}
      onCustomDimChange={setCustomDimExclusive}
      companies={companies}
      companyLabels={companyLabels}
      onCompaniesChange={onCompaniesChange}
      types={types}
      typeOptions={typeOptions}
      onTypesChange={onTypesChange}
      industries={industries}
      industryOptions={industryOptions}
      onIndustriesChange={onIndustriesChange}
      onDone={() => setPanelOpen(false)}
      onClear={clearCustom}
    />
  );

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden border-b border-pe-border bg-pe-canvas">
      <div className="flex min-w-0 max-w-full flex-col gap-2 px-4 py-2 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div
              className="inline-flex h-8 max-w-none rounded-full bg-pe-surface p-0.5"
              role="group"
              aria-label="News scope"
            >
              <ScopeButton selected={scope === 'global'} onClick={goGlobal}>
                Global
              </ScopeButton>
              {!guestMode ? (
                <ScopeButton
                  selected={scope === 'portfolio'}
                  onClick={goPortfolio}
                  title="Only news for tickers in a portfolio"
                >
                  Portfolio
                </ScopeButton>
              ) : null}
              <ScopeButton
                ref={customBtnRef}
                selected={scope === 'custom'}
                onClick={goCustom}
                title="Filter by ticker, type, or industry"
              >
                Custom
                {scope === 'custom' && customCount > 0 ? (
                  <span className="ml-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-white/25 px-1 py-0.5 text-[10px] font-bold leading-none text-white">
                    {customCount}
                  </span>
                ) : null}
              </ScopeButton>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-[12px] tabular-nums text-pe-text-muted sm:inline">
              {resultCount} {resultCount === 1 ? 'story' : 'stories'}
            </span>
            {showClear ? (
              <button
                type="button"
                onClick={clearCustom}
                className="text-[12px] font-semibold text-pe-text-secondary hover:text-pe-accent"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {!guestMode && scope === 'portfolio' ? (
          <div className="min-w-0">
            <PortfolioPicker
              portfolios={portfolios}
              selectedId={selectedPortfolioId}
              label={selectedPortfolioLabel}
              onChange={onSelectedPortfolioChange}
            />
          </div>
        ) : null}
      </div>

      {panelOpen && scope === 'custom' && isDesktop ? (
        <DesktopFilterPopover
          anchorRef={customBtnRef}
          onClose={() => setPanelOpen(false)}
        >
          {panel}
        </DesktopFilterPopover>
      ) : null}

      {panelOpen && scope === 'custom' && !isDesktop ? (
        <MobileFilterSheet onClose={() => setPanelOpen(false)}>{panel}</MobileFilterSheet>
      ) : null}
    </div>
  );
}

const ScopeButton = forwardRef(function ScopeButton(
  { selected, onClick, title, children },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={selected}
      className={`inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold transition sm:px-3 ${
        selected
          ? 'bg-[var(--fv-accent,var(--pe-accent))] text-white'
          : 'text-pe-text-secondary hover:text-pe-text'
      }`}
    >
      {children}
    </button>
  );
});

function PortfolioPicker({ portfolios, selectedId, label, onChange }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    const sync = () => {
      const el = btnRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 180) - 12)),
        width: Math.min(Math.max(rect.width, 180), window.innerWidth - 24),
      });
    };
    sync();
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('resize', sync);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('resize', sync);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const options = [
    { id: NEWS_ALL_PORTFOLIOS_ID, name: 'All portfolios' },
    ...portfolios.map((p) => ({
      id: p.id,
      name: p.name || (p.kind === 'watchlist' ? 'Watchlist' : 'Portfolio'),
    })),
  ];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex h-8 w-full max-w-full items-center gap-1 rounded-full border border-pe-border bg-white px-2.5 text-[12px] font-semibold text-pe-text sm:w-auto sm:max-w-[14rem]"
      >
        <span className="min-w-0 flex-1 truncate text-left sm:flex-none">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-pe-text-muted" />
      </button>
      {open && pos && typeof document !== 'undefined'
        ? createPortal(
            <ul
              ref={menuRef}
              style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
              className="fixed z-[90] max-h-60 overflow-y-auto rounded-xl border border-pe-border bg-pe-canvas py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
              role="listbox"
            >
              {options.map((opt) => {
                const on = opt.id === selectedId;
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => {
                        onChange?.(opt.id);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium ${
                        on
                          ? 'bg-pe-accent-wash text-pe-accent'
                          : 'text-pe-text hover:bg-pe-surface'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{opt.name}</span>
                      {on ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body
          )
        : null}
    </>
  );
}

function FilterPanelBody({
  customDim,
  onCustomDimChange,
  companies,
  companyLabels,
  onCompaniesChange,
  types,
  typeOptions,
  onTypesChange,
  industries,
  industryOptions,
  onIndustriesChange,
  onDone,
  onClear,
}) {
  const hasValues =
    (customDim === 'company' && companies.length > 0) ||
    (customDim === 'type' && types.length > 0) ||
    (customDim === 'industry' && industries.length > 0);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <section>
          <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
            Filter by
          </p>
          <p className="mt-0.5 text-[12px] text-pe-text-secondary">
            Choose one: ticker, type, or industry
          </p>
          <div
            className="mt-2 inline-flex rounded-full bg-pe-surface p-0.5"
            role="group"
            aria-label="Custom filter dimension"
          >
            {CUSTOM_DIMS.map((dim) => (
              <button
                key={dim.id}
                type="button"
                onClick={() => onCustomDimChange?.(dim.id)}
                aria-pressed={customDim === dim.id}
                className={`h-8 rounded-full px-3 text-[12px] font-semibold transition ${
                  customDim === dim.id
                    ? 'bg-[var(--fv-accent,var(--pe-accent))] text-white'
                    : 'text-pe-text-secondary hover:text-pe-text'
                }`}
              >
                {dim.label}
              </button>
            ))}
          </div>
        </section>

        {customDim === 'company' ? (
          <section>
            <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
              Tickers
            </p>
            <div className="mt-2">
              <NewsCompanyMultiSelect
                selected={companies}
                labels={companyLabels}
                onChange={onCompaniesChange}
              />
            </div>
          </section>
        ) : null}

        {customDim === 'type' ? (
          <CheckboxSection
            title="Type"
            options={typeOptions}
            selected={types}
            onChange={onTypesChange}
            emptyLabel="No types in this feed yet"
          />
        ) : null}

        {customDim === 'industry' ? (
          <CheckboxSection
            title="Industry"
            options={industryOptions}
            selected={industries}
            onChange={onIndustriesChange}
            emptyLabel="No industries mapped yet"
            searchable
          />
        ) : null}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-pe-border px-4 py-3">
        {hasValues ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl border border-pe-border px-3 py-2.5 text-sm font-semibold text-pe-text-secondary"
          >
            Clear
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDone}
          className="flex-1 rounded-xl bg-pe-accent py-2.5 text-sm font-bold text-white hover:bg-pe-accent-pressed"
        >
          Show results
        </button>
      </div>
    </div>
  );
}

function CheckboxSection({
  title,
  options,
  selected,
  onChange,
  emptyLabel,
  searchable = false,
}) {
  const [query, setQuery] = useState('');
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const filtered = useMemo(() => {
    const list = options ?? [];
    if (!searchable) return list;
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((opt) => String(opt).toLowerCase().includes(q));
  }, [options, query, searchable]);

  const toggle = (opt) => {
    if (selectedSet.has(opt)) onChange?.(selected.filter((v) => v !== opt));
    else onChange?.([...selected, opt]);
  };

  return (
    <section>
      <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
        {title}
      </p>
      {searchable && (options?.length ?? 0) > 6 ? (
        <label className="mt-2 flex items-center gap-2 rounded-lg border border-pe-border bg-white px-2.5 py-2">
          <Search className="h-3.5 w-3.5 text-pe-text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}`}
            className="min-w-0 flex-1 bg-transparent text-sm text-pe-text outline-none"
          />
        </label>
      ) : null}
      {!options?.length ? (
        <p className="mt-2 text-[12px] text-pe-text-muted">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-pe-border bg-white p-1">
          {filtered.map((opt) => {
            const on = selectedSet.has(opt);
            return (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => toggle(opt)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium ${
                    on ? 'bg-pe-accent-wash text-pe-accent' : 'text-pe-text hover:bg-pe-surface'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      on ? 'border-pe-accent bg-pe-accent text-white' : 'border-pe-border-strong'
                    }`}
                  >
                    {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="truncate">{opt}</span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 ? (
            <li className="px-2.5 py-2 text-[12px] text-pe-text-muted">No matches</li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

function ActiveChip({ label, onRemove }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex max-w-[11rem] shrink-0 items-center gap-1 rounded-full border border-pe-border bg-white px-2.5 py-1 text-[11px] font-semibold text-pe-text"
    >
      <span className="truncate">{label}</span>
      <X className="h-3 w-3 shrink-0 text-pe-text-muted" strokeWidth={2.5} />
    </button>
  );
}

function NewsCompanyMultiSelect({ selected, labels, onChange }) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState([]);
  const [loading, setLoading] = useState(false);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MARKET_MIN_SEARCH_CHARS) {
      setHits([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      searchNewsFilterCompanies(q, { exclude: [], limit: 10 })
        .then((items) => {
          if (!cancelled) setHits(items);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const add = (asset) => {
    const key = String(asset.key ?? '').trim().toUpperCase();
    if (!key || selectedSet.has(key)) return;
    const nextKeys = [...selected, key];
    const nextLabels = {
      ...(labels ?? {}),
      [key]: asset.name || asset.symbol || key,
    };
    onChange?.(nextKeys, nextLabels);
    setQuery('');
    setHits([]);
  };

  const remove = (key) => {
    const nextKeys = selected.filter((c) => c !== key);
    const nextLabels = { ...(labels ?? {}) };
    delete nextLabels[key];
    onChange?.(nextKeys, nextLabels);
  };

  return (
    <div>
      {selected.length ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((key) => (
            <ActiveChip
              key={key}
              label={labels?.[key] || formatTicker(key)}
              onRemove={() => remove(key)}
            />
          ))}
        </div>
      ) : null}
      <label className="flex items-center gap-2 rounded-lg border border-pe-border bg-white px-2.5 py-2">
        <Search className="h-3.5 w-3.5 text-pe-text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company or ticker"
          className="min-w-0 flex-1 bg-transparent text-sm text-pe-text outline-none"
        />
      </label>
      {query.trim().length >= MARKET_MIN_SEARCH_CHARS ? (
        <ul className="mt-1.5 max-h-48 overflow-y-auto rounded-lg border border-pe-border bg-white">
          {loading ? (
            <li className="px-3 py-2.5 text-[12px] text-pe-text-muted">Searching…</li>
          ) : hits.length === 0 ? (
            <li className="px-3 py-2.5 text-[12px] text-pe-text-muted">No matches</li>
          ) : (
            hits.map((asset) => {
              const key = String(asset.key).toUpperCase();
              const on = selectedSet.has(key);
              return (
                <li key={key}>
                  <button
                    type="button"
                    disabled={on}
                    onClick={() => add(asset)}
                    className="flex w-full items-center gap-2 border-b border-pe-border px-3 py-2.5 text-left last:border-b-0 hover:bg-pe-surface disabled:opacity-50"
                  >
                    <AssetLogo
                      logoIconUrl={asset.logoIconUrl}
                      assetType={asset.kind}
                      assetKey={asset.key}
                      name={asset.name || asset.symbol}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-pe-text">
                        {asset.kind === 'fund'
                          ? asset.name || asset.key
                          : formatTicker(asset.symbol || asset.key)}
                      </p>
                      {asset.kind === 'fund' ? null : (
                        <p className="truncate text-[11px] text-pe-text-muted">{asset.name}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] font-bold uppercase text-pe-text-muted">
                      {asset.kindLabel}
                    </span>
                    {on ? (
                      <Check className="h-4 w-4 shrink-0 text-pe-accent" />
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}

function DesktopFilterPopover({ anchorRef, onClose, children }) {
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    const sync = () => {
      const el = anchorRef?.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        left: Math.min(rect.left, window.innerWidth - 360 - 12),
      });
    };
    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const onDown = (event) => {
      if (panelRef.current?.contains(event.target)) return;
      if (anchorRef?.current?.contains(event.target)) return;
      onClose?.();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [anchorRef, onClose]);

  if (!pos || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{ top: pos.top, left: Math.max(12, pos.left) }}
      className="fixed z-[80] flex w-[min(100vw-24px,22rem)] max-h-[min(70vh,520px)] flex-col overflow-hidden rounded-2xl border border-pe-border bg-pe-canvas shadow-[0_12px_36px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.06)]"
      role="dialog"
      aria-label="Custom news filters"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-pe-border px-4 py-3">
        <p className="text-[14px] font-semibold text-pe-text">Custom filters</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-pe-text-muted hover:bg-pe-surface"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>,
    document.body
  );
}

function MobileFilterSheet({ onClose, children }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 md:hidden"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border border-pe-border bg-pe-canvas shadow-[0_12px_36px_rgba(0,0,0,0.12)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Custom news filters"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-pe-border px-4 py-3.5">
          <p className="text-[15px] font-semibold text-pe-text">Custom filters</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-pe-text-muted hover:bg-pe-surface"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
