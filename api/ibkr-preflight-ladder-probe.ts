import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  authorizeProbeRequest,
  DEFAULT_PROBE_SAMPLE,
  runIbkrPreflightLadder,
  type ProbeInstrument,
} from '../lib/ibkr-preflight-ladder.js';

export const config = {
  maxDuration: 60,
};

function parseSampleParam(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;
  const size = Number(text ?? '50');
  if (!Number.isFinite(size) || size <= 0) return DEFAULT_PROBE_SAMPLE;
  return DEFAULT_PROBE_SAMPLE.slice(0, Math.min(size, DEFAULT_PROBE_SAMPLE.length));
}

function parseConidsParam(value: string | string[] | undefined): ProbeInstrument[] | null {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text) return null;
  const conids = text
    .split(',')
    .map((part) => Number(part.trim()))
    .filter(Boolean);
  if (!conids.length) return null;
  const byConid = new Map(DEFAULT_PROBE_SAMPLE.map((row) => [row.conid, row]));
  return conids.map(
    (conid) =>
      byConid.get(conid) ?? {
        conid,
        symbol: null,
        exchange_id: null,
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
    const sample =
      parseConidsParam(req.query.conids) ?? parseSampleParam(req.query.sample);
    const batchSize = Number(req.query['batch-size'] ?? '10');

    const report = await runIbkrPreflightLadder({
      sample,
      batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 10,
      runtime: 'vercel',
      region: process.env.VERCEL_REGION ?? null,
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
