import { supabase, isSupabaseConfigured } from './supabase';
import { getAppCurrentUserId } from './socialIdentity';
import { skipAuthForDev } from './sessionStore';
import { createBooleanSyncManager } from './optimisticDebouncedSync';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const POST_IMAGE_BUCKET = 'post-images';
const MAX_POST_IMAGE_BYTES = 5 * 1024 * 1024;

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

function extensionForMime(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'jpg';
}

function dataUrlToBlob(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid image data.');
  const mime = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Upload a post image (File/Blob or data URL) and return its public URL. */
export async function uploadPostImage(image) {
  if (!image) return null;
  if (typeof image === 'string' && !image.startsWith('data:')) {
    // Already a remote URL.
    return image;
  }

  if (!usePostBackend() || !supabase) {
    // Dev/mock: keep data URLs so the feed still shows the image locally.
    if (typeof image === 'string') return image;
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read image.'));
      reader.readAsDataURL(image);
    });
  }

  const userId = getAppCurrentUserId();
  if (!userId) throw new Error('Sign in to post images.');

  let blob;
  let mime;
  if (typeof image === 'string') {
    blob = dataUrlToBlob(image);
    mime = blob.type || 'image/jpeg';
  } else {
    blob = image;
    mime = image.type || 'image/jpeg';
  }

  if (blob.size > MAX_POST_IMAGE_BYTES) {
    throw new Error('Image must be under 5 MB.');
  }

  const ext = extensionForMime(mime);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(POST_IMAGE_BUCKET).upload(path, blob, {
    contentType: mime,
    upsert: false,
    cacheControl: '31536000',
  });
  if (error) throw error;

  const { data } = supabase.storage.from(POST_IMAGE_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
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
  const imageUrl = image ? await uploadPostImage(image) : null;
  const postType = portfolioShare ? 'portfolio' : trade ? 'trade' : imageUrl ? 'image' : type;

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

  const { data, error } = await supabase.rpc('add_post_comment', {
    p_post_id: postId,
    p_body: trimmed,
    p_parent_id: parentId,
  });
  if (error) throw error;

  // Prefer a full reload so comment_count and authors stay in sync.
  try {
    return await fetchPost(postId);
  } catch (fetchErr) {
    // Comment is already persisted — merge it into a minimal post shape if reload fails.
    console.error('fetchPost after add_post_comment failed', fetchErr);
    return {
      id: postId,
      comments: [mapComment(data)],
      commentCount: 1,
    };
  }
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
