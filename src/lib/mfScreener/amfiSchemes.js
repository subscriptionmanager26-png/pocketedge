/** Load equity Direct Growth scheme list from the static JSON snapshot. */

let cache = null;
let loadPromise = null;

const LIST_URL = '/data/screener/amfi-equity-direct-growth.json';

export async function loadAmfiEquityDirectGrowth() {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = (async () => {
      const res = await fetch(LIST_URL);
      if (!res.ok) throw new Error(`Failed to load fund list (${res.status})`);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Failed to load fund list (unexpected response)');
      }
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('Fund list is empty');
      }
      cache = rows
        .filter((r) => r?.amfiCode && /^\d+$/.test(String(r.amfiCode)))
        .map((r) => ({
          amfiCode: String(r.amfiCode).trim(),
          isin: String(r.isin ?? '').trim(),
          name: String(r.name ?? '').trim(),
          category: String(r.category ?? '').trim(),
          subCategory: String(r.subCategory ?? '').trim(),
          amc: String(r.amc ?? '').trim(),
          plan: r.plan === 'Direct' ? 'Direct' : 'Regular',
          payout: r.payout === 'Growth' ? 'Growth' : 'IDCW',
        }));
      return cache;
    })();
  }
  return loadPromise;
}

export function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
