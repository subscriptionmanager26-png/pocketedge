import { useEffect, useState } from 'react';
import {
  MarketDetailHeader,
  MarketDetailShell,
  MetricTile,
} from '../components/MarketDetailLayout';
import { formatPrice, pnlClass } from '../lib/format';
import { fetchMarketPreview, resolveMarketCommodity } from '../lib/marketDataApi';

export default function CommodityDetailPage({ commodityId, onBack }) {
  const [commodity, setCommodity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      const preview = await fetchMarketPreview('commodity');
      let found = preview.items.find((item) => item.id === commodityId);
      if (!found) found = await resolveMarketCommodity(commodityId);
      if (!cancelled) {
        setCommodity(found ?? null);
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) {
        setCommodity(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [commodityId]);

  if (loading) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">
        Loading commodity…
      </div>
    );
  }

  if (!commodity) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">
        Commodity not found.
      </div>
    );
  }

  const subtitle = [commodity.unit, commodity.location].filter(Boolean).join(' · ');

  return (
    <MarketDetailShell title="Markets" onBack={onBack}>
      <MarketDetailHeader
        name={commodity.name}
        symbol={commodity.symbol}
        type="Commodity"
        subtitle={subtitle || 'MCX spot'}
        price={commodity.spotPrice != null ? formatPrice(commodity.spotPrice) : '—'}
      />

      {commodity.change != null ? (
        <section className="border-b border-pe-border px-4 py-5">
          <p className={`text-lg font-bold ${pnlClass(commodity.change)}`}>
            {commodity.change > 0 ? '+' : ''}
            {commodity.change.toLocaleString('en-IN', { maximumFractionDigits: 2 })} change
          </p>
          <p className="mt-1 text-sm text-pe-text-muted">
            Spot price only — previous close not available from MCX feed.
          </p>
        </section>
      ) : null}

      <section className="px-4 py-5">
        <div className="grid grid-cols-2 gap-2.5">
          <MetricTile label="Symbol" value={commodity.symbol ?? '—'} />
          <MetricTile label="Unit" value={commodity.unit ?? '—'} />
          <MetricTile label="Location" value={commodity.location ?? '—'} />
          <MetricTile
            label="Spot price"
            value={commodity.spotPrice != null ? formatPrice(commodity.spotPrice) : '—'}
          />
        </div>
      </section>
    </MarketDetailShell>
  );
}
