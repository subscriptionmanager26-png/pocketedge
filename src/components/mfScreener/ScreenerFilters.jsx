import { Search, X } from 'lucide-react';

/**
 * Multi-filter bar: search + category chips + sector chips.
 * Category excludes AMFI Sectoral/Thematic; sector is the dedicated filter for those funds.
 */
export function ScreenerFilters({
  query,
  onQueryChange,
  categoryOptions,
  activeCategory,
  onCategoryChange,
  sectorOptions,
  activeSector,
  onSectorChange,
  resultCount,
}) {
  const hasActive =
    Boolean(query.trim()) ||
    (activeCategory && activeCategory !== 'all') ||
    (activeSector && activeSector !== 'all');

  function clearAll() {
    onQueryChange('');
    onCategoryChange('all');
    onSectorChange('all');
  }

  return (
    <div className="mf-screener-filters">
      <div className="mf-screener-filters-top">
        <label className="mf-screener-search">
          <Search className="mf-screener-search-icon" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search fund or AMC"
            className="mf-screener-search-input"
          />
        </label>
        <div className="mf-screener-filters-meta">
          <span className="mf-screener-filters-count tabular-nums">{resultCount} funds</span>
          {hasActive ? (
            <button type="button" className="mf-screener-filters-clear" onClick={clearAll}>
              <X className="h-3.5 w-3.5" aria-hidden />
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <FilterChipRow
        label="Category"
        ariaLabel="Fund category"
        options={categoryOptions}
        activeId={activeCategory}
        onChange={(id) => {
          onCategoryChange(id);
          // Sectoral funds live under Sector — picking a market-cap category clears sector.
          if (id !== 'all' && activeSector !== 'all') onSectorChange('all');
        }}
      />

      {sectorOptions.length ? (
        <FilterChipRow
          label="Sector"
          ariaLabel="Sector or theme"
          options={sectorOptions}
          activeId={activeSector}
          onChange={(id) => {
          onSectorChange(id);
          // Sector filter focuses thematic funds — clear market-cap category.
          if (id !== 'all' && activeCategory !== 'all') onCategoryChange('all');
        }}
        />
      ) : null}
    </div>
  );
}

function FilterChipRow({ label, ariaLabel, options, activeId, onChange }) {
  return (
    <div className="mf-screener-filter-row">
      <span className="mf-screener-filter-label">{label}</span>
      <div className="mf-screener-filter-chips" role="tablist" aria-label={ariaLabel}>
        {options.map((opt) => {
          const active = opt.id === activeId;
          return (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`mf-screener-filter-chip${active ? ' is-active' : ''}`}
              onClick={() => onChange(opt.id)}
            >
              <span>{opt.label}</span>
              {opt.count != null ? (
                <span className="mf-screener-filter-chip-count tabular-nums">{opt.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
