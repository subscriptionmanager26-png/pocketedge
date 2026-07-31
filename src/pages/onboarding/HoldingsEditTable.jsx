import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import PortfolioAssetSearchField from '../../components/PortfolioAssetSearchField';
import CostModeToggle from '../../components/CostModeToggle';
import {
  COST_MODES,
  fieldClass,
  patchLiveCostFields,
  withSyncedAvg,
} from '../../lib/portfolioEdit';

const compactInputClass =
  'w-full min-w-0 rounded-md border border-pe-border-strong bg-pe-canvas px-2.5 py-2 text-base text-pe-text outline-none focus:border-pe-accent focus:ring-1 focus:ring-pe-accent md:text-[15px]';

const rowGridClass =
  'grid grid-cols-[minmax(0,1fr)_7.25rem_4.5rem_auto] items-start gap-2';

export function emptyHoldingRow() {
  return { id: crypto.randomUUID(), ticker: '', name: '', invested: '', qty: '', avg: '' };
}

function formatInr(value) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

export function sumTotalInvested(rows) {
  return (rows ?? []).reduce((sum, row) => {
    const invested = Number(row.invested);
    if (row.invested === '' || Number.isNaN(invested) || invested < 0) return sum;
    return sum + invested;
  }, 0);
}

export function countFilledHoldings(rows) {
  return (rows ?? []).filter((row) => {
    const ticker = String(row.ticker ?? '').trim();
    const invested = Number(row.invested);
    const qty = Number(row.qty);
    return (
      ticker &&
      row.invested !== '' &&
      !Number.isNaN(invested) &&
      invested >= 0 &&
      row.qty !== '' &&
      !Number.isNaN(qty) &&
      qty > 0
    );
  }).length;
}

/** Validate edit rows → analysis holdings `{ ticker, qty, avg }`. */
export function validateHoldingsRows(rows) {
  const errors = {};
  const holdings = [];

  for (const row of rows) {
    const synced = withSyncedAvg(row);
    const ticker = String(synced.ticker).trim().toUpperCase();
    const invested = Number(synced.invested);
    const qty = Number(synced.qty);
    const hasAny = Boolean(
      ticker || synced.invested !== '' || synced.qty !== '' || synced.avg !== ''
    );
    if (!hasAny) continue;

    const rowErr = {};
    if (!ticker) rowErr.ticker = true;
    if (synced.invested === '' || Number.isNaN(invested) || invested < 0) {
      rowErr.invested = true;
      rowErr.avg = true;
    }
    if (synced.qty === '' || Number.isNaN(qty) || qty <= 0) rowErr.qty = true;

    if (Object.keys(rowErr).length) {
      errors[synced.id] = rowErr;
    } else {
      holdings.push({
        ticker,
        qty,
        avg: qty > 0 ? invested / qty : 0,
        name: synced.name,
      });
    }
  }

  if (holdings.length < 1) {
    const fallback = rows[0];
    if (fallback) {
      errors[fallback.id] = { ticker: true, invested: true, avg: true, qty: true };
    }
    return {
      ok: false,
      errors,
      holdings: [],
      message: 'Add at least one holding with ticker, cost, and quantity.',
    };
  }

  if (Object.keys(errors).length) {
    return {
      ok: false,
      errors,
      holdings: [],
      message: 'Fix the highlighted rows, then try again.',
    };
  }

  return { ok: true, errors: {}, holdings, message: '' };
}

/** Live portfolio edit table - matches Profile portfolio editor. */
export default function HoldingsEditTable({
  rows,
  fieldErrors = {},
  onUpdateRow,
  onRemoveRow,
  onAddRow,
  hint = 'Search a stock, ETF, or fund, then enter cost and quantity.',
}) {
  const [costMode, setCostMode] = useState(COST_MODES.invested);
  const totalInvested = sumTotalInvested(rows);
  const holdingCount = countFilledHoldings(rows);
  const costLabel = costMode === COST_MODES.avg ? 'Avg price' : 'Total invested';
  const costErrorKey = costMode === COST_MODES.avg ? 'avg' : 'invested';

  const handleCostMode = (mode) => {
    setCostMode(mode);
    if (mode === COST_MODES.avg) {
      rows.forEach((row) => {
        const synced = withSyncedAvg(row);
        if (synced.avg !== row.avg) onUpdateRow(row.id, { avg: synced.avg });
      });
    }
  };

  const handlePatch = (id, patch) => {
    const row = rows.find((entry) => entry.id === id);
    if (!row) {
      onUpdateRow(id, patch);
      return;
    }
    // Parent merges patch into the row - pass only changed cost-synced fields.
    const next = patchLiveCostFields(row, patch, costMode);
    const delta = {};
    for (const key of Object.keys(next)) {
      if (next[key] !== row[key]) delta[key] = next[key];
    }
    if (Object.keys(delta).length) onUpdateRow(id, delta);
  };

  return (
    <div>
      <div className="rounded-lg border border-pe-border bg-pe-surface px-4 py-3">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
          Total invested
        </p>
        <p className="mt-1 text-[28px] font-bold tabular-nums tracking-tight text-pe-text">
          {formatInr(totalInvested)}
        </p>
        <p className="mt-1 text-[12px] text-pe-text-secondary">
          {holdingCount === 0
            ? 'Add holdings below - match this with Total invested in your broker app.'
            : `${holdingCount} holding${holdingCount === 1 ? '' : 's'} · check this against your broker app`}
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
            Holdings
          </p>
          {hint ? <p className="mt-1 text-sm text-pe-text-secondary">{hint}</p> : null}
        </div>
        <CostModeToggle value={costMode} onChange={handleCostMode} />
      </div>

      <div className="mt-4 space-y-2">
        <div className={`${rowGridClass} px-0.5`}>
          <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
            Ticker
          </p>
          <p className="text-right text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
            {costLabel}
          </p>
          <p className="text-right text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
            Qty
          </p>
          <span className="h-4 w-9 shrink-0" aria-hidden="true" />
        </div>

        {rows.map((row) => {
          const rowErr = fieldErrors[row.id] ?? {};
          const usedTickers = rows
            .filter((entry) => entry.id !== row.id)
            .map((entry) => entry.ticker.trim())
            .filter(Boolean);
          const costValue = costMode === COST_MODES.avg ? row.avg ?? '' : row.invested;
          const costHasError = Boolean(rowErr[costErrorKey] || rowErr.invested || rowErr.avg);

          return (
            <div key={row.id} className="space-y-1">
              <div className={rowGridClass}>
                <PortfolioAssetSearchField
                  value={row.name || row.ticker}
                  exclude={usedTickers}
                  placeholder="Search stock, ETF, or fund"
                  inputClassName={fieldClass(compactInputClass, rowErr.ticker)}
                  onValueChange={(next) =>
                    handlePatch(row.id, { ticker: next.toUpperCase(), name: '' })
                  }
                  onSelect={(asset) =>
                    handlePatch(row.id, {
                      ticker: asset.key,
                      name: asset.kind === 'fund' ? asset.name : '',
                    })
                  }
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costValue}
                  onChange={(e) =>
                    handlePatch(
                      row.id,
                      costMode === COST_MODES.avg
                        ? { avg: e.target.value }
                        : { invested: e.target.value }
                    )
                  }
                  placeholder={costLabel}
                  aria-label={costLabel}
                  className={fieldClass(
                    `${compactInputClass} text-right tabular-nums`,
                    costHasError
                  )}
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={row.qty}
                  onChange={(e) => handlePatch(row.id, { qty: e.target.value })}
                  placeholder="Qty"
                  aria-label="Quantity"
                  className={fieldClass(
                    `${compactInputClass} text-right tabular-nums`,
                    rowErr.qty
                  )}
                />
                <button
                  type="button"
                  onClick={() => onRemoveRow(row.id)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-pe-text-muted transition hover:bg-pe-surface hover:text-pe-negative"
                  aria-label="Delete holding row"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {rowErr.ticker ? (
                <p className="px-0.5 text-[12px] text-pe-negative">
                  {row.ticker.trim()
                    ? `${row.ticker.trim()} is not a valid stock, ETF, or fund - search to replace it.`
                    : 'Pick a stock, ETF, or fund from search results.'}
                </p>
              ) : null}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onAddRow}
          className="mt-1 inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm font-semibold text-pe-accent transition hover:bg-pe-accent-wash"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </div>
  );
}
