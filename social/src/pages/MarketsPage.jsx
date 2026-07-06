import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import PageHeader, { PageHeaderRow, PageHeaderSearch } from '../components/PageHeader';
import UnderlineTabs from '../components/UnderlineTabs';
import {
  NewsFeed,
  PostsFeed,
  TradesFeed,
  collectActivity,
} from '../components/ActivityFeed';
import Sparkline from '../components/Sparkline';
import { FUNDS } from '../data/fundData';
import { STOCKS } from '../data/mockData';
import { getReviewsForFund } from '../lib/reviewStore';
import { StarDisplay } from '../components/StarRating';
import { formatPct, formatPrice, pnlClass } from '../lib/format';

const ALL_STOCKS = Object.entries(STOCKS).map(([ticker, s]) => ({ ticker, ...s }));
const ALL_FUNDS = Object.values(FUNDS);
const CONTENT_TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'news', label: 'News' },
  { id: 'trades', label: 'Trades' },
  { id: 'posts', label: 'Posts' },
];

const MARKET_FILTERS = [
  { id: 'movers', label: 'Movers' },
  { id: 'gainers', label: 'Gainers' },
  { id: 'losers', label: 'Losers' },
];

export default function MarketsPage({
  selectedTicker,
  onSelectStock,
  onSelectFund,
  onClearStock,
  onOpenProfile,
  onOpenPost,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('movers');

  if (selectedTicker && STOCKS[selectedTicker]) {
    return (
      <StockDetail
        ticker={selectedTicker}
        onBack={onClearStock}
        onOpenProfile={onOpenProfile}
        onOpenPost={onOpenPost}
      />
    );
  }

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
      {/* Primary control: find a stock + market lens */}
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
        <UnderlineTabs
          embedded
          tabs={MARKET_FILTERS}
          active={filter}
          onChange={setFilter}
        />
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
            {q ? 'Results' : filter === 'gainers' ? 'Gainers' : filter === 'losers' ? 'Losers' : 'Top movers'}
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
                  <div>
                    <p className="text-[15px] font-semibold text-pe-text">${stock.ticker}</p>
                    <p className="text-sm text-pe-text-muted">{stock.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Sparkline data={stock.spark} positive={stock.changePct >= 0} />
                    <div className="min-w-[4.75rem] text-right">
                      <p className="text-[15px] font-semibold text-pe-text">
                        {formatPrice(stock.price)}
                      </p>
                      <p className={`text-sm font-semibold ${pnlClass(stock.changePct)}`}>
                        {formatPct(stock.changePct)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {!q && (
          <section>
            <SectionLabel>Mutual funds · reviewed by community</SectionLabel>
            <div className="mt-2 divide-y divide-pe-border">
              {ALL_FUNDS.slice(0, 6).map((fund) => {
                const reviews = getReviewsForFund(fund.id);
                const avg =
                  reviews.length > 0
                    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
                    : 0;
                return (
                  <button
                    key={fund.id}
                    type="button"
                    onClick={() => onSelectFund?.(fund.id)}
                    className="flex w-full items-center justify-between py-3.5 text-left transition hover:bg-pe-surface"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-[15px] font-semibold text-pe-text">{fund.name}</p>
                      <p className="text-sm text-pe-text-muted">
                        {fund.category} · {reviews.length} reviews
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {avg > 0 && <StarDisplay rating={Math.round(avg)} size="sm" />}
                      <p className="mt-0.5 text-xs font-semibold text-pe-positive">
                        3Y {formatPct(fund.return3Y, { signed: false })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StockDetail({ ticker, onBack, onOpenProfile, onOpenPost }) {
  const [contentTab, setContentTab] = useState('summary');
  const stock = STOCKS[ticker];
  const activity = useMemo(() => collectActivity([ticker]), [ticker]);

  return (
    <div>
      <PageHeader desktopOnly>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-pe-text-secondary hover:text-pe-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Markets
        </button>
      </PageHeader>

      <div className="border-b border-pe-border px-4 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pe-accent">
          ${ticker}
        </p>
        <h2 className="mt-0.5 font-serif text-2xl font-bold text-pe-text">{stock.name}</h2>

        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <p className="font-serif text-3xl font-bold text-pe-text">
              {formatPrice(stock.price)}
            </p>
            <p className={`mt-1 text-[15px] font-semibold ${pnlClass(stock.changePct)}`}>
              {formatPct(stock.changePct)} today
            </p>
          </div>
          <Sparkline data={stock.spark} positive={stock.changePct >= 0} className="h-12 w-28" />
        </div>
      </div>

      <UnderlineTabs tabs={CONTENT_TABS} active={contentTab} onChange={setContentTab} />

      {contentTab === 'summary' && (
        <div className="space-y-4 px-4 py-5">
          <div className="grid grid-cols-2 gap-3">
            <SummaryTile label="Last" value={formatPrice(stock.price)} />
            <SummaryTile
              label="Day change"
              value={formatPct(stock.changePct)}
              tone={stock.changePct}
            />
            <SummaryTile label="Week range" value="Demo" />
            <SummaryTile
              label="Mentions (wk)"
              value={String(activity.posts.length + activity.news.length)}
            />
          </div>
          <p className="text-sm leading-6 text-pe-text-secondary">
            Community activity for ${ticker} is aggregated below — news, trades, and posts
            from members who mention this name. Position disclosure appears on every take.
          </p>
        </div>
      )}
      {contentTab === 'news' && <NewsFeed items={activity.news} />}
      {contentTab === 'trades' && (
        <TradesFeed items={activity.trades} onOpenProfile={onOpenProfile} />
      )}
      {contentTab === 'posts' && (
        <PostsFeed items={activity.posts} onOpenProfile={onOpenProfile} onOpenPost={onOpenPost} />
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone }) {
  return (
    <div className="rounded-[10px] border border-pe-border bg-pe-surface px-3 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
        {label}
      </p>
      <p className={`mt-1.5 text-[15px] font-semibold ${tone != null ? pnlClass(tone) : 'text-pe-text'}`}>
        {value}
      </p>
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
