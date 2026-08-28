export const config = {
  runtime: 'edge',
};

import { HOLDINGS_CORS, jsonResponse } from '../_lib/fundHoldingsCdn.js';
import { openfinSupabaseConfig } from '../_lib/openfinSupabaseServer.js';

type UsageRow = {
  usage_date: string;
  endpoint: string;
  request_count: number;
};

/**
 * GET /api/v1/stats
 * Public aggregate API usage for the OpenFin dashboard.
 */
export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: HOLDINGS_CORS });
  }
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const { url, anonKey } = openfinSupabaseConfig();
  if (!url || !anonKey) {
    return jsonResponse(
      {
        tracking: false,
        message: 'Usage tracking not configured on this deployment.',
        totals: [],
        by_endpoint: [],
      },
      200,
      { 'Cache-Control': 'public, max-age=60' },
    );
  }

  try {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);
    const sinceDate = since.toISOString().slice(0, 10);

    const res = await fetch(
      `${url}/rest/v1/openfin_api_usage_daily?usage_date=gte.${sinceDate}&select=usage_date,endpoint,request_count&order=usage_date.desc`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      },
    );

    if (!res.ok) {
      return jsonResponse(
        {
          tracking: true,
          message: 'Usage table not ready yet — apply Supabase migration.',
          totals: [],
          by_endpoint: [],
        },
        200,
        { 'Cache-Control': 'public, max-age=60' },
      );
    }

    const rows = (await res.json()) as UsageRow[];
    const byEndpoint = new Map<string, number>();
    const byDay = new Map<string, number>();
    let total = 0;

    for (const row of rows) {
      const count = Number(row.request_count) || 0;
      total += count;
      byEndpoint.set(row.endpoint, (byEndpoint.get(row.endpoint) ?? 0) + count);
      byDay.set(row.usage_date, (byDay.get(row.usage_date) ?? 0) + count);
    }

    const by_endpoint = [...byEndpoint.entries()]
      .map(([endpoint, request_count]) => ({ endpoint, request_count }))
      .sort((a, b) => b.request_count - a.request_count);

    const daily = [...byDay.entries()]
      .map(([usage_date, request_count]) => ({ usage_date, request_count }))
      .sort((a, b) => b.usage_date.localeCompare(a.usage_date));

    return jsonResponse(
      {
        tracking: true,
        window_days: 30,
        total_requests: total,
        by_endpoint,
        daily,
        note:
          'Counts edge-handled routes (/api/v1, /holdings, /filings, /stats). CDN rewrites for /catalog, /meta, and /portfolios are not included yet.',
        generated_at: new Date().toISOString(),
      },
      200,
      {
        'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600',
      },
    );
  } catch (err) {
    return jsonResponse(
      {
        tracking: false,
        error: 'Could not load usage stats',
        detail: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
}
