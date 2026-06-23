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
    if (now < nextRequestSlot) await sleep(nextRequestSlot - now);
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
        throw new Error(`Snapshot failed (${response.status}): ${body.slice(0, 200)}`);
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

export function authorizeProbeRequest(
  probeSecret: string | undefined,
  headerSecret: string | null | undefined
) {
  if (!probeSecret) return { ok: true as const, warning: 'IBKR_PROBE_SECRET not set' };
  if (headerSecret !== probeSecret) return { ok: false as const, error: 'unauthorized' };
  return { ok: true as const };
}
