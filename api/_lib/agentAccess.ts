import { createClient } from '@supabase/supabase-js';

import { supabaseServerConfig } from './supabaseServer.js';

function adminClient() {
  const { url, serviceRoleKey } = supabaseServerConfig();
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function accessField() {
  return process.env.POCKETEDGE_AGENT_ACCESS_FIELD || 'agent_access';
}

export async function userHasAgentAccess(
  userId: string,
  userMetadata?: Record<string, unknown>,
) {
  const field = accessField();
  const supabase = adminClient();
  if (supabase) {
    const { data, error } = await supabase.from('profiles').select(field).eq('id', userId).maybeSingle();
    if (!error && data && typeof data === 'object' && field in data) {
      return Boolean((data as Record<string, unknown>)[field]);
    }
  }
  if (userMetadata && field in userMetadata) return Boolean(userMetadata[field]);
  if (userMetadata?.agent_access !== undefined) return Boolean(userMetadata.agent_access);
  return false;
}
