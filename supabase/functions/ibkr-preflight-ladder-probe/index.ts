import {
  authorizeProbeRequest,
  DEFAULT_PROBE_SAMPLE,
  runIbkrPreflightLadder,
  type ProbeInstrument,
} from './ibkr-preflight-ladder.ts';

function parseSample(url: URL) {
  const size = Number(url.searchParams.get('sample') ?? '50');
  if (!Number.isFinite(size) || size <= 0) return DEFAULT_PROBE_SAMPLE;
  return DEFAULT_PROBE_SAMPLE.slice(0, Math.min(size, DEFAULT_PROBE_SAMPLE.length));
}

function parseConids(url: URL): ProbeInstrument[] | null {
  const text = url.searchParams.get('conids');
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
    const sample = parseConids(url) ?? parseSample(url);
    const batchSize = Number(url.searchParams.get('batch-size') ?? '10');

    const report = await runIbkrPreflightLadder({
      sample,
      batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 10,
      runtime: 'supabase_edge',
      region: Deno.env.get('SB_REGION') ?? Deno.env.get('DENO_REGION') ?? null,
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
