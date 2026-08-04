import { dayChangeAmount, formatNavDate, formatPct, formatPrice, pnlClass } from '../lib/format';
import AssetLogo from './AssetLogo';

function formatSignedPlain(n) {
  if (n == null || Number.isNaN(n)) return '-';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function hasMeaningfulMove(amount, pctValue) {
  const absAmount = amount != null && Number.isFinite(amount) ? Math.abs(amount) : null;
  const absPct = pctValue != null && Number.isFinite(pctValue) ? Math.abs(pctValue) : null;
  if (absAmount != null && absAmount >= 0.005) return true;
  if (absPct != null && absPct >= 0.005) return true;
  return false;
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
  priceLabel = null,
  asOfDate = null,
  formatAsCurrency = true,
  size = 'row',
  className = '',
  assetType = null,
}) {
  const type = String(assetType ?? '').toLowerCase();
  const isFund = type === 'fund';
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
  const meaningful = hasMeaningfulMove(amount, showPct ? pctValue : null);
  // Show day move whenever we have one — session hours only gate live polling,
  // not whether the last session's change is displayed after the close.
  const hasChange = meaningful;
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
  const navDateLabel = formatNavDate(asOfDate);
  const resolvedPriceLabel =
    priceLabel ??
    (isFund
      ? navDateLabel
        ? `NAV (${navDateLabel})`
        : 'NAV'
      : 'Current Price');

  const priceClass =
    size === 'detail'
      ? 'text-[20px] font-semibold text-pe-text'
      : 'text-[15px] font-semibold text-pe-text';
  const changeClass =
    size === 'detail'
      ? `text-[20px] font-semibold tabular-nums ${pnlClass(tone)}`
      : `text-sm font-semibold tabular-nums ${pnlClass(tone)}`;
  const labelClass = 'text-[12px] font-medium text-pe-text-muted';
  const changeText = `${amount != null ? formatValue(amount) : '-'}${
    showPct ? ` (${formatPct(pctValue)})` : ''
  }`;

  if (size === 'detail') {
    return (
      <div className={`flex items-start gap-8 ${className}`.trim()}>
        <div className="min-w-0">
          <p className={labelClass}>{resolvedPriceLabel}</p>
          <p className={priceClass}>{priceDisplay}</p>
        </div>
        {hasChange ? (
          <div className="min-w-0">
            <p className={labelClass}>{isFund ? <>Day&apos;s Change</> : <>Today&apos;s Change</>}</p>
            <p className={changeClass}>{changeText}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <p className={priceClass}>{priceDisplay}</p>
      {hasChange ? <p className={changeClass}>{changeText}</p> : null}
    </div>
  );
}

export default function AssetProductHeader({
  name,
  ticker,
  subtitle,
  type: _type,
  logoIconUrl,
  assetType,
  assetKey,
  price,
  changePct,
  previousClose,
  change,
  asOfDate = null,
  priceLabel = null,
  formatAsCurrency = true,
  metaValue,
  priceSource,
}) {
  void _type;
  return (
    <section className="px-4 py-5 md:px-6">
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
          <h1 className="text-[22px] font-semibold tracking-tight text-pe-text md:text-2xl">{name}</h1>
          {ticker ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-pe-text-muted">
              {ticker}
              {String(priceSource ?? '').toLowerCase() === 'bse' ? (
                <span className="rounded bg-pe-accent-wash px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-pe-accent">
                  BSE
                </span>
              ) : null}
            </p>
          ) : null}
          {subtitle ? <p className="mt-0.5 text-[13px] text-pe-text-secondary">{subtitle}</p> : null}
        </div>
      </div>

      {price != null || changePct != null ? (
        <QuoteChangeBlock
          className="mt-4"
          size="detail"
          assetType={assetType}
          price={price}
          changePct={changePct}
          previousClose={previousClose}
          change={change}
          asOfDate={asOfDate}
          priceLabel={priceLabel}
          formatAsCurrency={formatAsCurrency}
          priceText={typeof price === 'string' ? price : null}
        />
      ) : null}

      {metaValue ? <p className="mt-2 text-[13px] text-pe-text-muted">{metaValue}</p> : null}
    </section>
  );
}
