import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import PostCard from '../components/PostCard';
import CommentComposer from '../components/CommentComposer';
import { isDevMockMode } from '../lib/appMode';
import { POSTS } from '../data/mockData';

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
  const cached = (posts ?? (isDevMockMode() ? POSTS : [])).find((p) => p.id === postId);

  useEffect(() => {
    if (!postId) {
      setDetailPost(null);
      return undefined;
    }

    if (fetchPost) {
      let cancelled = false;
      setDetailPost(cached ?? null);
      fetchPost(postId)
        .then((row) => {
          if (!cancelled) setDetailPost(row);
        })
        .catch(() => {
          if (!cancelled && cached) setDetailPost(cached);
        });
      return () => {
        cancelled = true;
      };
    }

    setDetailPost(cached ?? null);
    return undefined;
  }, [postId, cached, fetchPost]);

  const post = detailPost ?? cached;

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
        onOpenProfile={onOpenProfile}
        onToggleLike={onToggleLike}
      />

      {onAddComment && <CommentComposer onSubmit={onAddComment} />}
    </div>
  );
}
