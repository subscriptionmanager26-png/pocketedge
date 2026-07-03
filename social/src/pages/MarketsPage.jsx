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
    <div className="space-y-6 px-4 py-5">
      <section>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-pe-text-muted">
          Indices snapshot
        </p>
        <div className="grid grid-cols-2 gap-3">
          <IndexCard name="Nifty 50" value="24,812" change={0.41} />
          <IndexCard name="Sensex" value="81,420" change={0.38} />
          <IndexCard name="Bank Nifty" value="53,190" change={-0.22} />
          <IndexCard name="India VIX" value="12.4" change={-1.8} />
        </div>
      </section>

      <section>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-pe-text-muted">
          Top movers
        </p>
        <div className="space-y-1">
          {MOVERS.slice(0, 6).map((stock) => (
            <MoverRow key={stock.ticker} stock={stock} />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4">
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-pe-positive">
            Gainers
          </p>
          {GAINERS.slice(0, 3).map((s) => (
            <MiniMover key={s.ticker} stock={s} />
          ))}
        </section>
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-pe-negative">
            Losers
          </p>
          {LOSERS.slice(0, 3).map((s) => (
            <MiniMover key={s.ticker} stock={s} />
          ))}
        </section>
      </div>

      <p className="text-center text-[11px] text-pe-text-muted">
        Live prices are demo data. Brokerage sync is the upgrade path.
      </p>
    </div>
  );
}

function IndexCard({ name, value, change }) {
  return (
    <div className="rounded-xl border border-pe-border bg-pe-surface px-3 py-3">
      <p className="text-[11px] text-pe-text-muted">{name}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      <p className={`text-xs font-medium ${pnlClass(change)}`}>{formatPct(change)}</p>
    </div>
  );
}

function MoverRow({ stock }) {
  return (
    <div className="flex items-center justify-between border-b border-pe-border/60 py-3">
      <div>
        <p className="text-sm font-semibold">${stock.ticker}</p>
        <p className="text-xs text-pe-text-muted">{stock.name}</p>
      </div>
      <div className="flex items-center gap-3">
        <Sparkline data={stock.spark} positive={stock.changePct >= 0} />
        <div className="min-w-[4.5rem] text-right">
          <p className="text-sm font-medium">{formatPrice(stock.price)}</p>
          <p className={`text-xs font-medium ${pnlClass(stock.changePct)}`}>
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
      <span className="font-medium">${stock.ticker}</span>
      <span className={`text-xs font-medium ${pnlClass(stock.changePct)}`}>
        {formatPct(stock.changePct)}
      </span>
    </div>
  );
}
