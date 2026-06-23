/**
 * IBKR field-31 snapshot fetch with configurable preflight.
 */

const SNAPSHOT_URL =
  'https://www.interactivebrokers.com/portal.proxy/v1/mkt/iserver/marketdata/snapshot';
const FIELDS = '31';
const DEFAULT_REQUESTS_PER_SECOND = 3;
const MAX_RETRIES = 4;

let nextRequestSlot = 0;

export function createIbkrSnapshotClient(options = {}) {
  const requestsPerSecond = options.requestsPerSecond ?? DEFAULT_REQUESTS_PER_SECOND;
  const minGapMs = Math.ceil(1000 / requestsPerSecond);
  const metrics = { requests: 0, rateLimited: 0, retries: 0 };

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function throttle() {
    const now = Date.now();
    if (now < nextRequestSlot) {
      await sleep(nextRequestSlot - now);
    }
    nextRequestSlot = Math.max(Date.now(), nextRequestSlot) + minGapMs;
  }

  async function fetchSnapshot(conids) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
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
        const backoff = 2000 * (attempt + 1);
        await sleep(backoff);
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

    throw new Error(`Snapshot failed after ${MAX_RETRIES} retries (429) for ${conids.length} conids`);
  }

  async function fetchBatch(conids, { preflightCount = 1, preflightWaitMs = 1000 } = {}) {
    for (let i = 0; i < preflightCount; i += 1) {
      await fetchSnapshot(conids);
      if (preflightWaitMs > 0) {
        await sleep(preflightWaitMs);
      }
    }
    return fetchSnapshot(conids);
  }

  return { fetchSnapshot, fetchBatch, metrics, sleep };
}

export function parseIbkrField31(value) {
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

export function chunk(items, size) {
  const batches = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}
