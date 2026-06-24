import React from 'react';
import { Calendar, Trophy } from 'lucide-react';
import {
  CHALLENGE_BASKETS_HINT,
  CHALLENGE_PRIZE_HEADLINE,
  CHALLENGE_START_LABEL,
} from '../../challengeMeta';

export default function ChallengeWelcomeCard({ className = '' }) {
  return (
    <div className={`pe-card p-6 sm:p-8 text-center ${className}`}>
      <div className="w-11 h-11 rounded-xl bg-amber-400/15 flex items-center justify-center mx-auto mb-4">
        <Trophy className="w-5 h-5 text-amber-600" aria-hidden />
      </div>
      <h3 className="text-xl sm:text-2xl font-semibold text-pe-text">{CHALLENGE_PRIZE_HEADLINE}</h3>
      <p className="text-pe-text-secondary mt-2 text-sm sm:text-base leading-relaxed max-w-md mx-auto">
        {CHALLENGE_BASKETS_HINT}
      </p>
      <p className="inline-flex items-center justify-center gap-2 mt-4 text-sm font-medium text-pe-text bg-neutral-100 rounded-full px-4 py-2">
        <Calendar className="w-4 h-4 shrink-0" aria-hidden />
        {CHALLENGE_START_LABEL}
      </p>
    </div>
  );
}
