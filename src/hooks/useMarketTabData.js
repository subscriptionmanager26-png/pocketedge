import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MARKET_MIN_SEARCH_CHARS,
  MARKET_PREVIEW_LIMIT,
  fetchMarketPreview,
  peekMarketPreview,
  searchMarketTab,
  subscribeMarketPreview,
} from '../lib/marketDataApi';
import { preloadAssetLogos } from '../lib/assetLogo';
import { markTabDataReady } from '../lib/perfMarks';
import { tabToAssetType } from '../lib/marketRefreshPolicy';
import { useMarketQuotePolling } from './useMarketQuoteRefresh';

function useDebouncedValue(value, delayMs = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function scheduleLogoPreload(items) {
  const run = () => preloadAssetLogos(items, { limit: MARKET_PREVIEW_LIMIT });
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 1200 });
  } else {
    queueMicrotask(run);
  }
}

export function useMarketTabData(tab, query = '') {
  const cachedPreview = peekMarketPreview(tab);
  const [previewItems, setPreviewItems] = useState(() => cachedPreview?.items ?? []);
  const [searchItems, setSearchItems] = useState([]);
  const [syncedAt, setSyncedAt] = useState(() => cachedPreview?.syncedAt ?? null);
  const [loading, setLoading] = useState(() => !cachedPreview?.items?.length);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const [searchError, setSearchError] = useState(null);

  const debouncedQuery = useDebouncedValue(query.trim());
  const assetType = tabToAssetType(tab);

  useEffect(() => {
    let cancelled = false;
    const cached = peekMarketPreview(tab);
    if (!cached?.items?.length) {
      setLoading(true);
    }
    setError(null);

    fetchMarketPreview(tab)
      .then((payload) => {
        if (cancelled) return;
        const items = payload.items ?? [];
        setPreviewItems(items);
        setSyncedAt(payload.syncedAt ?? null);
        markTabDataReady('markets', payload.source ?? 'network');
        scheduleLogoPreload(items);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load market data');
        if (!cached?.items?.length) setPreviewItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const unsubscribe = subscribeMarketPreview(tab, (payload) => {
      if (cancelled) return;
      setPreviewItems(payload.items ?? []);
      setSyncedAt(payload.syncedAt ?? null);
      scheduleLogoPreload(payload.items ?? []);
    });

    return () => {
      cancelled = true;
      unsubscribe();
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
        scheduleLogoPreload(items.slice(0, 30));
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
  const items = isSearching ? searchItems : previewItems;

  const refreshQuotes = useCallback(async () => {
    if (isSearching) {
      const { items: nextItems } = await searchMarketTab(tab, debouncedQuery);
      setSearchItems(nextItems);
      return;
    }
    const payload = await fetchMarketPreview(tab, { force: true });
    setPreviewItems(payload.items ?? []);
    setSyncedAt(payload.syncedAt ?? null);
  }, [tab, debouncedQuery, isSearching]);

  useMarketQuotePolling({
    assetType,
    enabled: Boolean(assetType) && !loading && !error,
    onRefresh: refreshQuotes,
    deps: [tab, debouncedQuery, isSearching, loading, error],
  });

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
