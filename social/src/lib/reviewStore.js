/** Fund & stock reviews, votes, comments, community-access unlock. */

import { CURRENT_USER } from '../data/mockData';
import { SEED_FUND_REVIEWS } from '../data/fundData';
import { SEED_STOCK_REVIEWS } from '../data/stockData';
import { skipAuthForDev } from './sessionStore';

const STORE_KEY = 'pe_social_fund_reviews';
const UNLOCK_KEY = 'pe_social_community_reviews_unlocked';

const listeners = new Set();

function seedReviews() {
  return [
    ...SEED_FUND_REVIEWS.map((r) => ({ ...r, comments: r.comments ?? [] })),
    ...SEED_STOCK_REVIEWS.map((r) => ({ ...r, comments: r.comments ?? [] })),
  ];
}

function emit() {
  listeners.forEach((fn) => fn());
}

function readStore() {
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
  return { reviews: seedReviews(), votes: {} };
}

function writeStore(data) {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
  emit();
}

export function subscribeReviews(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hasCommunityReviewsAccess() {
  if (skipAuthForDev()) return true;
  if (localStorage.getItem(UNLOCK_KEY) === '1') return true;
  const { reviews } = readStore();
  return reviews.some((r) => r.authorId === CURRENT_USER.id);
}

export function unlockCommunityReviews() {
  localStorage.setItem(UNLOCK_KEY, '1');
  emit();
}

export function getReviewsForFund(fundId) {
  return readStore()
    .reviews.filter((r) => r.fundId === fundId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getReviewsForStock(ticker) {
  return readStore()
    .reviews.filter((r) => r.stockTicker === ticker)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getUserReviewForFund(fundId) {
  return readStore().reviews.find(
    (r) => r.authorId === CURRENT_USER.id && r.fundId === fundId
  ) ?? null;
}

export function getUserReviewForStock(ticker) {
  return readStore().reviews.find(
    (r) => r.authorId === CURRENT_USER.id && r.stockTicker === ticker
  ) ?? null;
}

/** One review per user per asset — creates or updates. */
export function upsertReview({ fundId, stockTicker, rating, body = '' }) {
  const store = readStore();
  const existingIdx = store.reviews.findIndex(
    (r) =>
      r.authorId === CURRENT_USER.id &&
      ((fundId && r.fundId === fundId) || (stockTicker && r.stockTicker === stockTicker))
  );

  if (existingIdx >= 0) {
    const existing = store.reviews[existingIdx];
    store.reviews[existingIdx] = {
      ...existing,
      rating,
      body: body.trim(),
      updatedAt: new Date().toISOString(),
    };
    writeStore(store);
    unlockCommunityReviews();
    return store.reviews[existingIdx];
  }

  const review = {
    id: `rev_${Date.now()}`,
    ...(fundId ? { fundId } : {}),
    ...(stockTicker ? { stockTicker } : {}),
    authorId: CURRENT_USER.id,
    rating,
    body: body.trim(),
    createdAt: new Date().toISOString(),
    agreeCount: 0,
    disagreeCount: 0,
    comments: [],
    shareCount: 0,
  };
  store.reviews = [review, ...store.reviews];
  writeStore(store);
  unlockCommunityReviews();
  return review;
}

export function addReview({ fundId, stockTicker, rating, body = '' }) {
  return upsertReview({ fundId, stockTicker, rating, body });
}

export function updateReview(reviewId, { rating, body }) {
  const store = readStore();
  const idx = store.reviews.findIndex((r) => r.id === reviewId);
  if (idx < 0) return null;
  store.reviews[idx] = {
    ...store.reviews[idx],
    ...(rating != null ? { rating } : {}),
    ...(body != null ? { body: body.trim() } : {}),
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  return store.reviews[idx];
}

export function voteReview(reviewId, vote) {
  const store = readStore();
  const prev = store.votes[reviewId];
  const review = store.reviews.find((r) => r.id === reviewId);
  if (!review) return;

  if (prev === 'agree') review.agreeCount = Math.max(0, review.agreeCount - 1);
  if (prev === 'disagree') review.disagreeCount = Math.max(0, review.disagreeCount - 1);

  if (prev === vote) {
    delete store.votes[reviewId];
  } else {
    store.votes[reviewId] = vote;
    if (vote === 'agree') review.agreeCount += 1;
    else review.disagreeCount += 1;
  }

  writeStore(store);
}

export function getUserVote(reviewId) {
  return readStore().votes[reviewId] ?? null;
}

export function addReviewComment(reviewId, body, parentId = null) {
  const store = readStore();
  const review = store.reviews.find((r) => r.id === reviewId);
  if (!review || !body.trim()) return null;

  const comment = {
    id: `rc_${Date.now()}`,
    authorId: CURRENT_USER.id,
    body: body.trim(),
    parentId,
    createdAt: new Date().toISOString(),
  };
  review.comments = [...(review.comments ?? []), comment];
  writeStore(store);
  return comment;
}

export function incrementReviewShare(reviewId) {
  const store = readStore();
  const review = store.reviews.find((r) => r.id === reviewId);
  if (!review) return;
  review.shareCount = (review.shareCount ?? 0) + 1;
  writeStore(store);
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
  emit();
}
