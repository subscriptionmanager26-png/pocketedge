import { useState } from 'react';
import { X } from 'lucide-react';
import FundReviewStep from '../pages/onboarding/FundReviewStep';
import { pickRandomCategory } from '../data/fundData';
import { addReview } from '../lib/reviewStore';

export default function FundReviewModal({ open, onClose, onSubmitted }) {
  const [category] = useState(() => pickRandomCategory());
  const [fundId, setFundId] = useState('');
  const [rating, setRating] = useState(0);
  const [reviewLine, setReviewLine] = useState('');

  if (!open) return null;

  const canSubmit = fundId && rating >= 1;

  const submit = () => {
    if (!canSubmit) return;
    addReview({ fundId, rating, body: reviewLine });
    setFundId('');
    setRating(0);
    setReviewLine('');
    onSubmitted?.();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-pe-border bg-pe-canvas sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-pe-border bg-pe-canvas px-4 py-3.5">
          <span className="text-[15px] font-semibold text-pe-text">Unlock reviews</span>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-pe-text-secondary hover:bg-pe-surface">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 pb-6">
          <FundReviewStep
            category={category}
            selectedFundId={fundId}
            onSelectFund={setFundId}
            rating={rating}
            onRating={setRating}
            reviewLine={reviewLine}
            onReviewLine={setReviewLine}
          />
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="mt-6 w-full rounded-md bg-pe-accent py-3 text-[15px] font-bold text-white disabled:opacity-40"
          >
            Submit review & unlock
          </button>
        </div>
      </div>
    </div>
  );
}
