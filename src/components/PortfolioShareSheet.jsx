import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { sharePortfolio } from '../lib/sharePortfolioImage';
import {
  SHARE_SORT_ALLOCATION,
  SHARE_SORT_PERFORMANCE,
} from '../lib/portfolioShare';

export default function PortfolioShareSheet({
  open,
  portfolio,
  ownerHandle,
  onClose,
  onSharesUpdated,
}) {
  const [sort, setSort] = useState(SHARE_SORT_ALLOCATION);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState('');

  if (!open || !portfolio) return null;

  const handleShare = async () => {
    setSharing(true);
    setNotice('');
    try {
      const result = await sharePortfolio({
        portfolio,
        ownerHandle,
        sort,
        onSharesUpdated,
      });
      if (result.ok) {
        if (result.method === 'fallback') {
          setNotice('Image downloaded and link copied to clipboard.');
        } else {
          onClose?.();
        }
      } else if (result.reason !== 'cancelled') {
        setNotice('Could not share this portfolio. Try again.');
      } else {
        onClose?.();
      }
    } catch {
      setNotice('Could not share this portfolio. Try again.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="portfolio-share-title"
        className="w-full max-w-md rounded-2xl border border-pe-border bg-pe-canvas p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="portfolio-share-title" className="text-lg font-bold text-pe-text">
              Share portfolio
            </h2>
            <p className="mt-1 text-sm text-pe-text-secondary">
              Creates an image with top 10 holdings plus a link preview.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sharing}
            className="rounded-md p-1 text-pe-text-secondary hover:bg-pe-surface"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
            Sort holdings by
          </legend>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-pe-border px-3 py-2.5">
            <input
              type="radio"
              name="portfolio-share-sort"
              value={SHARE_SORT_ALLOCATION}
              checked={sort === SHARE_SORT_ALLOCATION}
              onChange={() => setSort(SHARE_SORT_ALLOCATION)}
              disabled={sharing}
              className="accent-pe-accent"
            />
            <span className="text-sm font-medium text-pe-text">Allocation (largest weights)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-pe-border px-3 py-2.5">
            <input
              type="radio"
              name="portfolio-share-sort"
              value={SHARE_SORT_PERFORMANCE}
              checked={sort === SHARE_SORT_PERFORMANCE}
              onChange={() => setSort(SHARE_SORT_PERFORMANCE)}
              disabled={sharing}
              className="accent-pe-accent"
            />
            <span className="text-sm font-medium text-pe-text">Performance (best returns)</span>
          </label>
        </fieldset>

        {notice ? <p className="mt-4 text-sm text-pe-text-secondary">{notice}</p> : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sharing}
            className="flex-1 rounded-lg border border-pe-border-strong px-4 py-2.5 text-sm font-semibold text-pe-text-secondary hover:bg-pe-surface disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-pe-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-pe-accent-pressed disabled:opacity-60"
          >
            {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {sharing ? 'Preparing…' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}
