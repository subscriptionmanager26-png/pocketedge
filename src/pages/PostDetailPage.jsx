import { useEffect, useMemo, useState } from 'react';
import PostCard from '../components/PostCard';
import CommentComposer from '../components/CommentComposer';
import { PostDetailSkeleton } from '../components/PageSkeletons';
import { isDevMockMode } from '../lib/appMode';
import { isNewsSocialPost, parseNewsSocialContent } from '../lib/newsPostBody';
import {
  absoluteNewsPostUrl,
  buildNewsShareTitle,
  truncatePreview,
} from '../lib/shareNewsPost';
import { resolveAssetLogoUrl, LOGO_VARIANT_DETAIL } from '../lib/assetLogo';
import { setSeoMeta, SITE_ORIGIN, DEFAULT_IMAGE } from '../lib/seoMeta';
import { useNewsCompanyNames } from '../lib/useNewsCompanyNames';
import { usePostEnrichment } from '../lib/usePostEnrichment';

export default function PostDetailPage({
  postId,
  posts,
  onBack,
  onOpenProfile,
  onOpenStock,
  onAddComment,
  onToggleLike,
  fetchPost,
}) {
  const [detailPost, setDetailPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mockFallback, setMockFallback] = useState(null);
  const cached = (posts ?? []).find((p) => p.id === postId) ?? mockFallback;

  useEffect(() => {
    if (!isDevMockMode() || cached || !postId) return undefined;
    let cancelled = false;
    import('../data/mockData')
      .then((mod) => {
        if (cancelled) return;
        setMockFallback(mod.POSTS.find((p) => p.id === postId) ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [postId, cached]);

  useEffect(() => {
    if (!postId) {
      setDetailPost(null);
      setLoading(false);
      return undefined;
    }

    if (fetchPost) {
      let cancelled = false;
      setLoading(!cached);
      setDetailPost(cached ?? null);
      fetchPost(postId)
        .then((row) => {
          if (!cancelled) setDetailPost(row);
        })
        .catch(() => {
          if (!cancelled && cached) setDetailPost(cached);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    setDetailPost(cached ?? null);
    setLoading(false);
    return undefined;
  }, [postId, cached, fetchPost]);

  const post = useMemo(() => {
    const base = detailPost ?? cached;
    if (!base) return null;
    // Prefer the richer comments list from either source (App cache updates on comment).
    const detailComments = detailPost?.comments ?? [];
    const cachedComments = cached?.comments ?? [];
    const comments =
      cachedComments.length > detailComments.length ? cachedComments : detailComments;
    const commentCount = Math.max(
      comments.length,
      Number(base.commentCount) || 0,
      Number(cached?.commentCount) || 0,
      Number(detailPost?.commentCount) || 0
    );
    return { ...base, comments, commentCount };
  }, [detailPost, cached]);
  const enrichmentPosts = useMemo(() => (post ? [post] : []), [post]);
  const enrichmentTick = usePostEnrichment(enrichmentPosts);
  const companyNames = useNewsCompanyNames(enrichmentPosts);
  const newsCompanyName = useMemo(() => {
    if (!post || !isNewsSocialPost(post)) return null;
    const { symbol } = parseNewsSocialContent(post);
    if (!symbol) return null;
    return companyNames.get(symbol.toUpperCase()) || symbol;
  }, [post, companyNames]);

  useEffect(() => {
    if (!post || !isNewsSocialPost(post)) return undefined;
    const parts = parseNewsSocialContent(post);
    const companyName = newsCompanyName || parts.symbol || 'PocketEdge News';
    const title = buildNewsShareTitle({
      companyName,
      symbol: parts.symbol,
      title: parts.title,
    });
    const description =
      truncatePreview(parts.text || parts.title, 180) ||
      'Market news on PocketEdge';
    const logoPath = parts.symbol
      ? resolveAssetLogoUrl({
          assetType: parts.assetType,
          assetKey: parts.symbol,
          variant: LOGO_VARIANT_DETAIL,
        })
      : null;
    const image = post.image
      ? post.image.startsWith('http')
        ? post.image
        : `${SITE_ORIGIN}${post.image}`
      : logoPath
        ? logoPath.startsWith('http')
          ? logoPath
          : `${SITE_ORIGIN}${logoPath}`
        : DEFAULT_IMAGE;

    const abs = absoluteNewsPostUrl(post.id);
    const path = abs.startsWith(SITE_ORIGIN)
      ? abs.slice(SITE_ORIGIN.length) || `/post/${post.id}`
      : `/post/${post.id}`;

    return setSeoMeta({
      title,
      description,
      path,
      image,
    });
  }, [post, newsCompanyName]);

  if (loading && !post) {
    return <PostDetailSkeleton />;
  }

  if (!post) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-lg font-bold text-pe-text">Post not found</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 text-sm font-semibold text-pe-link hover:underline"
        >
          Back to feed
        </button>
      </div>
    );
  }

  return (
    <div className="pt-1 md:pt-0">
      <PostCard
        post={post}
        variant="detail"
        companyName={newsCompanyName}
        enrichmentTick={enrichmentTick}
        onOpenProfile={onOpenProfile}
        onOpenStock={onOpenStock}
        onToggleLike={onToggleLike}
      />

      {onAddComment && !isNewsSocialPost(post) ? (
        <CommentComposer onSubmit={onAddComment} />
      ) : null}
    </div>
  );
}
