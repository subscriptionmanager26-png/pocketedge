import React from 'react';
import { Flame, Gem, TrendingUp } from 'lucide-react';
import { formatPercent, getBasketReturn, getBasketReturnLabel } from '../basketCatalog';

const BADGES = {
  trending: {
    label: 'Trending',
    shortLabel: 'Trending',
    icon: TrendingUp,
    overlayClass: 'bg-amber-500/95 text-white border-amber-400/40',
  },
  hot: {
    label: 'Hot',
    shortLabel: 'Hot',
    icon: Flame,
    overlayClass: 'bg-rose-500/95 text-white border-rose-400/40',
  },
  hidden_gem: {
    label: 'Hidden gem',
    shortLabel: 'Gem',
    icon: Gem,
    overlayClass: 'bg-violet-600/95 text-white border-violet-400/40',
  },
};

function BasketImage({ basket, className = '', overlay = true }) {
  return (
    <div className={`relative h-full w-full overflow-hidden bg-neutral-100 ${className}`}>
      {basket.imageUrl ? (
        <img src={basket.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className={`h-full w-full bg-gradient-to-br ${
            basket.imageGradient || 'from-emerald-600 to-cyan-500'
          } flex items-center justify-center`}
        >
          <span className="text-2xl sm:text-4xl font-bold text-white/25 select-none">
            {basket.name.charAt(0)}
          </span>
        </div>
      )}
      {overlay && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
      )}
    </div>
  );
}

function BasketBadgeOverlay({ basket, compact = false }) {
  const badge = basket.badge ? BADGES[basket.badge] : null;
  const BadgeIcon = badge?.icon;

  const pos = compact ? 'top-1.5 left-1.5' : 'top-2 left-2';
  const ownPos = compact ? 'top-1.5 right-1.5' : 'top-2 right-2';
  const size = compact
    ? 'px-1.5 py-0.5 text-[9px] gap-0.5'
    : 'px-2 py-1 text-[11px] gap-1';
  const iconSize = compact ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <>
      {badge && (
        <span
          className={`absolute ${pos} inline-flex items-center ${size} rounded-full font-semibold uppercase tracking-wide border shadow-sm ${badge.overlayClass}`}
        >
          {BadgeIcon && <BadgeIcon className={iconSize} />}
          {badge.label}
        </span>
      )}
      {basket.isOwn && (
        <span
          className={`absolute ${ownPos} px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-white/95 text-neutral-900 border border-white/80 shadow-sm`}
        >
          Yours
        </span>
      )}
    </>
  );
}

export default function SearchBasketCard({ basket, onClick, preview = false }) {
  const returnValue = getBasketReturn(basket);
  const returnLabel = getBasketReturnLabel(basket);
  const positive = returnValue >= 0;

  if (preview) {
    return (
      <div className="w-full h-full pe-card overflow-hidden flex flex-col">
        <div className="relative aspect-[3/2] w-full shrink-0 overflow-hidden">
          <BasketImage basket={basket} />
          <BasketBadgeOverlay basket={basket} />
        </div>
        <DesktopCardBody
          returnValue={returnValue}
          returnLabel={returnLabel}
          positive={positive}
          basket={basket}
          preview
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full aspect-square text-left transition-all group pe-card pe-card-hover overflow-hidden flex flex-col p-0 !rounded-[1.375rem] sm:aspect-auto sm:h-full sm:!rounded-2xl"
    >
      {/* Mobile — square card, image edge-to-edge on top */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden sm:hidden">
        <BasketImage basket={basket} />
        <BasketBadgeOverlay basket={basket} compact />
      </div>
      <div className="shrink-0 flex flex-col justify-center gap-1 px-2.5 py-2 h-[4.25rem] sm:hidden">
        <h3 className="text-[13px] font-semibold text-pe-text leading-snug line-clamp-2">
          {basket.name}
        </h3>
        <div className="flex items-baseline gap-1 min-w-0">
          <span className="text-[9px] font-medium uppercase tracking-wide text-pe-text-muted truncate">
            {returnLabel}
          </span>
          <span
            className={`text-xs font-semibold tabular-nums shrink-0 ${
              positive ? 'text-pe-positive' : 'text-pe-negative'
            }`}
          >
            {formatPercent(returnValue)}
          </span>
        </div>
      </div>

      {/* Desktop — wide image card */}
      <div className="relative hidden sm:block w-full aspect-[3/2] shrink-0 overflow-hidden">
        <BasketImage
          basket={basket}
          className="group-hover:scale-[1.02] transition-transform duration-300"
        />
        <BasketBadgeOverlay basket={basket} />
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:flex-col sm:w-full sm:min-h-0">
        <DesktopCardBody
          returnValue={returnValue}
          returnLabel={returnLabel}
          positive={positive}
          basket={basket}
        />
      </div>
    </button>
  );
}

function DesktopCardBody({ basket, returnValue, returnLabel, positive, preview = false }) {
  return (
    <div
      className={`flex flex-col flex-1 w-full min-h-0 ${
        preview ? 'p-3 sm:p-4' : 'p-3.5'
      }`}
    >
      <h3 className="pe-card-title line-clamp-2 min-h-[2.5rem] leading-snug">
        {basket.name}
      </h3>
      <p className="pe-body-s mt-0.5 line-clamp-2 min-h-[2.5rem] leading-snug">
        {basket.shortDescription}
      </p>
      <div className="flex items-center justify-end gap-1.5 mt-auto pt-2.5 border-t border-pe-border/60 pe-body-s">
        <span className="text-pe-text-muted">{returnLabel}</span>
        <span
          className={`font-bold tabular-nums ${
            positive ? 'text-pe-positive' : 'text-pe-negative'
          }`}
        >
          {formatPercent(returnValue)}
        </span>
      </div>
    </div>
  );
}
