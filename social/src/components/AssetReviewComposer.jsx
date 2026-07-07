import { useEffect, useState } from 'react';
import StarRating, { StarDisplay } from './StarRating';
import {
  getUserReviewForFund,
  getUserReviewForStock,
  subscribeReviews,
  upsertReview,
} from '../lib/reviewStore';

const inputClass =
  'w-full rounded-lg border border-pe-border-strong bg-pe-canvas px-3 py-2.5 text-[15px] text-pe-text outline-none focus:border-pe-accent focus:ring-1 focus:ring-pe-accent';

export default function AssetReviewComposer({ assetType, fundId, ticker, assetLabel, onSubmitted }) {
  const [reviewTick, setReviewTick] = useState(0);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewLine, setReviewLine] = useState('');

  useEffect(() => subscribeReviews(() => setReviewTick((n) => n + 1)), []);

  const existing =
    assetType === 'fund'
      ? getUserReviewForFund(fundId)
      : getUserReviewForStock(ticker);

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

  const submit = () => {
    if (rating < 1) return;
    upsertReview({
      fundId: assetType === 'fund' ? fundId : undefined,
      stockTicker: assetType === 'stock' ? ticker : undefined,
      rating,
      body: reviewLine,
    });
    setEditing(false);
    onSubmitted?.();
  };

  if (existing && !editing) {
    return (
      <div className="border-b border-pe-border bg-pe-surface/40 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-pe-text-muted">Your review</p>
            <div className="mt-2 flex items-center gap-2">
              <StarDisplay rating={existing.rating} />
              <span className="text-sm font-semibold text-pe-text">{existing.rating}.0</span>
            </div>
            {existing.body ? (
              <p className="mt-2 text-[15px] leading-relaxed text-pe-text">{existing.body}</p>
            ) : (
              <p className="mt-2 text-sm text-pe-text-muted">No written review — rating only.</p>
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
        {existing ? 'Edit your review' : `Rate ${assetLabel}`}
      </p>
      <div className="mt-2">
        <StarRating value={rating} onChange={setRating} />
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
          disabled={rating < 1}
          className="rounded-md bg-pe-accent px-4 py-2 text-sm font-bold text-white hover:bg-pe-accent-pressed disabled:opacity-40"
        >
          {existing ? 'Save changes' : 'Submit review'}
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
