import Sparkline from '../components/Sparkline';
import { STOCKS } from '../data/mockData';
import { formatPct, formatPrice, pnlClass } from '../lib/format';

const MOVERS = Object.entries(STOCKS)
  .map(([ticker, s]) => ({ ticker, ...s }))
  .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

const GAINERS = [...MOVERS].filter((s) => s.changePct > 0).sort((a, b) => b.changePct - a.changePct);
const LOSERS = [...MOVERS].filter((s) => s.changePct < 0).sort((a, b) => a.changePct - b.changePct);

export default function MarketsPage() {
  return (
    <div className="space-y-8 px-4 py-6 md:px-6">
      <section>
        <SectionLabel>Indices snapshot</SectionLabel>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <IndexCard name="Nifty 50" value="24,812" change={0.41} />
          <IndexCard name="Sensex" value="81,420" change={0.38} />
          <IndexCard name="Bank Nifty" value="53,190" change={-0.22} />
          <IndexCard name="India VIX" value="12.4" change={-1.8} />
        </div>
      </section>

      <section>
        <SectionLabel>Top movers</SectionLabel>
        <div className="mt-2 divide-y divide-pe-border">
          {MOVERS.slice(0, 6).map((stock) => (
            <MoverRow key={stock.ticker} stock={stock} />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4">
        <section className="rounded-xl border border-pe-border bg-pe-surface p-3.5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-pe-positive">
            Gainers
          </p>
          {GAINERS.slice(0, 3).map((s) => (
            <MiniMover key={s.ticker} stock={s} />
          ))}
        </section>
        <section className="rounded-xl border border-pe-border bg-pe-surface p-3.5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-pe-negative">
            Losers
          </p>
          {LOSERS.slice(0, 3).map((s) => (
            <MiniMover key={s.ticker} stock={s} />
          ))}
        </section>
      </div>

      <p className="text-center text-xs text-pe-text-secondary">
        Live prices are demo data. Brokerage sync is the upgrade path.
      </p>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pe-text-secondary">
      {children}
    </p>
  );
}

function IndexCard({ name, value, change }) {
  return (
    <div className="rounded-xl border border-pe-border bg-pe-surface px-3.5 py-3.5">
      <p className="text-sm text-pe-text-secondary">{name}</p>
      <p className="mt-1 text-xl font-semibold text-pe-text">{value}</p>
      <p className={`mt-0.5 text-sm font-medium ${pnlClass(change)}`}>{formatPct(change)}</p>
    </div>
  );
}

function MoverRow({ stock }) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <div>
        <p className="text-[15px] font-semibold text-pe-text">${stock.ticker}</p>
        <p className="text-sm text-pe-text-secondary">{stock.name}</p>
      </div>
      <div className="flex items-center gap-3">
        <Sparkline data={stock.spark} positive={stock.changePct >= 0} />
        <div className="min-w-[4.75rem] text-right">
          <p className="text-[15px] font-semibold text-pe-text">{formatPrice(stock.price)}</p>
          <p className={`text-sm font-medium ${pnlClass(stock.changePct)}`}>
            {formatPct(stock.changePct)}
          </p>
        </div>
      </div>
    </div>
  );
}

function MiniMover({ stock }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="font-medium text-pe-text">${stock.ticker}</span>
      <span className={`font-semibold ${pnlClass(stock.changePct)}`}>
        {formatPct(stock.changePct)}
      </span>
    </div>
  );
}
