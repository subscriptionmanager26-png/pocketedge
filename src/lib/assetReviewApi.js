import { supabase, isSupabaseConfigured } from './supabase';
import { skipAuthForDev } from './sessionStore';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isBackendReviewId(reviewId) {
  return UUID_RE.test(String(reviewId ?? ''));
}

export function useReviewBackend() {
  return isSupabaseConfigured() && !skipAuthForDev();
}

export function assetRefFromReviewInput({ fundId, stockTicker, assetType, assetId, isEtf }) {
  if (fundId) return { assetType: 'fund', assetId: fundId };
  if (stockTicker) {
    return {
      assetType: isEtf || assetType === 'etf' ? 'etf' : 'stock',
      assetId: stockTicker,
    };
  }
  if (assetType && assetId) return { assetType, assetId };
  return null;
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

export function mapReviewRow(row) {
  const assetType = row.asset_type;
  const assetId = row.asset_id;
  return {
    id: row.id,
    authorId: row.author_id,
    assetType,
    assetId,
    fundId: assetType === 'fund' ? assetId : undefined,
    stockTicker: assetType === 'stock' || assetType === 'etf' ? assetId : undefined,
    indexId: assetType === 'index' ? assetId : undefined,
    commodityId: assetType === 'commodity' ? assetId : undefined,
    rating: row.rating,
    body: row.body ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    agreeCount: row.agree_count ?? 0,
    disagreeCount: row.disagree_count ?? 0,
    shareCount: row.share_count ?? 0,
    userVote: row.user_vote ?? null,
    comments: (row.comments ?? []).map(mapComment),
  };
}

export async function fetchAssetReviews(assetType, assetId) {
  const { data, error } = await supabase.rpc('list_asset_reviews', {
    p_asset_type: assetType,
    p_asset_id: assetId,
  });
  if (error) throw error;
  return (data?.items ?? []).map(mapReviewRow);
}

export async function fetchReviewsByAuthor(authorId) {
  const { data, error } = await supabase.rpc('list_reviews_by_author', {
    p_author_id: authorId,
  });
  if (error) throw error;
  return (data?.items ?? []).map(mapReviewRow);
}

export async function fetchUserAssetReview(assetType, assetId) {
  const { data, error } = await supabase.rpc('get_user_asset_review', {
    p_asset_type: assetType,
    p_asset_id: assetId,
  });
  if (error) throw error;
  return data ? mapReviewRow(data) : null;
}

export async function upsertAssetReview({ assetType, assetId, rating, body = '' }) {
  const { data, error } = await supabase.rpc('upsert_asset_review', {
    p_asset_type: assetType,
    p_asset_id: assetId,
    p_rating: rating,
    p_body: body,
  });
  if (error) throw error;
  return mapReviewRow(data);
}

export async function toggleReviewVote(reviewId, vote) {
  const { data, error } = await supabase.rpc('toggle_review_vote', {
    p_review_id: reviewId,
    p_vote: vote,
  });
  if (error) throw error;
  return mapReviewRow(data);
}

export async function addAssetReviewComment(reviewId, body, parentId = null) {
  const { data, error } = await supabase.rpc('add_review_comment', {
    p_review_id: reviewId,
    p_body: body,
    p_parent_id: parentId,
  });
  if (error) throw error;
  return mapReviewRow(data);
}

export async function incrementAssetReviewShare(reviewId) {
  const { data, error } = await supabase.rpc('increment_review_share', {
    p_review_id: reviewId,
  });
  if (error) throw error;
  return mapReviewRow(data);
}

export async function fetchCommunityReviewsAccess() {
  const { data, error } = await supabase.rpc('has_community_reviews_access');
  if (error) throw error;
  return Boolean(data);
}
