import React, { useMemo } from 'react';
import { formatPercent } from '../basketCatalog';

const PERIOD_DAYS = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '1Y': 365,
  ALL: Infinity,
};

const PERIOD_LABELS = {
  '1W': '1W Returns',
  '1M': '1M Returns',
  '3M': '3M Returns',
  '1Y': '1Y Returns',
  ALL: 'All Returns',
};

function filterNavByPeriod(data, period) {
  if (!data?.length) return [];
  if (period === 'ALL') return data;

  const days = PERIOD_DAYS[period] ?? 90;
  const lastDate = new Date(data[data.length - 1].date);
  const cutoff = new Date(lastDate);
  cutoff.setDate(cutoff.getDate() - days);

  const filtered = data.filter((d) => new Date(d.date) >= cutoff);
  if (filtered.length >= 2) return filtered;
  return data.slice(-Math.min(2, data.length));
}

export default function NavChart({ data, height = 160, period = '3M' }) {
  const series = useMemo(() => filterNavByPeriod(data, period), [data, period]);

  const { path, last, periodReturn } = useMemo(() => {
    if (!series.length) return { path: '', last: 0, periodReturn: 0 };

    const values = series.map((d) => d.nav);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const pad = (maxVal - minVal) * 0.1 || 1;
    const lo = minVal - pad;
    const hi = maxVal + pad;
    const w = 100;
    const h = height;

    const points = series.map((d, i) => {
      const x = series.length === 1 ? w / 2 : (i / (series.length - 1)) * w;
      const y = h - ((d.nav - lo) / (hi - lo)) * h;
      return `${x},${y}`;
    });

    const first = values[0];
    const lastVal = values[values.length - 1];
    const change = first ? ((lastVal - first) / first) * 100 : 0;

    return {
      path: `M ${points.join(' L ')}`,
      last: lastVal,
      periodReturn: change,
    };
  }, [series, height]);

  if (!data?.length) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-neutral-500">
        NAV data unavailable
      </div>
    );
  }

  const positive = periodReturn >= 0;
  const periodLabel = PERIOD_LABELS[period] || 'Returns';

  return (
    <div>
      <div className="flex items-end justify-between mb-3 gap-4">
        <div>
          <p className="font-label text-[10px] font-medium uppercase tracking-widest text-pe-text-muted">
            Index value
          </p>
          <p className="text-2xl font-bold text-pe-text tabular-nums">{last.toFixed(1)}</p>
        </div>
        <div className="text-right">
          <p className="font-label text-[10px] font-medium uppercase tracking-widest text-pe-text-muted">
            {periodLabel}
          </p>
          <p
            className={`text-xl sm:text-2xl font-semibold tabular-nums ${
              positive ? 'text-pe-positive' : 'text-pe-negative'
            }`}
          >
            {formatPercent(periodReturn)}
          </p>
        </div>
      </div>

      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full h-40 sm:h-48 lg:h-56"
      >
        <defs>
          <linearGradient id="navFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L 100,${height} L 0,${height} Z`} fill="url(#navFill)" />
        <path
          d={path}
          fill="none"
          stroke="rgb(52, 211, 153)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="flex justify-between mt-2 text-[10px] text-pe-text-muted">
        <span>{formatDate(series[0].date)}</span>
        <span>{formatDate(series[series.length - 1].date)}</span>
      </div>
    </div>
  );
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}
