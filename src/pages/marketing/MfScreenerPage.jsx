import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import MarketingShell from '../../components/MarketingShell';
import { ScreenerFilters } from '../../components/mfScreener/ScreenerFilters';
import { loadAmfiEquityDirectGrowth, uniqueSorted } from '../../lib/mfScreener/amfiSchemes';
import { standardizeAmcName } from '../../lib/mfScreener/amcNames';
import {
  cellNumeric,
  formatAum,
  formatDisplayCell,
  formatRatio,
  formatReturnPct,
  formatTer,
  returnTone,
  shortCategoryLabel,
  sortValue,
} from '../../lib/mfScreener/format';
import { getFundReturn, listFundReturns, parseUpvalyMetric } from '../../lib/mfScreener/metrics';
import { simplifySchemeName } from '../../lib/mfScreener/schemeNames';
import {
  isSectoralSubCategory,
  resolveSectorTheme,
  sortSectorThemes,
} from '../../lib/mfScreener/sectors';
import { buildMetricsIndex, formatSnapshotDate, loadScreenerSnapshot } from '../../lib/mfScreener/snapshot';
import {
  ALL_SCREENER_COLUMNS,
  SCREENER_TABLE_GROUPS,
  screenerColumnKey,
  sortDescDefault,
} from '../../lib/mfScreener/types';
import { fundPath, resourcesPath } from '../../lib/routes';
import '../../components/mfScreener/mfScreener.css';

const ALL_ID = 'all';

function FundDetail({ row, scheme, snapshotLoading, onBack }) {
  const returnRows = scheme ? listFundReturns(scheme) : [];
  const risk3y = scheme?.riskStdDevByTimeframe?.['3y'];
  const ret1y = getFundReturn(scheme, '1y')?.valuePct;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-pe-accent hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to screener
      </button>

      <article className="rounded-xl border border-pe-border bg-pe-canvas p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {row.sectorTheme ? (
            <span className="rounded-full bg-pe-surface px-2.5 py-1 text-xs font-semibold text-pe-text-secondary">
              {row.sectorTheme}
            </span>
          ) : (
            <span className="rounded-full bg-pe-surface px-2.5 py-1 text-xs font-semibold text-pe-text-secondary">
              {shortCategoryLabel(row.subCategory)}
            </span>
          )}
          <span className="rounded-full bg-pe-surface px-2.5 py-1 text-xs font-semibold text-pe-text-secondary">
            Direct · Growth
          </span>
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-pe-text">
          {simplifySchemeName(row.name, row.amfiCode)}
        </h2>
        <p className="mt-1 text-sm text-pe-text-secondary">{standardizeAmcName(row.amc)}</p>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-pe-text-muted">AUM</p>
            <p className="mt-1 text-base font-semibold text-pe-text">{formatAum(scheme?.aumCr)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-pe-text-muted">
              Expense ratio
            </p>
            <p className="mt-1 text-base font-semibold text-pe-text">
              {formatTer(scheme?.expenseRatio)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-pe-text-muted">1Y return</p>
            <p className={`mt-1 text-base font-semibold ${returnTone(ret1y)}`}>
              {formatReturnPct(ret1y)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-pe-text-muted">3Y CAGR</p>
            <p className={`mt-1 text-base font-semibold ${returnTone(scheme?.cagrByPeriod?.['3y'])}`}>
              {formatReturnPct(scheme?.cagrByPeriod?.['3y'])}
            </p>
          </div>
        </div>

        <Link
          to={fundPath(row.amfiCode)}
          className="mt-5 inline-flex text-sm font-semibold text-pe-accent hover:underline"
        >
          Open fund page →
        </Link>
      </article>

      <section className="rounded-xl border border-pe-border bg-pe-canvas p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-pe-accent">Returns</p>
        <div className="mt-3 divide-y divide-pe-border">
          {returnRows.length ? (
            returnRows.map((r) => (
              <div key={r.timeframe} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-pe-text-secondary">{r.label}</span>
                <span className={`font-semibold ${returnTone(r.valuePct)}`}>
                  {formatReturnPct(r.valuePct)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-pe-text-muted">
              {snapshotLoading ? 'Loading returns…' : 'No return data'}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-pe-border bg-pe-canvas p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-pe-accent">Fundamentals</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['P/E', formatRatio(parseUpvalyMetric(scheme?.fundamentals?.pe), 1)],
            ['P/B', formatRatio(parseUpvalyMetric(scheme?.fundamentals?.pb), 1)],
            ['P/S', formatRatio(parseUpvalyMetric(scheme?.fundamentals?.priceToSale), 1)],
            ['Inception', scheme?.inceptionDate ?? '—'],
          ].map(([label, val]) => (
            <div key={label} className="rounded-lg bg-pe-surface px-3 py-2.5">
              <p className="text-xs text-pe-text-muted">{label}</p>
              <p className="mt-0.5 text-sm font-semibold text-pe-text">{val}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-pe-border bg-pe-canvas p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-pe-accent">
          Risk (3Y std dev)
        </p>
        <div className="mt-3 divide-y divide-pe-border text-sm">
          <div className="flex justify-between py-2.5">
            <span className="text-pe-text-secondary">Fund</span>
            <span className="font-semibold text-pe-text">
              {risk3y?.value != null ? `${formatRatio(risk3y.value, 1)}%` : '—'}
            </span>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-pe-text-secondary">Category avg</span>
            <span className="font-semibold text-pe-text">
              {risk3y?.categoryAverage != null
                ? `${formatRatio(risk3y.categoryAverage, 1)}%`
                : '—'}
            </span>
          </div>
        </div>
      </section>

      {scheme?.holdings?.length ? (
        <section className="rounded-xl border border-pe-border bg-pe-canvas p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-pe-accent">Top holdings</p>
          <div className="mt-3 divide-y divide-pe-border">
            {scheme.holdings.slice(0, 10).map((h) => (
              <div key={h.name} className="flex items-start justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-pe-text">{h.name}</p>
                  <p className="text-xs text-pe-text-muted">{h.sector ?? '—'}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-pe-text">{h.weightage}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function MfScreenerPage() {
  const [allRows, setAllRows] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [csvLoading, setCsvLoading] = useState(true);
  const [sortKey, setSortKey] = useState('cagr_1y');
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedCode, setSelectedCode] = useState(null);
  const [metrics, setMetrics] = useState({});
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [snapshotDate, setSnapshotDate] = useState(null);
  const [activeCategory, setActiveCategory] = useState(ALL_ID);
  const [activeSector, setActiveSector] = useState(ALL_ID);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    void loadAmfiEquityDirectGrowth()
      .then((rows) => {
        if (cancelled) return;
        setAllRows(
          rows.map((r) => ({
            ...r,
            amcLabel: standardizeAmcName(r.amc),
            amcSortKey: standardizeAmcName(r.amc).toLowerCase(),
            sectorTheme: resolveSectorTheme({
              name: r.name,
              subCategory: r.subCategory,
            }),
          })),
        );
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load fund list');
      })
      .finally(() => {
        if (!cancelled) setCsvLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadScreenerSnapshot()
      .then((snapshot) => {
        if (cancelled) return;
        const index = buildMetricsIndex(snapshot);
        setMetrics(index);
        setSnapshotDate(snapshot.generatedAt);
        // Re-tag sectoral funds with Upvaly schemeCategory when snapshot arrives.
        setAllRows((prev) =>
          prev.map((r) => {
            if (!isSectoralSubCategory(r.subCategory)) return r;
            const scheme = index[r.amfiCode];
            return {
              ...r,
              sectorTheme: resolveSectorTheme({
                name: scheme?.schemeName || r.name,
                schemeCategory: scheme?.schemeCategory,
                subCategory: r.subCategory,
              }),
            };
          }),
        );
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError((prev) => prev ?? (err instanceof Error ? err.message : 'Failed to load screener data'));
        }
      })
      .finally(() => {
        if (!cancelled) setSnapshotLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const marketCapRows = allRows.filter((r) => !isSectoralSubCategory(r.subCategory));
    const counts = new Map();
    for (const r of marketCapRows) {
      counts.set(r.subCategory, (counts.get(r.subCategory) ?? 0) + 1);
    }
    const cats = uniqueSorted(marketCapRows.map((r) => r.subCategory)).map((id) => ({
      id,
      label: shortCategoryLabel(id),
      count: counts.get(id) ?? 0,
    }));
    return [{ id: ALL_ID, label: 'All', count: marketCapRows.length }, ...cats];
  }, [allRows]);

  const sectorOptions = useMemo(() => {
    const sectoral = allRows.filter((r) => r.sectorTheme);
    const counts = new Map();
    for (const r of sectoral) {
      counts.set(r.sectorTheme, (counts.get(r.sectorTheme) ?? 0) + 1);
    }
    const themes = sortSectorThemes([...counts.keys()]).map((id) => ({
      id,
      label: id,
      count: counts.get(id) ?? 0,
    }));
    return [
      { id: ALL_ID, label: 'Off' },
      { id: 'all-themes', label: 'All themes', count: sectoral.length },
      ...themes,
    ];
  }, [allRows]);

  useEffect(() => {
    if (!categoryOptions.length) return;
    setActiveCategory((prev) => {
      if (prev && categoryOptions.some((o) => o.id === prev)) return prev;
      const largeCap = categoryOptions.find((o) => /large cap/i.test(o.id));
      return largeCap?.id ?? ALL_ID;
    });
  }, [categoryOptions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRows.filter((r) => {
      if (activeSector === 'all-themes') {
        if (!r.sectorTheme) return false;
      } else if (activeSector !== ALL_ID) {
        if (r.sectorTheme !== activeSector) return false;
      } else if (activeCategory !== ALL_ID) {
        if (r.subCategory !== activeCategory) return false;
      } else if (isSectoralSubCategory(r.subCategory)) {
        // Category All + Sector Off → market-cap styles only.
        return false;
      }

      if (!q) return true;
      return (
        r.amcLabel.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.sectorTheme || '').toLowerCase().includes(q) ||
        shortCategoryLabel(r.subCategory).toLowerCase().includes(q)
      );
    });
  }, [allRows, activeCategory, activeSector, query]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey, metrics);
      const bv = sortValue(b, sortKey, metrics);
      let cmp;
      if (typeof av === 'string' && typeof bv === 'string') {
        cmp = av.localeCompare(bv);
        cmp = sortDesc ? -cmp : cmp;
      } else {
        cmp = sortDesc ? bv - av : av - bv;
      }
      if (cmp !== 0) return cmp;
      return a.amfiCode.localeCompare(b.amfiCode);
    });
    return copy;
  }, [filtered, sortKey, sortDesc, metrics]);

  const selected = useMemo(
    () => (selectedCode ? allRows.find((r) => r.amfiCode === selectedCode) ?? null : null),
    [selectedCode, allRows],
  );

  const dataLoading = csvLoading || snapshotLoading;

  const activeFilterLabel = useMemo(() => {
    if (activeSector === 'all-themes') return 'All themes';
    if (activeSector !== ALL_ID) return activeSector;
    if (activeCategory !== ALL_ID) return shortCategoryLabel(activeCategory);
    return 'Market cap styles';
  }, [activeCategory, activeSector]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(sortDescDefault(key));
    }
  };

  const sortIndicator = (key) => (sortKey === key ? (sortDesc ? ' ↓' : ' ↑') : '');

  if (selected) {
    return (
      <MarketingShell wide>
        <FundDetail
          row={selected}
          scheme={metrics[selected.amfiCode]}
          snapshotLoading={snapshotLoading}
          onBack={() => setSelectedCode(null)}
        />
      </MarketingShell>
    );
  }

  return (
    <MarketingShell wide>
      <div className="mb-6">
        <Link
          to={resourcesPath()}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-pe-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Resources
        </Link>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-pe-accent">Resources</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-pe-text md:text-4xl">
          MF screener
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-pe-text-secondary">
          Equity Direct Growth funds — filter by category or sector/theme, then compare rolling
          returns, CAGR, risk, and fundamentals.
        </p>
      </div>

      {loadError ? (
        <p className="mb-4 rounded-lg border border-pe-negative/30 bg-pe-negative/5 px-4 py-3 text-sm text-pe-negative">
          {loadError}
        </p>
      ) : null}

      {csvLoading && !allRows.length ? (
        <div className="flex items-center gap-2 text-sm text-pe-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading funds…
        </div>
      ) : null}

      {allRows.length ? (
        <ScreenerFilters
          query={query}
          onQueryChange={setQuery}
          categoryOptions={categoryOptions}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          sectorOptions={sectorOptions}
          activeSector={activeSector}
          onSectorChange={setActiveSector}
          resultCount={sorted.length}
        />
      ) : null}

      <section className="mf-screener-table-wrap mt-4 overflow-hidden rounded-xl border border-pe-border bg-pe-canvas shadow-sm">
        <div className="mf-screener-table-meta flex flex-wrap items-baseline gap-2 border-b border-pe-border px-3.5 py-2.5">
          <span className="text-sm font-bold text-pe-text">{sorted.length} Funds</span>
          <span className="text-sm font-bold text-pe-accent">{activeFilterLabel}</span>
          {snapshotDate ? (
            <span className="ml-auto text-xs text-pe-text-muted">
              Data as of {formatSnapshotDate(snapshotDate)}
            </span>
          ) : null}
        </div>

        <div className="mf-screener-table-scroll overflow-x-auto">
          <table className="mf-screener-table mf-screener-table-unified">
            <thead>
              <tr>
                <th rowSpan={2} className="mf-screener-sticky-col mf-screener-th-fund">
                  <button type="button" className="mf-screener-th-btn" onClick={() => toggleSort('name')}>
                    AMC{sortIndicator('name')}
                  </button>
                </th>
                {SCREENER_TABLE_GROUPS.map((group) => (
                  <th key={group.label} colSpan={group.columns.length} className="mf-screener-th-group">
                    {group.label}
                  </th>
                ))}
              </tr>
              <tr>
                {SCREENER_TABLE_GROUPS.flatMap((group) =>
                  group.columns.map((col) => (
                    <th key={screenerColumnKey(col)} className="mf-screener-th-sub">
                      <button
                        type="button"
                        className="mf-screener-th-btn"
                        onClick={() => toggleSort(col.sortKey)}
                      >
                        {col.label}
                        {sortIndicator(col.sortKey)}
                      </button>
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const scheme = metrics[row.amfiCode];
                return (
                  <tr key={row.amfiCode} className="mf-screener-row">
                    <td className="mf-screener-fund-cell mf-screener-sticky-col">
                      <button
                        type="button"
                        className="mf-screener-amc-btn"
                        onClick={() => setSelectedCode(row.amfiCode)}
                      >
                        {row.amcLabel}
                      </button>
                      {row.sectorTheme && activeSector === 'all-themes' ? (
                        <p className="mt-0.5 text-[11px] font-medium text-pe-text-muted">
                          {row.sectorTheme}
                        </p>
                      ) : null}
                    </td>
                    {ALL_SCREENER_COLUMNS.map((col) => {
                      const value = cellNumeric(col, scheme);
                      const tone =
                        col.kind === 'rolling' || col.kind === 'cagr' ? returnTone(value) : '';
                      return (
                        <td key={screenerColumnKey(col)} className={tone}>
                          {dataLoading && value == null ? '…' : formatDisplayCell(col, value)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {!dataLoading && !sorted.length ? (
                <tr>
                  <td
                    colSpan={1 + ALL_SCREENER_COLUMNS.length}
                    className="py-10 text-center text-sm text-pe-text-muted"
                  >
                    No funds match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </MarketingShell>
  );
}
