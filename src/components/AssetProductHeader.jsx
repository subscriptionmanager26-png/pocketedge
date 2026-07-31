import { dayChangeAmount, formatPct, formatPrice, pnlClass } from '../lib/format';
import AssetLogo from './AssetLogo';

function formatSignedPlain(n) {
  if (n == null || Number.isNaN(n)) return '-';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/**
 * Shared quote block for search rows + security detail headers.
 * Row: stacked price / change (markets & search).
 * Detail: Current Price and Today's Change on one horizontal plane.
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
      : price != null && price !== '…' && price !== '-' && price !== '—'
        ? Number(String(price).replace(/[₹,\s]/g, ''))
        : null;
  const amount = dayChangeAmount({
    price: Number.isFinite(numericPrice) ? numericPrice : null,
    changePct,
    previousClose,
    change,
  });
  const hasPct = changePct != null && Number.isFinite(Number(changePct));
  const prev = Number(previousClose);
  const derivedPct =
    !hasPct && amount != null && Number.isFinite(prev) && prev !== 0
      ? (amount / prev) * 100
      : !hasPct &&
          amount != null &&
          Number.isFinite(numericPrice) &&
          numericPrice !== 0 &&
          Number.isFinite(numericPrice - amount) &&
          numericPrice - amount !== 0
        ? (amount / (numericPrice - amount)) * 100
        : null;
  const pctValue = hasPct ? Number(changePct) : derivedPct;
  const showPct = pctValue != null && Number.isFinite(pctValue);
  const hasChange = amount != null || showPct;
  const tone = amount != null ? amount : showPct ? pctValue : 0;
  const formatValue = (n) => (formatAsCurrency ? formatPrice(n) : formatSignedPlain(n));
  const priceDisplay =
    priceText ??
    (price === '…' || price === '-' || price === '—'
      ? price === '—'
        ? '-'
        : price
      : price != null
        ? typeof price === 'string' && (price.startsWith('₹') || Number.isNaN(Number(price)))
          ? price
          : formatValue(Number(price))
        : '-');

  const priceClass =
    size === 'detail'
      ? 'text-[20px] font-semibold text-pe-text'
      : 'text-[15px] font-semibold text-pe-text';
  const changeClass =
    size === 'detail'
      ? `text-[20px] font-semibold tabular-nums ${pnlClass(tone)}`
      : `text-sm font-semibold tabular-nums ${pnlClass(tone)}`;
  const labelClass = 'text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted';
  const changeText = `${amount != null ? formatValue(amount) : '-'}${
    showPct ? ` (${formatPct(pctValue)})` : ''
  }`;

  if (size === 'detail') {
    return (
      <div className={`flex items-start gap-8 ${className}`.trim()}>
        <div className="min-w-0">
          <p className={labelClass}>Current Price</p>
          <p className={priceClass}>{priceDisplay}</p>
        </div>
        {hasChange ? (
          <div className="min-w-0">
            <p className={labelClass}>Today&apos;s Change</p>
            <p className={changeClass}>{changeText}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <p className={labelClass}>Current Price</p>
      <p className={priceClass}>{priceDisplay}</p>
      {hasChange ? (
        <div className="mt-1">
          <p className={labelClass}>Today&apos;s Change</p>
          <p className={changeClass}>{changeText}</p>
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
  logoIconUrl,
  assetType,
  assetKey,
  price,
  changePct,
  previousClose,
  change,
  formatAsCurrency = true,
  metaValue,
  priceSource,
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
      <div className="flex items-start gap-3">
        <AssetLogo
          logoIconUrl={logoIconUrl}
          assetType={assetType}
          assetKey={assetKey ?? ticker}
          name={name}
          size="md"
          priority
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-pe-text">{name}</h1>
          {ticker ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-pe-text-muted">
              {ticker}
              {String(priceSource ?? '').toLowerCase() === 'bse' ? (
                <span className="rounded bg-pe-accent-wash px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-pe-accent">
                  BSE
                </span>
              ) : null}
            </p>
          ) : null}
          {subtitle ? <p className="mt-0.5 text-sm text-pe-text-secondary">{subtitle}</p> : null}
        </div>
      </div>

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
