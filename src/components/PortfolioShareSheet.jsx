import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { preparePortfolioShare, sharePreparedPortfolio } from '../lib/sharePortfolioImage';
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
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState(null);
  const [notice, setNotice] = useState('');
  const prepareToken = useRef(0);
  const portfolioId = portfolio?.id ?? null;

  useEffect(() => {
    if (!open || !portfolioId) {
      setPrepared(null);
      setPreparing(false);
      return undefined;
    }

    const token = ++prepareToken.current;
    setPreparing(true);
    setPrepared(null);
    setNotice('');

    preparePortfolioShare({ portfolio, ownerHandle, sort })
      .then((result) => {
        if (prepareToken.current !== token) return;
        if (!result.ok) {
          setNotice(
            result.reason === 'empty_snapshot'
              ? 'Add holdings before sharing this portfolio.'
              : 'Could not prepare the share image. Try again.'
          );
          setPrepared(null);
        } else {
          setPrepared(result);
        }
        setPreparing(false);
      })
      .catch((error) => {
        if (prepareToken.current !== token) return;
        console.error('Prepare portfolio share failed', error);
        setNotice('Could not prepare the share image. Try again.');
        setPrepared(null);
        setPreparing(false);
      });

    return () => {
      prepareToken.current += 1;
    };
  }, [open, portfolioId, ownerHandle, sort, portfolio]);

  if (!open || !portfolio) return null;

  const handleShare = async () => {
    if (!prepared?.ok) return;

    setSharing(true);
    setNotice('');
    try {
      const result = await sharePreparedPortfolio({ prepared, onSharesUpdated });
      if (result.ok) {
        if (result.method === 'fallback') {
          setNotice('Image downloaded. Caption copied — paste it with the image.');
        } else {
          onClose?.();
        }
      } else if (result.reason === 'cancelled') {
        onClose?.();
      } else {
        setNotice('Could not share this portfolio. Try again.');
      }
    } catch (error) {
      console.error('Portfolio share failed', error);
      setNotice(
        error?.message
          ? `Share failed: ${String(error.message).slice(0, 120)}`
          : 'Could not share this portfolio. Try again.'
      );
    } finally {
      setSharing(false);
    }
  };

  const handleRetryPrepare = () => {
    if (!portfolioId) return;
    const token = ++prepareToken.current;
    setPreparing(true);
    setPrepared(null);
    setNotice('');
    preparePortfolioShare({ portfolio, ownerHandle, sort })
      .then((result) => {
        if (prepareToken.current !== token) return;
        if (!result.ok) {
          setNotice(
            result.reason === 'empty_snapshot'
              ? 'Add holdings before sharing this portfolio.'
              : 'Could not prepare the share image. Try again.'
          );
          setPrepared(null);
        } else {
          setPrepared(result);
        }
        setPreparing(false);
      })
      .catch((error) => {
        if (prepareToken.current !== token) return;
        console.error('Prepare portfolio share failed', error);
        setNotice('Could not prepare the share image. Try again.');
        setPrepared(null);
        setPreparing(false);
      });
  };

  const shareDisabled = sharing || preparing || !prepared?.ok;
  const shareLabel = sharing ? 'Sharing…' : preparing ? 'Preparing…' : 'Share';

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
              Creates an image with top holdings plus a link preview.
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

        {notice ? (
          <div className="mt-4 flex items-start justify-between gap-3">
            <p className="text-sm text-pe-text-secondary">{notice}</p>
            {!preparing && !prepared?.ok ? (
              <button
                type="button"
                onClick={handleRetryPrepare}
                className="shrink-0 text-sm font-semibold text-pe-accent hover:underline"
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : null}

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
            disabled={shareDisabled}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-pe-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-pe-accent-pressed disabled:opacity-60"
          >
            {sharing || preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {shareLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
