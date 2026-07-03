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
  news: { bar: 'bg-sky-500', label: 'News', text: 'text-sky-400' },
  post: { bar: 'bg-violet-500', label: 'Post', text: 'text-violet-400' },
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

  const holdingMap = useMemo(() => {
    const map = Object.fromEntries(MY_PORTFOLIO.holdings.map((h) => [h.ticker, h]));
    return map;
  }, []);

  const p = MY_PORTFOLIO;

  return (
    <div>
      <section className="border-b border-pe-border px-4 py-5">
        <p className="text-xs text-pe-text-muted">Total value</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{formatInr(p.totalValue)}</p>
        <p className={`mt-1 text-sm font-medium ${pnlClass(p.todayPnl)}`}>
          {formatInr(p.todayPnl)} ({formatPct(p.todayPnlPct)}) today
        </p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat label="Invested" value={formatInr(p.invested, { compact: true })} />
          <Stat
            label="Total P&L"
            value={formatInr(p.totalPnl, { compact: true })}
            sub={formatPct(p.totalPnlPct)}
            tone={p.totalPnl}
          />
          <Stat label="XIRR" value={formatPct(p.xirr, { signed: false })} tone={p.xirr} />
        </div>

        <div className="mt-4 flex gap-1 rounded-xl bg-pe-surface p-1">
          {PERIODS.map((per) => (
            <button
              key={per}
              type="button"
              onClick={() => setPeriod(per)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                period === per ? 'bg-white text-black' : 'text-pe-text-muted hover:text-pe-text'
              }`}
            >
              {per}
            </button>
          ))}
        </div>
      </section>

      <div className="border-b border-pe-border px-4 py-3">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 scrollbar-none">
          {lists.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => list.id !== 'new' && setListTab(list.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                listTab === list.id
                  ? 'border-white bg-white text-black'
                  : list.id === 'new'
                    ? 'border-dashed border-pe-border text-pe-text-muted'
                    : 'border-pe-border text-pe-text-secondary hover:border-white/30'
              }`}
            >
              {list.id === 'new' ? (
                <span className="inline-flex items-center gap-1">
                  <Plus className="h-3 w-3" /> New list
                </span>
              ) : (
                list.name
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex border-b border-pe-border px-4 py-3">
        <div className="inline-flex rounded-full bg-pe-surface p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                view === v.id ? 'bg-white text-black' : 'text-pe-text-muted'
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
            <div key={ticker} className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">${ticker}</p>
                  <p className="text-xs text-pe-text-muted">{stock?.name}</p>
                  {holding ? (
                    <p className="mt-1 text-xs text-pe-text-secondary">
                      {holding.qty} shares · avg {formatPrice(holding.avg)}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-pe-warning">On watchlist</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Sparkline
                    data={holding?.spark ?? stock?.spark ?? []}
                    positive={(holding?.pnlPct ?? stock?.changePct ?? 0) >= 0}
                  />
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatPrice(stock?.price)}</p>
                    <p
                      className={`text-xs font-medium ${pnlClass(holding?.pnlPct ?? stock?.changePct ?? 0)}`}
                    >
                      {formatPct(holding?.pnlPct ?? stock?.changePct ?? 0)}
                    </p>
                  </div>
                </div>
              </div>

              {view === 'updates' && updates.length > 0 && (
                <div className="mt-3 space-y-2">
                  {visible.map((u) => (
                    <UpdateRow key={u.id} update={u} />
                  ))}
                  {overflow > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => ({ ...e, [ticker]: true }))}
                      className="inline-flex items-center gap-1 text-xs font-medium text-pe-text-secondary hover:text-pe-text"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
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
    <div className="rounded-xl border border-pe-border bg-pe-surface px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-pe-text-muted">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${tone != null ? pnlClass(tone) : 'text-pe-text'}`}>
        {value}
      </p>
      {sub && <p className={`text-[11px] ${pnlClass(tone)}`}>{sub}</p>}
    </div>
  );
}

function UpdateRow({ update }) {
  const style = UPDATE_STYLES[update.type] ?? UPDATE_STYLES.post;
  const person = update.authorId ? getPerson(update.authorId) : null;

  return (
    <div className="flex gap-2.5 rounded-xl border border-pe-border/70 bg-pe-surface/60 px-3 py-2.5">
      <span className={`mt-1 h-8 w-0.5 shrink-0 rounded-full ${style.bar}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${style.text}`}>
            {style.label}
          </span>
          <span className="text-[10px] text-pe-text-muted">{update.time}</span>
        </div>

        {update.type === 'news' && (
          <div className="mt-0.5 flex items-start gap-2">
            <Newspaper className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
            <div>
              <p className="text-sm text-pe-text">{update.title}</p>
              <p className="text-[11px] text-pe-text-muted">{update.source}</p>
            </div>
          </div>
        )}

        {update.type === 'post' && (
          <div className="mt-1 flex gap-2">
            <Avatar person={person} size="sm" />
            <div>
              <p className="text-xs font-medium text-pe-text-secondary">@{person?.handle}</p>
              <p className="text-sm text-pe-text">{update.snippet}</p>
            </div>
          </div>
        )}

        {(update.type === 'buy' || update.type === 'sell') && (
          <div className="mt-1 flex items-center gap-2">
            <Avatar person={person} size="sm" />
            <div>
              <p className="text-xs font-medium text-pe-text-secondary">
                @{person?.handle} · {update.type === 'buy' ? 'Bought' : 'Sold'}
              </p>
              <p className="text-sm text-pe-text">
                {update.qty} @ {formatPrice(update.price)}
                {update.pnlPct != null && (
                  <span className={`ml-2 ${pnlClass(update.pnlPct)}`}>
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
