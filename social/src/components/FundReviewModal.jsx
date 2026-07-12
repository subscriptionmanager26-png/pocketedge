import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import SignalPicker from './SignalPicker';
import FundReviewStep from '../pages/onboarding/FundReviewStep';
import { getFund, pickRandomCategory } from '../data/fundData';
import { addReview } from '../lib/reviewStore';

const inputClass =
  'w-full rounded-lg border border-pe-border-strong bg-pe-canvas px-3 py-2.5 text-[15px] text-pe-text outline-none focus:border-pe-accent focus:ring-1 focus:ring-pe-accent';

export default function FundReviewModal({ open, prefillFundId, onClose, onSubmitted }) {
  const prefillFund = prefillFundId ? getFund(prefillFundId) : null;
  const [category] = useState(() => prefillFund?.category ?? pickRandomCategory());
  const [fundId, setFundId] = useState(prefillFundId ?? '');
  const [rating, setRating] = useState(0);
  const [reviewLine, setReviewLine] = useState('');

  useEffect(() => {
    if (open) {
      setFundId(prefillFundId ?? '');
      setRating(0);
      setReviewLine('');
    }
  }, [open, prefillFundId]);

  if (!open) return null;

  const canSubmit = fundId && rating >= 1;

  const submit = async () => {
    if (!canSubmit) return;
    await addReview({ fundId, rating, body: reviewLine });
    onSubmitted?.();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-pe-border bg-pe-canvas sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-pe-border bg-pe-canvas px-4 py-3.5">
          <span className="text-[15px] font-semibold text-pe-text">
            {prefillFund ? `Signal on ${prefillFund.name}` : 'Unlock signals'}
          </span>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-pe-text-secondary hover:bg-pe-surface">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 pb-6">
          {prefillFund ? (
            <>
              <p className="mt-4 text-[15px] leading-relaxed text-pe-text-secondary">
                Share a Bullish, Neutral, or Bearish signal to unlock community signals and posts across PocketEdge.
              </p>
              <p className="mt-6 text-xs font-bold uppercase tracking-widest text-pe-text-muted">Your signal</p>
              <div className="mt-2">
                <SignalPicker value={rating} onChange={setRating} />
              </div>
              <p className="mt-6 text-xs font-bold uppercase tracking-widest text-pe-text-muted">
                One-line note (optional)
              </p>
              <input
                value={reviewLine}
                onChange={(e) => setReviewLine(e.target.value)}
                placeholder="I like this because…"
                maxLength={160}
                className={`${inputClass} mt-2`}
              />
              <p className="mt-1 text-xs text-pe-text-muted">{reviewLine.length}/160</p>
            </>
          ) : (
            <FundReviewStep
              category={category}
              selectedFundId={fundId}
              onSelectFund={setFundId}
              rating={rating}
              onRating={setRating}
              reviewLine={reviewLine}
              onReviewLine={setReviewLine}
            />
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="mt-6 w-full rounded-md bg-pe-accent py-3 text-[15px] font-bold text-white disabled:opacity-40"
          >
            Submit signal & unlock
          </button>
        </div>
      </div>
    </div>
  );
}
