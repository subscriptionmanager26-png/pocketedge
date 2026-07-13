import { dayChangeAmount, formatPct, formatPrice, pnlClass } from '../lib/format';

function formatSignedPlain(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/**
 * Shared quote block for search rows + security detail headers.
 * Current Price
 * Today's Change as XX ( YY% )
 */
export function QuoteChangeBlock({
  price,
  changePct,
  previousClose,
  change,
  priceText = null,
  formatAsCurrency = true,
  size = 'row',
  className = '',
}) {
  const numericPrice =
    typeof price === 'number'
      ? price
      : price != null && price !== '…' && price !== '—'
        ? Number(String(price).replace(/[₹,\s]/g, ''))
        : null;
  const amount = dayChangeAmount({
    price: Number.isFinite(numericPrice) ? numericPrice : null,
    changePct,
    previousClose,
    change,
  });
  const hasPct = changePct != null && Number.isFinite(Number(changePct));
  const tone = amount != null ? amount : hasPct ? changePct : 0;
  const formatValue = (n) => (formatAsCurrency ? formatPrice(n) : formatSignedPlain(n));
  const priceDisplay =
    priceText ??
    (price === '…' || price === '—'
      ? price
      : price != null
        ? typeof price === 'string' && (price.startsWith('₹') || Number.isNaN(Number(price)))
          ? price
          : formatValue(Number(price))
        : '—');

  const priceClass =
    size === 'detail' ? 'text-3xl font-bold text-pe-text' : 'text-[15px] font-semibold text-pe-text';
  const changeClass =
    size === 'detail'
      ? `text-lg font-bold tabular-nums ${pnlClass(tone)}`
      : `text-sm font-semibold tabular-nums ${pnlClass(tone)}`;

  return (
    <div className={className}>
      <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
        Current Price
      </p>
      <p className={priceClass}>{priceDisplay}</p>
      {amount != null || hasPct ? (
        <div className="mt-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
            Today&apos;s Change
          </p>
          <p className={changeClass}>
            {amount != null ? formatValue(amount) : '—'}
            {hasPct ? ` (${formatPct(changePct)})` : ''}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default function AssetProductHeader({
  name,
  ticker,
  subtitle,
  type,
  price,
  changePct,
  previousClose,
  change,
  formatAsCurrency = true,
  metaValue,
}) {
  return (
    <section className="border-b border-pe-border px-4 py-5">
      {type ? (
        <p className="mb-2">
          <span className="inline-flex rounded-full bg-pe-accent-wash px-2.5 py-1 text-xs font-semibold text-pe-accent">
            {type}
          </span>
        </p>
      ) : null}
      <h1 className="text-2xl font-bold text-pe-text">{name}</h1>
      {ticker ? <p className="mt-0.5 text-sm text-pe-text-muted">{ticker}</p> : null}
      {subtitle ? <p className="mt-0.5 text-sm text-pe-text-secondary">{subtitle}</p> : null}

      {price != null || changePct != null ? (
        <QuoteChangeBlock
          className="mt-3"
          size="detail"
          price={price}
          changePct={changePct}
          previousClose={previousClose}
          change={change}
          formatAsCurrency={formatAsCurrency}
          priceText={typeof price === 'string' ? price : null}
        />
      ) : null}

      {metaValue ? <p className="mt-2 text-sm text-pe-text-muted">{metaValue}</p> : null}
    </section>
  );
}
