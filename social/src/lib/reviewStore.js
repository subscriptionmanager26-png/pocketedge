/** Fund reviews, votes, comments, and community-access unlock (Phase 1–3). */

import { CURRENT_USER } from '../data/mockData';
import { SEED_FUND_REVIEWS } from '../data/fundData';
import { skipAuthForDev } from './sessionStore';

const STORE_KEY = 'pe_social_fund_reviews';
const UNLOCK_KEY = 'pe_social_community_reviews_unlocked';

const listeners = new Set();

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
  return {
    reviews: SEED_FUND_REVIEWS.map((r) => ({ ...r, comments: r.comments ?? [] })),
    votes: {},
  };
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

export function getAllReviews() {
  return readStore().reviews;
}

export function getReviewsForFund(fundId) {
  return readStore()
    .reviews.filter((r) => r.fundId === fundId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getReviewById(reviewId) {
  return readStore().reviews.find((r) => r.id === reviewId) ?? null;
}

export function addReview({ fundId, rating, body = '' }) {
  const store = readStore();
  const review = {
    id: `rev_${Date.now()}`,
    fundId,
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

export function getDiscussionsForFund(fundId) {
  const reviews = getReviewsForFund(fundId);
  const threads = [];

  for (const review of reviews) {
    if ((review.comments ?? []).length > 0) {
      threads.push({
        id: `disc_rev_${review.id}`,
        kind: 'review',
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

export function clearReviewStore() {
  localStorage.removeItem(STORE_KEY);
  localStorage.removeItem(UNLOCK_KEY);
  emit();
}
