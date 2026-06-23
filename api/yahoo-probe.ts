import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authorizeProbeRequest } from '../lib/ibkr-preflight-ladder.js';
import {
  DEFAULT_YAHOO_PROBE_SYMBOLS,
  runYahooProbe,
  type YahooProbeSymbol,
} from '../lib/yahoo-probe.js';

export const config = {
  maxDuration: 60,
};

function parseSymbolsParam(value: string | string[] | undefined): YahooProbeSymbol[] | null {
  const text = Array.isArray(value) ? value[0] : value;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const auth = authorizeProbeRequest(
    process.env.IBKR_PROBE_SECRET,
    (req.headers['x-probe-secret'] as string | undefined) ?? null
  );
  if (!auth.ok) {
    return res.status(401).json({ ok: false, error: auth.error });
  }

  try {
    const sampleSize = Number(req.query.sample ?? '10');
    const symbols =
      parseSymbolsParam(req.query.symbols) ??
      DEFAULT_YAHOO_PROBE_SYMBOLS.slice(
        0,
        Number.isFinite(sampleSize) && sampleSize > 0
          ? Math.min(sampleSize, DEFAULT_YAHOO_PROBE_SYMBOLS.length)
          : DEFAULT_YAHOO_PROBE_SYMBOLS.length
      );

    const report = await runYahooProbe({
      symbols,
      runtime: 'vercel',
      region: process.env.VERCEL_REGION ?? null,
      includeFinra: req.query.finra !== '0',
    });

    return res.status(200).json({
      ...report,
      auth_warning: 'warning' in auth ? auth.warning : undefined,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      runtime: 'vercel',
      region: process.env.VERCEL_REGION ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
