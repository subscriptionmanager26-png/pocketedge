import { CURRENT_USER, PEOPLE, USER_FOLLOWING_SEED } from '../data/mockData';
import { isDevMockMode } from './appMode';
import { getAppCurrentUserId } from './socialIdentity';
import {
  fetchFollowCounts,
  fetchFollowerIds,
  fetchFollowingIds,
  fetchRecentFollowers,
  followUser,
  unfollowUser,
  useFollowBackend,
} from './socialGraphApi';

const FOLLOWING_KEY = 'pe_social_following';
const TOPICS_KEY = 'pe_social_topics';

const DEFAULT_FOLLOWING = isDevMockMode() ? USER_FOLLOWING_SEED.u_me : [];
const ALL_USER_IDS = isDevMockMode() ? [CURRENT_USER.id, ...PEOPLE.map((p) => p.id)] : [];
const DEFAULT_TOPICS = isDevMockMode() ? ['Banking', 'ITServices', 'Macro'] : [];

const listeners = new Set();

/** Live cache: who the current user follows. */
let myFollowingCache = null;
/** Live cache: following list per profile user id. */
const followingListCache = new Map();
/** Live cache: followers list per profile user id. */
const followersListCache = new Map();
/** Live cache: {followers, following} counts per profile user id. */
const countsCache = new Map();
/** Live cache: recent follower events for the current user (activity). */
let myFollowerEventsCache = [];

function emit() {
  listeners.forEach((fn) => fn());
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  emit();
}

function isDemoUserId(id) {
  return /^(u_me|u_\w+|u\d+)$/i.test(String(id ?? ''));
}

function filterLiveIds(ids) {
  return (ids ?? []).filter((id) => id && !isDemoUserId(id)).map(String);
}

function bumpCountsForToggle(followerId, followeeId, nowFollowing) {
  const delta = nowFollowing ? 1 : -1;

  const followerCounts = countsCache.get(followerId) ?? { followers: 0, following: 0 };
  countsCache.set(followerId, {
    ...followerCounts,
    following: Math.max(0, followerCounts.following + delta),
  });

  const followeeCounts = countsCache.get(followeeId) ?? { followers: 0, following: 0 };
  countsCache.set(followeeId, {
    ...followeeCounts,
    followers: Math.max(0, followeeCounts.followers + delta),
  });

  if (followingListCache.has(followerId)) {
    const list = new Set(followingListCache.get(followerId));
    if (nowFollowing) list.add(followeeId);
    else list.delete(followeeId);
    followingListCache.set(followerId, [...list]);
  }

  if (followersListCache.has(followeeId)) {
    const list = new Set(followersListCache.get(followeeId));
    if (nowFollowing) list.add(followerId);
    else list.delete(followerId);
    followersListCache.set(followeeId, [...list]);
  }
}

export function subscribeSocialGraph(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getFollowingIds() {
  if (useFollowBackend()) {
    if (myFollowingCache) return new Set(myFollowingCache);
    return new Set(filterLiveIds(readJson(FOLLOWING_KEY, [])));
  }
  const ids = readJson(FOLLOWING_KEY, DEFAULT_FOLLOWING);
  if (isDevMockMode()) return new Set(ids);
  return new Set(filterLiveIds(ids));
}

export function isFollowing(userId) {
  if (!userId) return false;
  return getFollowingIds().has(String(userId));
}

/** Optimistic toggle; persists to Supabase when live. */
export async function toggleFollow(userId) {
  if (!userId || isDemoUserId(userId)) return false;
  const targetId = String(userId);
  const me = getAppCurrentUserId();
  if (targetId === me) return false;

  const currently = isFollowing(targetId);
  const nextFollowing = !currently;

  if (useFollowBackend()) {
    const next = getFollowingIds();
    if (nextFollowing) next.add(targetId);
    else next.delete(targetId);
    myFollowingCache = next;
    writeJson(FOLLOWING_KEY, [...next]);
    bumpCountsForToggle(me, targetId, nextFollowing);
    emit();

    try {
      if (nextFollowing) await followUser(targetId);
      else await unfollowUser(targetId);
      await Promise.all([
        hydrateFollowGraph(targetId).catch(() => {}),
        me ? hydrateFollowGraph(me).catch(() => {}) : Promise.resolve(),
      ]);
    } catch {
      // Revert optimistic update.
      if (nextFollowing) next.delete(targetId);
      else next.add(targetId);
      myFollowingCache = next;
      writeJson(FOLLOWING_KEY, [...next]);
      bumpCountsForToggle(me, targetId, !nextFollowing);
      emit();
      return !nextFollowing;
    }
    return nextFollowing;
  }

  const next = getFollowingIds();
  if (next.has(targetId)) next.delete(targetId);
  else next.add(targetId);
  writeJson(FOLLOWING_KEY, [...next]);
  return next.has(targetId);
}

export function setFollowingIds(ids) {
  const cleaned = filterLiveIds(ids);
  if (useFollowBackend()) myFollowingCache = new Set(cleaned);
  writeJson(FOLLOWING_KEY, cleaned);
}

export function getFollowedTopicSlugs() {
  return new Set(readJson(TOPICS_KEY, DEFAULT_TOPICS));
}

export function isTopicFollowed(slug) {
  return getFollowedTopicSlugs().has(slug);
}

export function toggleTopicFollow(slug) {
  const next = getFollowedTopicSlugs();
  if (next.has(slug)) next.delete(slug);
  else next.add(slug);
  writeJson(TOPICS_KEY, [...next]);
  return next.has(slug);
}

export function setFollowedTopicSlugs(slugs) {
  writeJson(TOPICS_KEY, slugs);
}

export function clearSocialGraph() {
  localStorage.removeItem(FOLLOWING_KEY);
  localStorage.removeItem(TOPICS_KEY);
  myFollowingCache = null;
  myFollowerEventsCache = [];
  followingListCache.clear();
  followersListCache.clear();
  countsCache.clear();
  emit();
}

function followingMap() {
  if (!isDevMockMode()) {
    return { [getAppCurrentUserId()]: [...getFollowingIds()] };
  }
  const map = { ...USER_FOLLOWING_SEED };
  map[CURRENT_USER.id] = [...getFollowingIds()];
  return map;
}

export function getFollowingForUser(userId) {
  if (!userId) return [];
  const id = String(userId);

  if (useFollowBackend()) {
    if (followingListCache.has(id)) return [...followingListCache.get(id)];
    if (id === getAppCurrentUserId()) return [...getFollowingIds()];
    return [];
  }

  if (!isDevMockMode()) {
    if (id === getAppCurrentUserId()) return [...getFollowingIds()];
    return [];
  }
  if (id === CURRENT_USER.id) return [...getFollowingIds()];
  return [...(USER_FOLLOWING_SEED[id] ?? [])];
}

export function getFollowersForUser(userId) {
  if (!userId) return [];
  const id = String(userId);

  if (useFollowBackend()) {
    if (followersListCache.has(id)) return [...followersListCache.get(id)];
    return [];
  }

  const map = followingMap();
  return ALL_USER_IDS.filter((uid) => uid !== id && (map[uid] ?? []).includes(id));
}

export function getFollowCounts(userId) {
  if (!userId) return { followers: 0, following: 0 };
  const id = String(userId);

  if (useFollowBackend() && countsCache.has(id)) {
    return { ...countsCache.get(id) };
  }

  return {
    followers: getFollowersForUser(id).length,
    following: getFollowingForUser(id).length,
  };
}

/** Prefetch current user's following set (call on app bootstrap). */
export async function hydrateMyFollowing() {
  if (!useFollowBackend()) return [...getFollowingIds()];
  const me = getAppCurrentUserId();
  if (!me || isDemoUserId(me)) return [];
  await hydrateFollowGraph(me);
  return [...getFollowingIds()];
}

/** Recent people who followed the current user (for Activity). */
export function getMyRecentFollowerEvents() {
  return myFollowerEventsCache.map((event) => ({ ...event }));
}

/** Prefetch following/followers lists + counts for a profile. */
export async function hydrateFollowGraph(userId) {
  if (!userId) return { followers: 0, following: 0 };
  const id = String(userId);
  if (isDemoUserId(id)) return { followers: 0, following: 0 };

  if (!useFollowBackend()) {
    return getFollowCounts(id);
  }

  const me = getAppCurrentUserId();
  const isSelf = id === me;

  const [counts, following, followersPayload] = await Promise.all([
    fetchFollowCounts(id),
    fetchFollowingIds(id),
    isSelf ? fetchRecentFollowers(id, { limit: 50 }) : fetchFollowerIds(id),
  ]);

  countsCache.set(id, counts);
  followingListCache.set(id, following);

  if (isSelf) {
    myFollowerEventsCache = followersPayload;
    followersListCache.set(
      id,
      followersPayload.map((event) => event.followerId)
    );
    myFollowingCache = new Set(following);
    writeJson(FOLLOWING_KEY, following);
  } else {
    followersListCache.set(id, followersPayload);
  }

  emit();
  return counts;
}
