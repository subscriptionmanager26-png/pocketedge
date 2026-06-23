const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

export type YahooProbeSymbol = {
  yahoo_symbol: string;
  label: string;
  venue: string;
};

/** Mix of US liquid, OTC, EU, Asia, Canada, UK — mirrors production backup paths. */
export const DEFAULT_YAHOO_PROBE_SYMBOLS: YahooProbeSymbol[] = [
  { yahoo_symbol: 'AAPL', label: 'AAPL', venue: 'US' },
  { yahoo_symbol: 'ABBV', label: 'ABBV', venue: 'US' },
  { yahoo_symbol: 'THNBY', label: 'THNBY', venue: 'OTC' },
  { yahoo_symbol: '000673.SZ', label: '000673', venue: 'China' },
  { yahoo_symbol: 'TPRO.MI', label: 'TPRO', venue: 'EU' },
  { yahoo_symbol: '6627.T', label: '6627', venue: 'Japan' },
  { yahoo_symbol: 'PWR.L', label: 'PWR', venue: 'UK' },
  { yahoo_symbol: 'TECK-B.TO', label: 'TECK-B', venue: 'Canada' },
  { yahoo_symbol: '2330.TW', label: '2330', venue: 'Taiwan' },
  { yahoo_symbol: '005930.KS', label: '005930', venue: 'Korea' },
];

export type YahooProbeResult = {
  yahoo_symbol: string;
  label: string;
  venue: string;
  ok: boolean;
  price: number | null;
  currency: string | null;
  exchange: string | null;
  host: string | null;
  http_status: number | null;
  error: string | null;
  latency_ms: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchYahooChartProbe(symbol: string) {
  let lastStatus: number | null = null;
  let lastHost: string | null = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const host = YAHOO_HOSTS[attempt % YAHOO_HOSTS.length];
    lastHost = host;
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d&includePrePost=true`;
    const started = Date.now();

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(15000),
      });
      lastStatus = response.status;
      const latency_ms = Date.now() - started;

      if (response.status === 429) {
        lastError = 'rate_limited';
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!response.ok) {
        lastError = `http_${response.status}`;
        return { ok: false, price: null, currency: null, exchange: null, host, http_status: response.status, error: lastError, latency_ms };
      }

      const data = await response.json();
      const result = data?.chart?.result?.[0];
      if (!result) {
        return { ok: false, price: null, currency: null, exchange: null, host, http_status: response.status, error: 'no_chart_result', latency_ms };
      }

      const closes = result.indicators?.quote?.[0]?.close?.filter((v: unknown) => v != null) ?? [];
      const price = closes.at(-1) ?? result.meta?.regularMarketPrice;
      if (price == null || Number(price) <= 0) {
        return { ok: false, price: null, currency: result.meta?.currency ?? null, exchange: result.meta?.exchangeName ?? null, host, http_status: response.status, error: 'no_price', latency_ms };
      }

      return {
        ok: true,
        price: Number(price),
        currency: result.meta?.currency ?? null,
        exchange: result.meta?.exchangeName ?? null,
        host,
        http_status: response.status,
        error: null,
        latency_ms,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await sleep(1000 * (attempt + 1));
    }
  }

  return {
    ok: false,
    price: null,
    currency: null,
    exchange: null,
    host: lastHost,
    http_status: lastStatus,
    error: lastError ?? 'fetch_failed',
    latency_ms: 0,
  };
}

export async function fetchFinraProbe(symbol: string) {
  const started = Date.now();
  try {
    const url =
      `https://api.finra.org/data/group/otcMarket/name/otcSecurities?limit=1` +
      `&fields=issueSymbolIdentifier,lastSalePrice,updatedDateTime` +
      `&issueSymbolIdentifier=${encodeURIComponent(symbol)}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(10000),
    });
    const latency_ms = Date.now() - started;
    if (!response.ok) {
      return { ok: false, price: null, http_status: response.status, error: `http_${response.status}`, latency_ms };
    }
    const data = await response.json();
    const row = Array.isArray(data) ? data[0] : data?.results?.[0] ?? data?.[0];
    const price = row?.lastSalePrice != null ? Number(row.lastSalePrice) : null;
    if (price == null || price <= 0) {
      return { ok: false, price: null, http_status: response.status, error: 'no_price', latency_ms };
    }
    return { ok: true, price, http_status: response.status, error: null, latency_ms };
  } catch (error) {
    return {
      ok: false,
      price: null,
      http_status: null,
      error: error instanceof Error ? error.message : String(error),
      latency_ms: Date.now() - started,
    };
  }
}

export async function runYahooProbe(options: {
  symbols?: YahooProbeSymbol[];
  runtime?: string;
  region?: string | null;
  includeFinra?: boolean;
}) {
  const {
    symbols = DEFAULT_YAHOO_PROBE_SYMBOLS,
    runtime = 'unknown',
    region = null,
    includeFinra = true,
  } = options;

  const startedAt = new Date().toISOString();
  const results: YahooProbeResult[] = [];

  for (const row of symbols) {
    const hit = await fetchYahooChartProbe(row.yahoo_symbol);
    results.push({
      yahoo_symbol: row.yahoo_symbol,
      label: row.label,
      venue: row.venue,
      ok: hit.ok,
      price: hit.price,
      currency: hit.currency,
      exchange: hit.exchange,
      host: hit.host,
      http_status: hit.http_status,
      error: hit.error,
      latency_ms: hit.latency_ms,
    });
    await sleep(200);
  }

  let finra: Record<string, unknown> | null = null;
  if (includeFinra) {
    const finraHit = await fetchFinraProbe('THNBY');
    finra = {
      symbol: 'THNBY',
      ok: finraHit.ok,
      price: finraHit.price,
      http_status: finraHit.http_status,
      error: finraHit.error,
      latency_ms: finraHit.latency_ms,
    };
  }

  const priced = results.filter((row) => row.ok).length;

  return {
    ok: priced > 0,
    probe_type: 'yahoo_chart',
    runtime,
    region,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    sample_size: symbols.length,
    summary: {
      total: symbols.length,
      priced,
      missing: symbols.length - priced,
      by_venue: Object.fromEntries(
        [...new Set(symbols.map((row) => row.venue))].map((venue) => {
          const rows = results.filter((r) => r.venue === venue);
          return [venue, { total: rows.length, priced: rows.filter((r) => r.ok).length }];
        })
      ),
    },
    finra_otc: finra,
    results,
  };
}
