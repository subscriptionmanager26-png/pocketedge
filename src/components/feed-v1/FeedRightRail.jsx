import { useState } from 'react';
import { MessageSquare } from 'lucide-react';

function formatPct(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function pctClass(pct) {
  if (Number(pct) > 0) return 'text-[var(--fv-positive)]';
  if (Number(pct) < 0) return 'text-[var(--fv-negative)]';
  return 'text-[var(--fv-text-muted)]';
}

function Sparkline({ up = true, width = 56 }) {
  const stroke = up ? 'var(--fv-positive)' : 'var(--fv-negative)';
  return (
    <svg width={width} height="24" viewBox="0 0 64 28" fill="none" aria-hidden className="shrink-0">
      <path
        d={
          up
            ? 'M1 22 C10 20, 14 18, 20 14 S32 6, 40 10 S52 18, 63 4'
            : 'M1 6 C12 8, 16 14, 24 16 S40 12, 48 18 S56 24, 63 22'
        }
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

const MARKET_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'indices', label: 'Indices' },
  { id: 'sector', label: 'Sector' },
];

export default function FeedRightRail({
  market,
  trending,
  discussions,
  people,
  stacked = false,
  live = false,
}) {
  const [marketTab, setMarketTab] = useState('overview');

  const shellClass = stacked
    ? 'flex flex-col gap-5'
    : 'hidden h-dvh w-[min(420px,32vw)] flex-col overflow-y-auto overscroll-y-contain bg-white px-4 py-4 md:fixed md:right-0 md:top-0 md:z-30 md:flex';

  return (
    <aside className={shellClass}>
      <div className={`flex flex-col gap-5 ${stacked ? '' : 'pb-8 pt-[72px]'}`}>
        {/* Market Today */}
        <section className="fv-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[16px] font-semibold text-[var(--fv-text)]">Market Today</h2>
            {live ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fv-positive)]/12 px-2.5 py-1 text-[11px] font-semibold text-[var(--fv-positive)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--fv-positive)]" />
                Live
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex gap-1">
            {MARKET_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMarketTab(t.id)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition duration-150 ${
                  marketTab === t.id
                    ? 'bg-[var(--fv-text)] text-white'
                    : 'text-[var(--fv-text-secondary)] hover:bg-black/[0.04]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <ul className="mt-4 space-y-3">
            {(market?.indices ?? []).slice(0, 2).map((idx) => (
              <li key={idx.name} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--fv-text)]">
                    {idx.name.replace(' ', ' ').toUpperCase().includes('NIFTY')
                      ? idx.name.toUpperCase()
                      : idx.name.toUpperCase()}
                  </p>
                  <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-[var(--fv-text)]">
                    {idx.value}
                  </p>
                  <p className={`text-[12px] font-semibold tabular-nums ${pctClass(idx.changePct)}`}>
                    {formatPct(idx.changePct)}
                  </p>
                </div>
                <Sparkline up={Number(idx.changePct) >= 0} />
              </li>
            ))}
          </ul>
        </section>

        {/* Trending */}
        <section className="fv-card p-5">
          <h2 className="text-[16px] font-semibold text-[var(--fv-text)]">
            Trending on PocketEdge
          </h2>
          <ul className="mt-3 space-y-3">
            {(trending ?? []).map((row) => (
              <li key={row.ticker} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--fv-accent)]/10 text-[12px] font-bold text-[var(--fv-accent)]">
                  {row.ticker.slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[var(--fv-text)]">
                    {row.name}
                  </p>
                  <p className="fv-caption">{row.ticker}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-[13px] font-semibold tabular-nums ${pctClass(row.changePct)}`}>
                    {formatPct(row.changePct)}
                  </p>
                  <Sparkline up={Number(row.changePct) >= 0} width={48} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Top Discussions */}
        <section className="fv-card p-5">
          <h2 className="text-[16px] font-semibold text-[var(--fv-text)]">Top Discussions</h2>
          <ul className="mt-3 space-y-3">
            {(discussions ?? []).map((d) => (
              <li key={d.id} className="flex items-start gap-2.5">
                <MessageSquare
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fv-text-muted)]"
                  strokeWidth={2}
                />
                <div className="min-w-0">
                  <p className="text-[14px] font-medium leading-snug text-[var(--fv-text)]">
                    {d.title}
                  </p>
                  <p className="fv-caption mt-0.5">{d.replies} replies</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* People to Follow */}
        <section className="fv-card p-5">
          <h2 className="text-[16px] font-semibold text-[var(--fv-text)]">People to Follow</h2>
          <ul className="mt-3 space-y-3.5">
            {(people ?? []).map((p) => (
              <li key={p.id} className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--fv-accent)]/12 text-[14px] font-semibold text-[var(--fv-accent)]">
                  {p.avatar}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[var(--fv-text)]">{p.name}</p>
                  <p className="fv-caption truncate">{p.role || p.focus}</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-full border-0 bg-[var(--fv-accent)]/10 px-3 py-1.5 text-[12px] font-semibold text-[var(--fv-accent)] transition hover:bg-[var(--fv-accent)] hover:text-white"
                >
                  Follow
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Portfolio CTA */}
        <section className="overflow-hidden rounded-[20px] bg-gradient-to-br from-[#fff4ec] via-white to-[#ffe8d6] p-5 shadow-[var(--fv-shadow)]">
          <h2 className="text-[16px] font-semibold text-[var(--fv-text)]">Create your portfolio</h2>
          <p className="fv-meta mt-1.5 leading-relaxed">
            Track holdings, share theses, and see how you compare with serious investors.
          </p>
          <button type="button" className="fv-btn-primary mt-4 h-10 w-full text-[14px]">
            Get started
          </button>
        </section>
      </div>
    </aside>
  );
}
