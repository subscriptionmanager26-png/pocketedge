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

export function MostDiscussedModule({ items }) {
  return (
    <section className="fv-card mx-4 p-6 md:mx-8">
      <h2 className="fv-card-title">Most Discussed Today</h2>
      <p className="fv-caption mt-1">Stocks with the fastest-growing conversation</p>
      <ul className="mt-4 divide-y divide-[var(--fv-border)]">
        {items.map((row, i) => (
          <li key={row.ticker} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="fv-caption w-4 tabular-nums">{i + 1}</span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-[var(--fv-text)]">
                  ${row.ticker}
                </p>
                <p className="fv-caption truncate">{row.name}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-[13px] font-semibold tabular-nums ${pctClass(row.changePct)}`}>
                {formatPct(row.changePct)}
              </p>
              <p className="fv-caption">{row.posts} posts</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ConsensusShiftModule({ items }) {
  return (
    <section className="fv-card mx-4 p-6 md:mx-8">
      <h2 className="fv-card-title">Consensus Shift</h2>
      <p className="fv-caption mt-1">Investors who recently changed their stance</p>
      <ul className="mt-4 space-y-4">
        {items.map((row) => (
          <li
            key={row.id}
            className="rounded-[16px] border border-[var(--fv-border)] bg-[var(--fv-canvas)] px-4 py-3.5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[15px] font-semibold text-[var(--fv-text)]">{row.author}</p>
              <p className="fv-label">
                ${row.ticker} · {row.from} →{' '}
                <span className="text-[var(--fv-accent)]">{row.to}</span>
              </p>
            </div>
            <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--fv-text-secondary)]">
              {row.note}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HighConvictionModule({ items }) {
  return (
    <section className="fv-card mx-4 p-6 md:mx-8">
      <h2 className="fv-card-title">High-Conviction Ideas</h2>
      <p className="fv-caption mt-1">From authors with strong historical track records</p>
      <ul className="mt-4 space-y-3">
        {items.map((row) => (
          <li
            key={row.id}
            className="rounded-[16px] border border-[var(--fv-border)] px-4 py-3.5 transition duration-150 hover:shadow-[var(--fv-shadow)]"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="fv-meta">
                {row.authorName} · ★ {row.rating} · {row.alphaPct}% Alpha
              </p>
              <p className="fv-label">${row.tickers.join(' · $')}</p>
            </div>
            <p className="fv-card-title mt-1.5 text-[16px]">{row.title}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SuggestedInvestorsModule({ investors }) {
  return (
    <section className="fv-card mx-4 p-6 md:mx-8">
      <h2 className="fv-card-title">Suggested Investors</h2>
      <p className="fv-caption mt-1">Serious capital. Verified track records.</p>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {investors.map((p) => (
          <div
            key={p.id}
            className="w-[min(220px,70vw)] shrink-0 rounded-[16px] border border-[var(--fv-border)] bg-[var(--fv-canvas)] p-4"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--fv-accent)]/10 text-[14px] font-semibold text-[var(--fv-accent)]">
                {p.avatar}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-[var(--fv-text)]">{p.name}</p>
                <p className="fv-caption truncate">★ {p.rating} · {p.years} yrs</p>
              </div>
            </div>
            <p className="fv-meta mt-3">
              {p.verifiedPortfolioInr} · {p.alphaPct}% Alpha
            </p>
            <p className="fv-caption mt-1 line-clamp-2">{p.focus}</p>
            <button type="button" className="fv-btn-primary mt-4 h-9 w-full text-[13px]">
              Follow
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
