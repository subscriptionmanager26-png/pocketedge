import { supabase, isSupabaseConfigured } from './supabase';
import { getAppCurrentUserId } from './socialIdentity';
import { skipAuthForDev } from './sessionStore';
import { createBooleanSyncManager } from './optimisticDebouncedSync';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const postLikeSync = createBooleanSyncManager();

export function isBackendPostId(postId) {
  return UUID_RE.test(String(postId ?? ''));
}

export function usePostBackend() {
  return isSupabaseConfigured() && !skipAuthForDev();
}

function mapComment(row) {
  return {
    id: row.id,
    authorId: row.author_id,
    body: row.body,
    parentId: row.parent_id ?? null,
    createdAt: row.created_at,
  };
}

export function mapPostRow(row, { comments = [] } = {}) {
  return {
    id: row.id,
    authorId: row.author_id,
    type: row.post_type ?? row.type ?? 'text',
    body: row.body ?? '',
    image: row.image_url ?? row.image ?? null,
    trade: row.trade ?? null,
    portfolioShare: row.portfolio_share ?? row.portfolioShare ?? null,
    via: row.via ?? null,
    topics: row.topics ?? [],
    createdAt: row.created_at ?? row.createdAt,
    likes: row.like_count ?? row.likes ?? 0,
    liked: row.liked ?? false,
    commentCount: row.comment_count ?? comments.length,
    comments: comments.map(mapComment),
  };
}

export function notePostLikeSynced(postId, liked) {
  postLikeSync.noteServerSynced(postId, Boolean(liked));
}

export async function fetchFeedPosts({ limit = 50, offset = 0 } = {}) {
  const { data, error } = await supabase.rpc('list_feed_posts', {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  const posts = (data?.items ?? []).map((row) => mapPostRow(row));
  posts.forEach((post) => notePostLikeSynced(post.id, post.liked));
  return posts;
}

/** Posts that mention any of the given tickers within the last `days` days. */
export async function fetchPostsMentioningTickers(
  tickers,
  { days = 30, limit = 50 } = {}
) {
  const keys = [...new Set((tickers ?? []).map((t) => String(t ?? '').trim()).filter(Boolean))];
  if (!keys.length) return [];
  if (!usePostBackend()) return [];

  const { data, error } = await supabase.rpc('list_posts_mentioning_tickers', {
    p_tickers: keys,
    p_days: days,
    p_limit: limit,
  });
  if (error) throw error;
  const posts = (data?.items ?? []).map((row) => mapPostRow(row));
  posts.forEach((post) => notePostLikeSynced(post.id, post.liked));
  return posts;
}

export async function fetchPost(postId) {
  const { data, error } = await supabase.rpc('get_social_post', {
    p_post_id: postId,
  });
  if (error) throw error;
  const post = mapPostRow(data, { comments: data.comments ?? [] });
  notePostLikeSynced(post.id, post.liked);
  return post;
}

export async function createPost({
  body = '',
  type = 'text',
  image = null,
  trade = null,
  portfolioShare = null,
  via = null,
  topics = [],
}) {
  const postType = portfolioShare ? 'portfolio' : trade ? 'trade' : image ? 'image' : type;
  const imageUrl = image && !String(image).startsWith('data:') ? image : null;

  const { data, error } = await supabase.rpc('create_social_post', {
    p_body: body,
    p_post_type: postType,
    p_image_url: imageUrl,
    p_trade: trade,
    p_portfolio_share: portfolioShare,
    p_via: via,
    p_topics: topics,
  });
  if (error) throw error;
  const post = mapPostRow(data);
  notePostLikeSynced(post.id, post.liked);
  return post;
}

export function applyOptimisticPostLike(post) {
  const liked = !post.liked;
  return {
    liked,
    likes: Math.max(0, (post.likes ?? 0) + (liked ? 1 : -1)),
  };
}

export function togglePostLike(postId, current) {
  const next = applyOptimisticPostLike(current);

  if (!usePostBackend() || !isBackendPostId(postId)) {
    return next;
  }

  postLikeSync.scheduleSync(postId, next.liked, async () => {
    const { error } = await supabase.rpc('toggle_post_like', { p_post_id: postId });
    if (error) throw error;
  });

  return next;
}

export function revertPostLike(postId, syncedLiked, current) {
  const liked = syncedLiked;
  const delta = (liked ? 1 : 0) - (current.liked ? 1 : 0);
  postLikeSync.noteServerSynced(postId, liked);
  return {
    liked,
    likes: Math.max(0, (current.likes ?? 0) + delta),
  };
}

export async function addPostComment(postId, body, parentId = null) {
  const trimmed = body.trim();
  if (!trimmed) return null;

  if (!usePostBackend() || !isBackendPostId(postId)) {
    return {
      id: `c_${Date.now()}`,
      authorId: getAppCurrentUserId(),
      body: trimmed,
      parentId,
      createdAt: new Date().toISOString(),
      pending: true,
    };
  }

  const { error } = await supabase.rpc('add_post_comment', {
    p_post_id: postId,
    p_body: trimmed,
    p_parent_id: parentId,
  });
  if (error) throw error;
  return fetchPost(postId);
}

export function buildOptimisticPostComment(body, parentId = null) {
  return {
    id: `pending_${Date.now()}`,
    authorId: getAppCurrentUserId(),
    body: body.trim(),
    parentId,
    createdAt: new Date().toISOString(),
    pending: true,
  };
}
