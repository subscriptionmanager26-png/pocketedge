import { CURRENT_USER, getPerson, getPersonByHandle } from '../data/mockData';
import { supabase, isSupabaseConfigured } from './supabase';
import { skipAuthForDev } from './sessionStore';

let selfProfile = null;
const byUserId = new Map();
const byUsername = new Map();

function useLiveIdentity() {
  return isSupabaseConfigured() && !skipAuthForDev();
}

export function setSelfProfile(profile) {
  selfProfile = profile ?? null;
  if (!profile) return;
  if (profile.user_id) byUserId.set(profile.user_id, profile);
  if (profile.username) byUsername.set(profile.username.toLowerCase(), profile);
}

export function getSelfProfile() {
  return selfProfile;
}

export function getAppCurrentUserId() {
  if (useLiveIdentity() && selfProfile?.user_id) return selfProfile.user_id;
  return CURRENT_USER.id;
}

export function profileToPerson(profile) {
  if (!profile) return null;
  return {
    id: profile.user_id,
    name: profile.display_name || profile.username || 'Investor',
    handle: profile.username,
    avatar: (profile.display_name || profile.username || '?').charAt(0).toUpperCase(),
    bio: profile.bio ?? '',
    location: profile.location ?? '',
    focus: profile.focus ?? '',
    xirr: 0,
    followers: 0,
    following: 0,
    assetsInfluenced: 0,
    joinedAt: profile.created_at ?? null,
    portfolioPublic: true,
    showHoldingsPublic: true,
    showXirrPublic: true,
  };
}

export function getAppCurrentUser() {
  if (useLiveIdentity() && selfProfile) return profileToPerson(selfProfile);
  return CURRENT_USER;
}

/** Sync peek from cache — avoids a second network hop after deep-link resolve. */
export function peekPerson(userId) {
  if (!userId) return null;
  if (!useLiveIdentity()) return getPerson(userId);

  if (selfProfile?.user_id === userId) return profileToPerson(selfProfile);
  const cached = byUserId.get(userId);
  return cached ? profileToPerson(cached) : null;
}

function cacheProfile(profile) {
  if (!profile?.user_id) return;
  byUserId.set(profile.user_id, profile);
  if (profile.username) byUsername.set(profile.username.toLowerCase(), profile);
}

async function fetchProfileByUsername(username) {
  if (!useLiveIdentity()) return null;
  const { data, error } = await supabase.rpc('get_social_profile', { p_username: username });
  if (error) throw error;
  return data;
}

export async function resolvePersonByHandle(handle) {
  const normalized = handle?.toLowerCase?.().replace(/^@/, '');
  if (!normalized) return null;

  if (!useLiveIdentity()) {
    return getPersonByHandle(normalized);
  }

  if (byUsername.has(normalized)) {
    return profileToPerson(byUsername.get(normalized));
  }

  const profile = await fetchProfileByUsername(normalized);
  if (profile) {
    cacheProfile(profile);
    return profileToPerson(profile);
  }

  return null;
}

export async function resolvePerson(userId) {
  if (!userId) return null;

  const currentId = getAppCurrentUserId();
  if (userId === currentId) return getAppCurrentUser();

  if (!useLiveIdentity()) {
    return getPerson(userId);
  }

  if (byUserId.has(userId)) {
    return profileToPerson(byUserId.get(userId));
  }

  const { data, error } = await supabase
    .from('social_profiles')
    .select('user_id, username, display_name, bio, avatar_url, location, focus, created_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    cacheProfile(data);
    return profileToPerson(data);
  }

  return null;
}

/** Batch-resolve profiles for feed cards (one query for missing IDs). */
export async function resolvePeople(userIds = []) {
  const unique = [...new Set((userIds ?? []).filter(Boolean).map(String))];
  if (!unique.length) return [];

  if (!useLiveIdentity()) {
    return unique.map((id) => getPerson(id)).filter(Boolean);
  }

  const currentId = getAppCurrentUserId();
  const missing = unique.filter(
    (id) => id !== currentId && !byUserId.has(id) && selfProfile?.user_id !== id
  );

  if (missing.length) {
    const { data, error } = await supabase
      .from('social_profiles')
      .select('user_id, username, display_name, bio, avatar_url, location, focus, created_at')
      .in('user_id', missing);

    if (error) throw error;
    for (const row of data ?? []) cacheProfile(row);
  }

  return unique.map((id) => peekPerson(id) ?? profileToPerson(byUserId.get(id))).filter(Boolean);
}

export function getHandleForUserIdSync(userId) {
  if (useLiveIdentity()) {
    if (selfProfile?.user_id === userId) return selfProfile.username;
    const cached = byUserId.get(userId);
    if (cached?.username) return cached.username;
    return null;
  }
  return getPerson(userId).handle;
}

/** Sync person lookup for feed/comments — avoids mock PEOPLE in production. */
export function getPersonSync(userId) {
  if (!userId) return null;
  if (!useLiveIdentity()) return getPerson(userId);

  if (selfProfile?.user_id === userId) return profileToPerson(selfProfile);
  const cached = byUserId.get(userId);
  if (cached) return profileToPerson(cached);

  return {
    id: userId,
    name: 'Member',
    handle: 'member',
    avatar: 'M',
    bio: '',
    location: '',
    focus: '',
    xirr: 0,
    followers: 0,
    following: 0,
    assetsInfluenced: 0,
    portfolioPublic: true,
    showHoldingsPublic: true,
    showXirrPublic: true,
  };
}
