import { Binoculars, Copy } from 'lucide-react';

const iconBadgeClass =
  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-pe-text-secondary';

export function PortfolioKindIcon({ kind }) {
  const isWatchlist = kind === 'watchlist';

  if (isWatchlist) {
    return (
      <span className={iconBadgeClass} title="Watchlist" aria-label="Watchlist">
        <Binoculars className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
    );
  }

  return (
    <span className={iconBadgeClass} title="Live" aria-label="Live">
      <span className="h-2 w-2 rounded-full bg-pe-positive" />
    </span>
  );
}

export function PortfolioOriginIcon({ portfolio }) {
  const isCopied = Boolean(portfolio?.sourcePortfolioId);

  if (isCopied) {
    return (
      <span className={iconBadgeClass} title="Copied" aria-label="Copied">
        <Copy className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
    );
  }

  return (
    <span
      className={`${iconBadgeClass} text-[9px] font-extrabold tracking-tight text-pe-text-muted`}
      title="Original"
      aria-label="Original"
    >
      OG
    </span>
  );
}

export function PortfolioKindMetaTags({ portfolio }) {
  const kind = portfolio?.kind === 'watchlist' ? 'watchlist' : 'live';

  return (
    <div className="flex items-center gap-0.5">
      <PortfolioKindIcon kind={kind} />
      <PortfolioOriginIcon portfolio={portfolio} />
    </div>
  );
}

export function PortfolioSourceAttribution({ portfolio, onSeeOriginal }) {
  if (!portfolio?.sourcePortfolioId) return null;

  const canNavigate = Boolean(portfolio.sourceUserId && onSeeOriginal);

  return (
    <p className="mt-1 text-xs text-pe-text-muted">
      Based on {portfolio.sourcePortfolioName ?? 'another portfolio'}
      {portfolio.sourceUserName ? ` by ${portfolio.sourceUserName}` : ''}
      {canNavigate ? (
        <>
          {' · '}
          <button
            type="button"
            onClick={() =>
              onSeeOriginal(portfolio.sourceUserId, portfolio.sourcePortfolioId)
            }
            className="font-semibold text-pe-link hover:underline"
          >
            See original
          </button>
        </>
      ) : null}
    </p>
  );
}
