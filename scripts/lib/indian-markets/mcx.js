import { UA } from './constants.js';

export async function fetchMcxSpotPrices() {
  const home = await fetch('https://www.mcxindia.com/market-data/spot-market-price', {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  const cookie = (home.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(';')[0])
    .join('; ');

  const res = await fetch('https://www.mcxindia.com/GetSpotMarketPrice?culture=en', {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      Cookie: cookie,
      Referer: 'https://www.mcxindia.com/market-data/spot-market-price',
    },
  });

  if (!res.ok) {
    throw new Error(`MCX spot fetch failed: ${res.status}`);
  }

  const payload = await res.json();
  const asOn = payload?.Data?.Summary?.AsOn ?? null;

  const items = (payload?.Data?.Data ?? []).map((row) => ({
    id: row.enSymbol || row.symbol,
    name: row.enSymbol || row.symbol,
    symbol: row.symbol,
    unit: row.unit ?? null,
    location: row.enlocation || row.location || null,
    spotPrice: row.todaysSpotPrice != null ? Number(row.todaysSpotPrice) : null,
    change: row.change != null ? Number(row.change) : null,
    date: row.FormattedDate ?? null,
    time: row.FormattedTime ?? null,
  }));

  return { asOn, items };
}
