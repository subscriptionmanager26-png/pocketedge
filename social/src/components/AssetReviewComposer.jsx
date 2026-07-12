import { useEffect, useState } from 'react';
import SignalPicker, { SignalDisplay } from './SignalPicker';
import {
  getUserReviewForCommodity,
  getUserReviewForFund,
  getUserReviewForIndex,
  getUserReviewForStock,
  subscribeReviews,
  upsertReview,
} from '../lib/reviewStore';

const inputClass =
  'w-full rounded-lg border border-pe-border-strong bg-pe-canvas px-3 py-2.5 text-[15px] text-pe-text outline-none focus:border-pe-accent focus:ring-1 focus:ring-pe-accent';

function resolveExistingReview({ assetType, fundId, ticker, indexId, commodityId, isEtf }) {
  if (assetType === 'fund') return getUserReviewForFund(fundId);
  if (assetType === 'index') return getUserReviewForIndex(indexId);
  if (assetType === 'commodity') return getUserReviewForCommodity(commodityId);
  return getUserReviewForStock(ticker, { isEtf });
}

export default function AssetReviewComposer({
  assetType,
  fundId,
  ticker,
  indexId,
  commodityId,
  assetLabel,
  isEtf = false,
  onSubmitted,
}) {
  const [reviewTick, setReviewTick] = useState(0);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewLine, setReviewLine] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => subscribeReviews(() => setReviewTick((n) => n + 1)), []);

  const existing = resolveExistingReview({
    assetType,
    fundId,
    ticker,
    indexId,
    commodityId,
    isEtf,
  });

  void reviewTick;

  useEffect(() => {
    if (existing && !editing) {
      setRating(existing.rating);
      setReviewLine(existing.body ?? '');
    }
  }, [existing?.id, existing?.rating, existing?.body, editing]);

  const startEdit = () => {
    if (existing) {
      setRating(existing.rating);
      setReviewLine(existing.body ?? '');
    }
    setEditing(true);
  };

  const cancelEdit = () => {
    if (existing) {
      setRating(existing.rating);
      setReviewLine(existing.body ?? '');
      setEditing(false);
      return;
    }
    setRating(0);
    setReviewLine('');
    setEditing(false);
  };

  const submit = async () => {
    if (rating < 1 || submitting) return;
    setSubmitting(true);
    try {
      await upsertReview({
        fundId: assetType === 'fund' ? fundId : undefined,
        stockTicker:
          assetType === 'stock' || assetType === 'etf' ? ticker : undefined,
        assetType,
        assetId:
          assetType === 'index'
            ? indexId
            : assetType === 'commodity'
              ? commodityId
              : undefined,
        isEtf,
        rating,
        body: reviewLine,
      });
      setEditing(false);
      onSubmitted?.();
    } finally {
      setSubmitting(false);
    }
  };

  if (existing && !editing) {
    return (
      <div className="border-b border-pe-border bg-pe-surface/40 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-pe-text-muted">Your signal</p>
            <div className="mt-2">
              <SignalDisplay rating={existing.rating} />
            </div>
            {existing.body ? (
              <p className="mt-2 text-[15px] leading-relaxed text-pe-text">{existing.body}</p>
            ) : (
              <p className="mt-2 text-sm text-pe-text-muted">No written note — signal only.</p>
            )}
          </div>
          <button
            type="button"
            onClick={startEdit}
            className="shrink-0 rounded-md border border-pe-border-strong px-3 py-1.5 text-sm font-semibold text-pe-text hover:bg-pe-surface"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-pe-border px-4 py-4">
      <p className="text-xs font-bold uppercase tracking-widest text-pe-text-muted">
        {existing ? 'Edit your signal' : `Your signal on ${assetLabel}`}
      </p>
      <div className="mt-3">
        <SignalPicker value={rating} onChange={setRating} />
      </div>
      <input
        value={reviewLine}
        onChange={(e) => setReviewLine(e.target.value)}
        placeholder="Optional one-line take…"
        maxLength={160}
        className={`${inputClass} mt-4`}
      />
      <p className="mt-1 text-xs text-pe-text-muted">{reviewLine.length}/160</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={rating < 1 || submitting}
          className="rounded-md bg-pe-accent px-4 py-2 text-sm font-bold text-white hover:bg-pe-accent-pressed disabled:opacity-40"
        >
          {existing ? 'Save changes' : 'Submit signal'}
        </button>
        {(existing || rating > 0 || reviewLine) && (
          <button
            type="button"
            onClick={cancelEdit}
            className="rounded-md border border-pe-border-strong px-4 py-2 text-sm font-semibold text-pe-text-secondary hover:bg-pe-surface"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
