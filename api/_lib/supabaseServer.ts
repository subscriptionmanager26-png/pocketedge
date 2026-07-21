/** Server-only Supabase config (never use VITE_* in API routes). */

export function supabaseServerConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let ref: string | null = null;
  if (url) {
    try {
      ref = new URL(url).hostname.split('.')[0];
    } catch {
      ref = null;
    }
  }
  return { url, anonKey, serviceRoleKey, ref };
}

export function authCookieName(ref: string) {
  return `pe_sb_sb-${ref}-auth-token`;
}

export function readSessionFromCookieHeader(cookieHeader: string, ref: string): string | null {
  const cookieName = authCookieName(ref);
  const escaped = cookieName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = cookieHeader.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

export function readAccessTokenFromRequest(request: Request, ref: string): string | null {
  const raw = readSessionFromCookieHeader(request.headers.get('cookie') ?? '', ref);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.access_token ?? null;
  } catch {
    return null;
  }
}
