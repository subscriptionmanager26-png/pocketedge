export const config = {
  runtime: 'edge',
};

function supabaseConfig() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  let ref = null;
  try {
    ref = new URL(url).hostname.split('.')[0];
  } catch {
    return null;
  }
  return { url, anonKey, ref };
}

function readAccessToken(request, ref) {
  const cookieName = `pe_sb_sb-${ref}-auth-token`;
  const header = request.headers.get('cookie') ?? '';
  const escaped = cookieName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = header.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  if (!match) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1]));
    return parsed?.access_token ?? null;
  } catch {
    return null;
  }
}

async function callRpc(config, token, name, body = {}) {
  const res = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: config.anonKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${name} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function decodeJwtSub(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return json?.sub ?? null;
  } catch {
    return null;
  }
}

export default async function handler(request) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const cfg = supabaseConfig();
  if (!cfg) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store',
      },
    });
  }

  const token = readAccessToken(request, cfg.ref);
  if (!token) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store',
      },
    });
  }

  const userId = decodeJwtSub(token);
  if (!userId) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store',
      },
    });
  }

  try {
    let payload = null;
    try {
      payload = await callRpc(cfg, token, 'bootstrap_app_v2', { p_feed_limit: 50 });
    } catch {
      const [core, portfolios, marketsPreview, followCounts, influencing] = await Promise.all([
        callRpc(cfg, token, 'bootstrap_social_app', { p_feed_limit: 50 }),
        callRpc(cfg, token, 'list_user_portfolios', { p_owner_id: userId }),
        callRpc(cfg, token, 'list_social_market_preview', { p_asset_type: 'stock', p_limit: 40 }),
        callRpc(cfg, token, 'get_follow_counts', { p_user_id: userId }),
        callRpc(cfg, token, 'get_influencing_bucket', { p_user_id: userId }),
      ]);
      payload = {
        profile: core?.profile ?? null,
        feed: core?.feed ?? null,
        portfolios: Array.isArray(portfolios) ? portfolios : [],
        markets_preview: marketsPreview ?? null,
        follow_counts: followCounts ?? null,
        influencing,
      };
    }

    const body = JSON.stringify({
      authenticated: true,
      userId,
      profile: payload?.profile ?? null,
      feed: payload?.feed ?? null,
      portfolios: payload?.portfolios ?? [],
      marketsPreview: payload?.markets_preview ?? payload?.marketsPreview ?? null,
      followCounts: payload?.follow_counts ?? payload?.followCounts ?? null,
      following: payload?.following ?? [],
      followers: payload?.followers ?? [],
      influencing: payload?.influencing ?? null,
    });

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        authenticated: false,
        error: error instanceof Error ? error.message : 'boot failed',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, no-store',
        },
      }
    );
  }
}
