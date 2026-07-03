import { X } from 'lucide-react';
import { STOCKS } from '../data/mockData';
import { formatPct, formatPrice, pnlClass } from '../lib/format';
import { statusStyles } from '../lib/tickers';

export default function TickerMiniCard({ ticker, position, onClose }) {
  const stock = STOCKS[ticker];
  const styles = statusStyles(position.status);

  return (
    <span
      role="dialog"
      className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-pe-border bg-pe-elevated p-3 shadow-2xl shadow-black/50"
    >
      <span className="mb-2 flex items-start justify-between gap-2">
        <span>
          <span className="block text-sm font-semibold text-pe-text">${ticker}</span>
          <span className="block text-xs text-pe-text-muted">{stock?.name ?? ticker}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-pe-text-muted hover:bg-white/5 hover:text-pe-text"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>

      <span className="mb-2 flex items-baseline gap-2">
        <span className="text-base font-semibold">{formatPrice(stock?.price)}</span>
        <span className={`text-xs font-medium ${pnlClass(stock?.changePct ?? 0)}`}>
          {formatPct(stock?.changePct ?? 0)}
        </span>
      </span>

      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles.chip}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
        {styles.label}
      </span>

      {position.status === 'holds' && (
        <span className="mt-2 block space-y-1 text-xs text-pe-text-secondary">
          <span className="flex justify-between">
            <span>Qty</span>
            <span className="text-pe-text">{position.qty}</span>
          </span>
          <span className="flex justify-between">
            <span>Avg</span>
            <span className="text-pe-text">{formatPrice(position.avg)}</span>
          </span>
          <span className="flex justify-between">
            <span>P&L</span>
            <span className={pnlClass(position.pnlPct)}>{formatPct(position.pnlPct)}</span>
          </span>
        </span>
      )}

      {position.status === 'exited' && (
        <span className="mt-2 block space-y-1 text-xs text-pe-text-secondary">
          <span className="flex justify-between">
            <span>Exit</span>
            <span className="text-pe-text">{formatPrice(position.exitPrice)}</span>
          </span>
          <span className="flex justify-between">
            <span>Realized</span>
            <span className={pnlClass(position.pnlPct)}>{formatPct(position.pnlPct)}</span>
          </span>
        </span>
      )}
    </span>
  );
}
