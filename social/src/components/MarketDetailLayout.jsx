import { ArrowLeft } from 'lucide-react';
import PageHeader from './PageHeader';

function formatIndexGroup(group) {
  if (!group) return null;
  return group
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function MetricTile({ label, value, tone }) {
  return (
    <div className="rounded-[10px] border border-pe-border bg-pe-surface px-3 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
        {label}
      </p>
      <p
        className={`mt-1.5 text-[15px] font-semibold ${
          tone === 'positive'
            ? 'text-pe-positive'
            : tone === 'negative'
              ? 'text-pe-negative'
              : 'text-pe-text'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function MarketDetailHeader({ name, symbol, type, price, subtitle }) {
  return (
    <section className="border-b border-pe-border px-4 py-5">
      <h1 className="text-2xl font-bold text-pe-text">{name}</h1>
      {symbol && symbol !== name ? (
        <p className="mt-0.5 text-sm text-pe-text-muted">{symbol}</p>
      ) : null}
      {subtitle ? <p className="mt-1 text-sm text-pe-text-secondary">{subtitle}</p> : null}
      <p className="mt-2">
        <span className="inline-flex rounded-full bg-pe-surface px-2.5 py-0.5 text-[11px] font-semibold text-pe-text-secondary">
          {type}
        </span>
      </p>
      {price ? <p className="mt-3 text-3xl font-bold text-pe-text">{price}</p> : null}
    </section>
  );
}

export function MarketDetailShell({ title, onBack, children }) {
  return (
    <div>
      <PageHeader desktopOnly>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-pe-text-secondary hover:text-pe-text"
        >
          <ArrowLeft className="h-4 w-4" />
          {title}
        </button>
      </PageHeader>
      {children}
    </div>
  );
}

export { formatIndexGroup };
