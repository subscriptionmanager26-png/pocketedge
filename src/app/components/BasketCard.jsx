import React from 'react';
import { ChevronRight, Users } from 'lucide-react';
import { formatPercent } from '../basketCatalog';

export default function BasketCard({ basket, subtitle, onClick, showReturn = true }) {
  const returnValue = basket.stats?.cagr ?? basket.returnPct ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-full text-left pe-card p-4 sm:p-5 pe-card-hover group"
    >
      <div className="flex gap-3 sm:gap-4">
        <div
          className={`shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${
            basket.imageGradient || 'from-emerald-600 to-cyan-500'
          } flex items-center justify-center overflow-hidden`}
        >
          {basket.imageUrl ? (
            <img src={basket.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-white/90">
              {basket.name.charAt(0)}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="pe-card-title truncate">
                {basket.name}
              </h3>
              <p className="pe-body-s mt-0.5 line-clamp-2">
                {subtitle || basket.shortDescription}
              </p>
            </div>
            {showReturn && (
              <div className="text-right shrink-0">
                <div className="pe-body-s text-pe-text-muted">
                  {basket.stats?.returnLabel || 'Returns'}
                </div>
                <div className="text-base font-bold text-pe-positive tabular-nums mt-0.5">
                  {formatPercent(returnValue)}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-2.5">
            <div className="flex flex-wrap gap-1">
              {(basket.tags || []).slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-pe-text-secondary border border-neutral-200/80"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 text-pe-text-secondary">
              {basket.followers != null && (
                <span className="flex items-center gap-1 text-xs">
                  <Users className="w-3.5 h-3.5" />
                  {basket.followers.toLocaleString()}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-pe-text-muted group-hover:text-pe-text" />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
