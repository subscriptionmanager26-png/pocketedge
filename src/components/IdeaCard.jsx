import { Lock } from 'lucide-react';
import {
  formatIdeaReturn,
  getIdeaThesis,
  getPortfolioDayReturnPct,
  ideaReturnClass,
} from '../lib/ideaReturns';

/**
 * Ideas card: name, thesis, made-by display name, 1D only.
 * Readable hierarchy — no fixed crush height, no nested buttons.
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

  const openCard = () => {
    if (blurReturns) {
      onUnlock?.();
      return;
    }
    onOpen?.(owner?.id, portfolio?.id);
  };

  const openMaker = (event) => {
    event.stopPropagation();
    if (blurReturns) {
      onUnlock?.();
      return;
    }
    onOpenProfile?.(owner?.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openCard}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openCard();
        }
      }}
      className="flex min-h-[168px] w-full cursor-pointer flex-col rounded-xl border border-pe-border-strong bg-pe-surface p-4 text-left transition hover:bg-white"
    >
      <p className="line-clamp-2 text-[15px] font-semibold leading-6 tracking-tight text-pe-text">
        {portfolio?.name || 'Untitled idea'}
      </p>

      <p className="mt-2 line-clamp-2 text-[15px] leading-6 text-pe-text-secondary">
        {thesis || <span className="italic text-pe-text-muted">No thesis yet</span>}
      </p>

      <p className="mt-3 truncate text-[12px] leading-4 text-pe-text-muted">
        Made by{' '}
        <span
          role="link"
          tabIndex={0}
          onClick={openMaker}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openMaker(event);
            }
          }}
          className="font-medium text-pe-text-secondary underline-offset-2 hover:text-pe-accent hover:underline"
        >
          {makerName}
        </span>
      </p>

      <div className="mt-auto flex items-end gap-2 border-t border-pe-border pt-3">
        <div className="min-w-0">
          <p className="text-[12px] leading-4 text-pe-text-muted">1D</p>
          {blurReturns ? (
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className="select-none text-[20px] font-semibold tabular-nums leading-7 text-pe-text blur-[5px]"
                aria-hidden="true"
              >
                {formatIdeaReturn(dayReturn ?? 1.24)}
              </span>
              <Lock className="h-4 w-4 shrink-0 text-pe-accent" aria-label="Sign in to view returns" />
            </div>
          ) : (
            <p className={`mt-0.5 text-[20px] font-semibold tabular-nums leading-7 ${ideaReturnClass(dayReturn)}`}>
              {formatIdeaReturn(dayReturn)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
