import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import SearchBasketCard from '../components/SearchBasketCard';
import { mergeDiscoverBaskets, searchBaskets } from '../basketCatalog';
import { navigateApp } from '../appRoute';
import AppPageLayout from '../components/AppPageLayout';

const filters = ['All', 'Thematic', 'Strategy', 'US', 'AI', 'EV'];

export default function SearchPage({ userBaskets, marketplaceBaskets = [] }) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const allBaskets = useMemo(
    () => mergeDiscoverBaskets(userBaskets, marketplaceBaskets),
    [userBaskets, marketplaceBaskets]
  );

  const results = useMemo(() => {
    let list = searchBaskets(query, allBaskets);
    if (activeFilter !== 'All') {
      list = list.filter(
        (b) =>
          b.type === activeFilter ||
          b.tags?.includes(activeFilter) ||
          (activeFilter === 'US' && b.tags?.includes('US'))
      );
    }
    return list;
  }, [query, activeFilter, allBaskets]);

  return (
    <AppPageLayout>
      <PageHeader title="Discover baskets" align="left" className="!mb-0" />

      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-pe-text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, theme, or stock..."
          className="pe-input pl-10 py-2.5 sm:py-3 text-sm sm:text-base"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActiveFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors ${
              activeFilter === f ? 'pe-pill-active' : 'pe-pill-inactive'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <p className="pe-body-s text-pe-text-muted">
        {results.length} basket{results.length === 1 ? '' : 's'}
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-3 sm:gap-3 sm:items-stretch">
        {results.map((basket) => (
          <SearchBasketCard
            key={basket.id}
            basket={basket}
            onClick={() => navigateApp({ tab: 'basket', basketId: basket.id })}
          />
        ))}
        {results.length === 0 && (
          <div className="col-span-full py-10 pe-body-s text-pe-text-muted px-3 sm:px-0">
            No baskets match your search
          </div>
        )}
      </div>
    </AppPageLayout>
  );
}
