import { classifySecurityForm } from '../../lib/portfolioForm';

const FIXTURE_MAS = {
  RELIANCE: { price: 2980, ma50: 2850, ma200: 2720 },
  TCS: { price: 3920, ma50: 4010, ma200: 4100 },
  INFY: { price: 1850, ma50: 1780, ma200: 1690 },
  HDFCBANK: { price: 1720, ma50: 1750, ma200: 1680 },
  ITC: { price: 430, ma50: 445, ma200: 460 },
  SBIN: { price: 820, ma50: 790, ma200: 750 },
  WIPRO: { price: 265, ma50: 275, ma200: 290 },
  AXISBANK: { price: 1180, ma50: 1120, ma200: 1080 },
  BHARTIARTL: { price: 1650, ma50: 1580, ma200: 1490 },
  TATAMOTORS: { price: 720, ma50: 760, ma200: 790 },
};

export async function analyzeHoldings(holdings) {
  const tickers = holdings.map((h) => h.ticker);
  let bySymbol = {};

  try {
    const response = await fetch(
      `/api/equity-moving-averages?symbols=${encodeURIComponent(tickers.join(','))}`
    );
    if (response.ok) {
      const payload = await response.json();
      bySymbol = payload?.bySymbol ?? {};
    }
  } catch {
    // fixtures below
  }

  return holdings.map((holding) => {
    const live = bySymbol[holding.ticker];
    const mas =
      live?.price != null
        ? live
        : FIXTURE_MAS[holding.ticker] ?? {
            price: holding.price ?? holding.avg,
            ma50: null,
            ma200: null,
          };
    const form = classifySecurityForm(mas);
    const invested = holding.qty * holding.avg;
    const value = holding.qty * (mas.price ?? holding.avg);
    return {
      ...holding,
      price: mas.price ?? holding.avg,
      ma50: mas.ma50,
      ma200: mas.ma200,
      form,
      invested,
      value,
      pnl: value - invested,
      pnlPct: invested ? ((value - invested) / invested) * 100 : 0,
    };
  });
}

export function summarizeAnalysis(rows) {
  const buckets = {
    in_form: rows.filter((r) => r.form === 'in_form'),
    out_of_form: rows.filter((r) => r.form === 'out_of_form'),
    unsure: rows.filter((r) => r.form === 'unsure'),
  };
  const totalValue = rows.reduce((sum, r) => sum + r.value, 0);
  const totalInvested = rows.reduce((sum, r) => sum + r.invested, 0);
  const inFormValue = buckets.in_form.reduce((sum, r) => sum + r.value, 0);
  const offTrackValue = buckets.out_of_form.reduce((sum, r) => sum + r.value, 0);

  let headline = 'Mixed signals';
  let detail =
    'Some names are riding the trend, others need a closer look. Start with Off Track weights.';

  if (rows.length && totalValue > 0 && inFormValue / totalValue >= 0.65) {
    headline = 'Mostly in form';
    detail =
      'A large share of your portfolio is trading above both 50 and 200 day averages.';
  } else if (rows.length && totalValue > 0 && offTrackValue / totalValue >= 0.5) {
    headline = 'Under pressure';
    detail =
      'Over half of your portfolio value sits below both moving averages. Review those names first.';
  } else if (buckets.unsure.length === rows.length) {
    headline = 'Need clearer data';
    detail =
      'We could not classify every holding yet. Search for NSE tickers or try again shortly.';
  }

  return {
    buckets,
    totalValue,
    totalInvested,
    pnlPct: totalInvested ? ((totalValue - totalInvested) / totalInvested) * 100 : 0,
    inFormShare: totalValue ? (inFormValue / totalValue) * 100 : 0,
    offTrackShare: totalValue ? (offTrackValue / totalValue) * 100 : 0,
    headline,
    detail,
  };
}
