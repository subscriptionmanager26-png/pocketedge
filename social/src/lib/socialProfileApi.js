import { supabase, isSupabaseConfigured } from './supabase';
import { CURRENT_USER, getPersonByHandle } from '../data/mockData';
import { skipAuthForDev } from './sessionStore';

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

  if (!isSupabaseConfigured() || skipAuthForDev()) {
    return mockPublicProfile(handle);
  }

  const { data, error } = await supabase.rpc('get_social_profile_public', {
    p_username: handle,
  });
  if (error) throw error;
  return data;
}

export async function ensureSocialProfile() {
  if (!isSupabaseConfigured() || skipAuthForDev()) {
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

export async function fetchSocialProfile(username) {
  const handle = username?.toLowerCase?.().replace(/^@/, '');
  if (!handle) return null;

  if (!isSupabaseConfigured() || skipAuthForDev()) {
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
