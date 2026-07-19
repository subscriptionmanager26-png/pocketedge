/** Fund & stock reviews — Supabase in production, localStorage in dev mock. */

import { SEED_FUND_REVIEWS } from '../data/fundData';
import { SEED_STOCK_REVIEWS } from '../data/stockData';
import { isDevMockMode } from './appMode';
import { getAppCurrentUserId } from './socialIdentity';
import {
  addAssetReviewComment,
  assetRefFromReviewInput,
  fetchAssetReviews,
  fetchCommunityReviewsAccess,
  fetchReviewsByAuthor,
  incrementAssetReviewShare,
  toggleReviewVote,
  upsertAssetReview,
  useReviewBackend,
} from './assetReviewApi';
import { createBooleanSyncManager } from './optimisticDebouncedSync';

const STORE_KEY = 'pe_social_fund_reviews';
const UNLOCK_KEY = 'pe_social_community_reviews_unlocked';

const listeners = new Set();
let reviewCache = [];
let accessCache = null;
const votesCache = {};
const reviewLikeSync = createBooleanSyncManager();

function seedReviews() {
  return [
    ...SEED_FUND_REVIEWS.map((r) => ({ ...r, comments: r.comments ?? [] })),
    ...SEED_STOCK_REVIEWS.map((r) => ({ ...r, comments: r.comments ?? [] })),
  ];
}

function emit() {
  listeners.forEach((fn) => fn());
}

function readLocalStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        reviews: parsed.reviews ?? [],
        votes: parsed.votes ?? {},
      };
    }
  } catch {
    /* fall through */
  }
  if (!isDevMockMode()) {
    return { reviews: [], votes: {} };
  }
  return { reviews: seedReviews(), votes: {} };
}

function writeLocalStore(data) {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
  emit();
}

function syncVotesFromReviews(reviews) {
  for (const review of reviews) {
    if (review.userVote) votesCache[review.id] = review.userVote;
    reviewLikeSync.noteServerSynced(review.id, review.userVote === 'agree');
  }
}

function reviewsForAsset(assetType, assetId) {
  return reviewCache
    .filter((r) => {
      if (r.assetType && r.assetId) {
        return r.assetType === assetType && r.assetId === assetId;
      }
      if (assetType === 'fund') return r.fundId === assetId;
      if (assetType === 'stock' || assetType === 'etf') return r.stockTicker === assetId;
      if (assetType === 'index') return r.indexId === assetId;
      if (assetType === 'commodity') return r.commodityId === assetId;
      return false;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function subscribeReviews(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function hydrateCommunityAccess() {
  if (!useReviewBackend()) return hasCommunityReviewsAccess();
  if (accessCache != null) return accessCache;
  accessCache = await fetchCommunityReviewsAccess();
  emit();
  return accessCache;
}

export function hasCommunityReviewsAccess() {
  if (isDevMockMode()) return true;
  if (useReviewBackend()) return Boolean(accessCache);
  if (localStorage.getItem(UNLOCK_KEY) === '1') return true;
  return readLocalStore().reviews.some((r) => r.authorId === getAppCurrentUserId());
}

export function unlockCommunityReviews() {
  if (useReviewBackend()) {
    accessCache = true;
    emit();
    return;
  }
  localStorage.setItem(UNLOCK_KEY, '1');
  emit();
}

export async function loadReviewsForAsset(assetType, assetId) {
  if (!assetId) return [];
  if (useReviewBackend()) {
    const rows = await fetchAssetReviews(assetType, assetId);
    reviewCache = [
      ...reviewCache.filter(
        (r) => !(r.assetType === assetType && r.assetId === assetId)
      ),
      ...rows,
    ];
    syncVotesFromReviews(rows);
    emit();
    return rows;
  }
  if (!isDevMockMode()) {
    reviewCache = [];
    emit();
    return [];
  }
  reviewCache = readLocalStore().reviews;
  emit();
  return reviewsForAsset(assetType, assetId);
}

export async function loadReviewsForFund(fundId) {
  return loadReviewsForAsset('fund', fundId);
}

export async function loadReviewsForStock(ticker, { isEtf = false } = {}) {
  return loadReviewsForAsset(isEtf ? 'etf' : 'stock', ticker);
}

export async function loadReviewsForIndex(indexId) {
  return loadReviewsForAsset('index', indexId);
}

export async function loadReviewsForCommodity(commodityId) {
  return loadReviewsForAsset('commodity', commodityId);
}

export async function loadReviewsByAuthor(userId) {
  if (!userId) return [];
  if (useReviewBackend()) {
    const rows = await fetchReviewsByAuthor(userId);
    const other = reviewCache.filter((r) => r.authorId !== userId);
    reviewCache = [...other, ...rows];
    syncVotesFromReviews(rows);
    emit();
    return rows;
  }
  reviewCache = readLocalStore().reviews;
  emit();
  return getReviewsByAuthor(userId);
}

export function getReviewsForFund(fundId) {
  return reviewsForAsset('fund', fundId);
}

export function getReviewsForStock(ticker) {
  return reviewsForAsset('stock', ticker).concat(reviewsForAsset('etf', ticker));
}

export function getReviewsForIndex(indexId) {
  return reviewsForAsset('index', indexId);
}

export function getReviewsForCommodity(commodityId) {
  return reviewsForAsset('commodity', commodityId);
}

export function getReviewsByAuthor(userId) {
  return reviewCache
    .filter((r) => r.authorId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getUserReviewForFund(fundId) {
  return (
    reviewCache.find(
      (r) => r.authorId === getAppCurrentUserId() && (r.fundId === fundId || (r.assetType === 'fund' && r.assetId === fundId))
    ) ?? null
  );
}

export function getUserReviewForStock(ticker, { isEtf = false } = {}) {
  const type = isEtf ? 'etf' : 'stock';
  return (
    reviewCache.find(
      (r) =>
        r.authorId === getAppCurrentUserId() &&
        (r.stockTicker === ticker || (r.assetType === type && r.assetId === ticker))
    ) ?? null
  );
}

export function getUserReviewForIndex(indexId) {
  return (
    reviewCache.find(
      (r) =>
        r.authorId === getAppCurrentUserId() &&
        (r.indexId === indexId || (r.assetType === 'index' && r.assetId === indexId))
    ) ?? null
  );
}

export function getUserReviewForCommodity(commodityId) {
  return (
    reviewCache.find(
      (r) =>
        r.authorId === getAppCurrentUserId() &&
        (r.commodityId === commodityId ||
          (r.assetType === 'commodity' && r.assetId === commodityId))
    ) ?? null
  );
}

export async function upsertReview(input) {
  const ref = assetRefFromReviewInput(input);
  if (useReviewBackend() && ref) {
    const row = await upsertAssetReview({
      assetType: ref.assetType,
      assetId: ref.assetId,
      rating: input.rating,
      body: input.body ?? '',
    });
    reviewCache = [
      ...reviewCache.filter((r) => r.id !== row.id && !(r.assetType === row.assetType && r.assetId === row.assetId && r.authorId === row.authorId)),
      row,
    ];
    unlockCommunityReviews();
    emit();
    return row;
  }

  const store = readLocalStore();
  const { fundId, stockTicker, rating, body = '' } = input;
  const existingIdx = store.reviews.findIndex(
    (r) =>
      r.authorId === getAppCurrentUserId() &&
      ((fundId && r.fundId === fundId) || (stockTicker && r.stockTicker === stockTicker))
  );

  if (existingIdx >= 0) {
    store.reviews[existingIdx] = {
      ...store.reviews[existingIdx],
      rating,
      body: body.trim(),
      updatedAt: new Date().toISOString(),
    };
    writeLocalStore(store);
    reviewCache = store.reviews;
    unlockCommunityReviews();
    return store.reviews[existingIdx];
  }

  const review = {
    id: `rev_${Date.now()}`,
    ...(fundId ? { fundId } : {}),
    ...(stockTicker ? { stockTicker } : {}),
    authorId: getAppCurrentUserId(),
    rating,
    body: body.trim(),
    createdAt: new Date().toISOString(),
    agreeCount: 0,
    disagreeCount: 0,
    comments: [],
    shareCount: 0,
  };
  store.reviews = [review, ...store.reviews];
  writeLocalStore(store);
  reviewCache = store.reviews;
  unlockCommunityReviews();
  return review;
}

export function addReview(input) {
  return upsertReview(input);
}

function patchReviewInCache(reviewId, patch) {
  reviewCache = reviewCache.map((r) => (r.id === reviewId ? { ...r, ...patch } : r));
}

function applyOptimisticReviewLike(reviewId) {
  const review =
    reviewCache.find((r) => r.id === reviewId) ??
    readLocalStore().reviews.find((r) => r.id === reviewId);
  if (!review) return null;

  const prevVote = votesCache[reviewId] ?? review.userVote ?? null;
  const liked = prevVote !== 'agree';
  let agreeCount = review.agreeCount ?? 0;
  let disagreeCount = review.disagreeCount ?? 0;
  const userVote = liked ? 'agree' : null;

  if (prevVote === 'agree') agreeCount = Math.max(0, agreeCount - 1);
  else {
    agreeCount += 1;
    if (prevVote === 'disagree') disagreeCount = Math.max(0, disagreeCount - 1);
  }

  if (userVote) votesCache[reviewId] = userVote;
  else delete votesCache[reviewId];

  const updated = { ...review, agreeCount, disagreeCount, userVote };
  patchReviewInCache(reviewId, updated);

  if (!useReviewBackend() || !isBackendReviewId(reviewId)) {
    const store = readLocalStore();
    const idx = store.reviews.findIndex((r) => r.id === reviewId);
    if (idx >= 0) {
      store.reviews[idx] = updated;
      if (userVote) store.votes[reviewId] = userVote;
      else delete store.votes[reviewId];
      writeLocalStore(store);
      reviewCache = store.reviews;
    }
  }

  emit();
  return updated;
}

export function toggleReviewLike(reviewId) {
  const updated = applyOptimisticReviewLike(reviewId);
  if (!updated) return null;

  if (useReviewBackend() && isBackendReviewId(reviewId)) {
    const liked = updated.userVote === 'agree';
    reviewLikeSync.scheduleSync(reviewId, liked, async () => {
      await toggleReviewVote(reviewId, 'agree');
    });
  }

  return updated;
}

export async function voteReview(reviewId, vote) {
  if (vote === 'agree') return toggleReviewLike(reviewId);
  if (useReviewBackend() && isBackendReviewId(reviewId)) {
    const row = await toggleReviewVote(reviewId, vote);
    reviewCache = reviewCache.map((r) => (r.id === row.id ? row : r));
    votesCache[reviewId] = row.userVote ?? null;
    if (!row.userVote) delete votesCache[reviewId];
    emit();
    return;
  }

  const store = readLocalStore();
  const prev = store.votes[reviewId];
  const review = store.reviews.find((r) => r.id === reviewId);
  if (!review) return;

  if (prev === 'agree') review.agreeCount = Math.max(0, review.agreeCount - 1);
  if (prev === 'disagree') review.disagreeCount = Math.max(0, review.disagreeCount - 1);

  if (prev === vote) {
    delete store.votes[reviewId];
    delete votesCache[reviewId];
  } else {
    store.votes[reviewId] = vote;
    votesCache[reviewId] = vote;
    if (vote === 'agree') review.agreeCount += 1;
    else review.disagreeCount += 1;
  }

  writeLocalStore(store);
  reviewCache = store.reviews;
}

function isBackendReviewId(reviewId) {
  return /^[0-9a-f-]{36}$/i.test(String(reviewId ?? ''));
}

export function getUserVote(reviewId) {
  if (votesCache[reviewId]) return votesCache[reviewId];
  if (!useReviewBackend()) return readLocalStore().votes[reviewId] ?? null;
  const review = reviewCache.find((r) => r.id === reviewId);
  return review?.userVote ?? null;
}

export async function addReviewComment(reviewId, body, parentId = null) {
  const trimmed = body.trim();
  if (!trimmed) return null;

  const review = reviewCache.find((r) => r.id === reviewId);
  const optimisticComment = {
    id: `pending_${Date.now()}`,
    authorId: getAppCurrentUserId(),
    body: trimmed,
    parentId,
    createdAt: new Date().toISOString(),
    pending: true,
  };

  if (review) {
    patchReviewInCache(reviewId, {
      comments: [...(review.comments ?? []), optimisticComment],
    });
    emit();
  }

  if (useReviewBackend() && isBackendReviewId(reviewId)) {
    try {
      const row = await addAssetReviewComment(reviewId, trimmed, parentId);
      reviewCache = reviewCache.map((r) => (r.id === row.id ? row : r));
      emit();
      return row.comments[row.comments.length - 1] ?? null;
    } catch (err) {
      if (review) {
        patchReviewInCache(reviewId, {
          comments: (review.comments ?? []).filter((c) => c.id !== optimisticComment.id),
        });
        emit();
      }
      throw err;
    }
  }

  const store = readLocalStore();
  const localReview = store.reviews.find((r) => r.id === reviewId);
  if (!localReview) return null;

  const comment = {
    id: `rc_${Date.now()}`,
    authorId: getAppCurrentUserId(),
    body: trimmed,
    parentId,
    createdAt: new Date().toISOString(),
  };
  localReview.comments = [...(localReview.comments ?? []), comment];
  writeLocalStore(store);
  reviewCache = store.reviews;
  return comment;
}

export async function incrementReviewShare(reviewId) {
  const review = reviewCache.find((r) => r.id === reviewId);
  if (review) {
    patchReviewInCache(reviewId, { shareCount: (review.shareCount ?? 0) + 1 });
    emit();
  }

  if (useReviewBackend() && isBackendReviewId(reviewId)) {
    try {
      const row = await incrementAssetReviewShare(reviewId);
      reviewCache = reviewCache.map((r) => (r.id === row.id ? row : r));
      emit();
    } catch (err) {
      if (review) {
        patchReviewInCache(reviewId, { shareCount: review.shareCount ?? 0 });
        emit();
      }
      throw err;
    }
    return;
  }

  const store = readLocalStore();
  const localReview = store.reviews.find((r) => r.id === reviewId);
  if (!localReview) return;
  localReview.shareCount = (localReview.shareCount ?? 0) + 1;
  writeLocalStore(store);
  reviewCache = store.reviews;
  emit();
}

function discussionsFromReviews(reviews) {
  const threads = [];
  for (const review of reviews) {
    if ((review.comments ?? []).length > 0) {
      threads.push({
        id: `disc_rev_${review.id}`,
        reviewId: review.id,
        title: `${review.rating}★ review sparking debate`,
        preview: review.comments[0]?.body ?? '',
        commentCount: review.comments.length,
        createdAt: review.comments[review.comments.length - 1]?.createdAt ?? review.createdAt,
      });
    }
  }
  return threads.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getDiscussionsForFund(fundId) {
  return discussionsFromReviews(getReviewsForFund(fundId));
}

export function getDiscussionsForStock(ticker) {
  return discussionsFromReviews(getReviewsForStock(ticker));
}

export function clearReviewStore() {
  localStorage.removeItem(STORE_KEY);
  localStorage.removeItem(UNLOCK_KEY);
  reviewCache = [];
  accessCache = null;
  Object.keys(votesCache).forEach((k) => delete votesCache[k]);
  reviewLikeSync.clearAll();
  emit();
}
