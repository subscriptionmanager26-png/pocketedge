import { mergePollRowIntoEquity, equityItemSymbol } from './nseEquityStream';

export const STOCKS_POLL_MS = 30 * 60 * 1000;

export function mapNseStockTradedRow(row) {
  return {
    symbol: row.symbol,
    price: row.lastPrice != null ? Number(row.lastPrice) : null,
    changePct: row.pchange != null ? Number(row.pchange) : null,
    change: row.change != null ? Number(row.change) : null,
    previousClose: row.previousClose != null ? Number(row.previousClose) : null,
    segment: row.series ?? null,
  };
}

export async function fetchLiveNseStocksTraded() {
  const response = await fetch('/api/nse-stocks-traded');
  if (!response.ok) {
    throw new Error('Failed to fetch live stocks traded');
  }
  const payload = await response.json();
  const rows = payload?.total?.data ?? payload?.data ?? [];
  return rows.map(mapNseStockTradedRow);
}

export function mergePollRowsIntoEquityItems(items, rows) {
  if (!items.length || !rows.length) return items;
  const rowBySymbol = new Map(
    rows.map((row) => [normalizeSymbol(row.symbol), row]),
  );

  return items.map((item) => {
    const polled = rowBySymbol.get(normalizeSymbol(equityItemSymbol(item)));
    if (!polled) return item;
    return mergePollRowIntoEquity(item, polled);
  });
}

export function findPolledEquity(rows, item) {
  const itemSymbol = equityItemSymbol(item);
  if (!itemSymbol) return null;
  const key = normalizeSymbol(itemSymbol);
  return rows.find((row) => normalizeSymbol(row.symbol) === key) ?? null;
}

function normalizeSymbol(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9&-]/g, '');
}

export function subscribeNseStocksPoll(onRows) {
  let cancelled = false;
  let timer = null;

  const run = async () => {
    try {
      const rows = await fetchLiveNseStocksTraded();
      if (!cancelled) onRows(rows);
    } catch {
      // Keep last good values when the proxy is unavailable.
    }
  };

  run();
  timer = setInterval(run, STOCKS_POLL_MS);

  return () => {
    cancelled = true;
    if (timer) clearInterval(timer);
  };
}
