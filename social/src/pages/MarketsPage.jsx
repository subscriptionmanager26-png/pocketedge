import { useMemo, useState } from 'react';
import PageHeader, { PageHeaderRow, PageHeaderSearch } from '../components/PageHeader';
import UnderlineTabs from '../components/UnderlineTabs';
import { useMarketTabData } from '../hooks/useMarketTabData';
import { formatPct, formatPrice, pnlClass } from '../lib/format';
import { formatTicker } from '../lib/tickers';

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

function formatIndexGroup(group) {
  if (!group) return null;
  return group
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatIndexValue(value) {
  if (value == null) return '—';
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function formatNavDate(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MarketsPage({ onSelectStock, onSelectFund }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('stocks');
  const { items, syncedAt, loading, error } = useMarketTabData(tab);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    let list = [...items];
    if (q) {
      list = list.filter((item) => matchesQuery(item, tab, q));
    }

    if (tab === 'commodity') {
      return list.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    }

    if (tab === 'mutual_funds') {
      return list.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    }

    return list.sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0));
  }, [items, q, tab]);

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
        {syncedAt ? (
          <p className="mb-4 text-xs text-pe-text-muted">
            Data synced {new Date(syncedAt).toLocaleString('en-IN')}
          </p>
        ) : null}

        {loading ? (
          <p className="py-10 text-center text-sm text-pe-text-secondary">Loading market data…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-pe-negative">{error}</p>
        ) : null}

        {!loading && !error && tab === 'stocks' ? (
          <MarketList empty={filtered.length === 0} emptyMessage="No stocks found">
            {filtered.map((stock) => (
              <MarketRow
                key={stock.symbol}
                title={formatTicker(stock.symbol)}
                subtitle={stock.name}
                primaryValue={stock.price != null ? formatPrice(stock.price) : '—'}
                changePct={stock.changePct}
                onClick={() => onSelectStock?.(stock.symbol)}
              />
            ))}
          </MarketList>
        ) : null}

        {!loading && !error && tab === 'mutual_funds' ? (
          <MarketList empty={filtered.length === 0} emptyMessage="No mutual funds found">
            {filtered.map((fund) => (
              <MarketRow
                key={fund.schemeCode}
                title={fund.name}
                subtitle={[fund.category, fund.subCategory].filter(Boolean).join(' · ') || fund.amc}
                primaryValue={fund.nav != null ? formatPrice(fund.nav) : '—'}
                secondaryValue={fund.navDate ? `NAV · ${formatNavDate(fund.navDate)}` : null}
                onClick={() => onSelectFund?.(fund.schemeCode)}
              />
            ))}
          </MarketList>
        ) : null}

        {!loading && !error && tab === 'etf' ? (
          <MarketList empty={filtered.length === 0} emptyMessage="No ETFs found">
            {filtered.map((etf) => (
              <MarketRow
                key={etf.symbol}
                title={formatTicker(etf.symbol)}
                subtitle={etf.name}
                primaryValue={etf.ltp != null ? formatPrice(etf.ltp) : '—'}
                changePct={etf.changePct}
                onClick={() => onSelectStock?.(etf.symbol)}
              />
            ))}
          </MarketList>
        ) : null}

        {!loading && !error && tab === 'indices' ? (
          <MarketList empty={filtered.length === 0} emptyMessage="No indices found">
            {filtered.map((index) => (
              <MarketRow
                key={index.id}
                title={index.name}
                subtitle={formatIndexGroup(index.group)}
                primaryValue={formatIndexValue(index.value)}
                changePct={index.changePct}
              />
            ))}
          </MarketList>
        ) : null}

        {!loading && !error && tab === 'commodity' ? (
          <MarketList empty={filtered.length === 0} emptyMessage="No commodities found">
            {filtered.map((item) => (
              <MarketRow
                key={`${item.id}-${item.location}`}
                title={item.name}
                subtitle={[item.unit, item.location].filter(Boolean).join(' · ')}
                primaryValue={item.spotPrice != null ? formatPrice(item.spotPrice) : '—'}
              />
            ))}
          </MarketList>
        ) : null}
      </div>
    </div>
  );
}

function matchesQuery(item, tab, q) {
  switch (tab) {
    case 'stocks':
    case 'etf':
      return (
        item.symbol?.toLowerCase().includes(q) ||
        item.name?.toLowerCase().includes(q) ||
        item.ticker?.toLowerCase().includes(q)
      );
    case 'mutual_funds':
      return (
        item.name?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.subCategory?.toLowerCase().includes(q) ||
        item.amc?.toLowerCase().includes(q) ||
        item.schemeCode?.includes(q)
      );
    case 'indices':
      return (
        item.id?.toLowerCase().includes(q) ||
        item.name?.toLowerCase().includes(q) ||
        item.symbol?.toLowerCase().includes(q) ||
        item.group?.toLowerCase().includes(q)
      );
    case 'commodity':
      return (
        item.id?.toLowerCase().includes(q) ||
        item.name?.toLowerCase().includes(q) ||
        item.symbol?.toLowerCase().includes(q) ||
        item.location?.toLowerCase().includes(q)
      );
    default:
      return true;
  }
}

function MarketList({ children, empty, emptyMessage }) {
  if (empty) {
    return (
      <p className="py-10 text-center text-sm text-pe-text-secondary">{emptyMessage}</p>
    );
  }

  return <div className="divide-y divide-pe-border">{children}</div>;
}

function MarketRow({ title, subtitle, primaryValue, secondaryValue, changePct, onClick }) {
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
      {primaryValue != null || changePct != null || secondaryValue ? (
        <div className="shrink-0 text-right">
          {primaryValue != null ? (
            <p className="text-[15px] font-semibold text-pe-text">{primaryValue}</p>
          ) : null}
          {changePct != null ? (
            <p className={`text-sm font-semibold ${pnlClass(changePct)}`}>
              {formatPct(changePct)}
            </p>
          ) : null}
          {secondaryValue ? (
            <p className="text-xs text-pe-text-muted">{secondaryValue}</p>
          ) : null}
        </div>
      ) : null}
    </Tag>
  );
}
