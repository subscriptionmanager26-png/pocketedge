import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader, { PageHeaderRow, PageHeaderSearch } from '../components/PageHeader';
import UnderlineTabs from '../components/UnderlineTabs';
import AssetLogo from '../components/AssetLogo';
import { MarketsListSkeleton } from '../components/PageSkeletons';
import { useMarketTabData } from '../hooks/useMarketTabData';
import { useSeoMeta } from '../hooks/useSeoMeta';
import { MARKET_MIN_SEARCH_CHARS } from '../lib/marketDataApi';
import { markTabPaint } from '../lib/perfMarks';
import { dayChangeAmount, formatPct, formatPrice, pnlClass } from '../lib/format';
import {
  commodityPath,
  etfPath,
  fundPath,
  indexPath,
  stockPath,
  tabPath,
} from '../lib/routes';
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
  if (value == null) return '-';
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function MarketsPage({
  sectionTab = 'stocks',
  onSectionTabChange,
  onSelectStock,
  onSelectFund,
  onSelectIndex,
  onSelectCommodity,
  guestMode = false,
}) {
  const [query, setQuery] = useState('');
  const tab = sectionTab;
  const { items, loading, error } = useMarketTabData(tab, query);

  useSeoMeta(
    guestMode
      ? {
          title: 'Markets',
          description:
            'Search Indian stocks, mutual funds, ETFs, indices, and commodities on PocketEdge.',
          path: tabPath('markets'),
        }
      : null
  );

  useEffect(() => {
    markTabPaint('markets');
  }, []);

  const handleTabChange = (next) => {
    onSectionTabChange?.(next);
    setQuery('');
  };

  const searchHint =
    query.trim().length > 0 && query.trim().length < MARKET_MIN_SEARCH_CHARS
      ? `Type at least ${MARKET_MIN_SEARCH_CHARS} characters to search`
      : null;

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
        {guestMode ? (
          <div className="mb-5">
            <h1 className="text-xl font-bold tracking-tight text-pe-text">Markets</h1>
            <p className="mt-1 text-sm text-pe-text-secondary">
              Search Indian stocks, mutual funds, ETFs, indices, and commodities.
            </p>
          </div>
        ) : null}

        {searchHint ? (
          <p className="mb-4 text-xs text-pe-text-muted">{searchHint}</p>
        ) : null}

        {loading ? (
          <MarketsListSkeleton />
        ) : error ? (
          <p className="py-10 text-center text-sm text-pe-negative">{error}</p>
        ) : null}

        {!loading && !error && tab === 'stocks' ? (
          <MarketList empty={items.length === 0} emptyMessage="No stocks found">
            {items.map((stock, index) => (
              <MarketRow
                key={stock.id ?? stock.symbol}
                to={stockPath(stock.id ?? stock.symbol)}
                title={formatTicker(stock.symbol)}
                subtitle={stock.name}
                logoIconUrl={stock.logoIconUrl}
                assetType="stock"
                assetKey={stock.id ?? stock.symbol}
                logoPriority={index < 8}
                price={stock.price}
                changePct={stock.changePct}
                previousClose={stock.previousClose}
                change={stock.change}
                onClick={
                  onSelectStock
                    ? () => onSelectStock?.(stock.id ?? stock.symbol, { seed: stock })
                    : undefined
                }
              />
            ))}
          </MarketList>
        ) : null}

        {!loading && !error && tab === 'mutual_funds' ? (
          <MarketList empty={items.length === 0} emptyMessage="No mutual funds found">
            {items.map((fund, index) => (
              <MarketRow
                key={fund.schemeCode}
                to={fundPath(fund.schemeCode)}
                title={fund.name}
                subtitle={[fund.category, fund.subCategory].filter(Boolean).join(' · ') || fund.amc}
                logoIconUrl={fund.logoIconUrl}
                assetType="fund"
                assetKey={fund.schemeCode ?? fund.id}
                logoPriority={index < 8}
                price={fund.nav}
                changePct={fund.changePct}
                previousClose={fund.previousClose}
                change={fund.change}
                onClick={onSelectFund ? () => onSelectFund?.(fund.schemeCode, fund) : undefined}
              />
            ))}
          </MarketList>
        ) : null}

        {!loading && !error && tab === 'etf' ? (
          <MarketList empty={items.length === 0} emptyMessage="No ETFs found">
            {items.map((etf) => (
              <MarketRow
                key={etf.id ?? etf.symbol}
                to={etfPath(etf.id ?? etf.symbol)}
                title={formatTicker(etf.symbol)}
                subtitle={etf.name}
                logoIconUrl={etf.logoIconUrl}
                assetType="etf"
                assetKey={etf.id ?? etf.symbol}
                price={etf.ltp ?? etf.price}
                changePct={etf.changePct}
                previousClose={etf.previousClose}
                change={etf.change}
                onClick={
                  onSelectStock
                    ? () => onSelectStock?.(etf.id ?? etf.symbol, { kind: 'etf', seed: etf })
                    : undefined
                }
              />
            ))}
          </MarketList>
        ) : null}

        {!loading && !error && tab === 'indices' ? (
          <MarketList empty={items.length === 0} emptyMessage="No indices found">
            {items.map((index) => (
              <MarketRow
                key={index.id}
                to={indexPath(index.id)}
                title={index.name}
                subtitle={formatIndexGroup(index.group)}
                logoIconUrl={index.logoIconUrl}
                assetType="index"
                assetKey={index.id}
                priceText={formatIndexValue(index.value)}
                price={index.value}
                formatAsCurrency={false}
                changePct={index.changePct}
                previousClose={index.previousClose}
                change={index.change}
                onClick={onSelectIndex ? () => onSelectIndex?.(index.id, index) : undefined}
              />
            ))}
          </MarketList>
        ) : null}

        {!loading && !error && tab === 'commodity' ? (
          <MarketList empty={items.length === 0} emptyMessage="No commodities found">
            {items.map((item) => (
              <MarketRow
                key={item.id}
                to={commodityPath(item.id)}
                title={item.name}
                subtitle={[item.unit, item.location].filter(Boolean).join(' · ')}
                logoIconUrl={item.logoIconUrl}
                assetType="commodity"
                assetKey={item.id}
                price={item.spotPrice}
                changePct={item.changePct}
                previousClose={item.previousClose}
                change={item.change}
                onClick={
                  onSelectCommodity ? () => onSelectCommodity?.(item.id, item) : undefined
                }
              />
            ))}
          </MarketList>
        ) : null}
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

function MarketRow({
  to,
  title,
  subtitle,
  logoIconUrl,
  assetType,
  assetKey,
  logoPriority = false,
  price,
  priceText,
  changePct,
  previousClose,
  change,
  formatAsCurrency = true,
  onClick,
}) {
  const amount = dayChangeAmount({ price, changePct, previousClose, change });
  const hasPct = changePct != null && Number.isFinite(Number(changePct));
  const tone = amount != null ? amount : hasPct ? changePct : 0;
  const formatValue = (n) => {
    if (!formatAsCurrency) {
      const sign = n > 0 ? '+' : n < 0 ? '−' : '';
      return `${sign}${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    }
    return formatPrice(n);
  };

  const className = 'flex w-full items-center justify-between gap-3 py-3.5 text-left transition hover:bg-pe-surface';
  const body = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <AssetLogo
          logoIconUrl={logoIconUrl}
          assetType={assetType}
          assetKey={assetKey}
          name={title}
          size="sm"
          priority={logoPriority}
        />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-pe-text">{title}</p>
          {subtitle ? <p className="truncate text-sm text-pe-text-muted">{subtitle}</p> : null}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[15px] font-semibold text-pe-text">
          {priceText ?? (price != null ? formatValue(price) : '-')}
        </p>
        {amount != null || hasPct ? (
          <p className={`text-sm font-semibold tabular-nums ${pnlClass(tone)}`}>
            {amount != null ? formatValue(amount) : '-'}
            {hasPct ? ` (${formatPct(changePct)})` : ''}
          </p>
        ) : null}
      </div>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        onClick={(event) => {
          if (onClick) {
            event.preventDefault();
            onClick();
          }
        }}
        className={className}
      >
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}
