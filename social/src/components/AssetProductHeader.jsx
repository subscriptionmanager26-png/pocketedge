import { formatPct, pnlClass } from '../lib/format';

export default function AssetProductHeader({
  name,
  ticker,
  subtitle,
  type,
  priceLabel,
  price,
  changeLabel,
  changePct,
  metaLabel,
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

      {price || changePct != null ? (
        <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
          {price ? (
            <div>
              {priceLabel ? (
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                  {priceLabel}
                </p>
              ) : null}
              <p className="text-3xl font-bold text-pe-text">{price}</p>
            </div>
          ) : null}
          {changePct != null && Number.isFinite(Number(changePct)) ? (
            <div>
              {changeLabel ? (
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                  {changeLabel}
                </p>
              ) : null}
              <p className={`text-xl font-bold tabular-nums ${pnlClass(changePct)}`}>
                {formatPct(changePct)}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {metaValue ? (
        <p className="mt-2 text-sm text-pe-text-muted">
          {metaLabel ? (
            <span className="mr-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
              {metaLabel}
            </span>
          ) : null}
          {metaValue}
        </p>
      ) : null}
    </section>
  );
}
