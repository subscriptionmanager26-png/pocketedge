import { useEffect, useState } from 'react';
import PageHeader, { PageHeaderSearch } from '../components/PageHeader';
import PortfolioCard from '../components/PortfolioCard';
import { PortfoliosListSkeleton } from '../components/PortfolioSkeletons';
import { rememberPerson } from '../lib/socialIdentity';
import { fetchDiscoverPortfolios } from '../lib/socialPortfolioApi';
import { getPortfolioEngagementSync } from '../lib/portfolioEngagementApi';

function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function IdeasPage({ onOpenPortfolio, onOpenProfile }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const debouncedQuery = useDebouncedValue(query.trim());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchDiscoverPortfolios({ query: debouncedQuery, limit: 20 })
      .then((next) => {
        if (cancelled) return;
        for (const row of next) {
          if (row.owner) {
            rememberPerson({
              id: row.owner.id,
              name: row.owner.name,
              handle: row.owner.handle,
              avatarUrl: row.owner.avatarUrl,
              bio: row.owner.bio,
            });
          }
        }
        setRows(next);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Could not load ideas');
        setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  return (
    <div>
      <PageHeader>
        <PageHeaderSearch
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search portfolios, people…"
          autoFocus
        />
      </PageHeader>

      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold tracking-tight text-pe-text">Ideas</h1>
        <p className="mt-1 text-sm text-pe-text-secondary">
          Public portfolios from investors on PocketEdge.
        </p>
      </div>

      {loading ? (
        <PortfoliosListSkeleton count={3} />
      ) : error ? (
        <p className="px-4 py-14 text-center text-sm text-pe-negative">{error}</p>
      ) : !rows.length ? (
        <p className="px-4 py-14 text-center text-sm text-pe-text-secondary">
          {debouncedQuery ? 'No matching portfolios.' : 'No public portfolios yet.'}
        </p>
      ) : (
        <div>
          {rows.map(({ portfolio, owner }) => (
            <div key={portfolio.id} className="border-b border-pe-border">
              <button
                type="button"
                onClick={() => onOpenProfile?.(owner.id)}
                className="flex w-full items-center gap-2 px-4 pt-4 text-left"
              >
                <span className="truncate text-[15px] font-semibold text-pe-text">
                  {owner.name}
                </span>
                <span className="truncate text-sm text-pe-text-muted">@{owner.handle}</span>
              </button>
              <PortfolioCard
                portfolio={portfolio}
                social={getPortfolioEngagementSync(portfolio.id)}
                canCopy
                sourceOwnerId={owner.id}
                sourceOwnerName={owner.name}
                onOpen={() => onOpenPortfolio?.(owner.id, portfolio.id)}
                onDiscuss={() => onOpenPortfolio?.(owner.id, portfolio.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
