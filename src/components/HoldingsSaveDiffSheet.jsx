import { X } from 'lucide-react';
import AppModalOverlay from './AppModalOverlay';
import { formatInr } from '../lib/format';

function deltaClass(n) {
  if (n > 0) return 'text-pe-positive';
  if (n < 0) return 'text-pe-negative';
  return 'text-pe-text';
}

function formatSignedInr(n) {
  if (!Number.isFinite(n) || n === 0) return formatInr(0);
  const sign = n > 0 ? '+' : '−';
  return `${sign}${formatInr(Math.abs(n))}`;
}

/**
 * Post-save review of holdings / invested changes for a live portfolio.
 * Portaled via AppModalOverlay so the dim covers Shell top bar + right rail.
 */
export default function HoldingsSaveDiffSheet({ summary, onClose }) {
  if (!summary) return null;

  const {
    beforeCount,
    afterCount,
    beforeInvested,
    afterInvested,
    investedDelta,
    added,
    removed,
    changed,
  } = summary;

  const hasLineChanges = added.length + removed.length + changed.length > 0;

  return (
    <AppModalOverlay open onClose={onClose} closeOnBackdrop={false} label="Holdings update summary">
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-pe-border px-4 py-4 md:px-5">
          <div>
            <p className="text-[15px] font-semibold text-pe-text">Holdings updated</p>
            <p className="mt-0.5 text-[12px] text-pe-text-secondary">
              Before vs after this save
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-pe-text-muted hover:bg-pe-surface hover:text-pe-text"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-pe-border bg-pe-surface/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-pe-text-muted">
                Holdings
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-pe-text">
                {beforeCount}
                <span className="mx-1.5 text-pe-text-muted">→</span>
                {afterCount}
              </p>
            </div>
            <div className="rounded-xl border border-pe-border bg-pe-surface/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-pe-text-muted">
                Total invested
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-pe-text">
                {formatInr(beforeInvested)}
                <span className="mx-1.5 text-pe-text-muted">→</span>
                {formatInr(afterInvested)}
              </p>
              <p className={`mt-0.5 text-[12px] font-semibold tabular-nums ${deltaClass(investedDelta)}`}>
                {formatSignedInr(investedDelta)}
              </p>
            </div>
          </div>

          {hasLineChanges ? (
            <div className="mt-4 space-y-3">
              {added.length ? (
                <DiffGroup title="Added" tone="positive">
                  {added.map((row) => (
                    <DiffRow
                      key={`a-${row.ticker}`}
                      label={row.name || row.ticker}
                      detail={`${row.qty.toLocaleString('en-IN')} qty · ${formatInr(row.invested)}`}
                    />
                  ))}
                </DiffGroup>
              ) : null}
              {removed.length ? (
                <DiffGroup title="Removed" tone="negative">
                  {removed.map((row) => (
                    <DiffRow
                      key={`r-${row.ticker}`}
                      label={row.name || row.ticker}
                      detail={`${row.qty.toLocaleString('en-IN')} qty · ${formatInr(row.invested)}`}
                    />
                  ))}
                </DiffGroup>
              ) : null}
              {changed.length ? (
                <DiffGroup title="Changed" tone="neutral">
                  {changed.map((row) => (
                    <DiffRow
                      key={`c-${row.ticker}`}
                      label={row.name || row.ticker}
                      detail={`Qty ${row.before.qty.toLocaleString('en-IN')} → ${row.after.qty.toLocaleString('en-IN')} · ${formatInr(row.before.invested)} → ${formatInr(row.after.invested)}`}
                    />
                  ))}
                </DiffGroup>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-pe-text-secondary">
              No ticker-level changes — invested and holdings counts look the same.
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-pe-border px-4 py-3 md:px-5">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-pe-accent text-[14px] font-bold text-white hover:bg-pe-accent-pressed"
          >
            Done
          </button>
        </div>
      </div>
    </AppModalOverlay>
  );
}

function DiffGroup({ title, tone, children }) {
  const toneClass =
    tone === 'positive'
      ? 'text-pe-positive'
      : tone === 'negative'
        ? 'text-pe-negative'
        : 'text-pe-text';
  return (
    <div>
      <p className={`text-[12px] font-bold uppercase tracking-[0.06em] ${toneClass}`}>{title}</p>
      <ul className="mt-1.5 divide-y divide-pe-border rounded-lg border border-pe-border">
        {children}
      </ul>
    </div>
  );
}

function DiffRow({ label, detail }) {
  return (
    <li className="px-3 py-2.5">
      <p className="text-[13px] font-semibold text-pe-text">{label}</p>
      <p className="mt-0.5 text-[12px] tabular-nums text-pe-text-secondary">{detail}</p>
    </li>
  );
}
