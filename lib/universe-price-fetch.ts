import {
  chunk,
  createIbkrClient,
  LADDER_STEPS,
  parseIbkrField31,
  type ProbeInstrument,
} from './ibkr-preflight-ladder.js';
import { fetchYahooBackupBatch, type InstrumentRow, type YahooQuote } from './yahoo-backup.js';
import { getSupabaseAdminConfig, supabaseRest, type SupabaseConfig } from './supabase-admin.js';

export type FetchSlot = 'us_close' | 'overnight';

export type LadderRow = {
  conid: number;
  symbol: string | null;
  exchange_id: string | null;
  success_step: number | null;
  success_step_label: string | null;
  last: number | null;
  last_raw: string | null;
  price_source: string | null;
};

export type PriceRow = {
  conid: number;
  price: number;
  currency: string | null;
  source: string;
  exchange_id: string | null;
  yahoo_symbol: string | null;
  ibkr_reference_price: number | null;
  quote_confidence: string | null;
};

const STEPS_VERCEL = LADDER_STEPS.slice(0, 2);
const CHUNK_SIZE_DEFAULT = 200;
const BATCH_SIZE_DEFAULT = 10;
const DEADLINE_MS_DEFAULT = 240_000;

function toProbeInstrument(row: InstrumentRow): ProbeInstrument {
  return {
    conid: row.conid,
    symbol: row.symbol,
    exchange_id: row.exchange_id,
  };
}

async function runIbkrSteps(
  instruments: InstrumentRow[],
  steps: typeof LADDER_STEPS,
  batchSize: number
) {
  const client = createIbkrClient();
  const sample = instruments.map(toProbeInstrument);
  const byConid = new Map(sample.map((row) => [row.conid, row]));
  const state = new Map<number, LadderRow>(
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
        price_source: 'ibkr',
      },
    ])
  );

  const stepCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const stepConfig of steps) {
    const pending = instruments.filter((row) => state.get(row.conid)!.success_step == null);
    if (!pending.length) continue;

    const batches = chunk(pending, batchSize);
    for (const batch of batches) {
      const conids = batch.map((row) => row.conid);
      try {
        const snapshots = await client.fetchBatch(conids, {
          preflightCount: stepConfig.preflightCount,
          preflightWaitMs: stepConfig.preflightWaitMs,
        });

        for (const snapshot of snapshots) {
          const parsed = parseIbkrField31(snapshot['31']);
          const entry = state.get(snapshot.conid);
          if (!entry || entry.success_step != null || parsed.price == null || parsed.price <= 0) continue;
          entry.success_step = stepConfig.step;
          entry.success_step_label = stepConfig.label;
          entry.last = parsed.price;
          entry.last_raw = parsed.raw;
          entry.price_source = 'ibkr';
          stepCounts[stepConfig.step as 1 | 2 | 3 | 4] += 1;
        }
      } catch {
        // Continue other batches; misses may recover on later steps.
      }
    }
  }

  return { state, stepCounts, metrics: client.metrics };
}

async function runIbkrSteps34OnSupabase(
  instruments: InstrumentRow[],
  config: { supabaseUrl: string; probeSecret?: string; batchSize: number }
) {
  const body = {
    instruments: instruments.map((row) => ({
      conid: row.conid,
      symbol: row.symbol,
      exchange_id: row.exchange_id,
    })),
    batch_size: config.batchSize,
  };

  const response = await fetch(`${config.supabaseUrl}/functions/v1/ibkr-preflight-retry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.probeSecret ? { 'x-probe-secret': config.probeSecret } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    return {
      state: new Map<number, LadderRow>(),
      stepCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      error: `Supabase IBKR retry failed (${response.status})`,
    };
  }

  const data = await response.json();
  const stepCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const state = new Map<number, LadderRow>();

  for (const row of data.results ?? []) {
    if (row.success_step != null && row.last != null) {
      stepCounts[row.success_step as 1 | 2 | 3 | 4] += 1;
      state.set(row.conid, {
        conid: row.conid,
        symbol: row.symbol ?? null,
        exchange_id: row.exchange_id ?? null,
        success_step: row.success_step,
        success_step_label: row.success_step_label ?? null,
        last: row.last,
        last_raw: row.last_raw ?? null,
        price_source: 'ibkr',
      });
    }
  }

  return { state, stepCounts };
}

function mergeLadderState(base: Map<number, LadderRow>, patch: Map<number, LadderRow>) {
  for (const [conid, row] of patch) {
    if (row.success_step != null) base.set(conid, row);
  }
}

function ladderRowsToPrices(
  instruments: InstrumentRow[],
  ladder: Map<number, LadderRow>,
  yahoo: Map<number, YahooQuote>
): PriceRow[] {
  const rows: PriceRow[] = [];
  for (const inst of instruments) {
    const ibkr = ladder.get(inst.conid);
    if (ibkr?.last != null && ibkr.last > 0) {
      rows.push({
        conid: inst.conid,
        price: ibkr.last,
        currency: inst.currency,
        source: 'ibkr',
        exchange_id: inst.exchange_id,
        yahoo_symbol: null,
        ibkr_reference_price: null,
        quote_confidence: 'high',
      });
      continue;
    }
    const hit = yahoo.get(inst.conid);
    if (hit?.price != null && hit.price > 0) {
      rows.push({
        conid: inst.conid,
        price: hit.price,
        currency: hit.currency ?? inst.currency,
        source: hit.source,
        exchange_id: inst.exchange_id,
        yahoo_symbol: hit.yahoo_symbol,
        ibkr_reference_price: null,
        quote_confidence: hit.quote_confidence,
      });
    }
  }
  return rows;
}

function ladderDbRows(
  runId: string,
  instruments: InstrumentRow[],
  ladder: Map<number, LadderRow>,
  yahoo: Map<number, YahooQuote>
) {
  const rows = [];
  for (const inst of instruments) {
    const entry = ladder.get(inst.conid);
    const yhit = yahoo.get(inst.conid);
    if (yhit) {
      rows.push({
        run_id: runId,
        conid: inst.conid,
        symbol: inst.symbol,
        exchange_id: inst.exchange_id,
        success_step: 5,
        success_step_label: 'yahoo_backup',
        last_price: yhit.price,
        last_raw: null,
        price_source: yhit.source,
      });
      continue;
    }
    if (entry?.success_step != null) {
      rows.push({
        run_id: runId,
        conid: inst.conid,
        symbol: entry.symbol ?? inst.symbol,
        exchange_id: entry.exchange_id ?? inst.exchange_id,
        success_step: entry.success_step,
        success_step_label: entry.success_step_label,
        last_price: entry.last,
        last_raw: entry.last_raw,
        price_source: entry.price_source,
      });
      continue;
    }
    rows.push({
      run_id: runId,
      conid: inst.conid,
      symbol: inst.symbol,
      exchange_id: inst.exchange_id,
      success_step: null,
      success_step_label: null,
      last_price: null,
      last_raw: null,
      price_source: null,
    });
  }
  return rows;
}

export async function processInstrumentChunk(options: {
  runId: string;
  fetchSlot: FetchSlot;
  fetchedAt: string;
  instruments: InstrumentRow[];
  supabaseConfig?: SupabaseConfig;
  supabaseUrl?: string;
  probeSecret?: string;
  batchSize?: number;
}) {
  const {
    runId,
    fetchSlot,
    fetchedAt,
    instruments,
    batchSize = BATCH_SIZE_DEFAULT,
    probeSecret = process.env.IBKR_PROBE_SECRET,
  } = options;

  const supabaseConfig = options.supabaseConfig ?? getSupabaseAdminConfig();
  const supabaseUrl = options.supabaseUrl ?? supabaseConfig.url;

  const ladder = new Map<number, LadderRow>(
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
        price_source: null,
      },
    ])
  );

  const totals = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  const vercel = await runIbkrSteps(instruments, STEPS_VERCEL, batchSize);
  mergeLadderState(ladder, vercel.state);
  totals[1] += vercel.stepCounts[1];
  totals[2] += vercel.stepCounts[2];

  const missesAfter12 = instruments.filter((row) => ladder.get(row.conid)?.success_step == null);
  if (missesAfter12.length) {
    const supa = await runIbkrSteps34OnSupabase(missesAfter12, {
      supabaseUrl,
      probeSecret,
      batchSize,
    });
    mergeLadderState(ladder, supa.state);
    totals[3] += supa.stepCounts[3];
    totals[4] += supa.stepCounts[4];
  }

  const missesAfterIbkr = instruments.filter((row) => ladder.get(row.conid)?.success_step == null);
  const yahooCandidates = missesAfterIbkr.filter(
    (row) => row.yahoo_symbol || ['NASDAQ', 'NYSE', 'ARCA', 'OTCLNKECN', 'OTC'].includes(row.exchange_id ?? '')
  );
  const yahoo = yahooCandidates.length
    ? await fetchYahooBackupBatch(yahooCandidates)
    : new Map<number, YahooQuote>();
  totals[5] = yahoo.size;

  const priceRows = ladderRowsToPrices(instruments, ladder, yahoo);
  const ladderRows = ladderDbRows(runId, instruments, ladder, yahoo);

  const pricesTable = supabaseRest('instrument_prices', supabaseConfig);
  const historyTable = supabaseRest('instrument_price_history', supabaseConfig);
  const ladderTable = supabaseRest('ibkr_fetch_ladder_results', supabaseConfig);

  await pricesTable.upsert(
    priceRows.map((r) => ({
      conid: r.conid,
      price: r.price,
      currency: r.currency,
      source: r.source,
      exchange_id: r.exchange_id,
      yahoo_symbol: r.yahoo_symbol,
      ibkr_reference_price: r.ibkr_reference_price,
      quote_confidence: r.quote_confidence,
      fetched_at: fetchedAt,
      updated_at: fetchedAt,
    })),
    'conid'
  );

  await historyTable.insert(
    priceRows.map((r) => ({
      conid: r.conid,
      price: r.price,
      currency: r.currency,
      source: r.source,
      exchange_id: r.exchange_id,
      yahoo_symbol: r.yahoo_symbol,
      ibkr_reference_price: r.ibkr_reference_price,
      quote_confidence: r.quote_confidence,
      fetch_slot: fetchSlot,
      fetched_at: fetchedAt,
    }))
  );

  if (ladderRows.length) {
    await ladderTable.upsert(ladderRows, 'run_id,conid');
  }

  const ibkrCount = priceRows.filter((r) => r.source === 'ibkr').length;
  const yahooCount = priceRows.filter((r) => r.source === 'yahoo').length;
  const finraCount = priceRows.filter((r) => r.source === 'finra').length;

  return {
    processed: instruments.length,
    priced: priceRows.length,
    missing: instruments.length - priceRows.length,
    ibkrCount,
    yahooCount,
    finraCount,
    stepCounts: totals,
  };
}

export async function runUniversePriceFetch(options: {
  fetchSlot: FetchSlot;
  runId?: string;
  chunkOffset?: number;
  chunkSize?: number;
  deadlineMs?: number;
  continuationBaseUrl?: string;
  limit?: number;
}) {
  const startedAt = Date.now();
  const fetchedAt = new Date().toISOString();
  const {
    fetchSlot,
    chunkOffset = 0,
    deadlineMs = DEADLINE_MS_DEFAULT,
    continuationBaseUrl,
    limit,
  } = options;

  const chunkSize =
    options.chunkSize ??
    (limit != null && limit > 0 && limit <= 100 ? Math.min(10, limit) : CHUNK_SIZE_DEFAULT);

  const config = getSupabaseAdminConfig();
  const db = supabaseRest('universe_price_fetch_runs', config);
  const rpc = supabaseRest('instrument_prices', config);

  const universeCount = await rpc.rpc<number>('count_universe_instruments_for_price_fetch');
  const universeSize =
    options.limit != null && options.limit > 0
      ? Math.min(universeCount, options.limit)
      : universeCount;

  let runId = options.runId;
  let runRecord: Record<string, unknown>;
  let aggregate = {
    processed: 0,
    priced: 0,
    missing: 0,
    ibkrCount: 0,
    yahooCount: 0,
    finraCount: 0,
    stepCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };

  if (!runId) {
    runRecord = await db.insertReturning({
      fetch_slot: fetchSlot,
      fetched_at: fetchedAt,
      universe_size: universeSize,
      status: 'running',
      chunk_offset: 0,
      chunk_size: chunkSize,
      processed_count: 0,
      runtime: 'vercel',
    });
    runId = String(runRecord.id);
  } else {
    runRecord = { id: runId };
    const existing = await db.selectOne<{
      processed_count: number;
      ibkr_priced: number;
      yahoo_priced: number;
      finra_priced: number;
      missing: number;
      ibkr_step_1: number;
      ibkr_step_2: number;
      ibkr_step_3: number;
      ibkr_step_4: number;
      yahoo_backup: number;
    }>({ id: `eq.${runId}` });
    if (existing) {
      aggregate = {
        processed: existing.processed_count ?? chunkOffset,
        priced:
          (existing.ibkr_priced ?? 0) +
          (existing.yahoo_priced ?? 0) +
          (existing.finra_priced ?? 0),
        missing: existing.missing ?? 0,
        ibkrCount: existing.ibkr_priced ?? 0,
        yahooCount: existing.yahoo_priced ?? 0,
        finraCount: existing.finra_priced ?? 0,
        stepCounts: {
          1: existing.ibkr_step_1 ?? 0,
          2: existing.ibkr_step_2 ?? 0,
          3: existing.ibkr_step_3 ?? 0,
          4: existing.ibkr_step_4 ?? 0,
          5: existing.yahoo_backup ?? 0,
        },
      };
    }
  }

  let offset = chunkOffset;

  while (offset < universeSize && Date.now() - startedAt < deadlineMs) {
    const instruments = await rpc.rpc<InstrumentRow[]>(
      'list_universe_instruments_for_price_fetch',
      { p_offset: offset, p_limit: chunkSize }
    );

    if (!instruments.length) break;

    const chunkResult = await processInstrumentChunk({
      runId: runId!,
      fetchSlot,
      fetchedAt,
      instruments,
    });

    offset += instruments.length;
    aggregate.processed += chunkResult.processed;
    aggregate.priced += chunkResult.priced;
    aggregate.missing += chunkResult.missing;
    aggregate.ibkrCount += chunkResult.ibkrCount;
    aggregate.yahooCount += chunkResult.yahooCount;
    aggregate.finraCount += chunkResult.finraCount;
    for (const key of [1, 2, 3, 4, 5] as const) {
      aggregate.stepCounts[key] += chunkResult.stepCounts[key];
    }

    await db.update(
      { id: `eq.${runId}` },
      {
        chunk_offset: offset,
        processed_count: offset,
        ibkr_priced: aggregate.ibkrCount,
        yahoo_priced: aggregate.yahooCount,
        finra_priced: aggregate.finraCount,
        missing: universeSize - aggregate.priced,
        ibkr_step_1: aggregate.stepCounts[1],
        ibkr_step_2: aggregate.stepCounts[2],
        ibkr_step_3: aggregate.stepCounts[3],
        ibkr_step_4: aggregate.stepCounts[4],
        yahoo_backup: aggregate.stepCounts[5],
      }
    );
  }

  const completed = offset >= universeSize;
  let continuationUrl: string | undefined;
  if (completed) {
    await db.update(
      { id: `eq.${runId}` },
      {
        status: 'completed',
        duration_ms: Date.now() - startedAt,
        missing: universeSize - aggregate.priced,
      }
    );
  } else if (continuationBaseUrl) {
    continuationUrl = `${continuationBaseUrl}?slot=${fetchSlot}&run_id=${runId}&offset=${offset}`;
  }

  return {
    ok: true,
    run_id: runId,
    fetch_slot: fetchSlot,
    universe_size: universeSize,
    processed_offset: offset,
    completed,
    continuation_url: continuationUrl,
    ...aggregate,
    duration_ms: Date.now() - startedAt,
  };
}

export function detectFetchSlot(date = new Date()): FetchSlot {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    }).format(date)
  );
  return hour >= 12 ? 'us_close' : 'overnight';
}
