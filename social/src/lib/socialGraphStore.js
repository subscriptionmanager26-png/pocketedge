import { CURRENT_USER, PEOPLE, USER_FOLLOWING_SEED } from '../data/mockData';

const FOLLOWING_KEY = 'pe_social_following';
const TOPICS_KEY = 'pe_social_topics';

const DEFAULT_FOLLOWING = USER_FOLLOWING_SEED.u_me;
const ALL_USER_IDS = [CURRENT_USER.id, ...PEOPLE.map((p) => p.id)];
const DEFAULT_TOPICS = ['Banking', 'ITServices', 'Macro'];

const listeners = new Set();

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

export function subscribeSocialGraph(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getFollowingIds() {
  return new Set(readJson(FOLLOWING_KEY, DEFAULT_FOLLOWING));
}

export function isFollowing(userId) {
  return getFollowingIds().has(userId);
}

export function toggleFollow(userId) {
  const next = getFollowingIds();
  if (next.has(userId)) next.delete(userId);
  else next.add(userId);
  writeJson(FOLLOWING_KEY, [...next]);
  return next.has(userId);
}

export function setFollowingIds(ids) {
  writeJson(FOLLOWING_KEY, ids);
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
  emit();
}

function followingMap() {
  const map = { ...USER_FOLLOWING_SEED };
  map[CURRENT_USER.id] = [...getFollowingIds()];
  return map;
}

export function getFollowingForUser(userId) {
  if (userId === CURRENT_USER.id) return [...getFollowingIds()];
  return [...(USER_FOLLOWING_SEED[userId] ?? [])];
}

export function getFollowersForUser(userId) {
  const map = followingMap();
  return ALL_USER_IDS.filter((id) => id !== userId && (map[id] ?? []).includes(userId));
}

export function getFollowCounts(userId) {
  return {
    followers: getFollowersForUser(userId).length,
    following: getFollowingForUser(userId).length,
  };
}
