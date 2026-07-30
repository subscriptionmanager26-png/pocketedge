import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Search } from 'lucide-react';
import MarketingShell from '../../components/MarketingShell';
import {
  loadCompanyBriefIndex,
  listCuratedCompanyBriefs,
  searchCompanyBriefIndex,
} from '../../data/companyBriefs';
import { businessModelBriefPath, stockPath } from '../../lib/routes';
import { resolveAssetLogoUrl, LOGO_VARIANT_LIST } from '../../lib/assetLogo';
import { useSeoMeta } from '../../hooks/useSeoMeta';

/**
 * Business Model hub — Screener-backed company briefs + search.
 */
export default function BusinessModelPage() {
  useSeoMeta({
    title: 'Business Model',
    description:
      'Plain-language company briefs for listed Indian stocks — industry, products, and how the business works.',
    path: '/business-model',
  });
  const [query, setQuery] = useState('');
  const [indexItems, setIndexItems] = useState([]);
  const [indexCount, setIndexCount] = useState(0);
  const [indexError, setIndexError] = useState('');
  const curated = useMemo(() => listCuratedCompanyBriefs(), []);

  useEffect(() => {
    let cancelled = false;
    loadCompanyBriefIndex()
      .then((payload) => {
        if (cancelled) return;
        setIndexItems(payload.items ?? []);
        setIndexCount(payload.count ?? payload.items?.length ?? 0);
      })
      .catch(() => {
        if (!cancelled) setIndexError('Could not load the company brief library.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hits = useMemo(() => searchCompanyBriefIndex(indexItems, query, 12), [indexItems, query]);

  const emptyHint = useMemo(() => {
    if (indexError) return indexError;
    if (query.trim().length >= 1) return 'No matching company briefs. Try another ticker or name.';
    return `Search ${indexCount ? `${indexCount.toLocaleString('en-IN')} ` : ''}listed companies for a plain-language business model brief.`;
  }, [indexError, query, indexCount]);

  return (
    <MarketingShell>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-pe-accent">Business Model</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-pe-text md:text-4xl">
          What does this company do?
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-pe-text-secondary">
          Plain-language company briefs — industry, what they sell, and how the business works — stock
          by stock.
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
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ticker or company name"
            className="w-full rounded-lg border border-pe-border bg-pe-canvas py-2.5 pl-10 pr-3 text-[15px] outline-none ring-pe-accent focus:ring-2"
          />
        </div>
      </label>

      {hits.length ? (
        <ul className="mb-8 overflow-hidden rounded-xl border border-pe-border">
          {hits.map((hit) => {
            const logo = resolveAssetLogoUrl({
              assetType: 'stock',
              assetKey: hit.symbol,
              variant: LOGO_VARIANT_LIST,
            });
            return (
              <li key={hit.symbol} className="border-b border-pe-border last:border-b-0">
                <Link
                  to={businessModelBriefPath(hit.symbol)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-pe-surface"
                >
                  {logo ? (
                    <img
                      src={logo}
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 shrink-0 rounded-md border border-pe-border bg-white object-contain p-0.5"
                    />
                  ) : (
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-pe-accent-wash text-pe-accent">
                      <BookOpen className="h-4 w-4" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-pe-text">{hit.symbol}</span>
                    <span className="block truncate text-xs text-pe-text-muted">
                      {hit.name}
                      {hit.industry ? ` · ${hit.industry}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-pe-accent">Brief</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-8 text-sm text-pe-text-muted">{emptyHint}</p>
      )}

      {curated.length ? (
        <section aria-labelledby="featured-briefs-heading" className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-pe-text-muted">Featured</p>
          <h2
            id="featured-briefs-heading"
            className="mt-1 text-lg font-bold tracking-tight text-pe-text"
          >
            Deep-dive briefs
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {curated.map((brief) => (
              <li key={brief.symbol}>
                <Link
                  to={businessModelBriefPath(brief.symbol)}
                  className="flex gap-3 rounded-xl border border-pe-border bg-pe-canvas p-4 transition hover:border-pe-accent/40 hover:shadow-sm"
                >
                  {brief.logoUrl ? (
                    <img
                      src={brief.logoUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 shrink-0 rounded-lg border border-pe-border bg-white object-contain p-1"
                    />
                  ) : null}
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-pe-text">{brief.name}</span>
                    <span className="mt-0.5 block text-xs text-pe-text-muted">{brief.symbol}</span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-pe-text-secondary">
                      {brief.kicker}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="library-heading">
        <p className="text-xs font-semibold uppercase tracking-wide text-pe-text-muted">Library</p>
        <h2 id="library-heading" className="mt-1 text-lg font-bold tracking-tight text-pe-text">
          {indexCount
            ? `${indexCount.toLocaleString('en-IN')} company briefs`
            : 'Company briefs'}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-pe-text-secondary">
          Built from Screener company profiles — search above to open any ticker.
        </p>
        <p className="mt-3 text-sm text-pe-text-muted">
          Prefer live quotes?{' '}
          <Link to={stockPath('RELIANCE')} className="font-semibold text-pe-accent hover:underline">
            Open Markets
          </Link>
        </p>
      </section>
    </MarketingShell>
  );
}
