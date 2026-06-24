import React from 'react';
import { formatPercent, getBasketReturn, getBasketReturnLabel } from '../app/basketCatalog';

export default function LandingBasketCard({ basket }) {
  const returnPct = getBasketReturn(basket);
  const returnLabel = getBasketReturnLabel(basket);
  const stockCount = basket.constituents?.length ?? basket.stats?.constituents ?? 0;
  const region = basket.tags?.includes('US') ? 'US' : 'Global';

  const tagItems = [
    region,
    `+${stockCount} stocks`,
    ...(basket.tags || []).slice(0, 2),
  ];

  return (
    <article className="shrink-0 w-[300px] sm:w-[320px] h-[460px] flex flex-col bg-white border border-neutral-200/80 rounded-2xl overflow-hidden hover:border-neutral-300 hover:shadow-lg transition-all duration-300">
      <div className="relative h-[148px] shrink-0 overflow-hidden bg-neutral-100">
        {basket.imageUrl ? (
          <img src={basket.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${basket.imageGradient || 'from-emerald-600 to-cyan-500'}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      <div className="flex flex-1 flex-col p-5 min-h-0">
        <div className="h-14 shrink-0">
          <h3 className="text-xl font-semibold text-pe-text leading-snug line-clamp-2">
            {basket.name}
          </h3>
        </div>

        <div className="h-[4.5rem] shrink-0 mt-2">
          <p className="text-base text-pe-text-secondary leading-relaxed line-clamp-3">
            {basket.shortDescription || basket.description}
          </p>
        </div>

        <div className="h-[4.25rem] shrink-0 mt-4 pt-4 border-t border-neutral-100 flex flex-col justify-center">
          <p className="text-xs font-medium uppercase tracking-wider text-pe-text-muted">
            {returnLabel}
          </p>
          <p
            className={`text-3xl font-semibold tabular-nums mt-0.5 leading-none ${
              returnPct >= 0 ? 'text-emerald-600' : 'text-rose-500'
            }`}
          >
            {formatPercent(returnPct)}
          </p>
        </div>

        <div className="h-8 shrink-0 mt-auto pt-4 flex items-center gap-1.5 overflow-hidden flex-nowrap">
          {tagItems.map((tag) => (
            <span
              key={tag}
              className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md bg-neutral-100 text-pe-text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
