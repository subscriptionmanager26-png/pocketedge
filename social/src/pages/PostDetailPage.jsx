import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import PostCard from '../components/PostCard';
import CommentComposer from '../components/CommentComposer';
import { PostDetailSkeleton } from '../components/PageSkeletons';
import { isDevMockMode } from '../lib/appMode';
import { usePostEnrichment } from '../lib/usePostEnrichment';

export default function PostDetailPage({
  postId,
  posts,
  onBack,
  onOpenProfile,
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

  const post = detailPost ?? cached;
  const enrichmentPosts = useMemo(() => (post ? [post] : []), [post]);
  const enrichmentTick = usePostEnrichment(enrichmentPosts);

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
    <div>
      <PageHeader desktopOnly>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-pe-text-secondary hover:text-pe-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </PageHeader>

      <PostCard
        post={post}
        variant="detail"
        enrichmentTick={enrichmentTick}
        onOpenProfile={onOpenProfile}
        onToggleLike={onToggleLike}
      />

      {onAddComment && <CommentComposer onSubmit={onAddComment} />}
    </div>
  );
}
