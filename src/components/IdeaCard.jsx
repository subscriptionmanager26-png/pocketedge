import { Lock } from 'lucide-react';
import {
  formatIdeaReturn,
  getIdeaThesis,
  getPortfolioDayReturnPct,
  ideaReturnClass,
} from '../lib/ideaReturns';

/**
 * Fixed Ideas card: name, thesis, made-by display name, 1D only.
 */
export default function IdeaCard({
  portfolio,
  owner,
  dayReturnPct = null,
  blurReturns = false,
  onOpen,
  onOpenProfile,
  onUnlock,
}) {
  const thesis = getIdeaThesis(portfolio);
  const dayReturn =
    dayReturnPct != null && Number.isFinite(Number(dayReturnPct))
      ? Number(dayReturnPct)
      : getPortfolioDayReturnPct(portfolio);
  const makerName = String(owner?.name ?? '').trim() || 'Investor';

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
      className="flex h-[152px] w-full flex-col rounded-xl border border-pe-border bg-pe-canvas p-4 text-left transition hover:border-pe-border-strong hover:bg-pe-surface"
    >
      <p className="truncate text-[15px] font-semibold leading-6 text-pe-text">
        {portfolio?.name || 'Untitled idea'}
      </p>

      <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-[12px] leading-5 text-pe-text-secondary">
        {thesis || (
          <span className="italic text-pe-text-muted">No thesis yet</span>
        )}
      </p>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (blurReturns) {
            onUnlock?.();
            return;
          }
          onOpenProfile?.(owner?.id);
        }}
        className="mt-2 truncate text-[12px] text-pe-text-muted hover:text-pe-accent"
      >
        Made by {makerName}
      </button>

      <div className="mt-auto flex items-end gap-2 pt-2">
        <div className="min-w-0">
          <p className="text-[12px] leading-4 text-pe-text-muted">1D</p>
          {blurReturns ? (
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className="select-none text-[15px] font-semibold tabular-nums leading-6 text-pe-text blur-[5px]"
                aria-hidden="true"
              >
                {formatIdeaReturn(dayReturn ?? 1.24)}
              </span>
              <Lock className="h-3.5 w-3.5 shrink-0 text-pe-accent" aria-label="Sign in to view returns" />
            </div>
          ) : (
            <p className={`mt-0.5 text-[15px] font-semibold tabular-nums leading-6 ${ideaReturnClass(dayReturn)}`}>
              {formatIdeaReturn(dayReturn)}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
