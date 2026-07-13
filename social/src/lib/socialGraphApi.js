import { supabase, isSupabaseConfigured } from './supabase';
import { skipAuthForDev } from './sessionStore';

export function useFollowBackend() {
  return isSupabaseConfigured() && !skipAuthForDev();
}

function asIdList(data) {
  const items = data?.items ?? data ?? [];
  if (!Array.isArray(items)) return [];
  return items.map((id) => String(id)).filter(Boolean);
}

export async function followUser(userId) {
  const { data, error } = await supabase.rpc('follow_user', {
    p_user_id: userId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function unfollowUser(userId) {
  const { data, error } = await supabase.rpc('unfollow_user', {
    p_user_id: userId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function fetchIsFollowing(userId) {
  const { data, error } = await supabase.rpc('is_following', {
    p_user_id: userId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function fetchFollowingIds(userId) {
  const { data, error } = await supabase.rpc('list_following', {
    p_user_id: userId,
  });
  if (error) throw error;
  return asIdList(data);
}

export async function fetchFollowerIds(userId) {
  const { data, error } = await supabase.rpc('list_followers', {
    p_user_id: userId,
  });
  if (error) throw error;
  return asIdList(data);
}

export async function fetchFollowCounts(userId) {
  const { data, error } = await supabase.rpc('get_follow_counts', {
    p_user_id: userId,
  });
  if (error) throw error;
  return {
    followers: Number(data?.followers ?? 0),
    following: Number(data?.following ?? 0),
  };
}
