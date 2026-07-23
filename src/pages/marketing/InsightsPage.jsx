import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search } from 'lucide-react';
import MarketingShell from '../../components/MarketingShell';
import NewsList from '../../components/NewsList';
import UnderlineTabs from '../../components/UnderlineTabs';
import { formatPct } from '../../lib/format';
import { stockPath } from '../../lib/routes';
import {
  fetchExplanationFeed,
  fetchLatestExplanationDate,
  fetchStockExplanations,
  isStockNewsConfigured,
} from '../../lib/stockNewsApi';

const SCOPE_TABS = [
  { id: 'stock', label: 'Stocks' },
  { id: 'index', label: 'Sectors' },
  { id: 'commodity', label: 'Commodities' },
  { id: 'economics', label: 'Country' },
];

const MOVEMENT_OPTIONS = [
  { id: 'all', label: 'All moves' },
  { id: 'up', label: 'Gainers (≥ +1%)' },
  { id: 'down', label: 'Losers (≤ −1%)' },
  { id: 'big', label: 'Big movers (|%| ≥ 3%)' },
];

const DATE_PRESETS = [
  { id: 'latest', label: 'Latest available' },
  { id: 'pick', label: 'Pick a date' },
];

const SCOPE_COPY = {
  stock: {
    title: 'Stock-wise insights',
    body: 'Daily explanation summaries for equities — search a ticker or browse by move and date.',
  },
  index: {
    title: 'Sector-wise insights',
    body: 'Index and sector-move explainers (Nifty sector indices and similar).',
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

function matchesMovement(changePct, movement) {
  if (movement === 'all') return true;
  if (!Number.isFinite(changePct)) return movement === 'all';
  if (movement === 'up') return changePct >= 1;
  if (movement === 'down') return changePct <= -1;
  if (movement === 'big') return Math.abs(changePct) >= 3;
  return true;
}

function pnlClass(n) {
  if (!Number.isFinite(n) || n === 0) return 'text-pe-text';
  return n > 0 ? 'text-pe-positive' : 'text-pe-negative';
}

export default function InsightsPage() {
  const configured = isStockNewsConfigured();
  const [scope, setScope] = useState('stock');
  const [movement, setMovement] = useState('all');
  const [dateMode, setDateMode] = useState('latest');
  const [pickedDate, setPickedDate] = useState('');
  const [latestDate, setLatestDate] = useState(null);
  const [query, setQuery] = useState('');
  const [selectedTicker, setSelectedTicker] = useState('');
  const [marketBySymbol, setMarketBySymbol] = useState(() => new Map());
  const [feed, setFeed] = useState([]);
  const [tickerExplanations, setTickerExplanations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const copy = SCOPE_COPY[scope] ?? SCOPE_COPY.stock;
  const asOfDate = dateMode === 'pick' && pickedDate ? pickedDate : latestDate;

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
    setLatestDate(null);
    setPickedDate('');
    setDateMode('latest');
    setSelectedTicker('');
    setQuery('');

    if (!configured) return undefined;

    (async () => {
      const date = await fetchLatestExplanationDate(scope);
      if (!cancelled) setLatestDate(date);
    })();

    return () => {
      cancelled = true;
    };
  }, [scope, configured]);

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
        if (selectedTicker && scope === 'stock') {
          const rows = await fetchStockExplanations(selectedTicker, { limit: 60 });
          if (cancelled) return;
          setTickerExplanations(rows);
          setFeed([]);
        } else {
          const rows = await fetchExplanationFeed({
            assetType: scope,
            asOfDate: asOfDate || null,
            limit: 100,
          });
          if (cancelled) return;
          setFeed(rows);
          setTickerExplanations([]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Could not load insights.');
          setFeed([]);
          setTickerExplanations([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [configured, scope, asOfDate, selectedTicker]);

  const searchHits = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (q.length < 1 || scope !== 'stock') return [];
    const hits = [];
    for (const [symbol, meta] of marketBySymbol) {
      if (symbol.includes(q) || String(meta.name).toUpperCase().includes(q)) {
        hits.push({ symbol, ...meta });
      }
      if (hits.length >= 8) break;
    }
    return hits;
  }, [query, marketBySymbol, scope]);

  const filteredFeed = useMemo(() => {
    const q = query.trim().toUpperCase();
    return feed
      .map((row) => {
        const meta = marketBySymbol.get(row.ticker);
        const changePct = Number(meta?.changePct);
        return {
          ...row,
          name: meta?.name || row.ticker,
          changePct: Number.isFinite(changePct) ? changePct : null,
        };
      })
      .filter((row) => {
        if (scope === 'stock' && !matchesMovement(row.changePct, movement)) return false;
        if (!q) return true;
        return (
          row.ticker.includes(q) ||
          String(row.name).toUpperCase().includes(q) ||
          String(row.title).toUpperCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (scope === 'stock' && movement !== 'all') {
          return Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0);
        }
        return String(b.asOfDate).localeCompare(String(a.asOfDate));
      });
  }, [feed, marketBySymbol, movement, query, scope]);

  const selectTicker = (symbol) => {
    setSelectedTicker(symbol);
    setQuery(symbol);
  };

  const clearTicker = () => {
    setSelectedTicker('');
    setQuery('');
  };

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
          <div className="mb-4 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-pe-text-muted">
                Search
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pe-text-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    if (selectedTicker) setSelectedTicker('');
                  }}
                  placeholder={scope === 'stock' ? 'Ticker or company name' : 'Filter by name'}
                  className="w-full rounded-lg border border-pe-border bg-pe-canvas py-2.5 pl-10 pr-3 text-[15px] text-pe-text outline-none ring-pe-accent focus:ring-2"
                />
              </div>
              {searchHits.length && !selectedTicker ? (
                <ul className="mt-1 overflow-hidden rounded-lg border border-pe-border bg-pe-canvas shadow-sm">
                  {searchHits.map((hit) => (
                    <li key={hit.symbol}>
                      <button
                        type="button"
                        onClick={() => selectTicker(hit.symbol)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-pe-surface"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-pe-text">{hit.symbol}</span>
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
            </label>

            {scope === 'stock' ? (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-pe-text-muted">
                  % movement
                </span>
                <select
                  value={movement}
                  onChange={(event) => setMovement(event.target.value)}
                  className="w-full rounded-lg border border-pe-border bg-pe-canvas px-3 py-2.5 text-[15px] text-pe-text outline-none ring-pe-accent focus:ring-2"
                >
                  {MOVEMENT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div />
            )}

            <div className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-pe-text-muted">
                Explanation date
              </span>
              <div className="flex flex-col gap-2">
                <select
                  value={dateMode}
                  onChange={(event) => setDateMode(event.target.value)}
                  disabled={Boolean(selectedTicker)}
                  className="w-full rounded-lg border border-pe-border bg-pe-canvas px-3 py-2.5 text-[15px] text-pe-text outline-none ring-pe-accent focus:ring-2 disabled:opacity-60"
                >
                  {DATE_PRESETS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                      {opt.id === 'latest' && latestDate ? ` (${latestDate})` : ''}
                    </option>
                  ))}
                </select>
                {dateMode === 'pick' ? (
                  <input
                    type="date"
                    value={pickedDate}
                    onChange={(event) => setPickedDate(event.target.value)}
                    className="w-full rounded-lg border border-pe-border bg-pe-canvas px-3 py-2 text-[15px] outline-none ring-pe-accent focus:ring-2"
                  />
                ) : null}
              </div>
            </div>
          </div>

          <p className="mb-4 text-xs text-pe-text-muted">
            Sector tags on individual stocks are coming soon — use the <strong>Sectors</strong> tab for
            index-level sector moves.
          </p>

          {selectedTicker ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pe-border bg-pe-surface px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-pe-text">{selectedTicker}</p>
                <p className="text-xs text-pe-text-muted">
                  {marketBySymbol.get(selectedTicker)?.name || 'Showing all available explanations'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={stockPath(selectedTicker)}
                  className="rounded-md border border-pe-border-strong px-3 py-1.5 text-sm font-semibold text-pe-text hover:bg-pe-canvas"
                >
                  Open stock
                </Link>
                <button
                  type="button"
                  onClick={clearTicker}
                  className="rounded-md px-3 py-1.5 text-sm font-semibold text-pe-accent hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className="mb-4 text-sm text-pe-negative">{error}</p> : null}

          {loading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-pe-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading insights…
            </div>
          ) : selectedTicker ? (
            tickerExplanations.length ? (
              <div className="overflow-hidden rounded-xl border border-pe-border bg-pe-canvas">
                <NewsList items={tickerExplanations} />
              </div>
            ) : (
              <p className="py-10 text-sm text-pe-text-muted">No explanations found for {selectedTicker}.</p>
            )
          ) : filteredFeed.length ? (
            <div className="overflow-hidden rounded-xl border border-pe-border bg-pe-canvas">
              <div className="divide-y divide-pe-border">
                {filteredFeed.map((row) => (
                  <div key={row.id} className="px-4 py-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
                      <div className="min-w-0">
                        {scope === 'stock' ? (
                          <button
                            type="button"
                            onClick={() => selectTicker(row.ticker)}
                            className="text-left text-[15px] font-bold text-pe-text hover:text-pe-accent"
                          >
                            {row.ticker}
                          </button>
                        ) : (
                          <p className="text-[15px] font-bold text-pe-text">{row.ticker}</p>
                        )}
                        <p className="truncate text-xs text-pe-text-muted">{row.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {Number.isFinite(row.changePct) ? (
                          <span className={`text-sm font-semibold tabular-nums ${pnlClass(row.changePct)}`}>
                            {formatPct(row.changePct)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <NewsList
                      items={[
                        {
                          id: row.id,
                          title: row.title,
                          summary: row.summary,
                          publishedAt: row.publishedAt,
                        },
                      ]}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-10 text-sm text-pe-text-muted">
              No insights match these filters{asOfDate ? ` for ${asOfDate}` : ''}.
            </p>
          )}
        </>
      )}
    </MarketingShell>
  );
}
