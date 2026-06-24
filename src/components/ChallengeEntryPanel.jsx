import React from 'react';
import { Check, Circle } from 'lucide-react';
import { CHALLENGE_WINDOW } from '../challengeMeta';
import {
  captureChallengeEntered,
  captureChallengeTaskClicked,
} from '../analytics';
import {
  REQUIRED_REFERRALS,
  isChallengeEligible,
  markChallengeEntered,
  hasEnteredChallenge,
} from '../challengeEligibility';

export default function ChallengeEntryPanel({
  progress,
  onSignIn,
  onGoCreate,
  onEntered,
  referralLink = null,
  hideHeader = false,
  initialEntered = null,
  persistEntered = true,
  className = '',
}) {
  const [entered, setEntered] = React.useState(() =>
    initialEntered ?? hasEnteredChallenge()
  );
  const [referralCopied, setReferralCopied] = React.useState(false);
  const eligible = isChallengeEligible(progress);

  const handleCopyReferral = async () => {
    captureChallengeTaskClicked('referrals', 'Copy referral link');
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2000);
    } catch {
      // Clipboard unavailable — keep user on the page
    }
  };

  const tasks = [
    {
      id: 'register',
      label: 'Register on PocketEdge',
      done: progress.registered,
      action: progress.registered
        ? null
        : () => {
            captureChallengeTaskClicked('register', 'Sign in');
            onSignIn?.();
          },
      actionLabel: 'Sign in',
    },
    {
      id: 'baskets',
      label: 'Create a basket (up to 5)',
      detail: `${progress.basketCount}/${progress.maxBaskets} created`,
      done: progress.hasBaskets,
      action: progress.hasBaskets
        ? null
        : () => {
            captureChallengeTaskClicked('baskets', 'Create basket');
            onGoCreate?.();
          },
      actionLabel: 'Create basket',
    },
    {
      id: 'referrals',
      label: `Refer ${REQUIRED_REFERRALS} people on the platform`,
      detail: `${progress.referralCount}/${REQUIRED_REFERRALS} referrals`,
      done: progress.referralsMet,
      action: progress.referralsMet ? null : handleCopyReferral,
      actionLabel: 'Copy referral link',
      copiedLabel: 'Copied',
    },
  ].filter((task) => !(hideHeader && task.id === 'register' && progress.registered));

  const handleEnter = () => {
    if (!eligible) return;
    captureChallengeEntered({
      referralCount: progress.referralCount,
      basketCount: progress.basketCount,
    });
    if (persistEntered) markChallengeEntered();
    setEntered(true);
    onEntered?.();
  };

  if (entered && eligible) {
    return null;
  }

  return (
    <div className={`pe-card p-6 sm:p-8 ${className}`}>
      {!hideHeader && (
        <div className="text-center mb-6">
          <p className="text-sm font-medium uppercase tracking-widest text-pe-text-muted">Enter the challenge</p>
          <h3 className="text-xl sm:text-2xl font-semibold text-pe-text mt-2">
            Complete these steps to compete
          </h3>
          <p className="text-pe-text-secondary mt-2 text-sm sm:text-base">{CHALLENGE_WINDOW}</p>
        </div>
      )}

      <ul className={`space-y-3 sm:space-y-4 ${hideHeader ? '' : 'max-w-lg mx-auto'}`}>
        {tasks.map((task) => (
          <li
            key={task.id}
            className={`flex items-start gap-3 sm:gap-4 p-4 rounded-xl border ${
              task.done ? 'border-neutral-200/80 bg-neutral-50' : 'border-neutral-200/80 bg-white'
            }`}
          >
            <span
              className={`mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                task.done ? 'bg-neutral-900 text-white' : 'border-2 border-neutral-300 text-transparent'
              }`}
            >
              {task.done ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3 text-pe-text-muted" />}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`font-medium text-sm sm:text-base ${task.done ? 'text-pe-text' : 'text-pe-text'}`}>
                {task.label}
              </p>
              {task.detail && (
                <p className="text-xs sm:text-sm text-pe-text-secondary mt-0.5">{task.detail}</p>
              )}
            </div>
            {!task.done && task.action && (
              <button
                type="button"
                onClick={task.action}
                className="shrink-0 text-sm font-medium text-pe-text hover:text-pe-text-secondary whitespace-nowrap"
              >
                {task.id === 'referrals' && referralCopied ? task.copiedLabel : task.actionLabel} →
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={handleEnter}
          disabled={!eligible}
          className="pe-btn-primary px-8 py-3.5 text-base disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-neutral-900"
        >
          Enter the Challenge
        </button>
      </div>
    </div>
  );
}
