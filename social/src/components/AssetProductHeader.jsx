export default function AssetProductHeader({ name, ticker, subtitle, type, price }) {
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
      {price ? <p className="mt-3 text-3xl font-bold text-pe-text">{price}</p> : null}
    </section>
  );
}
