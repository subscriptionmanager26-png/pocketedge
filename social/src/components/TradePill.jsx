import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { formatPct, formatPrice, pnlClass } from '../lib/format';

export default function TradePill({ trade }) {
  const isBuy = trade.action === 'buy';
  return (
    <div
      className={`mt-3 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2 text-sm ${
        isBuy
          ? 'border-pe-positive/30 bg-pe-positive/10'
          : 'border-pe-negative/30 bg-pe-negative/10'
      }`}
    >
      <span className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wide ${isBuy ? 'text-pe-positive' : 'text-pe-negative'}`}>
        {isBuy ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        {trade.action}
      </span>
      <span className="font-medium text-pe-text">${trade.ticker}</span>
      <span className="text-pe-text-secondary">{trade.qty} @ {formatPrice(trade.price)}</span>
      {trade.pnlPct != null && (
        <span className={`font-medium ${pnlClass(trade.pnlPct)}`}>
          P&L {formatPct(trade.pnlPct)}
        </span>
      )}
    </div>
  );
}
