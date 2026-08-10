function formatTargetInr(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `₹${Number(n).toLocaleString('en-IN', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })}`;
}

function formatAsOf(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function barWidthPct(count, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (count / total) * 100));
}

function hasValidRating(rating) {
  return Boolean(rating && rating.consensusLabel && rating.consensusLabel !== 'Limited');
}

/**
 * Full Analyst ratings block for stock/ETF detail.
 * Always renders content; shows an empty state when coverage is missing.
 */
export default function AnalystRatingsSection({ rating, loading = false }) {
  if (loading) {
    return (
      <div className="px-4 py-8 text-center text-sm text-pe-text-secondary md:px-6">
        Loading analyst ratings…
      </div>
    );
  }

  if (!hasValidRating(rating)) {
    return (
      <div className="px-4 py-10 text-center md:px-6">
        <p className="text-[15px] font-semibold text-pe-text">No ratings exist</p>
        <p className="mt-1 text-[13px] leading-relaxed text-pe-text-secondary">
          Analyst consensus isn’t available for this security yet.
        </p>
      </div>
    );
  }

  const total = rating.analystCount || rating.buy + rating.hold + rating.sell;
  const asOf = formatAsOf(rating.syncedAt);
  const upside = rating.upsidePct;
  const hasUpside = upside != null && Number.isFinite(Number(upside));
  const upsidePositive = hasUpside && upside >= 0;

  const min = rating.targetLow;
  const avg = rating.targetAvg;
  const max = rating.targetHigh;
  const hasMin = min != null && Number.isFinite(Number(min));
  const hasAvg = avg != null && Number.isFinite(Number(avg));
  const hasMax = max != null && Number.isFinite(Number(max));

  const consensusClass =
    rating.consensusLabel === 'Buy'
      ? 'text-pe-positive'
      : rating.consensusLabel === 'Sell'
        ? 'text-pe-negative'
        : 'text-pe-text';

  return (
    <div className="space-y-5 px-4 md:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] text-pe-text-secondary">
          Based on {total} analyst{total === 1 ? '' : 's'}
        </p>
        {asOf ? (
          <p className="text-[12px] text-pe-text-muted">As of {asOf}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[16px] bg-pe-surface/80 px-3.5 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-pe-text-muted">
            Consensus rating
          </p>
          <p className={`mt-2 text-[24px] font-bold tracking-tight ${consensusClass}`}>
            {rating.consensusLabel}
          </p>
          <p className="mt-1.5 text-[12px] leading-snug text-pe-text-secondary">
            Overall view from covering analysts
          </p>
        </div>
        <div className="rounded-[16px] bg-pe-surface/80 px-3.5 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-pe-text-muted">
            Upside
          </p>
          <p
            className={`mt-2 text-[24px] font-bold tracking-tight tabular-nums ${
              hasUpside
                ? upsidePositive
                  ? 'text-pe-positive'
                  : 'text-pe-negative'
                : 'text-pe-text-muted'
            }`}
          >
            {hasUpside ? `${upsidePositive ? '+' : ''}${Number(upside).toFixed(1)}%` : '—'}
          </p>
          <p className="mt-1.5 text-[12px] leading-snug text-pe-text-secondary">
            Avg target vs last price
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2.5">
          <p className="text-[13px] font-semibold text-pe-text">1Y price targets</p>
          <p className="mt-0.5 text-[12px] text-pe-text-secondary">
            Analyst low, average, and high targets
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <TargetStat label="Min" value={formatTargetInr(hasMin ? min : null)} />
          <TargetStat label="Average" value={formatTargetInr(hasAvg ? avg : null)} emphasize />
          <TargetStat label="Max" value={formatTargetInr(hasMax ? max : null)} />
        </div>
      </div>

      <div>
        <div className="mb-3">
          <p className="text-[13px] font-semibold text-pe-text">
            Analyst rating distribution
          </p>
          <p className="mt-0.5 text-[12px] text-pe-text-secondary">
            How many analysts rate this a Buy, Hold, or Sell
          </p>
        </div>
        <div className="space-y-3 rounded-[16px] bg-pe-surface/80 px-3.5 py-3.5">
          <RatingBar label="Buy" count={rating.buy} total={total} tone="buy" />
          <RatingBar label="Hold" count={rating.hold} total={total} tone="hold" />
          <RatingBar label="Sell" count={rating.sell} total={total} tone="sell" />
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-pe-text-muted">
        Consensus and targets are estimates from covering analysts. Not investment advice.
      </p>
    </div>
  );
}

function TargetStat({ label, value, emphasize = false }) {
  return (
    <div
      className={`rounded-[14px] px-2.5 py-3 text-center ${
        emphasize ? 'bg-white ring-1 ring-black/[0.06]' : 'bg-pe-surface/80'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-pe-text-muted">
        {label}
      </p>
      <p
        className={`mt-1.5 tabular-nums tracking-tight ${
          emphasize
            ? 'text-[16px] font-bold text-pe-text'
            : 'text-[15px] font-semibold text-pe-text'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function RatingBar({ label, count, total, tone }) {
  const pct = barWidthPct(count, total);
  const fill =
    tone === 'buy'
      ? 'bg-pe-positive'
      : tone === 'sell'
        ? 'bg-pe-negative'
        : 'bg-pe-text-muted';

  return (
    <div className="flex items-center gap-2.5">
      <span className="w-9 shrink-0 text-[12px] font-semibold text-pe-text-secondary">
        {label}
      </span>
      <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/80">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex w-14 shrink-0 items-baseline justify-end gap-1">
        <span className="text-[13px] font-semibold tabular-nums text-pe-text">{count}</span>
        <span className="text-[10px] font-medium tabular-nums text-pe-text-muted">
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}

/** Compact portfolio chip text/styles from a view-model. */
export function analystChipClass(label) {
  if (label === 'Buy') return 'bg-pe-positive/10 text-pe-positive';
  if (label === 'Sell') return 'bg-pe-negative/10 text-pe-negative';
  return 'bg-pe-surface text-pe-text-secondary';
}
