import { useEffect, useMemo, useState } from 'react';
import PostCard from '../components/PostCard';
import { FeedSkeleton } from '../components/PageSkeletons';
import { isDevMockMode } from '../lib/appMode';
import { isNewsSocialPost, parseNewsSocialContent } from '../lib/newsPostBody';
import { rememberPerson } from '../lib/socialIdentity';
import {
  fetchNewsPosts,
  fetchPublicNewsPosts,
  usePostBackend,
} from '../lib/socialPostApi';
import { isSupabaseConfigured } from '../lib/supabase';
import { skipAuthForDev } from '../lib/sessionStore';
import { useNewsCompanyNames } from '../lib/useNewsCompanyNames';
import { usePostEnrichment } from '../lib/usePostEnrichment';

function seedMockNews() {
  return import('../data/feedDesignMock').then((mod) =>
    (mod.FEED_DESIGN_POSTS ?? [])
      .filter((p) => p.kind === 'news')
      .map((p) => {
        const symbol = String(p.tickers?.[0]?.symbol ?? '').toUpperCase() || null;
        rememberPerson({
          id: p.author?.id ?? 'pe_news',
          name: p.author?.name ?? 'PocketEdge News',
          handle: p.author?.handle ?? 'pocketedge_news',
          avatar: p.author?.avatar,
        });
        const title = p.title || '';
        const body = symbol
          ? `@${symbol} ${title}\n\n${p.body ?? ''}`.trim()
          : String(p.body ?? '');
        return {
          id: p.id,
          authorId: p.author?.id ?? 'pe_news',
          body,
          createdAt: p.createdAt,
          likes: p.likes ?? 0,
          liked: false,
          commentCount: 0,
          comments: [],
          via: {
            source: 'mn_news_ai_summaries',
            kind: 'person',
            ticker: symbol,
            type: 'Stock',
          },
          kind: 'news',
        };
      })
  );
}

/**
 * News tab — PocketEdge AI market summaries without poster identity.
 * Hierarchy: Company Name → Title → Text → logo image. Like + share only.
 */
export default function NewsPage({
  posts: postsFromParent,
  guestMode = false,
  onOpenPost,
  onOpenStock,
  onToggleLike,
}) {
  const [fetchedPosts, setFetchedPosts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const useLive =
      guestMode
        ? isSupabaseConfigured() && !skipAuthForDev()
        : usePostBackend();

    const load = !useLive
      ? isDevMockMode()
        ? seedMockNews()
        : Promise.resolve([])
      : guestMode
        ? fetchPublicNewsPosts()
        : fetchNewsPosts();

    load
      .then((next) => {
        if (!cancelled) setFetchedPosts(Array.isArray(next) ? next : []);
      })
      .catch((err) => {
        console.error('NewsPage load failed', err);
        if (!cancelled) setFetchedPosts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [guestMode]);

  const posts = useMemo(() => {
    const base = fetchedPosts ?? [];
    const parentById = new Map(
      (postsFromParent ?? []).map((p) => [p.id, p])
    );
    return base
      .map((p) => {
        const overlay = parentById.get(p.id);
        if (!overlay) return p;
        return {
          ...p,
          liked: overlay.liked ?? p.liked,
          likes: overlay.likes ?? p.likes,
        };
      })
      .filter(isNewsSocialPost);
  }, [fetchedPosts, postsFromParent]);

  const companyNames = useNewsCompanyNames(posts);
  const enrichmentTick = usePostEnrichment(posts);
  const showSkeleton = loading && !posts.length;

  if (showSkeleton) {
    return (
      <div className="pt-2">
        <FeedSkeleton count={4} />
      </div>
    );
  }

  if (!posts.length) {
    return (
      <p className="px-4 py-16 text-center text-sm text-pe-text-secondary md:px-6">
        {guestMode ? 'No news yet. Check back soon.' : 'No news posts yet.'}
      </p>
    );
  }

  return (
    <div className="pt-2 pb-8">
      {posts.map((post) => {
        const { symbol } = parseNewsSocialContent(post);
        const companyName = symbol
          ? companyNames.get(symbol.toUpperCase()) || symbol
          : null;
        return (
          <PostCard
            key={post.id}
            post={post}
            variant="news"
            companyName={companyName}
            enrichmentTick={enrichmentTick}
            onOpenPost={onOpenPost}
            onOpenStock={onOpenStock}
            onToggleLike={onToggleLike}
          />
        );
      })}
    </div>
  );
}
