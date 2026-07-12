/** Form regime from last close vs 50 / 200 DMA. */
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

export const FORM_META = {
  in_form: {
    id: 'in_form',
    label: 'In form',
    shortLabel: 'In form',
  },
  out_of_form: {
    id: 'out_of_form',
    label: 'Off Track',
    shortLabel: 'Off Track',
  },
  unsure: {
    id: 'unsure',
    label: 'Unsure',
    shortLabel: 'Unsure',
  },
};

const cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function fetchPortfolioFormByTicker(tickers) {
  const unique = [
    ...new Set(
      (tickers ?? [])
        .map((value) => String(value ?? '').trim().toUpperCase())
        .filter(Boolean)
    ),
  ];

  if (!unique.length) return {};

  const now = Date.now();
  const missing = [];
  const byTicker = {};

  for (const ticker of unique) {
    const cached = cache.get(ticker);
    if (cached && now - cached.at < CACHE_TTL_MS) {
      byTicker[ticker] = cached.form;
    } else {
      missing.push(ticker);
    }
  }

  if (!missing.length) return byTicker;

  try {
    const response = await fetch(
      `/api/equity-moving-averages?symbols=${encodeURIComponent(missing.join(','))}`
    );
    if (!response.ok) throw new Error('Moving averages request failed');
    const payload = await response.json();
    const rows = payload?.bySymbol ?? {};

    for (const ticker of missing) {
      const row = rows[ticker];
      const form = classifySecurityForm({
        price: row?.price,
        ma50: row?.ma50,
        ma200: row?.ma200,
      });
      cache.set(ticker, { form, at: now });
      byTicker[ticker] = form;
    }
  } catch {
    for (const ticker of missing) {
      byTicker[ticker] = 'unsure';
      cache.set(ticker, { form: 'unsure', at: now });
    }
  }

  return byTicker;
}
