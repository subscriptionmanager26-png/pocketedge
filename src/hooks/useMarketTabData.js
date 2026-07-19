import { useEffect, useMemo, useState } from 'react';
import { useNseIndexLiveItems } from './useNseIndexStream';
import {
  MARKET_MIN_SEARCH_CHARS,
  MARKET_PREVIEW_LIMIT,
  fetchMarketPreview,
  searchMarketTab,
} from '../lib/marketDataApi';
import { preloadAssetLogos } from '../lib/assetLogo';

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

  const [searchError, setSearchError] = useState(null);

  const debouncedQuery = useDebouncedValue(query.trim());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchMarketPreview(tab)
      .then((payload) => {
        if (cancelled) return;
        const items = payload.items ?? [];
        setPreviewItems(items);
        setSyncedAt(payload.syncedAt ?? null);
        preloadAssetLogos(items, { limit: MARKET_PREVIEW_LIMIT });
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
      setSearchError(null);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);
    setSearchError(null);

    searchMarketTab(tab, debouncedQuery)
      .then(({ items, total }) => {
        if (cancelled) return;
        setSearchItems(items);
        preloadAssetLogos(items, { limit: 30 });
        void total;
      })
      .catch((err) => {
        if (cancelled) return;
        setSearchItems([]);
        setSearchError(err.message || 'Search failed');
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, debouncedQuery]);

  const isSearching = debouncedQuery.length >= MARKET_MIN_SEARCH_CHARS;
  const baseItems = isSearching ? searchItems : previewItems;
  const [liveReady, setLiveReady] = useState(false);

  useEffect(() => {
    if (loading || error) {
      setLiveReady(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setLiveReady(true);
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loading, error, tab]);

  const streamIndices = tab === 'indices' && !loading && !error && liveReady;
  const items = useNseIndexLiveItems(baseItems, streamIndices);

  const statusMessage = useMemo(() => {
    if (loading) return null;
    if (isSearching) {
      if (searching) return 'Searching…';
      if (searchError) return searchError;
      if (!searchItems.length) return 'No matches found';
      return `Showing ${searchItems.length} result${searchItems.length === 1 ? '' : 's'}`;
    }
    return `Top ${Math.min(previewItems.length, MARKET_PREVIEW_LIMIT)} movers · search for more`;
  }, [loading, isSearching, searching, searchError, searchItems.length, previewItems.length]);

  return {
    items,
    syncedAt,
    loading,
    searching,
    error,
    searchError,
    isSearching,
    statusMessage,
  };
}
