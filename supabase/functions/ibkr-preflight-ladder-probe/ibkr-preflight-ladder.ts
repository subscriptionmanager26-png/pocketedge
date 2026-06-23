export const SNAPSHOT_URL =
  'https://www.interactivebrokers.com/portal.proxy/v1/mkt/iserver/marketdata/snapshot';
export const FIELDS = '31';

export const LADDER_STEPS = [
  { step: 1, preflightCount: 0, preflightWaitMs: 0, label: 'no_preflight_initial' },
  { step: 2, preflightCount: 0, preflightWaitMs: 0, label: 'no_preflight_retry' },
  { step: 3, preflightCount: 1, preflightWaitMs: 1000, label: 'preflight_1' },
  { step: 4, preflightCount: 2, preflightWaitMs: 2000, label: 'preflight_2' },
] as const;

export type ProbeInstrument = {
  conid: number;
  symbol: string | null;
  exchange_id: string | null;
};

export type LadderResultRow = {
  conid: number;
  symbol: string | null;
  exchange_id: string | null;
  success_step: number | null;
  success_step_label: string | null;
  last: number | null;
  last_raw: string | null;
  field_31: string | null;
};

/** Same 50-ticker mix used in the local probe (liquid US + OTC + Asia + one SWB miss). */
export const DEFAULT_PROBE_SAMPLE: ProbeInstrument[] = [
  { conid: 265598, symbol: 'AAPL', exchange_id: 'NASDAQ' },
  { conid: 118089500, symbol: 'ABBV', exchange_id: 'NYSE' },
  { conid: 3655373, symbol: 'ABCB', exchange_id: 'ARCA' },
  { conid: 400759002, symbol: 'ABEQ', exchange_id: 'ARCA' },
  { conid: 14680959, symbol: 'ABG', exchange_id: 'NYSE' },
  { conid: 649166469, symbol: 'ABLV', exchange_id: 'ARCA' },
  { conid: 4050, symbol: 'ABM', exchange_id: 'NYSE' },
  { conid: 504239576, symbol: 'ABSI', exchange_id: 'NASDAQ' },
  { conid: 869955105, symbol: 'ABUF', exchange_id: 'ARCA' },
  { conid: 336517320, symbol: 'ACA', exchange_id: 'ARCA' },
  { conid: 10814, symbol: 'ACH', exchange_id: 'NYSE' },
  { conid: 274940, symbol: 'ACNT', exchange_id: 'NASDAQ' },
  { conid: 822736139, symbol: 'ACSV', exchange_id: 'ARCA' },
  { conid: 845905507, symbol: 'ADAMO', exchange_id: 'NASDAQ' },
  { conid: 4157, symbol: 'ADI', exchange_id: 'NYSE' },
  { conid: 30207299, symbol: 'AACS', exchange_id: 'OTCLNKECN' },
  { conid: 680532487, symbol: 'AAKAY', exchange_id: 'OTCLNKECN' },
  { conid: 95309032, symbol: 'AAPJ', exchange_id: 'OTCLNKECN' },
  { conid: 44001811, symbol: 'AAPT', exchange_id: 'OTCLNKECN' },
  { conid: 6542348, symbol: 'ABLE', exchange_id: 'OTCLNKECN' },
  { conid: 229145261, symbol: 'ABVG', exchange_id: 'OTCLNKECN' },
  { conid: 331339431, symbol: 'ABWN', exchange_id: 'OTCLNKECN' },
  { conid: 444365548, symbol: 'ACAI', exchange_id: 'OTCLNKECN' },
  { conid: 127521708, symbol: 'ACMDY', exchange_id: 'OTCLNKECN' },
  { conid: 412448858, symbol: 'ACMMY', exchange_id: 'OTCLNKECN' },
  { conid: 158907658, symbol: 'ACTL', exchange_id: 'OTCLNKECN' },
  { conid: 30723974, symbol: 'ADBN', exchange_id: 'OTCLNKECN' },
  { conid: 457224922, symbol: 'ADDLY', exchange_id: 'OTCLNKECN' },
  { conid: 213613462, symbol: 'ADVT', exchange_id: 'OTCLNKECN' },
  { conid: 364697221, symbol: 'ADYX', exchange_id: 'OTCLNKECN' },
  { conid: 257312497, symbol: '000673', exchange_id: 'SEHKSZSE' },
  { conid: 257311898, symbol: '000687', exchange_id: 'SEHKSZSE' },
  { conid: 257312196, symbol: '000760', exchange_id: 'SEHKSZSE' },
  { conid: 257312407, symbol: '002071', exchange_id: 'SEHKSZSE' },
  { conid: 280799981, symbol: '002147', exchange_id: 'SEHKSZSE' },
  { conid: 257313659, symbol: '002260', exchange_id: 'SEHKSZSE' },
  { conid: 281750192, symbol: '002276.ON', exchange_id: 'SEHKSZSE' },
  { conid: 257313161, symbol: '002464', exchange_id: 'SEHKSZSE' },
  { conid: 257310532, symbol: '002477', exchange_id: 'SEHKSZSE' },
  { conid: 257313733, symbol: '002509', exchange_id: 'SEHKSZSE' },
  { conid: 257311579, symbol: '002711', exchange_id: 'SEHKSZSE' },
  { conid: 873812252, symbol: '0039P0', exchange_id: 'KRX' },
  { conid: 885279052, symbol: '00407A', exchange_id: 'TWSE' },
  { conid: 637688721, symbol: '00643K', exchange_id: 'TWSE' },
  { conid: 866451334, symbol: '008110', exchange_id: 'KRX' },
  { conid: 892323623, symbol: '009824', exchange_id: 'TWSE' },
  { conid: 887209791, symbol: '009825', exchange_id: 'TWSE' },
  { conid: 596991412, symbol: '015', exchange_id: 'SWB' },
  { conid: 892709861, symbol: '0156T0', exchange_id: 'KRX' },
  { conid: 887209640, symbol: '0164H0', exchange_id: 'KRX' },
];

export function parseIbkrField31(value: unknown) {
  if (value == null || value === '') {
    return { raw: null, price: null, currencyPrefix: null };
  }
  const text = String(value).trim();
  const match = text.match(/^([A-Z]{1,3})?(-?\d[\d,]*(?:\.\d+)?)$/);
  if (!match) return { raw: text, price: Number.NaN, currencyPrefix: null };
  const numeric = Number(match[2].replace(/,/g, ''));
  return {
    raw: text,
    price: Number.isFinite(numeric) ? numeric : null,
    currencyPrefix: match[1] ?? null,
  };
}

export function chunk<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

export function createIbkrClient(requestsPerSecond = 3) {
  const minGapMs = Math.ceil(1000 / requestsPerSecond);
  let nextRequestSlot = 0;
  const metrics = { requests: 0, rateLimited: 0, retries: 0 };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function throttle() {
    const now = Date.now();
    if (now < nextRequestSlot) {
      await sleep(nextRequestSlot - now);
    }
    nextRequestSlot = Math.max(Date.now(), nextRequestSlot) + minGapMs;
  }

  async function fetchSnapshot(conids: number[]) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await throttle();
      metrics.requests += 1;

      const url = `${SNAPSHOT_URL}?conids=${conids.join(',')}&fields=${FIELDS}`;
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Referer: 'https://www.interactivebrokers.com/en/trading/symbol.php',
        },
      });

      if (response.status === 429 || response.status >= 500) {
        metrics.retries += 1;
        if (response.status === 429) metrics.rateLimited += 1;
        await sleep(2000 * (attempt + 1));
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `Snapshot failed (${response.status}) for ${conids.length} conids: ${body.slice(0, 200)}`
        );
      }

      return response.json();
    }

    throw new Error(`Snapshot failed after retries (429) for ${conids.length} conids`);
  }

  async function fetchBatch(
    conids: number[],
    { preflightCount = 1, preflightWaitMs = 1000 }: { preflightCount?: number; preflightWaitMs?: number } = {}
  ) {
    for (let i = 0; i < preflightCount; i += 1) {
      await fetchSnapshot(conids);
      if (preflightWaitMs > 0) await sleep(preflightWaitMs);
    }
    return fetchSnapshot(conids);
  }

  return { fetchBatch, metrics };
}

export async function runIbkrPreflightLadder(options: {
  sample: ProbeInstrument[];
  batchSize?: number;
  runId?: string;
  runtime?: string;
  region?: string | null;
}) {
  const {
    sample,
    batchSize = 10,
    runId = crypto.randomUUID(),
    runtime = 'unknown',
    region = null,
  } = options;

  const client = createIbkrClient();
  const startedAt = new Date().toISOString();
  const byConid = new Map(sample.map((row) => [row.conid, row]));
  const state = new Map<number, LadderResultRow>(
    sample.map((row) => [
      row.conid,
      {
        conid: row.conid,
        symbol: row.symbol,
        exchange_id: row.exchange_id,
        success_step: null,
        success_step_label: null,
        last: null,
        last_raw: null,
        field_31: null,
      },
    ])
  );

  const stepSummaries: Array<Record<string, unknown>> = [];

  for (const stepConfig of LADDER_STEPS) {
    const pending = sample.filter((row) => state.get(row.conid)!.success_step == null);
    if (!pending.length) {
      stepSummaries.push({
        step: stepConfig.step,
        label: stepConfig.label,
        attempted: 0,
        newly_priced: 0,
      });
      continue;
    }

    let newlyPriced = 0;
    try {
      const batches = chunk(pending, batchSize);
      for (const batch of batches) {
        const conids = batch.map((row) => row.conid);
        const snapshots = await client.fetchBatch(conids, {
          preflightCount: stepConfig.preflightCount,
          preflightWaitMs: stepConfig.preflightWaitMs,
        });

        for (const snapshot of snapshots) {
          const instrument = byConid.get(snapshot.conid) ?? {
            conid: snapshot.conid,
            symbol: null,
            exchange_id: null,
          };
          const parsed = parseIbkrField31(snapshot['31']);
          const entry = state.get(snapshot.conid);
          if (!entry || entry.success_step != null || parsed.price == null) continue;
          entry.success_step = stepConfig.step;
          entry.success_step_label = stepConfig.label;
          entry.last = parsed.price;
          entry.last_raw = parsed.raw;
          entry.field_31 = snapshot['31'] == null ? null : String(snapshot['31']);
          newlyPriced += 1;
        }
      }
    } catch (error) {
      stepSummaries.push({
        step: stepConfig.step,
        label: stepConfig.label,
        attempted: pending.length,
        newly_priced: newlyPriced,
        error: error instanceof Error ? error.message : String(error),
      });
      break;
    }

    stepSummaries.push({
      step: stepConfig.step,
      label: stepConfig.label,
      attempted: pending.length,
      newly_priced: newlyPriced,
    });
  }

  const rows = [...state.values()];
  const byStep = { 1: 0, 2: 0, 3: 0, 4: 0, missing: 0 };
  for (const row of rows) {
    if (row.success_step == null) byStep.missing += 1;
    else byStep[row.success_step as 1 | 2 | 3 | 4] += 1;
  }

  return {
    ok: rows.some((row) => row.success_step != null),
    run_id: runId,
    probe_type: 'ibkr_preflight_ladder',
    runtime,
    region,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    sample_size: sample.length,
    batch_size: batchSize,
    steps: LADDER_STEPS,
    step_summaries: stepSummaries,
    summary: {
      total: rows.length,
      priced: rows.filter((row) => row.success_step != null).length,
      missing: rows.filter((row) => row.success_step == null).length,
      by_step: byStep,
    },
    metrics: client.metrics,
    results: rows,
  };
}

export function authorizeProbeRequest(
  probeSecret: string | undefined,
  headerSecret: string | null | undefined
) {
  if (!probeSecret) return { ok: true as const, warning: 'IBKR_PROBE_SECRET not set' };
  if (headerSecret !== probeSecret) {
    return { ok: false as const, error: 'unauthorized' };
  }
  return { ok: true as const };
}
