import { useEffect, useMemo, useState } from 'react';
import { resolvePeople } from './socialIdentity';
import { hydrateAuthorPositions } from './authorPositionsStore';
import { extractTickers } from './tickers';

/**
 * Hydrate author profiles + holding disclosure for a list of posts/comments,
 * then bump a tick so sync readers (getPersonSync / getPosition) re-render.
 */
export function usePostEnrichment(posts = [], { commentAuthors = true } = {}) {
  const [tick, setTick] = useState(0);

  const authorKey = useMemo(() => {
    const ids = new Set();
    for (const post of posts ?? []) {
      if (post?.authorId) ids.add(post.authorId);
      if (commentAuthors) {
        for (const comment of post?.comments ?? []) {
          if (comment?.authorId) ids.add(comment.authorId);
        }
      }
    }
    return [...ids].sort().join(',');
  }, [posts, commentAuthors]);

  const positionKey = useMemo(() => {
    const pairs = [];
    for (const post of posts ?? []) {
      if (!post?.authorId) continue;
      const tickers = extractTickers(post.body);
      if (post.trade?.ticker) tickers.push(post.trade.ticker);
      for (const ticker of post.portfolioShare?.tickers ?? []) tickers.push(ticker);
      if (tickers.length) pairs.push(`${post.authorId}:${tickers.join('|')}`);
      else pairs.push(post.authorId);
    }
    return pairs.sort().join(',');
  }, [posts]);

  useEffect(() => {
    if (!authorKey && !positionKey) return undefined;
    let cancelled = false;
    const authorIds = authorKey ? authorKey.split(',') : [];

    Promise.all([
      authorIds.length ? resolvePeople(authorIds) : Promise.resolve(),
      authorIds.length ? hydrateAuthorPositions(authorIds) : Promise.resolve(),
    ]).then(() => {
      if (!cancelled) setTick((value) => value + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [authorKey, positionKey]);

  return tick;
}
