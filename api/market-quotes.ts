export const config = {
  runtime: 'edge',
};

import { supabaseServerConfig } from './_lib/supabaseServer.js';

const MAX_KEYS = 40;

/**
 * Short-TTL public quotes for known asset keys (preview / detail / poll).
 * Live LTP still originates from Postgres writers — this only edge-caches reads.
 */
export default async function handler(request: Request) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { url, anonKey, serviceRoleKey } = supabaseServerConfig();
  const key = serviceRoleKey || anonKey;
  if (!url || !key) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), { status: 500 });
  }

  const reqUrl = new URL(request.url);
  const keys = [
    ...new Set(
      String(reqUrl.searchParams.get('keys') ?? '')
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
    ),
  ].slice(0, MAX_KEYS);

  if (!keys.length) {
    return new Response(JSON.stringify({ error: 'keys query required' }), { status: 400 });
  }

  const inList = keys.map((k) => `"${k.replaceAll('"', '')}"`).join(',');
  const res = await fetch(
    `${url}/rest/v1/social_market_assets?select=asset_key,asset_type,name,price,change_pct,previous_close,as_of_date,synced_at,logo_icon_url&asset_key=in.(${inList})`,
    {
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return new Response(
      JSON.stringify({ error: `lookup failed: ${res.status}`, detail: text.slice(0, 200) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const rows = await res.json();
  const byKey = new Map(
    (Array.isArray(rows) ? rows : []).map((row) => [String(row.asset_key ?? ''), row]),
  );
  const items = keys.map((requested) => {
    const row = byKey.get(requested) ?? byKey.get(requested.toUpperCase()) ?? null;
    if (!row) return { key: requested, assetKey: null, price: null };
    return {
      key: requested,
      assetKey: row.asset_key ?? null,
      assetType: row.asset_type ?? null,
      name: row.name ?? null,
      price: row.price != null ? Number(row.price) : null,
      changePct: row.change_pct != null ? Number(row.change_pct) : null,
      previousClose: row.previous_close != null ? Number(row.previous_close) : null,
      asOfDate: row.as_of_date ?? null,
      syncedAt: row.synced_at ?? null,
      logoIconUrl: row.logo_icon_url ?? null,
    };
  });

  return new Response(JSON.stringify({ items }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
    },
  });
}
