import { recalcHolding } from '../data/mockData';
import { holderFirstName } from './assetHoldersApi';

export const WATCHLIST_BASE_INVESTMENT = 10_000;
/** Max length for any portfolio / watchlist display name (incl. spaces). */
export const PORTFOLIO_NAME_MAX_LENGTH = 22;

/** Live books use a fixed display title — no custom names. */
export function livePortfolioDisplayName(displayName, fallback = 'My') {
  const full = `${holderFirstName(displayName, fallback)} Portfolio`;
  return truncatePortfolioName(full);
}

export function truncatePortfolioName(name) {
  return String(name ?? '').slice(0, PORTFOLIO_NAME_MAX_LENGTH);
}

export function isPortfolioNameTooLong(name) {
  return String(name ?? '').length > PORTFOLIO_NAME_MAX_LENGTH;
}

export function isPublishedLivePortfolio(portfolio) {
  return Boolean(
    portfolio &&
      !portfolio.isDraft &&
      !portfolio.isArchived &&
      !isWatchlistKind(portfolio.kind ?? 'live')
  );
}

export function findPublishedLivePortfolio(portfolios) {
  return (portfolios ?? []).find(isPublishedLivePortfolio) ?? null;
}

const inputErrorClass = 'border-pe-negative ring-1 ring-pe-negative focus:border-pe-negative focus:ring-pe-negative';

export function fieldClass(baseClass, hasError) {
  return hasError ? `${baseClass} ${inputErrorClass}` : baseClass;
}

export function isWatchlistKind(kind) {
  return kind === 'watchlist';
}

/** @deprecated Cost entry removed — holdings are qty-only. Kept for unused call sites. */
export const COST_MODES = {
  invested: 'invested',
  avg: 'avg',
};

export function formatCostInput(value) {
  if (value === '' || value == null) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const rounded = Math.round(n * 10000) / 10000;
  return String(rounded);
}

/** Live edit: qty (fund units) ≤6 dp. Blocks non-numeric / scroll-spin inputs. */
export const INVESTED_MAX_DECIMALS = 2;
export const QTY_MAX_DECIMALS = 6;

/**
 * Sanitize typed decimal string. Allows "", "12", "12.", "12.3".
 * Rejects letters; caps fractional digits at `maxDecimals`.
 */
export function sanitizeDecimalInput(raw, maxDecimals = 2) {
  const max = Math.max(0, Number(maxDecimals) || 0);
  let s = String(raw ?? '').replace(/[^\d.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = `${s.slice(0, firstDot + 1)}${s.slice(firstDot + 1).replace(/\./g, '')}`;
  }
  if (!s) return '';
  if (s === '.') return max > 0 ? '0.' : '';

  const [whole, frac] = s.split('.');
  const wholeClean = whole.replace(/^0+(?=\d)/, '') || (s.startsWith('0') ? '0' : '');
  if (frac === undefined) return wholeClean;
  if (max === 0) return wholeClean;
  return `${wholeClean}.${frac.slice(0, max)}`;
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

/** @deprecated Cost basis removed — always 0. */
export function totalInvestedFromHoldings() {
  return 0;
}

/**
 * Compare portfolio holdings before vs after a save (qty-focused).
 * @returns {{ beforeCount, afterCount, beforeQty, afterQty, qtyDelta, added, removed, changed }}
 */
export function summarizeHoldingsChange(beforeHoldings = [], afterHoldings = []) {
  const beforeMap = new Map();
  for (const h of beforeHoldings ?? []) {
    const ticker = String(h?.ticker ?? '').trim().toUpperCase();
    if (!ticker) continue;
    const qty = Number(h.qty) || 0;
    beforeMap.set(ticker, {
      ticker,
      name: h.assetName || h.name || ticker,
      qty,
    });
  }

  const afterMap = new Map();
  for (const h of afterHoldings ?? []) {
    const ticker = String(h?.ticker ?? '').trim().toUpperCase();
    if (!ticker) continue;
    const qty = Number(h.qty) || 0;
    afterMap.set(ticker, {
      ticker,
      name: h.assetName || h.name || ticker,
      qty,
    });
  }

  const added = [];
  const removed = [];
  const changed = [];

  for (const [ticker, after] of afterMap) {
    const before = beforeMap.get(ticker);
    if (!before) {
      added.push(after);
      continue;
    }
    if (Math.abs(before.qty - after.qty) > 1e-9) {
      changed.push({ ticker, name: after.name || before.name, before, after });
    }
  }
  for (const [ticker, before] of beforeMap) {
    if (!afterMap.has(ticker)) removed.push(before);
  }

  const beforeQty = [...beforeMap.values()].reduce((s, h) => s + h.qty, 0);
  const afterQty = [...afterMap.values()].reduce((s, h) => s + h.qty, 0);

  return {
    beforeCount: beforeMap.size,
    afterCount: afterMap.size,
    beforeQty,
    afterQty,
    qtyDelta: afterQty - beforeQty,
    // Back-compat aliases (unused by new sheet)
    beforeInvested: 0,
    afterInvested: 0,
    investedDelta: 0,
    added,
    removed,
    changed,
  };
}

/** Patch live holding edit rows (qty-only; clears leftover cost fields). */
export function patchLiveCostFields(row, patch) {
  const next = { ...row, ...patch, invested: '', avg: '' };
  if (Object.prototype.hasOwnProperty.call(patch, 'qty')) {
    next.qty = patch.qty;
  }
  return next;
}

export function withSyncedAvg(row) {
  return { ...row, avg: '', invested: '' };
}

function rowHasInput(row, isWatchlist) {
  if (isWatchlist) {
    return Boolean(row.ticker?.trim());
  }
  return Boolean(row.ticker?.trim() || (row.qty !== '' && row.qty != null));
}

/** Resolve watchlist weights: keep explicit % when every row has one; else equal-weight. */
export function resolveWatchlistWeightPcts(rows) {
  const list = rows ?? [];
  const n = list.length;
  if (!n) return [];
  const parsed = list.map((row) => Number(row.weight ?? row.weightPct));
  const allExplicit = parsed.every((w) => Number.isFinite(w) && w > 0);
  if (allExplicit) return parsed;
  const equal = 100 / n;
  return list.map(() => equal);
}

export function buildWatchlistHoldings(rows, assetsByKey = new Map()) {
  const weights = resolveWatchlistWeightPcts(rows);
  return rows.map((row, index) => {
    const ticker = row.ticker.trim();
    const asset = assetsByKey.get(ticker);
    const weightPct = weights[index] ?? 0;
    const price = Number(asset?.price);
    return {
      ticker: asset?.key ?? ticker,
      assetName: asset?.name ?? row.name?.trim() ?? '',
      isin: asset?.isin ?? row.isin ?? null,
      assetType: asset?.kind ?? (/^\d{6,}$/.test(ticker) ? 'fund' : 'stock'),
      logoIconUrl: asset?.logoIconUrl ?? null,
      qty: 0,
      avg: 0,
      price: Number.isFinite(price) && price > 0 ? price : 0,
      weightPct,
      invested: 0,
      value: 0,
      pnlPct: 0,
    };
  });
}

/** Persist live holdings as qty-only (avg always 0). Current value = qty × live price. */
export function buildLiveHoldings(rows, assetsByKey = new Map()) {
  return rows.map((row) => {
    const ticker = row.ticker.trim();
    const asset = assetsByKey.get(ticker);
    const qty = Number(row.qty) || 0;
    const price = Number(asset?.price);
    return recalcHolding({
      ticker: asset?.key ?? ticker,
      assetName: asset?.name ?? row.name?.trim() ?? '',
      isin: asset?.isin ?? row.isin ?? null,
      qty,
      avg: 0,
      price: Number.isFinite(price) && price > 0 ? price : 0,
    });
  });
}

export function validatePortfolioDraft({ kind, name, rows }) {
  const isWatchlist = isWatchlistKind(kind);
  const errors = {
    name: false,
    objective: false,
    thesis: false,
    rows: {},
  };

  // Live portfolios get an automatic "{FirstName} Portfolio" title.
  if (isWatchlist) {
    const trimmed = String(name ?? '').trim();
    if (!trimmed || trimmed.length > PORTFOLIO_NAME_MAX_LENGTH) errors.name = true;
  }

  const completeRows = [];

  for (const row of rows) {
    if (!rowHasInput(row, isWatchlist)) continue;

    const rowErrors = {};
    const ticker = row.ticker.trim();

    if (!ticker) rowErrors.ticker = true;

    if (!isWatchlist) {
      const qty = Number(row.qty);
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
        ...(isWatchlist ? {} : { qty: true }),
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

  const valid =
    !errors.name &&
    completeRows.length >= 1 &&
    Object.keys(errors.rows).length === 0;

  return { valid, errors, completeRows };
}

/** Plain-language message for Save validation failures (shown in a popup). */
export function formatPortfolioSaveValidationMessage(errors, { isWatchlist = false } = {}) {
  if (errors?.name) {
    return `Enter a watchlist name (max ${PORTFOLIO_NAME_MAX_LENGTH} characters).`;
  }

  const rowErrorEntries = Object.entries(errors?.rows ?? {});
  if (rowErrorEntries.length === 0) {
    return isWatchlist
      ? 'Add at least one ticker before saving.'
      : 'Add at least one holding with ticker and quantity before saving.';
  }

  const issues = new Set();
  for (const [, rowErrors] of rowErrorEntries) {
    if (rowErrors?.ticker) issues.add('ticker');
    if (rowErrors?.qty) issues.add('quantity');
  }

  const parts = [];
  if (issues.has('ticker')) parts.push('a valid ticker (duplicates are not allowed)');
  if (issues.has('quantity')) parts.push('quantity (> 0)');

  if (parts.length === 0) {
    return 'Fix the highlighted fields before saving.';
  }

  if (parts.length === 1) {
    return `Fix each flagged row: enter ${parts[0]}.`;
  }

  const last = parts.pop();
  return `Fix each flagged row: enter ${parts.join(', ')}, and ${last}.`;
}

export function portfolioHasDraftWork({ name, rows, isWatchlist }) {
  if (name.trim()) return true;
  return rows.some((row) => rowHasInput(row, isWatchlist));
}
