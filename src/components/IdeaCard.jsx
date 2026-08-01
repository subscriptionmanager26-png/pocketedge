import { Lock } from 'lucide-react';
import {
  formatIdeaReturn,
  getIdeaNarrative,
  getPortfolioDayReturnPct,
  ideaReturnClass,
} from '../lib/ideaReturns';

/**
 * Smallcase-inspired idea card: name + narrative + returns.
 * Holdings are intentionally not shown — Ideas is about story and performance.
 */
export default function IdeaCard({
  portfolio,
  owner,
  blurReturns = false,
  compact = false,
  onOpen,
  onOpenProfile,
  onUnlock,
}) {
  const narrative = getIdeaNarrative(portfolio);
  const dayReturn = getPortfolioDayReturnPct(portfolio);
  const totalReturn = Number(portfolio?.totalReturnPct ?? portfolio?.totalPnlPct);
  const hasTotal = Number.isFinite(totalReturn);

  const open = () => {
    if (blurReturns) {
      onUnlock?.();
      return;
    }
    onOpen?.(owner?.id, portfolio?.id);
  };

  return (
    <button
      type="button"
      onClick={open}
      className={`w-full rounded-xl border border-pe-border bg-pe-canvas text-left transition hover:border-pe-border-strong hover:bg-pe-surface ${
        compact ? 'p-3.5' : 'p-4'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`font-semibold leading-snug text-pe-text ${compact ? 'text-[15px]' : 'text-[15px]'}`}>
            <span className="line-clamp-2">{portfolio?.name || 'Untitled idea'}</span>
          </p>
          {owner?.handle ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (blurReturns) {
                  onUnlock?.();
                  return;
                }
                onOpenProfile?.(owner.id);
              }}
              className="mt-1 truncate text-[12px] text-pe-text-muted hover:text-pe-accent"
            >
              @{owner.handle}
            </button>
          ) : null}
        </div>
      </div>

      {narrative ? (
        <p
          className={`mt-2 text-[12px] leading-relaxed text-pe-text-secondary ${
            compact ? 'line-clamp-2' : 'line-clamp-3'
          }`}
        >
          {narrative}
        </p>
      ) : (
        <p className="mt-2 text-[12px] italic leading-relaxed text-pe-text-muted">
          No narrative yet
        </p>
      )}

      <div className={`mt-3 flex gap-6 ${compact ? '' : 'pt-1'}`}>
        <ReturnStat label="1D" value={dayReturn} blur={blurReturns} />
        {hasTotal ? <ReturnStat label="Total" value={totalReturn} blur={blurReturns} /> : null}
      </div>
    </button>
  );
}

function ReturnStat({ label, value, blur }) {
  return (
    <div className="min-w-[4.5rem]">
      <p className="text-[12px] text-pe-text-muted">{label}</p>
      {blur ? (
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className="select-none text-[15px] font-semibold tabular-nums text-pe-text blur-[5px]"
            aria-hidden="true"
          >
            {formatIdeaReturn(value ?? 1.24)}
          </span>
          <Lock className="h-3.5 w-3.5 text-pe-accent" aria-label="Sign in to view returns" />
        </div>
      ) : (
        <p className={`mt-1 text-[15px] font-semibold tabular-nums ${ideaReturnClass(value)}`}>
          {formatIdeaReturn(value)}
        </p>
      )}
    </div>
  );
}
