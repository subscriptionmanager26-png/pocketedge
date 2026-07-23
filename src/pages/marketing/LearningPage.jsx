import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Search } from 'lucide-react';
import MarketingShell from '../../components/MarketingShell';
import { stockPath } from '../../lib/routes';

/**
 * Learning hub — stock-wise business model explainers (content pipeline TBD).
 */
export default function LearningPage() {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState([]);

  const onSearch = async (value) => {
    setQuery(value);
    const q = value.trim().toUpperCase();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    try {
      const res = await fetch('/data/markets/stocks-search.json');
      if (!res.ok) return;
      const payload = await res.json();
      const next = [];
      for (const item of payload.items ?? []) {
        const symbol = String(item.symbol ?? item.id ?? '')
          .trim()
          .toUpperCase();
        const name = String(item.name ?? '');
        if (symbol.includes(q) || name.toUpperCase().includes(q)) {
          next.push({ symbol, name });
        }
        if (next.length >= 10) break;
      }
      setHits(next);
    } catch {
      setHits([]);
    }
  };

  const emptyHint = useMemo(
    () =>
      query.trim().length >= 2
        ? 'No matching stocks. Try another ticker or company name.'
        : 'Search any listed stock to open its page. Business-model explainers are being written and will appear here.',
    [query]
  );

  return (
    <MarketingShell>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-pe-accent">Learning</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-pe-text md:text-4xl">
          What does this stock do?
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-pe-text-secondary">
          Plain-language explainers on how a company makes money, its business model, and what to watch —
          stock by stock.
        </p>
      </div>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-pe-text-muted">
          Search a stock
        </span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pe-text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Ticker or company name"
            className="w-full rounded-lg border border-pe-border bg-pe-canvas py-2.5 pl-10 pr-3 text-[15px] outline-none ring-pe-accent focus:ring-2"
          />
        </div>
      </label>

      {hits.length ? (
        <ul className="mb-6 overflow-hidden rounded-xl border border-pe-border">
          {hits.map((hit) => (
            <li key={hit.symbol} className="border-b border-pe-border last:border-b-0">
              <Link
                to={stockPath(hit.symbol)}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-pe-surface"
              >
                <span>
                  <span className="block text-sm font-semibold text-pe-text">{hit.symbol}</span>
                  <span className="block text-xs text-pe-text-muted">{hit.name}</span>
                </span>
                <span className="text-xs font-semibold text-pe-accent">View</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-6 text-sm text-pe-text-muted">{emptyHint}</p>
      )}

      <div className="rounded-xl border border-dashed border-pe-border-strong bg-pe-surface px-5 py-8 text-center">
        <BookOpen className="mx-auto h-8 w-8 text-pe-accent" aria-hidden />
        <h2 className="mt-3 text-lg font-bold text-pe-text">Business model library</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-pe-text-secondary">
          We&apos;re building short, stock-wise primers (what they sell, how they earn, key risks). Check
          back soon — or open a stock from search above to explore market insights meanwhile.
        </p>
      </div>
    </MarketingShell>
  );
}
