import { recalcHolding } from '../data/mockData';

export const WATCHLIST_BASE_INVESTMENT = 10_000;

const inputErrorClass = 'border-pe-negative ring-1 ring-pe-negative focus:border-pe-negative focus:ring-pe-negative';

export function fieldClass(baseClass, hasError) {
  return hasError ? `${baseClass} ${inputErrorClass}` : baseClass;
}

export function isWatchlistKind(kind) {
  return kind === 'watchlist';
}

export function buildWatchlistHoldings(rows, assetsByKey = new Map()) {
  return rows.map((row) => {
    const ticker = row.ticker.trim();
    const asset = assetsByKey.get(ticker);
    const weightPct = Number(row.weight) || 0;
    const price = asset?.price ?? 0;
    const invested = WATCHLIST_BASE_INVESTMENT * (weightPct / 100);
    const qty = price > 0 ? invested / price : 0;
    return recalcHolding({ ticker: asset?.key ?? ticker, qty, avg: price, price, weightPct });
  });
}

export function buildLiveHoldings(rows, assetsByKey = new Map()) {
  return rows.map((row) => {
    const ticker = row.ticker.trim();
    const asset = assetsByKey.get(ticker);
    const qty = Number(row.qty) || 0;
    const invested = Number(row.invested) || 0;
    const avg = qty > 0 ? invested / qty : 0;
    const price = asset?.price ?? 0;
    return recalcHolding({ ticker: asset?.key ?? ticker, qty, avg, price });
  });
}

function rowHasInput(row, isWatchlist) {
  if (isWatchlist) {
    return Boolean(row.ticker?.trim() || row.weight !== '' && row.weight != null);
  }
  return Boolean(row.ticker?.trim() || row.invested !== '' && row.invested != null || row.qty !== '' && row.qty != null);
}

export function validatePortfolioDraft({ kind, name, objective, thesis, rows }) {
  const isWatchlist = isWatchlistKind(kind);
  const errors = {
    name: false,
    objective: false,
    thesis: false,
    rows: {},
  };

  if (!name.trim()) errors.name = true;
  if (!objective.trim()) errors.objective = true;
  if (!thesis.trim()) errors.thesis = true;

  const completeRows = [];

  for (const row of rows) {
    if (!rowHasInput(row, isWatchlist)) continue;

    const rowErrors = {};
    const ticker = row.ticker.trim();

    if (!ticker) rowErrors.ticker = true;

    if (isWatchlist) {
      const weight = Number(row.weight);
      if (row.weight === '' || Number.isNaN(weight) || weight <= 0) rowErrors.weight = true;
    } else {
      const invested = Number(row.invested);
      const qty = Number(row.qty);
      if (row.invested === '' || Number.isNaN(invested) || invested < 0) rowErrors.invested = true;
      if (row.qty === '' || Number.isNaN(qty) || qty <= 0) rowErrors.qty = true;
    }

    if (Object.keys(rowErrors).length) {
      errors.rows[row.id] = rowErrors;
    } else {
      completeRows.push(row);
    }
  }

  if (completeRows.length < 1) {
    const fallbackRow = rows[0];
    if (fallbackRow) {
      errors.rows[fallbackRow.id] = {
        ticker: true,
        ...(isWatchlist ? { weight: true } : { invested: true, qty: true }),
      };
    }
  } else {
    const seenTickers = new Map();
    for (const row of completeRows) {
      const ticker = row.ticker.trim();
      const prior = seenTickers.get(ticker);
      if (prior) {
        errors.rows[row.id] = { ...(errors.rows[row.id] ?? {}), ticker: true };
        errors.rows[prior] = { ...(errors.rows[prior] ?? {}), ticker: true };
      } else {
        seenTickers.set(ticker, row.id);
      }
    }
  }

  if (completeRows.length >= 1 && isWatchlist) {
    const totalWeight = completeRows.reduce((sum, row) => sum + (Number(row.weight) || 0), 0);
    if (Math.abs(totalWeight - 100) > 0.5) {
      for (const row of completeRows) {
        errors.rows[row.id] = { ...(errors.rows[row.id] ?? {}), weight: true };
      }
    }
  }

  const valid =
    !errors.name &&
    !errors.objective &&
    !errors.thesis &&
    completeRows.length >= 1 &&
    Object.keys(errors.rows).length === 0;

  return { valid, errors, completeRows };
}

export function portfolioHasDraftWork({ name, objective, thesis, rows, isWatchlist }) {
  if (name.trim() || objective.trim() || thesis.trim()) return true;
  return rows.some((row) => rowHasInput(row, isWatchlist));
}
