import { useEffect, useMemo, useState } from 'react';
import {
  MARKET_MIN_SEARCH_CHARS,
  MARKET_PREVIEW_LIMIT,
  fetchMarketPreview,
  searchMarketTab,
} from '../lib/marketDataApi';

function useDebouncedValue(value, delayMs = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export function useMarketTabData(tab, query = '') {
  const [previewItems, setPreviewItems] = useState([]);
  const [searchItems, setSearchItems] = useState([]);
  const [syncedAt, setSyncedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const debouncedQuery = useDebouncedValue(query.trim());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchMarketPreview(tab)
      .then((payload) => {
        if (cancelled) return;
        setPreviewItems(payload.items ?? []);
        setSyncedAt(payload.syncedAt ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load market data');
        setPreviewItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (debouncedQuery.length < MARKET_MIN_SEARCH_CHARS) {
      setSearchItems([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);

    searchMarketTab(tab, debouncedQuery)
      .then(({ items }) => {
        if (cancelled) return;
        setSearchItems(items);
      })
      .catch(() => {
        if (cancelled) return;
        setSearchItems([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, debouncedQuery]);

  const isSearching = debouncedQuery.length >= MARKET_MIN_SEARCH_CHARS;
  const items = isSearching ? searchItems : previewItems;

  const statusMessage = useMemo(() => {
    if (loading) return null;
    if (isSearching) {
      if (searching) return 'Searching…';
      if (!searchItems.length) return 'No matches found';
      return `Showing ${searchItems.length} result${searchItems.length === 1 ? '' : 's'}`;
    }
    return `Top ${Math.min(previewItems.length, MARKET_PREVIEW_LIMIT)} movers · search for more`;
  }, [loading, isSearching, searching, searchItems.length, previewItems.length]);

  return {
    items,
    syncedAt,
    loading,
    searching,
    error,
    isSearching,
    statusMessage,
  };
}
