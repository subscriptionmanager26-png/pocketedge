export default function AssetProductHeader({ name, ticker, type, price }) {
  return (
    <section className="border-b border-pe-border px-4 py-5">
      <h1 className="font-serif text-2xl font-bold text-pe-text">{name}</h1>
      {ticker ? <p className="mt-0.5 text-sm text-pe-text-muted">{ticker}</p> : null}
      {type ? (
        <p className="mt-2">
          <span className="inline-flex rounded-full bg-pe-surface px-2.5 py-0.5 text-[11px] font-semibold text-pe-text-secondary">
            {type}
          </span>
        </p>
      ) : null}
      {price ? (
        <p className="mt-3 font-serif text-3xl font-bold text-pe-text">{price}</p>
      ) : null}
    </section>
  );
}
