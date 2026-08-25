import { useEffect, useMemo, useState } from 'react';
import { lookupMarketAssetsBatch, findCachedMarketItem } from '../lib/marketDataApi';
import { isNewsSocialPost, parseNewsSocialContent } from '../lib/newsPostBody';

function readCachedAsset(symbol) {
  const key = String(symbol ?? '').trim();
  if (!key) return null;
  return (
    findCachedMarketItem('stocks', key) ||
    findCachedMarketItem('etf', key) ||
    findCachedMarketItem('mutual_funds', key) ||
    null
  );
}

function readCachedName(symbol) {
  return readCachedAsset(symbol)?.name || null;
}

function indexMarketAssets(map, extraKeys = []) {
  const next = new Map();
  const put = (rawKey, item) => {
    if (!item) return;
    const key = String(rawKey ?? '').trim().toUpperCase();
    if (key) next.set(key, item);
  };
  for (const [key, item] of map.entries()) {
    put(key, item);
    put(item?.symbol, item);
    put(item?.schemeCode, item);
    put(item?.id, item);
  }
  for (const key of extraKeys) {
    const cached = readCachedAsset(key);
    if (cached && !next.has(String(key).toUpperCase())) put(key, cached);
  }
  return next;
}

/**
 * Batch market-asset lookup for news symbols (and optional extra keys such as holdings).
 * Returns a Map of UPPERCASE symbol → market item.
 */
export function useNewsMarketAssets(posts = [], extraKeys = []) {
  const extraKey = (extraKeys ?? [])
    .map((key) => String(key ?? '').trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join('|');

  const symbols = useMemo(() => {
    const keys = new Set(extraKey ? extraKey.split('|') : []);
    for (const post of posts ?? []) {
      if (!isNewsSocialPost(post)) continue;
      const { symbol } = parseNewsSocialContent(post);
      if (symbol) keys.add(symbol.toUpperCase());
    }
    return [...keys].sort();
  }, [posts, extraKey]);

  const symbolKey = symbols.join('|');

  const [assets, setAssets] = useState(() => {
    const initial = new Map();
    for (const symbol of symbols) {
      const cached = readCachedAsset(symbol);
      if (cached) initial.set(symbol, cached);
    }
    return initial;
  });

  useEffect(() => {
    if (!symbols.length) {
      setAssets(new Map());
      return undefined;
    }
    let cancelled = false;

    const seed = new Map();
    for (const symbol of symbols) {
      const cached = readCachedAsset(symbol);
      if (cached) seed.set(symbol, cached);
    }
    if (seed.size) {
      setAssets((prev) => indexMarketAssets(new Map([...prev, ...seed]), symbols));
    }

    lookupMarketAssetsBatch(symbols)
      .then((map) => {
        if (cancelled) return;
        setAssets((prev) => indexMarketAssets(new Map([...prev, ...map]), symbols));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [symbolKey]); // eslint-disable-line react-hooks/exhaustive-deps -- symbols derived from key

  return assets;
}

/**
 * Resolve company display names for news posts (batch market-asset lookup).
 * Returns a Map of UPPERCASE symbol → company name.
 */
export function useNewsCompanyNames(posts = []) {
  const assets = useNewsMarketAssets(posts);
  return useMemo(() => {
    const names = new Map();
    for (const [key, item] of assets.entries()) {
      const name = item?.name;
      if (key && name) names.set(key, name);
    }
    for (const post of posts ?? []) {
      if (!isNewsSocialPost(post)) continue;
      const { symbol } = parseNewsSocialContent(post);
      if (!symbol) continue;
      const cached = readCachedName(symbol);
      if (cached && !names.has(symbol.toUpperCase())) names.set(symbol.toUpperCase(), cached);
    }
    return names;
  }, [assets, posts]);
}
