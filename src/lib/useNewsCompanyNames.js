import { useEffect, useMemo, useState } from 'react';
import { lookupMarketAssetsBatch, findCachedMarketItem } from '../lib/marketDataApi';
import { isNewsSocialPost, parseNewsSocialContent } from '../lib/newsPostBody';

function readCachedName(symbol) {
  const key = String(symbol ?? '').trim();
  if (!key) return null;
  return (
    findCachedMarketItem('stocks', key)?.name ||
    findCachedMarketItem('etf', key)?.name ||
    null
  );
}

/**
 * Resolve company display names for news posts (batch market-asset lookup).
 * Returns a Map of UPPERCASE symbol → company name.
 */
export function useNewsCompanyNames(posts = []) {
  const symbols = useMemo(() => {
    const keys = new Set();
    for (const post of posts ?? []) {
      if (!isNewsSocialPost(post)) continue;
      const { symbol } = parseNewsSocialContent(post);
      if (symbol) keys.add(symbol.toUpperCase());
    }
    return [...keys].sort();
  }, [posts]);

  const symbolKey = symbols.join('|');

  const [names, setNames] = useState(() => {
    const initial = new Map();
    for (const symbol of symbols) {
      const cached = readCachedName(symbol);
      if (cached) initial.set(symbol, cached);
    }
    return initial;
  });

  useEffect(() => {
    if (!symbols.length) return undefined;
    let cancelled = false;

    const seed = new Map();
    for (const symbol of symbols) {
      const cached = readCachedName(symbol);
      if (cached) seed.set(symbol, cached);
    }
    if (seed.size) setNames((prev) => (prev.size ? new Map([...prev, ...seed]) : seed));

    lookupMarketAssetsBatch(symbols)
      .then((map) => {
        if (cancelled) return;
        setNames((prev) => {
          const next = new Map(prev);
          for (const [key, item] of map.entries()) {
            const symbol = String(key ?? '').trim().toUpperCase();
            const name = item?.name;
            if (symbol && name) next.set(symbol, name);
            const alias = String(item?.symbol ?? '')
              .trim()
              .toUpperCase();
            if (alias && name) next.set(alias, name);
          }
          return next;
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [symbolKey]); // eslint-disable-line react-hooks/exhaustive-deps -- symbols derived from key

  return names;
}
