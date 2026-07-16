import { recalcHolding } from '../data/mockData';

export const WATCHLIST_BASE_INVESTMENT = 10_000;

const inputErrorClass = 'border-pe-negative ring-1 ring-pe-negative focus:border-pe-negative focus:ring-pe-negative';

export function fieldClass(baseClass, hasError) {
  return hasError ? `${baseClass} ${inputErrorClass}` : baseClass;
}

export function isWatchlistKind(kind) {
  return kind === 'watchlist';
}

/** Live holdings cost column: broker apps show either total invested or avg buy price. */
export const COST_MODES = {
  invested: 'invested',
  avg: 'avg',
};

export function formatCostInput(value) {
  if (value === '' || value == null) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  // Keep enough precision for avg prices without trailing noise.
  const rounded = Math.round(n * 10000) / 10000;
  return String(rounded);
}

export function avgFromInvestedQty(invested, qty) {
  const i = Number(invested);
  const q = Number(qty);
  if (!Number.isFinite(i) || !Number.isFinite(q) || q <= 0) return '';
  return formatCostInput(i / q);
}

export function investedFromAvgQty(avg, qty) {
  const a = Number(avg);
  const q = Number(qty);
  if (!Number.isFinite(a) || !Number.isFinite(q) || q <= 0) return '';
  return formatCostInput(a * q);
}

/** Keep invested ↔ avg in sync when editing live holding rows. */
export function patchLiveCostFields(row, patch, costMode = COST_MODES.invested) {
  const next = { ...row, ...patch };

  if (Object.prototype.hasOwnProperty.call(patch, 'avg')) {
    next.avg = patch.avg;
    if (next.qty !== '' && patch.avg !== '') {
      const invested = investedFromAvgQty(patch.avg, next.qty);
      if (invested !== '') next.invested = invested;
    }
    return next;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'invested')) {
    next.invested = patch.invested;
    if (next.qty !== '' && patch.invested !== '') {
      const avg = avgFromInvestedQty(patch.invested, next.qty);
      if (avg !== '') next.avg = avg;
    }
    return next;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'qty')) {
    next.qty = patch.qty;
    if (costMode === COST_MODES.avg) {
      if (next.avg !== '' && patch.qty !== '') {
        const invested = investedFromAvgQty(next.avg, patch.qty);
        if (invested !== '') next.invested = invested;
      }
    } else if (next.invested !== '' && patch.qty !== '') {
      const avg = avgFromInvestedQty(next.invested, patch.qty);
      if (avg !== '') next.avg = avg;
    }
    return next;
  }

  return next;
}

export function withSyncedAvg(row) {
  if (row.avg !== '' && row.avg != null) return row;
  const avg = avgFromInvestedQty(row.invested, row.qty);
  return avg === '' ? row : { ...row, avg };
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
    // Unmapped broker positions are retained at their average cost, which
    // deliberately starts them at zero profit/loss until a market mapping is
    // available.
    const price = asset?.price ?? avg;
    return recalcHolding({ ticker: asset?.key ?? ticker, qty, avg, price });
  });
}

function rowHasInput(row, isWatchlist) {
  if (isWatchlist) {
    return Boolean(row.ticker?.trim() || row.weight !== '' && row.weight != null);
  }
  return Boolean(row.ticker?.trim() || row.invested !== '' && row.invested != null || row.qty !== '' && row.qty != null);
}

export function validatePortfolioDraft({ kind, name, rows }) {
  const isWatchlist = isWatchlistKind(kind);
  const errors = {
    name: false,
    objective: false,
    thesis: false,
    rows: {},
  };

  if (!name.trim()) errors.name = true;

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
    completeRows.length >= 1 &&
    Object.keys(errors.rows).length === 0;

  return { valid, errors, completeRows };
}

export function portfolioHasDraftWork({ name, rows, isWatchlist }) {
  if (name.trim()) return true;
  return rows.some((row) => rowHasInput(row, isWatchlist));
}
