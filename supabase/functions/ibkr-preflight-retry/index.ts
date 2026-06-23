import {
  authorizeProbeRequest,
  chunk,
  createIbkrClient,
  LADDER_STEPS,
  parseIbkrField31,
  type ProbeInstrument,
} from './ibkr-preflight-ladder.ts';

const RETRY_STEPS = LADDER_STEPS.filter((step) => step.step >= 3);

type RetryResultRow = {
  conid: number;
  symbol: string | null;
  exchange_id: string | null;
  success_step: number | null;
  success_step_label: string | null;
  last: number | null;
  last_raw: string | null;
};

async function runRetrySteps(instruments: ProbeInstrument[], batchSize: number) {
  const client = createIbkrClient();
  const state = new Map<number, RetryResultRow>(
    instruments.map((row) => [
      row.conid,
      {
        conid: row.conid,
        symbol: row.symbol,
        exchange_id: row.exchange_id,
        success_step: null,
        success_step_label: null,
        last: null,
        last_raw: null,
      },
    ])
  );

  for (const stepConfig of RETRY_STEPS) {
    const pending = instruments.filter((row) => state.get(row.conid)!.success_step == null);
    if (!pending.length) continue;

    for (const batch of chunk(pending, batchSize)) {
      const conids = batch.map((row) => row.conid);
      try {
        const snapshots = await client.fetchBatch(conids, {
          preflightCount: stepConfig.preflightCount,
          preflightWaitMs: stepConfig.preflightWaitMs,
        });

        for (const snapshot of snapshots) {
          const parsed = parseIbkrField31(snapshot['31']);
          const entry = state.get(snapshot.conid);
          if (!entry || entry.success_step != null || parsed.price == null || parsed.price <= 0) {
            continue;
          }
          entry.success_step = stepConfig.step;
          entry.success_step_label = stepConfig.label;
          entry.last = parsed.price;
          entry.last_raw = parsed.raw;
        }
      } catch {
        // Continue other batches; misses may recover on later steps.
      }
    }
  }

  return {
    ok: true,
    runtime: 'supabase_edge',
    region: Deno.env.get('SB_REGION') ?? Deno.env.get('DENO_REGION') ?? null,
    results: [...state.values()],
    metrics: client.metrics,
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
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
    const body = await req.json();
    const instruments = (body.instruments ?? []).filter((row: ProbeInstrument) => row?.conid);
    const batchSize = Number(body.batch_size ?? 10);
    if (!instruments.length) {
      return Response.json({ ok: true, results: [] });
    }
    return Response.json(await runRetrySteps(instruments, batchSize));
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
});
