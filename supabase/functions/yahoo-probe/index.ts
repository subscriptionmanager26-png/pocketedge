import { authorizeProbeRequest } from './probe-auth.ts';
import {
  DEFAULT_YAHOO_PROBE_SYMBOLS,
  runYahooProbe,
  type YahooProbeSymbol,
} from './yahoo-probe.ts';

function parseSymbols(url: URL): YahooProbeSymbol[] | null {
  const text = url.searchParams.get('symbols');
  if (!text) return null;
  const symbols = text.split(',').map((part) => part.trim()).filter(Boolean);
  if (!symbols.length) return null;
  const bySymbol = new Map(DEFAULT_YAHOO_PROBE_SYMBOLS.map((row) => [row.yahoo_symbol, row]));
  return symbols.map(
    (yahoo_symbol) =>
      bySymbol.get(yahoo_symbol) ?? {
        yahoo_symbol,
        label: yahoo_symbol,
        venue: 'custom',
      }
  );
}

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }

  const auth = authorizeProbeRequest(
    Deno.env.get('IBKR_PROBE_SECRET'),
    req.headers.get('x-probe-secret')
  );
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.error }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const sampleSize = Number(url.searchParams.get('sample') ?? '10');
    const symbols =
      parseSymbols(url) ??
      DEFAULT_YAHOO_PROBE_SYMBOLS.slice(
        0,
        Number.isFinite(sampleSize) && sampleSize > 0
          ? Math.min(sampleSize, DEFAULT_YAHOO_PROBE_SYMBOLS.length)
          : DEFAULT_YAHOO_PROBE_SYMBOLS.length
      );

    const report = await runYahooProbe({
      symbols,
      runtime: 'supabase_edge',
      region: Deno.env.get('SB_REGION') ?? Deno.env.get('DENO_REGION') ?? null,
      includeFinra: url.searchParams.get('finra') !== '0',
    });

    return Response.json({
      ...report,
      auth_warning: 'warning' in auth ? auth.warning : undefined,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        runtime: 'supabase_edge',
        region: Deno.env.get('SB_REGION') ?? Deno.env.get('DENO_REGION') ?? null,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
});
