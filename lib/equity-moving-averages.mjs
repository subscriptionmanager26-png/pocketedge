/**
 * Fetch Yahoo daily closes and compute SMA50 / SMA200 for NSE equity symbols.
 * @param {string} symbol - NSE ticker without exchange suffix
 */
export async function fetchYahooMovingAverages(symbol) {
  const ticker = String(symbol ?? '')
    .trim()
    .toUpperCase();
  if (!ticker || !/^[A-Z0-9&.-]+$/.test(ticker)) {
    return null;
  }

  // Mutual-fund scheme codes are numeric — skip Yahoo.
  if (/^\d+$/.test(ticker)) return null;

  const yahooSymbol = `${ticker}.NS`;
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`);
  url.searchParams.set('range', '1y');
  url.searchParams.set('interval', '1d');
  url.searchParams.set('events', 'history');

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PocketEdge/1.0)',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo chart failed for ${yahooSymbol} (${response.status})`);
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter(
    (value) => typeof value === 'number' && Number.isFinite(value)
  );

  if (!closes.length) return null;

  const price = closes[closes.length - 1];
  const ma50 = simpleMovingAverage(closes, 50);
  const ma200 = simpleMovingAverage(closes, 200);

  return {
    symbol: ticker,
    price,
    ma50,
    ma200,
  };
}

function simpleMovingAverage(values, window) {
  if (!values.length || values.length < window) return null;
  let sum = 0;
  for (let i = values.length - window; i < values.length; i += 1) {
    sum += values[i];
  }
  return sum / window;
}

export async function fetchMovingAveragesForSymbols(symbols, { concurrency = 4 } = {}) {
  const unique = [
    ...new Set(
      (symbols ?? [])
        .map((value) => String(value ?? '').trim().toUpperCase())
        .filter(Boolean)
    ),
  ].slice(0, 40);

  const results = {};
  let index = 0;

  async function worker() {
    while (index < unique.length) {
      const current = unique[index];
      index += 1;
      try {
        results[current] = await fetchYahooMovingAverages(current);
      } catch {
        results[current] = null;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, unique.length) }, () => worker())
  );

  return results;
}
