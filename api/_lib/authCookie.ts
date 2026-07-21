import { authCookieName, supabaseServerConfig } from './supabaseServer.js';

const COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 days

function cookieDomain(host: string | null): string | null {
  if (!host) return null;
  if (host === 'localhost' || host.endsWith('.localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null;
  }
  if (host.endsWith('pocketedge.in')) return '.pocketedge.in';
  return null;
}

export function buildSessionSetCookie(
  sessionJson: string,
  request: Request,
): string {
  const cfg = supabaseServerConfig();
  if (!cfg.ref) throw new Error('Missing Supabase project ref');
  const name = authCookieName(cfg.ref);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const domain = cookieDomain(host);
  let cookie = `${name}=${encodeURIComponent(sessionJson)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; HttpOnly; SameSite=Lax`;
  if (domain) cookie += `; Domain=${domain}`;
  if (proto === 'https') cookie += '; Secure';
  return cookie;
}

export function buildSessionClearCookie(request: Request): string {
  const cfg = supabaseServerConfig();
  if (!cfg.ref) throw new Error('Missing Supabase project ref');
  const name = authCookieName(cfg.ref);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const domain = cookieDomain(host);
  let cookie = `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  if (domain) cookie += `; Domain=${domain}`;
  if (proto === 'https') cookie += '; Secure';
  return cookie;
}
