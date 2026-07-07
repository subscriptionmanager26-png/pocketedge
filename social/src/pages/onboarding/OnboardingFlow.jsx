import { useState } from 'react';
import { pickRandomCategory } from '../../data/fundData';
import { addReview } from '../../lib/reviewStore';
import { setOnboardingComplete } from '../../lib/sessionStore';
import FundReviewStep from './FundReviewStep';

/** Onboarding = fund rating + review. Unlocks community reviews on submit. */
export default function OnboardingFlow({ userId, onComplete }) {
  const [assignedCategory] = useState(() => pickRandomCategory());
  const [fundId, setFundId] = useState('');
  const [fundRating, setFundRating] = useState(0);
  const [fundReviewLine, setFundReviewLine] = useState('');

  const canSubmit = Boolean(fundId) && fundRating >= 1;

  const submit = () => {
    if (!canSubmit) return;
    addReview({ fundId, rating: fundRating, body: fundReviewLine });
    setOnboardingComplete(userId);
    onComplete?.();
  };

  return (
    <div className="min-h-dvh bg-pe-canvas">
      <div className="mx-auto max-w-feed px-4 py-8 md:py-12">
        <p className="text-xs font-bold uppercase tracking-widest text-pe-accent">Welcome</p>

        <FundReviewStep
          category={assignedCategory}
          selectedFundId={fundId}
          onSelectFund={setFundId}
          rating={fundRating}
          onRating={setFundRating}
          reviewLine={fundReviewLine}
          onReviewLine={setFundReviewLine}
        />

        <div className="mt-10 border-t border-pe-border pt-8">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="w-full rounded-md bg-pe-accent py-3 text-[15px] font-bold text-white transition hover:bg-pe-accent-pressed disabled:opacity-40"
          >
            Submit review & enter feed
          </button>
          <p className="mt-3 text-center text-[13px] text-pe-text-muted">
            One quick rating unlocks community reviews on funds and stocks.
          </p>
        </div>
      </div>
    </div>
  );
}
