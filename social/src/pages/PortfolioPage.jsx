import { useMemo, useState } from 'react';
import { ChevronDown, Newspaper, Plus } from 'lucide-react';
import Avatar from '../components/Avatar';
import Sparkline from '../components/Sparkline';
import {
  MY_PORTFOLIO,
  PORTFOLIO_UPDATES,
  STOCKS,
  getPerson,
} from '../data/mockData';
import { formatInr, formatPct, formatPrice, pnlClass } from '../lib/format';

const PERIODS = ['1D', '1W', '1M', '1Y'];
const VIEWS = [
  { id: 'updates', label: 'Updates' },
  { id: 'holdings', label: 'Holdings' },
];

const UPDATE_STYLES = {
  news: { bar: 'bg-sky-400', label: 'News', text: 'text-sky-300' },
  post: { bar: 'bg-violet-400', label: 'Post', text: 'text-violet-300' },
  buy: { bar: 'bg-pe-positive', label: 'Buy', text: 'text-pe-positive' },
  sell: { bar: 'bg-pe-negative', label: 'Sell', text: 'text-pe-negative' },
};

export default function PortfolioPage() {
  const [period, setPeriod] = useState('1D');
  const [view, setView] = useState('updates');
  const [listTab, setListTab] = useState('holdings');
  const [expanded, setExpanded] = useState({});

  const lists = useMemo(
    () => [
      { id: 'holdings', name: 'Holdings' },
      ...MY_PORTFOLIO.watchlists.map((w) => ({ id: w.id, name: w.name })),
      { id: 'new', name: '+ New list' },
    ],
    []
  );

  const activeTickers = useMemo(() => {
    if (listTab === 'holdings') return MY_PORTFOLIO.holdings.map((h) => h.ticker);
    const wl = MY_PORTFOLIO.watchlists.find((w) => w.id === listTab);
    return wl?.tickers ?? [];
  }, [listTab]);

  const holdingMap = useMemo(
    () => Object.fromEntries(MY_PORTFOLIO.holdings.map((h) => [h.ticker, h])),
    []
  );

  const p = MY_PORTFOLIO;

  return (
    <div>
      <section className="border-b border-pe-border px-4 py-6 md:px-6">
        <p className="text-sm text-pe-text-secondary">Total value</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-pe-text md:text-4xl">
          {formatInr(p.totalValue)}
        </p>
        <p className={`mt-1.5 text-[15px] font-medium ${pnlClass(p.todayPnl)}`}>
          {formatInr(p.todayPnl)} ({formatPct(p.todayPnlPct)}) today
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <Stat label="Invested" value={formatInr(p.invested, { compact: true })} />
          <Stat
            label="Total P&L"
            value={formatInr(p.totalPnl, { compact: true })}
            sub={formatPct(p.totalPnlPct)}
            tone={p.totalPnl}
          />
          <Stat label="XIRR" value={formatPct(p.xirr, { signed: false })} tone={p.xirr} />
        </div>

        <div className="mt-5 flex gap-1 rounded-xl border border-pe-border bg-pe-surface p-1">
          {PERIODS.map((per) => (
            <button
              key={per}
              type="button"
              onClick={() => setPeriod(per)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                period === per
                  ? 'bg-white text-black'
                  : 'text-pe-text-secondary hover:text-pe-text'
              }`}
            >
              {per}
            </button>
          ))}
        </div>
      </section>

      <div className="border-b border-pe-border px-4 py-3.5 md:px-6">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 scrollbar-none">
          {lists.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => list.id !== 'new' && setListTab(list.id)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                listTab === list.id
                  ? 'border-white bg-white text-black'
                  : list.id === 'new'
                    ? 'border-dashed border-pe-border-strong text-pe-text-secondary'
                    : 'border-pe-border text-pe-text-secondary hover:border-pe-border-strong hover:text-pe-text'
              }`}
            >
              {list.id === 'new' ? (
                <span className="inline-flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> New list
                </span>
              ) : (
                list.name
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex border-b border-pe-border px-4 py-3.5 md:px-6">
        <div className="inline-flex rounded-full border border-pe-border bg-pe-surface p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                view === v.id ? 'bg-white text-black' : 'text-pe-text-secondary hover:text-pe-text'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-pe-border">
        {activeTickers.map((ticker) => {
          const holding = holdingMap[ticker];
          const stock = STOCKS[ticker];
          const updates = PORTFOLIO_UPDATES[ticker] ?? [];
          const isOpen = expanded[ticker];
          const visible = isOpen ? updates : updates.slice(0, 2);
          const overflow = updates.length - visible.length;

          return (
            <div key={ticker} className="px-4 py-5 md:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-pe-text">${ticker}</p>
                  <p className="text-sm text-pe-text-secondary">{stock?.name}</p>
                  {holding ? (
                    <p className="mt-1 text-sm text-pe-text-secondary">
                      {holding.qty} shares · avg {formatPrice(holding.avg)}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm font-medium text-pe-warning">On watchlist</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Sparkline
                    data={holding?.spark ?? stock?.spark ?? []}
                    positive={(holding?.pnlPct ?? stock?.changePct ?? 0) >= 0}
                  />
                  <div className="text-right">
                    <p className="text-[15px] font-semibold text-pe-text">
                      {formatPrice(stock?.price)}
                    </p>
                    <p
                      className={`text-sm font-medium ${pnlClass(holding?.pnlPct ?? stock?.changePct ?? 0)}`}
                    >
                      {formatPct(holding?.pnlPct ?? stock?.changePct ?? 0)}
                    </p>
                  </div>
                </div>
              </div>

              {view === 'updates' && updates.length > 0 && (
                <div className="mt-3.5 space-y-2.5">
                  {visible.map((u) => (
                    <UpdateRow key={u.id} update={u} />
                  ))}
                  {overflow > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => ({ ...e, [ticker]: true }))}
                      className="inline-flex items-center gap-1 text-sm font-medium text-pe-text-secondary hover:text-pe-text"
                    >
                      <ChevronDown className="h-4 w-4" />
                      {overflow} more update{overflow > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }) {
  return (
    <div className="rounded-xl border border-pe-border bg-pe-surface px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-pe-text-secondary">
        {label}
      </p>
      <p className={`mt-1.5 text-[15px] font-semibold ${tone != null ? pnlClass(tone) : 'text-pe-text'}`}>
        {value}
      </p>
      {sub && <p className={`text-xs font-medium ${pnlClass(tone)}`}>{sub}</p>}
    </div>
  );
}

function UpdateRow({ update }) {
  const style = UPDATE_STYLES[update.type] ?? UPDATE_STYLES.post;
  const person = update.authorId ? getPerson(update.authorId) : null;

  return (
    <div className="flex gap-2.5 rounded-xl border border-pe-border bg-pe-surface px-3 py-3">
      <span className={`mt-1 h-9 w-0.5 shrink-0 rounded-full ${style.bar}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-semibold uppercase tracking-wide ${style.text}`}>
            {style.label}
          </span>
          <span className="text-xs text-pe-text-muted">{update.time}</span>
        </div>

        {update.type === 'news' && (
          <div className="mt-1 flex items-start gap-2">
            <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
            <div>
              <p className="text-sm leading-6 text-pe-text">{update.title}</p>
              <p className="text-xs text-pe-text-secondary">{update.source}</p>
            </div>
          </div>
        )}

        {update.type === 'post' && (
          <div className="mt-1.5 flex gap-2">
            <Avatar person={person} size="sm" />
            <div>
              <p className="text-xs font-medium text-pe-text-secondary">@{person?.handle}</p>
              <p className="text-sm leading-6 text-pe-text">{update.snippet}</p>
            </div>
          </div>
        )}

        {(update.type === 'buy' || update.type === 'sell') && (
          <div className="mt-1.5 flex items-center gap-2">
            <Avatar person={person} size="sm" />
            <div>
              <p className="text-xs font-medium text-pe-text-secondary">
                @{person?.handle} · {update.type === 'buy' ? 'Bought' : 'Sold'}
              </p>
              <p className="text-sm text-pe-text">
                {update.qty} @ {formatPrice(update.price)}
                {update.pnlPct != null && (
                  <span className={`ml-2 font-semibold ${pnlClass(update.pnlPct)}`}>
                    {formatPct(update.pnlPct)}
                  </span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
