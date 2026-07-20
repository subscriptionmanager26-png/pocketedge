import { supabase, isSupabaseConfigured } from './supabase';
import { CURRENT_USER, getPersonByHandle, PEOPLE } from '../data/mockData';
import { skipAuthForDev } from './sessionStore';
import { setSelfProfile, getSelfProfile } from './socialIdentity';

function useBackend() {
  return isSupabaseConfigured() && !skipAuthForDev();
}

function mockPublicProfile(username) {
  const person = getPersonByHandle(username);
  if (!person) return null;
  return {
    user_id: person.id,
    username: person.handle,
    display_name: person.name,
    avatar_url: null,
  };
}

export async function fetchPublicProfile(username) {
  const handle = username?.toLowerCase?.().replace(/^@/, '');
  if (!handle) return null;

  if (!useBackend()) {
    return mockPublicProfile(handle);
  }

  const { data, error } = await supabase.rpc('get_social_profile_public', {
    p_username: handle,
  });
  if (error) throw error;
  return data;
}

export async function ensureSocialProfile() {
  if (!useBackend()) {
    return {
      user_id: CURRENT_USER.id,
      username: CURRENT_USER.handle,
      display_name: CURRENT_USER.name,
      bio: CURRENT_USER.bio,
      avatar_url: null,
      location: CURRENT_USER.location,
      focus: CURRENT_USER.focus,
      is_self: true,
    };
  }

  const { data, error } = await supabase.rpc('ensure_social_profile');
  if (error) throw error;
  return data;
}

/** Profile + feed in one round-trip. */
export async function bootstrapSocialApp({ feedLimit = 50 } = {}) {
  if (!useBackend()) {
    const profile = await ensureSocialProfile();
    return { profile, feed: { items: [] } };
  }

  const { data, error } = await supabase.rpc('bootstrap_social_app', {
    p_feed_limit: feedLimit,
  });
  if (error) throw error;
  return {
    profile: data?.profile ?? null,
    feed: data?.feed ?? { items: [] },
  };
}

/** Profile header stats in one RPC (counts + influencing). */
export async function fetchProfileHeader(userId) {
  if (!useBackend() || !userId) return null;
  const { data, error } = await supabase.rpc('get_profile_header', {
    p_user_id: userId,
  });
  if (error) throw error;
  return data;
}

export async function fetchSocialProfile(username) {
  const handle = username?.toLowerCase?.().replace(/^@/, '');
  if (!handle) return null;

  if (!useBackend()) {
    const person = getPersonByHandle(handle);
    if (!person) return null;
    return {
      user_id: person.id,
      username: person.handle,
      display_name: person.name,
      bio: person.bio,
      avatar_url: null,
      location: person.location,
      focus: person.focus,
      is_self: person.id === CURRENT_USER.id,
    };
  }

  const { data, error } = await supabase.rpc('get_social_profile', { p_username: handle });
  if (error) throw error;
  return data;
}

export async function updateSocialProfile(patch) {
  if (!useBackend()) {
    CURRENT_USER.name = patch.display_name ?? CURRENT_USER.name;
    CURRENT_USER.bio = patch.bio ?? CURRENT_USER.bio;
    CURRENT_USER.location = patch.location ?? CURRENT_USER.location;
    CURRENT_USER.focus = patch.focus ?? CURRENT_USER.focus;
    return {
      user_id: CURRENT_USER.id,
      username: CURRENT_USER.handle,
      display_name: CURRENT_USER.name,
      bio: CURRENT_USER.bio,
      location: CURRENT_USER.location,
      focus: CURRENT_USER.focus,
      is_self: true,
    };
  }

  const userId = getSelfProfile()?.user_id;
  if (!userId) throw new Error('Profile not loaded');

  const { data, error } = await supabase
    .from('social_profiles')
    .update({
      display_name: patch.display_name,
      bio: patch.bio,
      location: patch.location,
      focus: patch.focus,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('user_id, username, display_name, bio, avatar_url, location, focus, created_at, updated_at')
    .single();

  if (error) throw error;

  const profile = { ...data, is_self: true };
  setSelfProfile(profile);
  return profile;
}

export async function searchSocialProfiles(query, { limit = 20 } = {}) {
  const needle = query?.trim();
  if (!needle) return [];

  if (!useBackend()) {
    const q = needle.toLowerCase();
    return PEOPLE.filter(
      (p) => p.name.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q)
    ).map((p) => ({
      user_id: p.id,
      username: p.handle,
      display_name: p.name,
      bio: p.bio,
      avatar_url: null,
      location: p.location,
      focus: p.focus,
    }));
  }

  const { data, error } = await supabase
    .from('social_profiles')
    .select('user_id, username, display_name, bio, avatar_url, location, focus')
    .or(`username.ilike.%${needle}%,display_name.ilike.%${needle}%`)
    .order('display_name')
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
