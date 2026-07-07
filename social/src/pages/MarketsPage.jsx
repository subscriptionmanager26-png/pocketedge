import { useMemo, useState } from 'react';
import PageHeader, { PageHeaderRow, PageHeaderSearch } from '../components/PageHeader';
import UnderlineTabs from '../components/UnderlineTabs';
import { FUNDS } from '../data/fundData';
import { STOCKS } from '../data/mockData';
import { formatPct, formatPrice, pnlClass } from '../lib/format';
import { formatTicker } from '../lib/tickers';

const ALL_STOCKS = Object.entries(STOCKS).map(([ticker, s]) => ({ ticker, ...s }));
const ALL_FUNDS = Object.values(FUNDS);

const MARKET_FILTERS = [
  { id: 'movers', label: 'Movers' },
  { id: 'gainers', label: 'Gainers' },
  { id: 'losers', label: 'Losers' },
];

export default function MarketsPage({
  onSelectStock,
  onSelectFund,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('movers');

  const q = query.trim().toLowerCase();

  const stocks = useMemo(() => {
    let list = [...ALL_STOCKS];
    if (q) {
      list = list.filter(
        (s) =>
          s.ticker.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q)
      );
    }
    if (filter === 'gainers') {
      return list.filter((s) => s.changePct > 0).sort((a, b) => b.changePct - a.changePct);
    }
    if (filter === 'losers') {
      return list.filter((s) => s.changePct < 0).sort((a, b) => a.changePct - b.changePct);
    }
    return list.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  }, [q, filter]);

  return (
    <div>
      <PageHeader
        footer={
          <PageHeaderRow>
            <PageHeaderSearch
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stocks"
            />
          </PageHeaderRow>
        }
      >
        <UnderlineTabs embedded tabs={MARKET_FILTERS} active={filter} onChange={setFilter} />
      </PageHeader>

      <div className="space-y-8 px-4 py-6">
        {!q && filter === 'movers' && (
          <section>
            <SectionLabel>Indices snapshot</SectionLabel>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <IndexCard name="Nifty 50" value="24,812" change={0.41} />
              <IndexCard name="Sensex" value="81,420" change={0.38} />
              <IndexCard name="Bank Nifty" value="53,190" change={-0.22} />
              <IndexCard name="India VIX" value="12.4" change={-1.8} />
            </div>
          </section>
        )}

        <section>
          <SectionLabel>
            {q ? 'Stocks' : filter === 'gainers' ? 'Gainers' : filter === 'losers' ? 'Losers' : 'Top movers'}
          </SectionLabel>
          <div className="mt-2 divide-y divide-pe-border">
            {stocks.length === 0 ? (
              <p className="py-10 text-center text-sm text-pe-text-secondary">No stocks found</p>
            ) : (
              stocks.map((stock) => (
                  <button
                    key={stock.ticker}
                    type="button"
                    onClick={() => onSelectStock?.(stock.ticker)}
                    className="flex w-full items-center justify-between py-3.5 text-left transition hover:bg-pe-surface"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-[15px] font-semibold text-pe-text">{formatTicker(stock.ticker)}</p>
                      <p className="text-sm text-pe-text-muted">{stock.name}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[15px] font-semibold text-pe-text">
                        {formatPrice(stock.price)}
                      </p>
                    </div>
                  </button>
                ))
            )}
          </div>
        </section>

        {!q && (
          <section>
            <SectionLabel>Mutual funds</SectionLabel>
            <div className="mt-2 divide-y divide-pe-border">
              {ALL_FUNDS.slice(0, 6).map((fund) => (
                  <button
                    key={fund.id}
                    type="button"
                    onClick={() => onSelectFund?.(fund.id)}
                    className="flex w-full items-center justify-between py-3.5 text-left transition hover:bg-pe-surface"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-[15px] font-semibold text-pe-text">{fund.name}</p>
                      <p className="text-sm text-pe-text-muted">{fund.category}</p>
                    </div>
                  </button>
                ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
      {children}
    </p>
  );
}

function IndexCard({ name, value, change }) {
  return (
    <div className="rounded-[10px] border border-pe-border bg-pe-surface px-3.5 py-3.5">
      <p className="text-sm text-pe-text-secondary">{name}</p>
      <p className="mt-1 font-serif text-xl font-bold text-pe-text">{value}</p>
      <p className={`mt-0.5 text-sm font-semibold ${pnlClass(change)}`}>{formatPct(change)}</p>
    </div>
  );
}
