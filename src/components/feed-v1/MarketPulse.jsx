function pctClass(pct) {
  if (pct == null || Number.isNaN(Number(pct))) return 'text-[var(--fv-text-muted)]';
  if (Number(pct) > 0) return 'text-[var(--fv-positive)]';
  if (Number(pct) < 0) return 'text-[var(--fv-negative)]';
  return 'text-[var(--fv-text-muted)]';
}

function formatPct(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

export default function MarketPulse({ data, compact = false }) {
  if (!data) return null;

  return (
    <section
      className={`fv-card ${compact ? 'mx-4 p-5 md:mx-8' : 'mx-4 mt-5 p-5 md:mx-8 md:p-6'}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="fv-card-title">{compact ? 'Market Pulse' : 'Market Pulse'}</h2>
        <p className="fv-caption">{data.asOf}</p>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
        {data.indices.map((idx) => (
          <div
            key={idx.name}
            className="rounded-[16px] border border-[var(--fv-border)] bg-[var(--fv-canvas)] px-3.5 py-3"
          >
            <p className="fv-label">{idx.name}</p>
            <p className="mt-1 text-[18px] font-semibold tabular-nums tracking-tight text-[var(--fv-text)]">
              {idx.value}
            </p>
            <p className={`mt-0.5 text-[13px] font-semibold tabular-nums ${pctClass(idx.changePct)}`}>
              {formatPct(idx.changePct)}
            </p>
          </div>
        ))}
      </div>

      {!compact ? (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="fv-label">Breadth</p>
            <p className="fv-meta">
              <span className="text-[var(--fv-positive)]">{data.breadth.advances}</span>
              {' adv · '}
              <span className="text-[var(--fv-negative)]">{data.breadth.declines}</span>
              {' dec · '}
              {data.breadth.unchanged} unch
            </p>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="fv-label mb-2">Leaders</p>
              <ul className="space-y-2">
                {data.leaders.map((row) => (
                  <li key={row.ticker} className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold text-[var(--fv-text)]">
                      ${row.ticker}
                    </span>
                    <span className={`text-[13px] font-semibold tabular-nums ${pctClass(row.changePct)}`}>
                      {formatPct(row.changePct)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="fv-label mb-2">Laggards</p>
              <ul className="space-y-2">
                {data.laggards.map((row) => (
                  <li key={row.ticker} className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold text-[var(--fv-text)]">
                      ${row.ticker}
                    </span>
                    <span className={`text-[13px] font-semibold tabular-nums ${pctClass(row.changePct)}`}>
                      {formatPct(row.changePct)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
