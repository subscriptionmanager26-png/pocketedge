import { fetchDmaSignalsByTicker } from '../../lib/portfolioForm';

export async function analyzeHoldings(holdings) {
  const tickers = holdings.map((h) => h.ticker);
  const signals = await fetchDmaSignalsByTicker(tickers);

  return holdings.map((holding) => {
    const ticker = String(holding.ticker ?? '')
      .trim()
      .toUpperCase()
      .replace(/\.NS$/i, '');
    const signal = signals[ticker];
    const price = Number.isFinite(signal?.price)
      ? signal.price
      : holding.price ?? holding.avg;
    const form = signal?.form ?? 'unsure';
    const invested = holding.qty * holding.avg;
    const value = holding.qty * (price ?? holding.avg);

    return {
      ...holding,
      ticker,
      price: price ?? holding.avg,
      ma50: signal?.ma50 ?? null,
      ma200: signal?.ma200 ?? null,
      regime: signal?.regime ?? null,
      asOfDate: signal?.asOfDate ?? null,
      form,
      invested,
      value,
      pnl: value - invested,
      pnlPct: invested ? ((value - invested) / invested) * 100 : 0,
    };
  });
}

export function summarizeAnalysis(rows) {
  const mapped = rows.filter((r) => !r.unmapped);
  const unmapped = rows.filter((r) => r.unmapped);
  const buckets = {
    in_form: mapped.filter((r) => r.form === 'in_form'),
    out_of_form: mapped.filter((r) => r.form === 'out_of_form'),
    unsure: mapped.filter((r) => r.form === 'unsure'),
    unmapped,
  };
  const totalValue = mapped.reduce((sum, r) => sum + r.value, 0);
  const totalInvested = rows.reduce((sum, r) => sum + r.invested, 0);
  const inFormValue = buckets.in_form.reduce((sum, r) => sum + r.value, 0);
  const offTrackValue = buckets.out_of_form.reduce((sum, r) => sum + r.value, 0);

  let headline = 'Mixed signals';
  if (mapped.length && totalValue > 0 && inFormValue / totalValue >= 0.65) {
    headline = 'Mostly in form';
  } else if (mapped.length && totalValue > 0 && offTrackValue / totalValue >= 0.5) {
    headline = 'Under pressure';
  } else if (!mapped.length && unmapped.length) {
    headline = 'Needs mapping';
  } else if (buckets.unsure.length === mapped.length && mapped.length) {
    headline = 'Mostly neutral';
  }

  return {
    buckets,
    totalValue,
    totalInvested,
    pnlPct: totalInvested ? ((totalValue - totalInvested) / totalInvested) * 100 : 0,
    inFormShare: totalValue ? (inFormValue / totalValue) * 100 : 0,
    offTrackShare: totalValue ? (offTrackValue / totalValue) * 100 : 0,
    unmappedCount: unmapped.length,
    headline,
  };
}
