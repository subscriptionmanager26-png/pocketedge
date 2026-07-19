import { mergePollRowIntoIndex } from './nseIndexStream';

const POLL_MS = 30_000;

export function mapNseIndexRow(row) {
  return {
    id: row.indexSymbol || row.index,
    symbol: row.indexSymbol || row.index,
    name: row.index || row.indexSymbol,
    group: row.key ?? null,
    value: row.last != null ? Number(row.last) : null,
    change: row.variation != null ? Number(row.variation) : null,
    previousClose: row.previousClose != null ? Number(row.previousClose) : null,
    changePct: row.percentChange != null ? Number(row.percentChange) : null,
    open: row.open != null ? Number(row.open) : null,
    high: row.high != null ? Number(row.high) : null,
    low: row.low != null ? Number(row.low) : null,
    advances: row.advances != null ? Number(row.advances) : null,
    declines: row.declines != null ? Number(row.declines) : null,
    yearHigh: row.yearHigh != null ? Number(row.yearHigh) : null,
    yearLow: row.yearLow != null ? Number(row.yearLow) : null,
    change30dPct: row.perChange30d != null ? Number(row.perChange30d) : null,
    change365dPct: row.perChange365d != null ? Number(row.perChange365d) : null,
  };
}

export async function fetchLiveNseIndices() {
  const response = await fetch('/api/nse-indices');
  if (!response.ok) {
    throw new Error('Failed to fetch live indices');
  }
  const payload = await response.json();
  return (payload?.data ?? []).map(mapNseIndexRow);
}

export function mergePollRowsIntoItems(items, rows) {
  if (!items.length || !rows.length) return items;
  const rowById = new Map(rows.map((row) => [normalizeIndexKey(row.id), row]));

  return items.map((item) => {
    const polled = rowById.get(normalizeIndexKey(item.id));
    if (!polled) return item;
    return mergePollRowIntoIndex(item, polled);
  });
}

export function findPolledIndex(rows, item) {
  if (!item) return null;
  const key = normalizeIndexKey(item.id);
  return rows.find((row) => normalizeIndexKey(row.id) === key) ?? null;
}

function normalizeIndexKey(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function subscribeNseIndicesPoll(onRows) {
  let cancelled = false;
  let timer = null;

  const run = async () => {
    try {
      const rows = await fetchLiveNseIndices();
      if (!cancelled) onRows(rows);
    } catch {
      // Keep last good values when the proxy is unavailable.
    }
  };

  run();
  timer = setInterval(run, POLL_MS);

  return () => {
    cancelled = true;
    if (timer) clearInterval(timer);
  };
}
