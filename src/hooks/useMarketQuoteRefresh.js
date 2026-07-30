import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchMarketPreview,
  lookupMarketAssetsBatch,
  searchMarketTab,
} from '../lib/marketDataApi';
import {
  getMarketRefreshPolicy,
  getPollIntervalMs,
  getResolveFn,
  shouldPollMarket,
} from '../lib/marketRefreshPolicy';

/**
 * Unified Supabase quote refresh: initial load + visibility-aware polling.
 *
 * @param {object} options
 * @param {string} [options.assetType]
 * @param {string} [options.tab]
 * @param {string[]} [options.keys]
 * @param {'preview'|'lookup'|'search'} [options.mode]
 * @param {string} [options.query]
 * @param {() => Promise<*>} [options.fetchFn] — override default RPC fetch
 * @param {boolean} [options.enabled]
 */
export function useMarketQuoteRefresh({
  assetType: rawAssetType,
  tab = null,
  keys = [],
  mode = 'preview',
  query = '',
  fetchFn = null,
  enabled = true,
}) {
  const policy = getMarketRefreshPolicy({ tab, assetType: rawAssetType });
  const assetType = policy.assetType ?? rawAssetType;

  const [items, setItems] = useState([]);
  const [item, setItem] = useState(null);
  const [syncedAt, setSyncedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const hasDataRef = useRef(false);

  const runFetch = useCallback(async ({ force = false } = {}) => {
    if (fetchFn) return fetchFn();

    if (mode === 'preview') {
      if (!tab) throw new Error('tab required for preview mode');
      return fetchMarketPreview(tab, { force });
    }

    if (mode === 'search') {
      if (!tab) throw new Error('tab required for search mode');
      return searchMarketTab(tab, query);
    }

    if (mode === 'lookup') {
      if (keys.length > 1) {
        return lookupMarketAssetsBatch(keys, { force });
      }
      const key = keys[0];
      if (!key) return null;
      const resolve = getResolveFn(assetType);
      if (!resolve) throw new Error(`No resolve function for asset type: ${assetType}`);
      return resolve(key, { force });
    }

    return null;
  }, [fetchFn, mode, tab, query, keys, assetType]);

  const applyResult = useCallback(
    (result, { isRefresh = false } = {}) => {
      if (result == null) return;

      if (mode === 'preview') {
        setItems(result.items ?? []);
        setSyncedAt(result.syncedAt ?? null);
        hasDataRef.current = (result.items ?? []).length > 0 || result.syncedAt != null;
        return;
      }

      if (mode === 'search') {
        setItems(result.items ?? []);
        hasDataRef.current = (result.items ?? []).length > 0;
        return;
      }

      if (mode === 'lookup') {
        if (result instanceof Map) {
          const first = keys.map((key) => result.get(key)).find(Boolean) ?? null;
          setItem(first);
          hasDataRef.current = result.size > 0;
          if (first?.syncedAt) setSyncedAt(first.syncedAt);
          return;
        }
        setItem(result);
        hasDataRef.current = Boolean(result);
        if (result?.syncedAt) setSyncedAt(result.syncedAt);
      }
    },
    [mode, keys]
  );

  const load = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!enabled) return;

      if (isRefresh) setRefreshing(true);
      else if (!hasDataRef.current) setLoading(true);

      try {
        const result = await runFetch({ force: isRefresh });
        applyResult(result, { isRefresh });
        if (!isRefresh) setError(null);
      } catch (err) {
        if (!hasDataRef.current) {
          setError(err.message || 'Failed to load market data');
          if (mode === 'preview' || mode === 'search') setItems([]);
          if (mode === 'lookup') setItem(null);
        }
        // Keep last successful data on refresh failure.
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [enabled, runFetch, applyResult, mode]
  );

  // Initial load
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    hasDataRef.current = false;
    setLoading(true);
    setError(null);

    runFetch()
      .then((result) => {
        if (cancelled) return;
        applyResult(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load market data');
        if (mode === 'preview' || mode === 'search') setItems([]);
        if (mode === 'lookup') setItem(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, runFetch, applyResult, mode]);

  // Visibility-aware polling
  useEffect(() => {
    if (!enabled || loading || error) return undefined;

    const intervalMs = getPollIntervalMs(assetType);
    if (!intervalMs) return undefined;

    let cancelled = false;
    let timer = null;

    const tick = () => {
      if (cancelled || !shouldPollMarket(assetType)) return;
      load({ isRefresh: true });
    };

    const schedule = () => {
      if (timer) window.clearInterval(timer);
      if (!shouldPollMarket(assetType)) return;
      timer = window.setInterval(tick, intervalMs);
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (timer) {
          window.clearInterval(timer);
          timer = null;
        }
      } else {
        tick();
        schedule();
      }
    };

    schedule();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, loading, error, assetType, load]);

  return {
    items,
    item,
    syncedAt,
    loading,
    refreshing,
    error,
    refresh: () => load({ isRefresh: true }),
  };
}

/**
 * Visibility-aware polling for an existing refresh callback (list/search tabs).
 */
export function useMarketQuotePolling({
  assetType,
  enabled = true,
  onRefresh,
  deps = [],
}) {
  useEffect(() => {
    if (!enabled || !assetType || typeof onRefresh !== 'function') return undefined;

    const intervalMs = getPollIntervalMs(assetType);
    if (!intervalMs) return undefined;

    let cancelled = false;
    let timer = null;

    const tick = async () => {
      if (cancelled || !shouldPollMarket(assetType)) return;
      try {
        await onRefresh();
      } catch {
        // Keep existing values when a refresh call fails.
      }
    };

    const schedule = () => {
      if (timer) window.clearInterval(timer);
      if (!shouldPollMarket(assetType)) return;
      timer = window.setInterval(tick, intervalMs);
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (timer) {
          window.clearInterval(timer);
          timer = null;
        }
      } else {
        tick();
        schedule();
      }
    };

    schedule();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls extra deps
  }, [assetType, enabled, onRefresh, ...deps]);
}
