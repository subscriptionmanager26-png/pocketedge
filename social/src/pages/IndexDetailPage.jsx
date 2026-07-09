import { useEffect, useState } from 'react';
import {
  MarketDetailHeader,
  MarketDetailShell,
  MetricTile,
  formatIndexGroup,
} from '../components/MarketDetailLayout';
import { formatPct, formatPrice, pnlClass } from '../lib/format';
import { fetchMarketPreview, resolveMarketIndex } from '../lib/marketDataApi';

function formatIndexValue(value) {
  if (value == null) return '—';
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function IndexDetailPage({ indexId, onBack }) {
  const [index, setIndex] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      const preview = await fetchMarketPreview('indices');
      let found = preview.items.find((item) => item.id === indexId);
      if (!found) found = await resolveMarketIndex(indexId);
      if (!cancelled) {
        setIndex(found ?? null);
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) {
        setIndex(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [indexId]);

  if (loading) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Loading index…</div>
    );
  }

  if (!index) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Index not found.</div>
    );
  }


  return (
    <MarketDetailShell title="Markets" onBack={onBack}>
      <MarketDetailHeader
        name={index.name}
        symbol={index.symbol}
        type="Index"
        subtitle={formatIndexGroup(index.group)}
        price={formatIndexValue(index.value)}
      />

      <section className="border-b border-pe-border px-4 py-5">
        <div className="flex flex-wrap items-baseline gap-3">
          {index.changePct != null ? (
            <p className={`text-lg font-bold ${pnlClass(index.changePct)}`}>
              {formatPct(index.changePct)}
            </p>
          ) : null}
          {index.change != null ? (
            <p className={`text-sm font-semibold ${pnlClass(index.change)}`}>
              {index.change > 0 ? '+' : ''}
              {formatIndexValue(index.change)} pts
            </p>
          ) : null}
        </div>
      </section>

      <section className="px-4 py-5">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <MetricTile label="Previous close" value={formatIndexValue(index.previousClose)} />
          <MetricTile label="Open" value={formatIndexValue(index.open)} />
          <MetricTile label="High" value={formatIndexValue(index.high)} />
          <MetricTile label="Low" value={formatIndexValue(index.low)} />
          <MetricTile label="52W high" value={formatIndexValue(index.yearHigh)} />
          <MetricTile label="52W low" value={formatIndexValue(index.yearLow)} />
          <MetricTile
            label="Advances"
            value={index.advances != null ? String(index.advances) : '—'}
            tone="positive"
          />
          <MetricTile
            label="Declines"
            value={index.declines != null ? String(index.declines) : '—'}
            tone="negative"
          />
          <MetricTile
            label="30D change"
            value={index.change30dPct != null ? formatPct(index.change30dPct) : '—'}
            tone={
              index.change30dPct > 0 ? 'positive' : index.change30dPct < 0 ? 'negative' : null
            }
          />
          <MetricTile
            label="1Y change"
            value={index.change365dPct != null ? formatPct(index.change365dPct) : '—'}
            tone={
              index.change365dPct > 0 ? 'positive' : index.change365dPct < 0 ? 'negative' : null
            }
          />
        </div>
      </section>
    </MarketDetailShell>
  );
}
