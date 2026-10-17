import { readAccessTokenFromRequest, supabaseServerConfig } from './supabaseServer.js';

export type PocketedgeUser = {
  id: string;
  email?: string;
  name?: string;
  metadata?: Record<string, unknown>;
};

export function accessTokenFromRequest(request: Request, ref: string): string | null {
  const header = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (header) return header;
  return readAccessTokenFromRequest(request, ref);
}

export async function pocketedgeUserFromRequest(request: Request): Promise<PocketedgeUser | null> {
  const cfg = supabaseServerConfig();
  if (!cfg.url || !cfg.anonKey || !cfg.ref) return null;
  const token = accessTokenFromRequest(request, cfg.ref);
  if (!token) return null;

  const res = await fetch(`${cfg.url}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: cfg.anonKey,
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    id?: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  };
  if (!data?.id) return null;
  const meta = data.user_metadata;
  const name =
    (typeof meta?.full_name === 'string' && meta.full_name) ||
    (typeof meta?.name === 'string' && meta.name) ||
    undefined;
  return { id: data.id, email: data.email, name, metadata: meta };
}
