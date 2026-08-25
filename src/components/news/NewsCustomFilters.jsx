import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import AssetLogo from '../AssetLogo';
import FilterChip from '../FilterChip';
import {
  MARKET_MIN_SEARCH_CHARS,
  searchNewsFilterCompanies,
} from '../../lib/newsFilters';
import { formatTicker } from '../../lib/tickers';

const DIMS = [
  { id: 'company', label: 'Ticker' },
  { id: 'type', label: 'Type' },
  { id: 'industry', label: 'Industry' },
];

function SelectedChip({ label, onRemove }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex max-w-[12rem] items-center gap-1 rounded-full border border-pe-accent/30 bg-pe-accent/10 px-2.5 py-1 text-[12px] font-semibold text-pe-accent"
    >
      <span className="truncate">{label}</span>
      <X className="h-3 w-3 shrink-0" strokeWidth={2.5} />
    </button>
  );
}

function TickerSearch({ selected, labels, onChange }) {
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
      searchNewsFilterCompanies(q, { exclude: [], limit: 8 })
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
    onChange?.(
      [...selected, key],
      { ...(labels ?? {}), [key]: asset.name || asset.symbol || key }
    );
    setQuery('');
    setHits([]);
  };

  const remove = (key) => {
    const nextLabels = { ...(labels ?? {}) };
    delete nextLabels[key];
    onChange?.(
      selected.filter((c) => c !== key),
      nextLabels
    );
  };

  return (
    <div className="space-y-3">
      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((key) => (
            <SelectedChip
              key={key}
              label={labels?.[key] || formatTicker(key)}
              onRemove={() => remove(key)}
            />
          ))}
        </div>
      ) : null}

      <label className="flex items-center gap-2 border-b border-pe-border py-2">
        <Search className="h-4 w-4 shrink-0 text-pe-text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company or ticker"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-pe-text outline-none placeholder:text-pe-text-muted"
        />
      </label>

      {query.trim().length >= MARKET_MIN_SEARCH_CHARS ? (
        <ul className="divide-y divide-pe-border">
          {loading ? (
            <li className="py-2.5 text-[13px] text-pe-text-muted">Searching…</li>
          ) : hits.length === 0 ? (
            <li className="py-2.5 text-[13px] text-pe-text-muted">No matches</li>
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
                    className="flex w-full items-center gap-3 py-3 text-left disabled:opacity-50"
                  >
                    <AssetLogo
                      logoIconUrl={asset.logoIconUrl}
                      assetType={asset.kind}
                      assetKey={asset.key}
                      name={asset.name || asset.symbol}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-pe-text">
                        {asset.kind === 'fund'
                          ? asset.name || asset.key
                          : formatTicker(asset.symbol || asset.key)}
                      </span>
                      {asset.kind === 'fund' ? null : (
                        <span className="mt-0.5 block truncate text-[12px] text-pe-text-muted">
                          {asset.name}
                        </span>
                      )}
                    </span>
                    {on ? (
                      <span className="shrink-0 text-[11px] font-semibold text-pe-accent">Added</span>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : (
        <p className="text-[13px] text-pe-text-muted">
          Add one or more tickers to narrow the feed.
        </p>
      )}
    </div>
  );
}

function OptionChips({ options, selected, onChange, searchable = false, emptyLabel }) {
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

  if (!options?.length) {
    return <p className="text-[13px] text-pe-text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {searchable && options.length > 8 ? (
        <label className="flex items-center gap-2 border-b border-pe-border py-2">
          <Search className="h-4 w-4 shrink-0 text-pe-text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search industries"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-pe-text outline-none placeholder:text-pe-text-muted"
          />
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {filtered.map((opt) => (
          <FilterChip
            key={opt}
            selected={selectedSet.has(opt)}
            onClick={() => toggle(opt)}
          >
            {opt}
          </FilterChip>
        ))}
        {!filtered.length ? (
          <p className="text-[13px] text-pe-text-muted">No matches</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Custom filter fields for News — used inside the filter dialog.
 */
export default function NewsCustomFilters({
  embedded = false,
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
}) {
  const setDim = (dim) => {
    if (dim === customDim) return;
    onCompaniesChange?.([], {});
    onTypesChange?.([]);
    onIndustriesChange?.([]);
    onCustomDimChange?.(dim);
  };

  return (
    <section className={embedded ? '' : 'px-4 pt-4 md:px-6'}>
      <div className="flex flex-wrap gap-2">
        {DIMS.map((dim) => (
          <FilterChip
            key={dim.id}
            selected={customDim === dim.id}
            onClick={() => setDim(dim.id)}
          >
            {dim.label}
          </FilterChip>
        ))}
      </div>

      <div className="mt-4">
        {customDim === 'company' ? (
          <TickerSearch
            selected={companies}
            labels={companyLabels}
            onChange={onCompaniesChange}
          />
        ) : null}
        {customDim === 'type' ? (
          <OptionChips
            options={typeOptions}
            selected={types}
            onChange={onTypesChange}
            emptyLabel="No types in this feed yet"
          />
        ) : null}
        {customDim === 'industry' ? (
          <OptionChips
            options={industryOptions}
            selected={industries}
            onChange={onIndustriesChange}
            searchable
            emptyLabel="No industries mapped yet"
          />
        ) : null}
      </div>
    </section>
  );
}
