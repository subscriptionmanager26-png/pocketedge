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

/** Recent people who followed `userId`, with created_at for activity. */
export async function fetchRecentFollowers(userId, { limit = 50 } = {}) {
  const { data, error } = await supabase.rpc('list_recent_followers', {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) throw error;
  const items = data?.items ?? [];
  if (!Array.isArray(items)) return [];
  return items
    .map((row) => ({
      followerId: String(row.follower_id ?? row.followerId ?? ''),
      createdAt: row.created_at ?? row.createdAt ?? null,
    }))
    .filter((row) => row.followerId);
}
