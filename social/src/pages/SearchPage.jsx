import { useMemo, useState } from 'react';
import { TrendingUp, Users } from 'lucide-react';
import Avatar from '../components/Avatar';
import PageHeader, { PageHeaderSearch } from '../components/PageHeader';
import { PEOPLE, STOCKS, TOPICS } from '../data/mockData';
import { formatCount, formatPct, formatPrice, pnlClass } from '../lib/format';

const RESULT_TABS = [
  { id: 'people', label: 'People' },
  { id: 'topics', label: 'Topics' },
  { id: 'stocks', label: 'Stocks' },
];

const TRENDING_STOCKS = Object.entries(STOCKS)
  .map(([ticker, s]) => ({ ticker, ...s }))
  .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
  .slice(0, 5);

export default function SearchPage({ onOpenProfile }) {
  const [query, setQuery] = useState('');
  const [resultTab, setResultTab] = useState('people');
  const [followedTopics, setFollowedTopics] = useState(
    () => new Set(TOPICS.filter((t) => t.followed).map((t) => t.slug))
  );

  const q = query.trim().toLowerCase();

  const peopleResults = useMemo(() => {
    const ranked = [...PEOPLE].sort((a, b) => b.xirr - a.xirr);
    if (!q) return ranked;
    return ranked.filter(
      (p) => p.name.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q)
    );
  }, [q]);

  const topicResults = useMemo(() => {
    if (!q) return TOPICS;
    return TOPICS.filter((t) => t.name.toLowerCase().includes(q));
  }, [q]);

  const stockResults = useMemo(() => {
    const entries = Object.entries(STOCKS).map(([ticker, s]) => ({ ticker, ...s }));
    if (!q) return entries;
    return entries.filter(
      (s) => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [q]);

  return (
    <div>
      {/* Primary control: search bar (replaces redundant page title on desktop) */}
      <PageHeader>
        <PageHeaderSearch
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people, topics, stocks"
          autoFocus
        />
      </PageHeader>

      {!q ? (
        <div className="space-y-8 px-4 py-6">
          <section>
            <SectionLabel icon={TrendingUp}>Trending topics</SectionLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {TOPICS.map((topic) => {
                const followed = followedTopics.has(topic.slug);
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() =>
                      setFollowedTopics((prev) => {
                        const next = new Set(prev);
                        if (next.has(topic.slug)) next.delete(topic.slug);
                        else next.add(topic.slug);
                        return next;
                      })
                    }
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                      followed
                        ? 'border-pe-accent bg-pe-accent-wash text-pe-accent'
                        : 'border-pe-border-strong text-pe-text-secondary hover:border-pe-text-muted hover:text-pe-text'
                    }`}
                  >
                    #{topic.name}
                    <span className="ml-1.5 font-medium text-pe-text-muted">
                      {topic.postsThisWeek}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <SectionLabel icon={Users}>Suggested people</SectionLabel>
            <div className="mt-1 divide-y divide-pe-border">
              {[...PEOPLE]
                .sort((a, b) => b.xirr - a.xirr)
                .slice(0, 4)
                .map((person) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    onOpenProfile={onOpenProfile}
                  />
                ))}
            </div>
          </section>

          <section>
            <SectionLabel>Most discussed this week</SectionLabel>
            <div className="mt-1 divide-y divide-pe-border">
              {TRENDING_STOCKS.map((stock) => (
                <StockRow key={stock.ticker} stock={stock} />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div>
          <div className="flex border-b border-pe-border">
            {RESULT_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setResultTab(t.id)}
                className={`relative flex-1 py-3.5 text-sm font-semibold ${
                  resultTab === t.id ? 'text-pe-text' : 'text-pe-text-muted hover:text-pe-text'
                }`}
              >
                {t.label}
                {resultTab === t.id && (
                  <span className="absolute inset-x-8 bottom-0 h-0.5 rounded-full bg-pe-accent" />
                )}
              </button>
            ))}
          </div>

          <div className="px-4 py-1">
            {resultTab === 'people' &&
              (peopleResults.length ? (
                peopleResults.map((p) => (
                  <PersonRow key={p.id} person={p} onOpenProfile={onOpenProfile} />
                ))
              ) : (
                <Empty />
              ))}
            {resultTab === 'topics' &&
              (topicResults.length ? (
                topicResults.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between border-b border-pe-border py-4"
                  >
                    <div>
                      <p className="text-[15px] font-semibold text-pe-text">#{t.name}</p>
                      <p className="mt-0.5 text-sm text-pe-text-secondary">
                        {t.postsThisWeek} posts · {formatCount(t.followers)} followers
                      </p>
                    </div>
                    <FollowButton />
                  </div>
                ))
              ) : (
                <Empty />
              ))}
            {resultTab === 'stocks' &&
              (stockResults.length ? (
                stockResults.map((s) => <StockRow key={s.ticker} stock={s} />)
              ) : (
                <Empty />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </div>
  );
}

function PersonRow({ person, onOpenProfile }) {
  return (
    <div className="flex items-center gap-3 py-3.5">
      <Avatar person={person} onClick={() => onOpenProfile?.(person.id)} />
      <button
        type="button"
        onClick={() => onOpenProfile?.(person.id)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-[15px] font-semibold text-pe-text hover:underline">
          {person.name}
        </p>
        <p className="text-sm text-pe-text-muted">@{person.handle}</p>
        <p className="mt-0.5 text-xs text-pe-text-secondary">
          <span className="font-semibold text-pe-positive">
            XIRR {formatPct(person.xirr, { signed: false })}
          </span>
          <span> · {formatCount(person.followers)} followers</span>
        </p>
      </button>
      <FollowButton />
    </div>
  );
}

function StockRow({ stock }) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <div>
        <p className="text-[15px] font-semibold text-pe-text">${stock.ticker}</p>
        <p className="text-sm text-pe-text-muted">{stock.name}</p>
      </div>
      <div className="text-right">
        <p className="text-[15px] font-semibold text-pe-text">{formatPrice(stock.price)}</p>
        <p className={`text-sm font-semibold ${pnlClass(stock.changePct)}`}>
          {formatPct(stock.changePct)}
        </p>
      </div>
    </div>
  );
}

function FollowButton() {
  return (
    <button
      type="button"
      className="shrink-0 rounded-md bg-pe-accent px-3.5 py-1.5 text-sm font-bold text-white transition hover:bg-pe-accent-pressed"
    >
      Follow
    </button>
  );
}

function Empty() {
  return <p className="py-14 text-center text-sm text-pe-text-secondary">No results</p>;
}
