/**
 * Yahoo / FINRA backup quotes for universe price fetch (step 5).
 */

const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchYahooChart(symbol) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const host = YAHOO_HOSTS[attempt % YAHOO_HOSTS.length];
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d&includePrePost=true`;
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 429) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!response.ok) return null;
      const data = await response.json();
      const result = data?.chart?.result?.[0];
      if (!result) return null;
      const closes = result.indicators?.quote?.[0]?.close?.filter((v) => v != null) ?? [];
      const price = closes.at(-1) ?? result.meta?.regularMarketPrice;
      if (price == null || Number(price) <= 0) return null;
      return {
        yahoo_symbol: symbol,
        price: Number(price),
        currency: result.meta?.currency ?? null,
        source: 'yahoo',
        quote_confidence: 'low',
      };
    } catch {
      await sleep(1000 * (attempt + 1));
    }
  }
  return null;
}

async function fetchFinraOtc(symbol) {
  try {
    const url =
      `https://api.finra.org/data/group/otcMarket/name/otcSecurities?limit=1` +
      `&fields=issueSymbolIdentifier,lastSalePrice,updatedDateTime` +
      `&issueSymbolIdentifier=${encodeURIComponent(symbol)}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const row = Array.isArray(data) ? data[0] : data?.results?.[0] ?? data?.[0];
    const price = row?.lastSalePrice != null ? Number(row.lastSalePrice) : null;
    if (price == null || price <= 0) return null;
    return {
      yahoo_symbol: symbol,
      price,
      currency: 'USD',
      source: 'finra',
      quote_confidence: 'low',
    };
  } catch {
    return null;
  }
}

function guessYahooSymbol(inst) {
  if (inst.yahoo_symbol) return inst.yahoo_symbol;
  const ex = inst.exchange_id ?? '';
  const sym = inst.symbol;
  if (!sym) return null;
  if (['OTCLNKECN', 'OTC'].includes(ex)) return sym;
  if (ex === 'NASDAQ' || ex === 'NYSE' || ex === 'ARCA') return sym;
  return null;
}

export async function fetchYahooBackupQuote(inst) {
  const symbol = guessYahooSymbol(inst);
  if (!symbol) return null;

  const yahoo = await fetchYahooChart(symbol);
  if (yahoo) return yahoo;

  if (['OTCLNKECN', 'OTC'].includes(inst.exchange_id ?? '')) {
    return fetchFinraOtc(symbol);
  }

  return null;
}

export async function fetchYahooBackupBatch(instruments, { onProgress, concurrency = 10 } = {}) {
  const quotes = new Map();
  let done = 0;

  async function worker(queue) {
    while (queue.length) {
      const inst = queue.shift();
      if (!inst) break;
      const hit = await fetchYahooBackupQuote(inst);
      if (hit) quotes.set(inst.conid, hit);
      done += 1;
      onProgress?.(done, instruments.length, quotes.size);
      await sleep(50);
    }
  }

  const queue = [...instruments];
  const workers = Array.from(
    { length: Math.min(concurrency, instruments.length) },
    () => worker(queue),
  );
  await Promise.all(workers);
  return quotes;
}
