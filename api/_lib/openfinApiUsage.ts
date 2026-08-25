import { supabaseServerConfig } from './supabaseServer.js';

export type OpenFinApiTrackInput = {
  endpoint: string;
  method?: string;
  status?: number;
  amfi?: string | null;
};

/** Fire-and-forget: Supabase daily counter + optional PostHog event. */
export function trackOpenFinApiRequest(input: OpenFinApiTrackInput): void {
  const endpoint = String(input.endpoint || '').trim();
  if (!endpoint) return;

  void incrementSupabaseUsage(endpoint);
  void capturePostHogEvent(input);
}

async function incrementSupabaseUsage(endpoint: string): Promise<void> {
  const { url, serviceRoleKey } = supabaseServerConfig();
  if (!url || !serviceRoleKey) return;

  try {
    await fetch(`${url}/rest/v1/rpc/increment_openfin_api_usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ p_endpoint: endpoint }),
    });
  } catch {
    /* usage tracking must not affect API responses */
  }
}

async function capturePostHogEvent(input: OpenFinApiTrackInput): Promise<void> {
  const apiKey =
    process.env.POSTHOG_PROJECT_TOKEN ??
    process.env.VITE_POSTHOG_PROJECT_TOKEN ??
    '';
  const host =
    process.env.POSTHOG_HOST ??
    process.env.VITE_POSTHOG_HOST ??
    'https://eu.i.posthog.com';
  if (!apiKey) return;

  try {
    await fetch(`${host.replace(/\/$/, '')}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event: 'openfin_api_request',
        properties: {
          endpoint: input.endpoint,
          method: input.method ?? 'GET',
          status: input.status ?? 200,
          amfi: input.amfi ?? undefined,
          source: 'edge',
        },
      }),
    });
  } catch {
    /* analytics must not affect API responses */
  }
}
