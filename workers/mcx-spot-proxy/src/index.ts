/**
 * MCX spot-price proxy via Cloudflare Browser Rendering.
 * Plain Worker fetch is blocked by MCX's Cloudflare WAF (403).
 * Headless Chrome navigates the site and same-origin fetches the JSON API.
 *
 * Auth: Authorization: Bearer <PROXY_TOKEN>
 */

import puppeteer from '@cloudflare/puppeteer';

const MCX_SEED = 'https://www.mcxindia.com/market-data/spot-market-price';
const MCX_API_PATH = '/GetSpotMarketPrice?culture=en';

export interface Env {
  PROXY_TOKEN: string;
  BROWSER: Fetcher;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function authorize(request: Request, env: Env): boolean {
  const expected = env.PROXY_TOKEN;
  if (!expected) return false;
  const auth = request.headers.get('authorization') ?? '';
  if (auth === `Bearer ${expected}`) return true;
  return (request.headers.get('x-mcx-proxy-token') ?? '') === expected;
}

async function fetchMcxViaBrowser(env: Env) {
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    );
    const seed = await page.goto(MCX_SEED, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    if (!seed || !seed.ok()) {
      throw new Error(`MCX seed page failed: ${seed?.status() ?? 'no-response'}`);
    }

    const payload = await page.evaluate(async (apiPath) => {
      const res = await fetch(apiPath, {
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`MCX API ${res.status}: ${text.slice(0, 160)}`);
      }
      return res.json();
    }, MCX_API_PATH);

    const rows = (payload?.Data?.Data ?? []) as Array<Record<string, unknown>>;
    const items = rows.map((row) => ({
      id: String(row.enSymbol ?? row.symbol ?? ''),
      location: String(row.enlocation ?? row.location ?? 'NA'),
      spotPrice: row.todaysSpotPrice != null ? Number(row.todaysSpotPrice) : null,
      change: row.change != null ? Number(row.change) : null,
      date: row.FormattedDate != null ? String(row.FormattedDate) : null,
      time: row.FormattedTime != null ? String(row.FormattedTime) : null,
    }));

    return {
      asOn: payload?.Data?.Summary?.AsOn ?? null,
      items,
    };
  } finally {
    await browser.close();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return json(200, { ok: true, service: 'mcx-spot-proxy', mode: 'browser' });
    }

    if (request.method !== 'GET' && request.method !== 'POST') {
      return json(405, { ok: false, error: 'Method not allowed' });
    }

    if (!authorize(request, env)) {
      return json(401, { ok: false, error: 'Unauthorized' });
    }

    try {
      const data = await fetchMcxViaBrowser(env);
      return json(200, { ok: true, via: 'browser', ...data, count: data.items.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json(502, { ok: false, error: message });
    }
  },
};
