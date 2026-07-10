import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import AuthLayoutHeader from '../../components/AuthLayoutHeader';
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

  const submit = async () => {
    if (!canSubmit) return;
    await addReview({ fundId, rating: fundRating, body: fundReviewLine });
    setOnboardingComplete(userId);
    onComplete?.();
  };

  return (
    <div className="flex min-h-dvh flex-col bg-pe-canvas text-pe-text">
      <AuthLayoutHeader badge="Setup" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-feed px-4 py-6 md:py-8">
          <p className="text-2xl font-bold text-pe-text md:text-3xl">
            One review to join the community
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-pe-text-secondary">
            Share a quick rating on something you invest in to read what other investors own and say.
          </p>

          <div className="mt-8 border-t border-pe-border pt-8">
            <FundReviewStep
              category={assignedCategory}
              selectedFundId={fundId}
              onSelectFund={setFundId}
              rating={fundRating}
              onRating={setFundRating}
              reviewLine={fundReviewLine}
              onReviewLine={setFundReviewLine}
            />
          </div>
        </div>
      </div>

      <footer className="shrink-0 border-t border-pe-border bg-pe-canvas px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-feed">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-pe-accent py-3 text-[15px] font-bold text-white transition hover:bg-pe-accent-pressed disabled:opacity-40"
          >
            <span>Submit review & enter feed</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <p className="mt-3 text-center text-[13px] text-pe-text-muted">
            One quick review unlocks community insights across PocketEdge.
          </p>
        </div>
      </footer>
    </div>
  );
}
