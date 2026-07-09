import { getSupabaseAdminConfig, supabaseRest, type SupabaseConfig } from './supabase-admin.js';

export function normalizeCurrencyCode(currency: string | null | undefined): string {
  const raw = String(currency || 'USD').trim();
  const upper = raw.toUpperCase();
  if (upper === 'GBX' || raw === 'GBp') return 'GBP';
  return upper;
}

export function fxRateForCurrency(
  currency: string | null | undefined,
  rates: Record<string, number> = {}
): number | null {
  const code = normalizeCurrencyCode(currency);
  if (code === 'USD') return 1;
  const rate = rates[code];
  return rate != null && Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function attachFxRateFields<T extends { currency?: string | null }>(
  row: T,
  rates: Record<string, number> = {}
): T & { fx_rate_to_usd: number | null } {
  return {
    ...row,
    fx_rate_to_usd: fxRateForCurrency(row.currency, rates),
  };
}

export function attachFxRateToPriceRows<T extends { currency?: string | null }>(
  rows: T[],
  rates: Record<string, number> = {}
) {
  return rows.map((row) => attachFxRateFields(row, rates));
}

export function ratesMapFromDbRows(rows: Array<{ currency?: string; rate_to_usd?: number }>) {
  const rates: Record<string, number> = { USD: 1 };
  for (const row of rows || []) {
    if (row.currency && row.rate_to_usd != null) {
      rates[row.currency] = Number(row.rate_to_usd);
    }
  }
  return rates;
}

export async function loadFxRatesFromDb(config: SupabaseConfig = getSupabaseAdminConfig()) {
  const { url, key } = config;
  const response = await fetch(`${url}/rest/v1/fx_rates_to_usd?select=currency,rate_to_usd`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) {
    return { USD: 1 };
  }
  return ratesMapFromDbRows(await response.json());
}

export async function refreshFxRatesInDb(config: SupabaseConfig = getSupabaseAdminConfig()) {
  const fetchedAt = new Date().toISOString();
  const rates = await loadFxRatesFromDb(config);
  const rows = Object.entries(rates)
    .filter(([, rate]) => Number.isFinite(rate) && rate > 0)
    .map(([currency, rate_to_usd]) => ({
      currency,
      rate_to_usd,
      source: 'live_snapshot',
      fetched_at: fetchedAt,
    }));

  if (rows.length) {
    const historyTable = supabaseRest('fx_rates_history', config);
    await historyTable.insert(rows);
  }

  return { rates, fetchedAt };
}
