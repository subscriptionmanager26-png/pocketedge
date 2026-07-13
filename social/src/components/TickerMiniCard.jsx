import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getPortfolioWeightPct, getPosition } from '../data/mockData';
import { hydrateAuthorPositions } from '../lib/authorPositionsStore';
import { resolvePortfolioAsset, holdingDisplayLabel } from '../lib/portfolioAssetUniverse';
import { getPersonSync, resolvePerson } from '../lib/socialIdentity';
import { formatPct, formatPrice, pnlClass } from '../lib/format';
import { formatTicker, statusStyles } from '../lib/tickers';

function resolveAuthorPosition(authorId, ticker, asset) {
  const keys = [
    ticker,
    asset?.key,
    asset?.name,
    asset?.item?.symbol,
    asset?.item?.schemeCode,
    asset?.item?.name,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);

  for (const key of keys) {
    const position = getPosition(authorId, key);
    if (position?.status && position.status !== 'none') {
      return {
        position,
        weightPct: getPortfolioWeightPct(authorId, key),
      };
    }
  }

  return {
    position: getPosition(authorId, ticker) ?? { status: 'none' },
    weightPct: getPortfolioWeightPct(authorId, ticker),
  };
}

function TickerCardContent({ ticker, authorId, onClose }) {
  const [asset, setAsset] = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const [positionTick, setPositionTick] = useState(0);
  const [author, setAuthor] = useState(() => getPersonSync(authorId));

  useEffect(() => {
    let cancelled = false;
    setPriceLoading(true);
    resolvePortfolioAsset(ticker)
      .then((resolved) => {
        if (!cancelled) setAsset(resolved);
      })
      .catch(() => {
        if (!cancelled) setAsset(null);
      })
      .finally(() => {
        if (!cancelled) setPriceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  useEffect(() => {
    let cancelled = false;
    setAuthor(getPersonSync(authorId));
    if (!authorId) return undefined;

    Promise.all([
      resolvePerson(authorId).catch(() => null),
      hydrateAuthorPositions([authorId]),
    ]).then(([person]) => {
      if (cancelled) return;
      if (person) setAuthor(person);
      setPositionTick((n) => n + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [authorId]);

  void positionTick;
  const { position, weightPct } = resolveAuthorPosition(authorId, ticker, asset);
  const styles = statusStyles(position.status);

  const name =
    asset?.name ||
    holdingDisplayLabel({
      ticker,
      assetName: asset?.name,
      assetType: asset?.kind,
    });
  const price = asset?.price ?? null;
  const changePct =
    asset?.item?.changePct != null
      ? Number(asset.item.changePct)
      : asset?.item?.change_pct != null
        ? Number(asset.item.change_pct)
        : null;
  const displayKey =
    asset?.kind === 'fund' ? name : formatTicker(asset?.key || ticker);

  // No position → 0%. Held with known weight → that %. Held without value data → null (show "Holds").
  const holdingPct =
    position.status === 'holds' ? (weightPct != null ? weightPct : null) : 0;

  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-pe-text">{displayKey}</p>
          {asset?.kind === 'fund' ? (
            <p className="mt-0.5 text-[12px] text-pe-text-muted">Mutual fund</p>
          ) : name && name !== displayKey ? (
            <p className="mt-0.5 truncate text-[13px] text-pe-text-secondary">{name}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-pe-text-muted hover:bg-pe-surface hover:text-pe-text"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
          Current price
        </p>
        {priceLoading ? (
          <p className="mt-1 text-sm text-pe-text-muted">Loading…</p>
        ) : (
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-lg font-semibold text-pe-text">{formatPrice(price)}</p>
            {Number.isFinite(changePct) ? (
              <p className={`text-sm font-semibold ${pnlClass(changePct)}`}>
                {formatPct(changePct)}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-pe-border bg-pe-surface px-3 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
          {author?.name
            ? `${String(author.name).trim().split(/\s+/)[0]}'s holding`
            : 'Author holding'}
        </p>
        <p className="mt-1 text-[17px] font-semibold text-pe-text">
          {holdingPct != null ? `${holdingPct.toFixed(1)}% of book` : 'Holds'}
        </p>
        {position.status === 'holds' ? (
          <p className="mt-0.5 text-[12px] text-pe-text-secondary">
            {position.pnlPct != null ? `${formatPct(position.pnlPct)} P&L` : 'In portfolio'}
          </p>
        ) : (
          <p className="mt-0.5 text-[12px] text-pe-text-secondary">
            {position.status === 'watchlist'
              ? 'On watchlist'
              : position.status === 'exited'
                ? 'Exited'
                : 'No position'}
          </p>
        )}
      </div>

      <div
        className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${styles.chip}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
        {styles.label}
        {position.status === 'holds' && position.pnlPct != null && (
          <span className={pnlClass(position.pnlPct)}>· {formatPct(position.pnlPct)}</span>
        )}
      </div>
    </>
  );
}

export default function TickerMiniCard({ ticker, authorId, onClose }) {
  const ref = useRef(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 767px)').matches
      : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (isMobile) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const onKeyDown = (event) => {
        if (event.key === 'Escape') onClose?.();
      };
      document.addEventListener('keydown', onKeyDown);
      return () => {
        document.body.style.overflow = prev;
        document.removeEventListener('keydown', onKeyDown);
      };
    }

    // Defer so the opening click doesn't immediately close the card.
    let remove = () => {};
    const timer = window.setTimeout(() => {
      const onPointerDown = (event) => {
        if (ref.current && !ref.current.contains(event.target)) onClose?.();
      };
      const onKeyDown = (event) => {
        if (event.key === 'Escape') onClose?.();
      };
      document.addEventListener('mousedown', onPointerDown);
      document.addEventListener('keydown', onKeyDown);
      remove = () => {
        document.removeEventListener('mousedown', onPointerDown);
        document.removeEventListener('keydown', onKeyDown);
      };
    }, 0);

    return () => {
      window.clearTimeout(timer);
      remove();
    };
  }, [onClose, isMobile]);

  if (isMobile) {
    return createPortal(
      <div className="fixed inset-0 z-50">
        <button
          type="button"
          aria-label="Close"
          className="absolute inset-0 bg-black/40"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-label={`${ticker} details`}
          className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-pe-border bg-pe-canvas p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
        >
          <TickerCardContent ticker={ticker} authorId={authorId} onClose={onClose} />
        </div>
      </div>,
      document.body
    );
  }

  return (
    <span
      ref={ref}
      role="dialog"
      aria-label={`${ticker} details`}
      className="absolute left-0 top-full z-30 mt-2 w-72 rounded-[10px] border border-pe-border-strong bg-pe-canvas p-3.5 shadow-lg"
    >
      <TickerCardContent ticker={ticker} authorId={authorId} onClose={onClose} />
    </span>
  );
}
