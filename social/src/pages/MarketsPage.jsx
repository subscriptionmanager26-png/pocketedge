import { useMemo, useState } from 'react';
import PageHeader, { PageHeaderRow, PageHeaderSearch } from '../components/PageHeader';
import UnderlineTabs from '../components/UnderlineTabs';
import { FUNDS } from '../data/fundData';
import { STOCKS } from '../data/mockData';
import { formatPct, formatPrice, pnlClass } from '../lib/format';
import { formatTicker } from '../lib/tickers';

const ALL_STOCKS = Object.entries(STOCKS).map(([ticker, s]) => ({ ticker, ...s }));
const ALL_FUNDS = Object.values(FUNDS);

const MARKET_INDICES = [
  { id: 'NIFTY50', name: 'Nifty 50', value: 24812.4, changePct: 0.41 },
  { id: 'SENSEX', name: 'Sensex', value: 81420.6, changePct: 0.38 },
  { id: 'BANKNIFTY', name: 'Bank Nifty', value: 53190.2, changePct: -0.22 },
  { id: 'NIFTYIT', name: 'Nifty IT', value: 36420.8, changePct: -0.54 },
  { id: 'NIFTYMID', name: 'Nifty Midcap 100', value: 52180.3, changePct: 0.62 },
  { id: 'INDIAVIX', name: 'India VIX', value: 12.4, changePct: -1.8 },
];

const MARKET_COMMODITIES = [
  { id: 'GOLD', name: 'Gold', subtitle: 'MCX · per 10g', price: 62450, changePct: 0.32 },
  { id: 'SILVER', name: 'Silver', subtitle: 'MCX · per kg', price: 72840, changePct: -0.18 },
  { id: 'CRUDEOIL', name: 'Crude Oil', subtitle: 'MCX · per bbl', price: 6420, changePct: 1.12 },
  { id: 'NATGAS', name: 'Natural Gas', subtitle: 'MCX · per mmBtu', price: 198.5, changePct: -0.84 },
  { id: 'COPPER', name: 'Copper', subtitle: 'MCX · per kg', price: 842.6, changePct: 0.45 },
  { id: 'ZINC', name: 'Zinc', subtitle: 'MCX · per kg', price: 268.4, changePct: -0.29 },
];

const MARKET_TABS = [
  { id: 'stocks', label: 'Stocks' },
  { id: 'mutual_funds', label: 'Mutual Funds' },
  { id: 'etf', label: 'ETF' },
  { id: 'indices', label: 'Indices' },
  { id: 'commodity', label: 'Commodity' },
];

const SEARCH_PLACEHOLDERS = {
  stocks: 'Search stocks',
  mutual_funds: 'Search mutual funds',
  etf: 'Search ETFs',
  indices: 'Search indices',
  commodity: 'Search commodities',
};

function isEtfTicker(ticker) {
  return /BEES$/i.test(ticker);
}

function formatIndexValue(value) {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 1 });
}

export default function MarketsPage({ onSelectStock, onSelectFund }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('stocks');

  const q = query.trim().toLowerCase();

  const stocks = useMemo(() => {
    let list = ALL_STOCKS.filter((s) => !isEtfTicker(s.ticker));
    if (q) {
      list = list.filter(
        (s) =>
          s.ticker.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  }, [q]);

  const mutualFunds = useMemo(() => {
    let list = [...ALL_FUNDS];
    if (q) {
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.category?.toLowerCase().includes(q) ||
          f.amc?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [q]);

  const etfs = useMemo(() => {
    let list = ALL_STOCKS.filter((s) => isEtfTicker(s.ticker));
    if (q) {
      list = list.filter(
        (s) =>
          s.ticker.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  }, [q]);

  const indices = useMemo(() => {
    let list = [...MARKET_INDICES];
    if (q) {
      list = list.filter(
        (item) =>
          item.id.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  }, [q]);

  const commodities = useMemo(() => {
    let list = [...MARKET_COMMODITIES];
    if (q) {
      list = list.filter(
        (item) =>
          item.id.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.subtitle?.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  }, [q]);

  const handleTabChange = (next) => {
    setTab(next);
    setQuery('');
  };

  return (
    <div>
      <PageHeader
        footer={
          <PageHeaderRow>
            <PageHeaderSearch
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={SEARCH_PLACEHOLDERS[tab]}
            />
          </PageHeaderRow>
        }
      >
        <UnderlineTabs embedded tabs={MARKET_TABS} active={tab} onChange={handleTabChange} />
      </PageHeader>

      <div className="px-4 py-6">
        {tab === 'stocks' && (
          <MarketList empty={stocks.length === 0} emptyMessage="No stocks found">
            {stocks.map((stock) => (
              <MarketRow
                key={stock.ticker}
                title={formatTicker(stock.ticker)}
                subtitle={stock.name}
                primaryValue={formatPrice(stock.price)}
                changePct={stock.changePct}
                onClick={() => onSelectStock?.(stock.ticker)}
              />
            ))}
          </MarketList>
        )}

        {tab === 'mutual_funds' && (
          <MarketList empty={mutualFunds.length === 0} emptyMessage="No mutual funds found">
            {mutualFunds.map((fund) => (
              <MarketRow
                key={fund.id}
                title={fund.name}
                subtitle={fund.category}
                primaryValue={fund.nav != null ? formatPrice(fund.nav) : null}
                changePct={fund.return1Y}
                onClick={() => onSelectFund?.(fund.id)}
              />
            ))}
          </MarketList>
        )}

        {tab === 'etf' && (
          <MarketList empty={etfs.length === 0} emptyMessage="No ETFs found">
            {etfs.map((etf) => (
              <MarketRow
                key={etf.ticker}
                title={formatTicker(etf.ticker)}
                subtitle={etf.name}
                primaryValue={formatPrice(etf.price)}
                changePct={etf.changePct}
                onClick={() => onSelectStock?.(etf.ticker)}
              />
            ))}
          </MarketList>
        )}

        {tab === 'indices' && (
          <MarketList empty={indices.length === 0} emptyMessage="No indices found">
            {indices.map((index) => (
              <MarketRow
                key={index.id}
                title={index.name}
                primaryValue={formatIndexValue(index.value)}
                changePct={index.changePct}
              />
            ))}
          </MarketList>
        )}

        {tab === 'commodity' && (
          <MarketList empty={commodities.length === 0} emptyMessage="No commodities found">
            {commodities.map((item) => (
              <MarketRow
                key={item.id}
                title={item.name}
                subtitle={item.subtitle}
                primaryValue={formatPrice(item.price)}
                changePct={item.changePct}
              />
            ))}
          </MarketList>
        )}
      </div>
    </div>
  );
}

function MarketList({ children, empty, emptyMessage }) {
  if (empty) {
    return (
      <p className="py-10 text-center text-sm text-pe-text-secondary">{emptyMessage}</p>
    );
  }

  return <div className="divide-y divide-pe-border">{children}</div>;
}

function MarketRow({ title, subtitle, primaryValue, changePct, onClick }) {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex w-full items-center justify-between py-3.5 text-left ${
        onClick ? 'transition hover:bg-pe-surface' : ''
      }`}
    >
      <div className="min-w-0 pr-3">
        <p className="text-[15px] font-semibold text-pe-text">{title}</p>
        {subtitle ? <p className="text-sm text-pe-text-muted">{subtitle}</p> : null}
      </div>
      {primaryValue != null || changePct != null ? (
        <div className="shrink-0 text-right">
          {primaryValue != null ? (
            <p className="text-[15px] font-semibold text-pe-text">{primaryValue}</p>
          ) : null}
          {changePct != null ? (
            <p className={`text-sm font-semibold ${pnlClass(changePct)}`}>
              {formatPct(changePct)}
            </p>
          ) : null}
        </div>
      ) : null}
    </Tag>
  );
}
