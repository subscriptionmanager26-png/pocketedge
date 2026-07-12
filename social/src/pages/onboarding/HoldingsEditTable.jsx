import { Plus, Trash2 } from 'lucide-react';
import PortfolioAssetSearchField from '../../components/PortfolioAssetSearchField';
import { fieldClass } from '../../lib/portfolioEdit';

const compactInputClass =
  'w-full min-w-0 rounded-md border border-pe-border-strong bg-pe-canvas px-2.5 py-2 text-[14px] text-pe-text outline-none focus:border-pe-accent focus:ring-1 focus:ring-pe-accent';

const rowGridClass =
  'grid grid-cols-[minmax(0,1fr)_7.25rem_4.5rem_auto] items-start gap-2';

export function emptyHoldingRow() {
  return { id: crypto.randomUUID(), ticker: '', invested: '', qty: '' };
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
    const ticker = String(row.ticker).trim().toUpperCase();
    const invested = Number(row.invested);
    const qty = Number(row.qty);
    const hasAny = Boolean(ticker || row.invested !== '' || row.qty !== '');
    if (!hasAny) continue;

    const rowErr = {};
    if (!ticker) rowErr.ticker = true;
    if (row.invested === '' || Number.isNaN(invested) || invested < 0) rowErr.invested = true;
    if (row.qty === '' || Number.isNaN(qty) || qty <= 0) rowErr.qty = true;

    if (Object.keys(rowErr).length) {
      errors[row.id] = rowErr;
    } else {
      holdings.push({
        ticker,
        qty,
        avg: qty > 0 ? invested / qty : 0,
        name: row.name,
      });
    }
  }

  if (holdings.length < 1) {
    const fallback = rows[0];
    if (fallback) {
      errors[fallback.id] = { ticker: true, invested: true, qty: true };
    }
    return {
      ok: false,
      errors,
      holdings: [],
      message: 'Add at least one holding with ticker, total invested, and quantity.',
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

/** Live portfolio edit table — matches Profile portfolio editor. */
export default function HoldingsEditTable({
  rows,
  fieldErrors = {},
  onUpdateRow,
  onRemoveRow,
  onAddRow,
  hint = 'Search a stock, ETF, or fund, then enter your total investment and quantity.',
}) {
  const totalInvested = sumTotalInvested(rows);
  const holdingCount = countFilledHoldings(rows);

  return (
    <div>
      <div className="rounded-lg border border-pe-border bg-pe-surface px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
          Total invested
        </p>
        <p className="mt-1 text-[28px] font-bold tabular-nums tracking-tight text-pe-text">
          {formatInr(totalInvested)}
        </p>
        <p className="mt-1 text-[13px] text-pe-text-secondary">
          {holdingCount === 0
            ? 'Add holdings below — match this with Total invested in your broker app.'
            : `${holdingCount} holding${holdingCount === 1 ? '' : 's'} · check this against your broker app`}
        </p>
      </div>

      <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
        Holdings
      </p>
      {hint ? <p className="mt-1 text-sm text-pe-text-secondary">{hint}</p> : null}

      <div className="mt-4 space-y-2">
        <div className="hidden items-center gap-2 px-0.5 md:flex">
          <p className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
            Ticker
          </p>
          <p className="w-[8.75rem] shrink-0 text-right text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
            Total invested
          </p>
          <p className="w-[5.25rem] shrink-0 text-right text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
            Qty
          </p>
          <span className="h-9 w-9 shrink-0" aria-hidden="true" />
        </div>

        {rows.map((row) => {
          const rowErr = fieldErrors[row.id] ?? {};
          const usedTickers = rows
            .filter((entry) => entry.id !== row.id)
            .map((entry) => entry.ticker.trim())
            .filter(Boolean);

          return (
            <div key={row.id} className="space-y-1">
              <div className={rowGridClass}>
                <PortfolioAssetSearchField
                  value={row.ticker}
                  exclude={usedTickers}
                  placeholder="Search stock, ETF, or fund"
                  inputClassName={fieldClass(compactInputClass, rowErr.ticker)}
                  onValueChange={(next) => onUpdateRow(row.id, { ticker: next.toUpperCase() })}
                  onSelect={(asset) =>
                    onUpdateRow(row.id, {
                      ticker: asset.key,
                      name: asset.name,
                    })
                  }
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.invested}
                  onChange={(e) => onUpdateRow(row.id, { invested: e.target.value })}
                  placeholder="Total invested"
                  aria-label="Total amount you invested"
                  className={fieldClass(
                    `${compactInputClass} text-right tabular-nums`,
                    rowErr.invested
                  )}
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={row.qty}
                  onChange={(e) => onUpdateRow(row.id, { qty: e.target.value })}
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
                    ? `${row.ticker.trim()} is not a valid stock, ETF, or fund — search to replace it.`
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
