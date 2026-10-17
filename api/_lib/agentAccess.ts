import { createClient } from '@supabase/supabase-js';

import { supabaseServerConfig } from './supabaseServer.js';

function serviceRoleKey() {
  const { serviceRoleKey: key } = supabaseServerConfig();
  return key?.trim() || undefined;
}

function accessField() {
  return process.env.POCKETEDGE_AGENT_ACCESS_FIELD || 'agent_access';
}

function flagFromMetadata(userMetadata?: Record<string, unknown>) {
  const field = accessField();
  if (userMetadata && field in userMetadata) return Boolean(userMetadata[field]);
  if (userMetadata?.agent_access !== undefined) return Boolean(userMetadata.agent_access);
  return false;
}

async function readProfileFlagAdmin(userId: string): Promise<boolean | null> {
  const { url, serviceRoleKey: key } = supabaseServerConfig();
  const field = accessField();
  if (!url || !key) return null;
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from('social_profiles')
    .select(field)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data || typeof data !== 'object' || !(field in data)) return null;
  return Boolean((data as Record<string, unknown>)[field]);
}

async function readProfileFlagAsUser(
  userId: string,
  accessToken: string,
): Promise<boolean | null> {
  const { url, anonKey } = supabaseServerConfig();
  const field = accessField();
  if (!url || !anonKey) return null;
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from('social_profiles')
    .select(field)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  if (!data) return false;
  if (typeof data === 'object' && field in data) return Boolean((data as Record<string, unknown>)[field]);
  return null;
}

export async function userHasAgentAccess(
  userId: string,
  userMetadata?: Record<string, unknown>,
  accessToken?: string,
) {
  if (process.env.POCKETEDGE_AGENT_ACCESS_OPEN === '1') return true;

  const fromMeta = flagFromMetadata(userMetadata);
  const fromAdmin = await readProfileFlagAdmin(userId);
  const fromUser = accessToken ? await readProfileFlagAsUser(userId, accessToken) : null;

  const fromProfile =
    fromAdmin === true || fromUser === true
      ? true
      : fromAdmin === false && fromUser === false
        ? false
        : fromAdmin ?? fromUser;

  if (fromProfile === true || fromMeta) return true;
  return false;
}

export async function agentAccessDefinitelyDisabled(userId: string) {
  const fromAdmin = await readProfileFlagAdmin(userId);
  return fromAdmin === false;
}
