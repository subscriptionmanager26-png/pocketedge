/**
 * Dead client helpers removed from production on 2026-07-19.
 * Paste back into the noted files if needed.
 */

// --- src/lib/portfolioForm.js (after mapDmaRegimeToForm) ---
/** @deprecated Prefer mapDmaRegimeToForm - kept for any leftover callers. */
export function classifySecurityForm({ price, ma50, ma200 }) {
  const close = Number(price);
  const dma50 = Number(ma50);
  const dma200 = Number(ma200);

  if (
    !Number.isFinite(close) ||
    !Number.isFinite(dma50) ||
    !Number.isFinite(dma200)
  ) {
    return 'unsure';
  }

  if (close > dma50 && close > dma200) return 'in_form';
  if (close < dma50 && close < dma200) return 'out_of_form';
  return 'unsure';
}

// --- src/lib/stockNewsApi.js (after fetchStockExplanations) ---
export async function fetchLatestStockExplanation(ticker) {
  const symbol = normalizeTicker(ticker);
  if (!symbol || !stockNewsClient) return null;

  const { data, error } = await stockNewsClient
    .from('mn_daily_stock_explanations')
    .select('as_of_date, status, explanation, confidence, generated_at')
    .eq('ticker', symbol)
    .order('as_of_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('fetchLatestStockExplanation failed', error);
    return null;
  }
  return data ?? null;
}
