import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  STOCKS,
  getPerson,
  getPortfolioWeightPct,
  getPosition,
} from '../data/mockData';
import { formatPct, formatPrice, pnlClass } from '../lib/format';
import { statusStyles } from '../lib/tickers';

function TickerCardContent({ ticker, authorId, onClose }) {
  const stock = STOCKS[ticker];
  const position = getPosition(authorId, ticker);
  const styles = statusStyles(position.status);
  const weightPct = getPortfolioWeightPct(authorId, ticker);
  const author = getPerson(authorId);
  const return3M = stock?.return3M ?? 0;

  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold text-pe-text">${ticker}</p>
          <p className="text-[13px] text-pe-text-secondary">{stock?.name ?? ticker}</p>
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

      <div className="mb-3 flex items-baseline gap-2">
        <p className="text-lg font-semibold text-pe-text">{formatPrice(stock?.price)}</p>
        <p className={`text-[13px] font-semibold ${pnlClass(stock?.changePct ?? 0)}`}>
          {formatPct(stock?.changePct ?? 0)} today
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-pe-border bg-pe-surface px-3 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
            3M return
          </p>
          <p className={`mt-1 text-[17px] font-semibold ${pnlClass(return3M)}`}>
            {formatPct(return3M)}
          </p>
        </div>

        <div className="rounded-lg border border-pe-border bg-pe-surface px-3 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
            Portfolio
          </p>
          <p className="mt-1 text-[17px] font-semibold text-pe-text">
            {weightPct != null ? `${weightPct.toFixed(1)}%` : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-pe-text-secondary">
            {weightPct != null
              ? `of @${author.handle}'s book`
              : position.status === 'watchlist'
                ? 'On watchlist'
                : position.status === 'exited'
                  ? 'Exited'
                  : 'No position'}
          </p>
        </div>
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

    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose?.();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
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
