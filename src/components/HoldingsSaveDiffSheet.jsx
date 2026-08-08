import { X } from 'lucide-react';
import AppModalOverlay from './AppModalOverlay';

function formatQty(n) {
  if (!Number.isFinite(n)) return '0';
  return Number(n).toLocaleString('en-IN', {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  });
}

function formatSignedQty(n) {
  if (!Number.isFinite(n) || Math.abs(n) < 1e-9) return '0';
  const sign = n > 0 ? '+' : '−';
  return `${sign}${formatQty(Math.abs(n))}`;
}

function deltaClass(n) {
  if (n > 0) return 'text-pe-positive';
  if (n < 0) return 'text-pe-negative';
  return 'text-pe-text';
}

/**
 * Compact post-save review (no cramped two-column qty cards).
 */
export default function HoldingsSaveDiffSheet({ summary, onClose }) {
  if (!summary) return null;

  const {
    beforeCount,
    afterCount,
    beforeQty = 0,
    afterQty = 0,
    qtyDelta = 0,
    added,
    removed,
    changed,
    sourceLabel,
  } = summary;

  const countDelta = afterCount - beforeCount;
  const hasLineChanges = added.length + removed.length + changed.length > 0;
  const headlineBits = [
    added.length ? `${added.length} added` : null,
    removed.length ? `${removed.length} removed` : null,
    changed.length ? `${changed.length} qty changed` : null,
  ].filter(Boolean);

  return (
    <AppModalOverlay open onClose={onClose} closeOnBackdrop={false} label="Holdings update summary">
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-pe-border px-4 py-4 md:px-5">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-pe-text">Portfolio saved</p>
            <p className="mt-0.5 text-[12px] text-pe-text-secondary">
              {sourceLabel ? `${sourceLabel} applied to My Portfolio` : 'Your holdings are up to date'}
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
          <div className="rounded-xl border border-pe-border bg-pe-surface/50 px-3.5 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-pe-text-muted">
                Holdings
              </p>
              <p className="text-[15px] font-bold tabular-nums text-pe-text">
                {beforeCount}
                <span className="mx-1.5 font-semibold text-pe-text-muted">→</span>
                {afterCount}
                {countDelta !== 0 ? (
                  <span className={`ml-2 text-[13px] font-semibold ${deltaClass(countDelta)}`}>
                    ({formatSignedQty(countDelta)})
                  </span>
                ) : null}
              </p>
            </div>

            <div className="mt-3 border-t border-pe-border/80 pt-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-pe-text-muted">
                  Net quantity change
                </p>
                <p className={`text-[15px] font-bold tabular-nums ${deltaClass(qtyDelta)}`}>
                  {formatSignedQty(qtyDelta)}
                </p>
              </div>
              <p className="mt-1 break-words text-[12px] leading-relaxed tabular-nums text-pe-text-secondary">
                Was {formatQty(beforeQty)} · now {formatQty(afterQty)}
              </p>
            </div>

            {headlineBits.length ? (
              <p className="mt-3 text-[12px] leading-relaxed text-pe-text-secondary">
                {headlineBits.join(' · ')}
              </p>
            ) : (
              <p className="mt-3 text-[12px] text-pe-text-secondary">No ticker-level changes.</p>
            )}
          </div>

          {hasLineChanges ? (
            <div className="mt-4 space-y-3">
              {added.length ? (
                <DiffGroup title="Added" tone="positive">
                  {added.map((row) => (
                    <DiffRow
                      key={`a-${row.ticker}`}
                      label={row.name || row.ticker}
                      detail={`Qty ${formatQty(row.qty)}`}
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
                      detail={`Qty ${formatQty(row.qty)}`}
                    />
                  ))}
                </DiffGroup>
              ) : null}
              {changed.length ? (
                <DiffGroup title="Qty changed" tone="neutral">
                  {changed.map((row) => (
                    <DiffRow
                      key={`c-${row.ticker}`}
                      label={row.name || row.ticker}
                      detail={`${formatQty(row.before.qty)} → ${formatQty(row.after.qty)}`}
                      delta={row.after.qty - row.before.qty}
                    />
                  ))}
                </DiffGroup>
              ) : null}
            </div>
          ) : null}
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
      <ul className="mt-1.5 divide-y divide-pe-border rounded-lg border border-pe-border bg-white">
        {children}
      </ul>
    </div>
  );
}

function DiffRow({ label, detail, delta }) {
  return (
    <li className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-pe-text">{label}</p>
        <p className="mt-0.5 break-words text-[12px] tabular-nums text-pe-text-secondary">{detail}</p>
      </div>
      {delta != null && Number.isFinite(delta) && Math.abs(delta) >= 1e-9 ? (
        <span className={`shrink-0 text-[12px] font-semibold tabular-nums ${deltaClass(delta)}`}>
          {formatSignedQty(delta)}
        </span>
      ) : null}
    </li>
  );
}
