import { useEffect, useMemo, useState } from 'react';
import { Eye, Flame } from 'lucide-react';
import SecurityIdeaCard from '../components/SecurityIdeaCard';
import { MarketsListSkeleton } from '../components/PageSkeletons';
import {
  fetchMarketPreview,
  listSgbMarketQuotes,
} from '../lib/marketDataApi';
import {
  IDEA_MARKET_TABS,
  ideaSecurityKey,
  openIdeaSecurity,
  rankMostWatchedSecurities,
  rankTrendingSecurities,
  toIdeaSecurity,
} from '../lib/ideaSecurities';

function SectionHeading({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      {Icon ? (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-[var(--fv-accent,#ff6719)]">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
      ) : null}
      <div className="min-w-0">
        <h2 className="text-[16px] font-semibold tracking-tight text-pe-text">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-[12px] leading-relaxed text-pe-text-secondary">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function SecurityRail({ items, onOpen }) {
  if (!items.length) {
    return <p className="px-4 text-[12px] text-pe-text-secondary">Nothing here yet.</p>;
  }
  // Minimal scroll inset — large soft shadows inside overflow-x paint a grey pad.
  return (
    <div className="flex gap-3 overflow-x-auto bg-white px-4 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => (
        <div
          key={ideaSecurityKey(item)}
          className="relative z-0 h-[148px] w-[min(240px,78vw)] min-w-[240px] shrink-0"
        >
          <SecurityIdeaCard item={item} onOpen={onOpen} />
        </div>
      ))}
    </div>
  );
}

async function loadBondIdeas() {
  try {
    const { items } = await listSgbMarketQuotes();
    return (items ?? [])
      .filter((row) => row.assetType === 'bond')
      .map((row) => toIdeaSecurity(row, 'bond'))
      .filter(Boolean);
  } catch (err) {
    console.warn('listSgbMarketQuotes failed for Ideas', err);
    return [];
  }
}

/**
 * Ideas browse hub — discovery rails only.
 * Search lives in the global top bar.
 */
export default function IdeasPage({
  onSelectStock,
  onSelectFund,
  onSelectCommodity,
  onSelectIndex,
}) {
  const [byTab, setByTab] = useState({});
  const [bonds, setBonds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handlers = useMemo(
    () => ({ onSelectStock, onSelectFund, onSelectCommodity, onSelectIndex }),
    [onSelectStock, onSelectFund, onSelectCommodity, onSelectIndex]
  );

  const handleOpen = (item) => openIdeaSecurity(item, handlers);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      ...IDEA_MARKET_TABS.map(async (tab) => {
        const payload = await fetchMarketPreview(tab);
        const assetType =
          tab === 'stocks'
            ? 'stock'
            : tab === 'mutual_funds'
              ? 'fund'
              : tab === 'etf'
                ? 'etf'
                : 'commodity';
        return [
          tab,
          (payload.items ?? []).map((row) => toIdeaSecurity(row, assetType)).filter(Boolean),
        ];
      }),
      loadBondIdeas().then((items) => ['bonds', items]),
    ])
      .then((entries) => {
        if (cancelled) return;
        const next = {};
        let bondItems = [];
        for (const [key, items] of entries) {
          if (key === 'bonds') {
            bondItems = items;
            continue;
          }
          next[key] = items;
        }
        setByTab(next);
        setBonds(bondItems);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Ideas securities load failed', err);
        setError(err.message || 'Could not load ideas');
        setByTab({});
        setBonds([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const allSecurities = useMemo(() => {
    return [
      ...(byTab.stocks ?? []),
      ...(byTab.etf ?? []),
      ...(byTab.mutual_funds ?? []),
      ...(byTab.commodity ?? []),
      ...bonds,
    ];
  }, [byTab, bonds]);

  const trending = useMemo(() => rankTrendingSecurities(allSecurities, 10), [allSecurities]);
  const mostWatched = useMemo(
    () => rankMostWatchedSecurities(allSecurities, 10),
    [allSecurities]
  );

  return (
    <div>
      {error ? <p className="px-4 pt-4 text-sm text-pe-negative">{error}</p> : null}

      {loading ? (
        <div className="space-y-6 px-4 pt-4 pb-8">
          <MarketsListSkeleton rows={4} />
          <MarketsListSkeleton rows={4} />
        </div>
      ) : (
        <>
          <section className="pb-5 pt-4">
            <div className="px-4">
              <SectionHeading
                icon={Flame}
                title="Trending"
                subtitle="Securities with the biggest 1D moves"
              />
            </div>
            <SecurityRail items={trending} onOpen={handleOpen} />
          </section>

          <section className="border-t border-pe-border/60 pb-5 pt-5">
            <div className="px-4">
              <SectionHeading
                icon={Eye}
                title="Most watched"
                subtitle="Names drawing the most attention today"
              />
            </div>
            <SecurityRail items={mostWatched} onOpen={handleOpen} />
          </section>

          {(byTab.stocks ?? []).length ? (
            <section className="border-t border-pe-border/60 pb-5 pt-5">
              <div className="px-4">
                <SectionHeading title="Stocks" subtitle="Equity movers" />
              </div>
              <SecurityRail
                items={rankTrendingSecurities(byTab.stocks ?? [], 8)}
                onOpen={handleOpen}
              />
            </section>
          ) : null}

          {(byTab.etf ?? []).length ? (
            <section className="border-t border-pe-border/60 pb-5 pt-5">
              <div className="px-4">
                <SectionHeading title="ETFs" subtitle="Exchange-traded funds" />
              </div>
              <SecurityRail
                items={rankTrendingSecurities(byTab.etf ?? [], 8)}
                onOpen={handleOpen}
              />
            </section>
          ) : null}

          {(byTab.mutual_funds ?? []).length ? (
            <section className="border-t border-pe-border/60 pb-5 pt-5">
              <div className="px-4">
                <SectionHeading title="Mutual funds" subtitle="Popular schemes" />
              </div>
              <SecurityRail items={(byTab.mutual_funds ?? []).slice(0, 8)} onOpen={handleOpen} />
            </section>
          ) : null}

          {(byTab.commodity ?? []).length ? (
            <section className="border-t border-pe-border/60 pb-5 pt-5">
              <div className="px-4">
                <SectionHeading title="Commodities" subtitle="Metals and more" />
              </div>
              <SecurityRail
                items={rankTrendingSecurities(byTab.commodity ?? [], 8)}
                onOpen={handleOpen}
              />
            </section>
          ) : null}

          {bonds.length ? (
            <section className="border-t border-pe-border/60 pb-8 pt-5">
              <div className="px-4">
                <SectionHeading title="Bonds" subtitle="Sovereign gold bonds" />
              </div>
              <SecurityRail items={bonds.slice(0, 8)} onOpen={handleOpen} />
            </section>
          ) : (
            <div className="pb-8" />
          )}
        </>
      )}
    </div>
  );
}
