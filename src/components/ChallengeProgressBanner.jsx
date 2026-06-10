import React from 'react';
import { Trophy } from 'lucide-react';
import { getLoggedInChallengeBanner } from '../challengeEligibility';
import { BANNER_HEIGHT_CLASS, edgeX } from '../designTokens';

export default function ChallengeProgressBanner({ progress }) {
  const { message, href } = getLoggedInChallengeBanner(progress);

  const className = `w-full shrink-0 ${BANNER_HEIGHT_CLASS} bg-neutral-900 text-neutral-100 border-b border-neutral-800 ${edgeX} flex items-center justify-center gap-2.5 sm:gap-3 text-center leading-snug`;

  return (
    <a href={href} className={`${className} hover:bg-neutral-800 transition-colors`}>
      <Trophy className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-amber-400" aria-hidden />
      <span className="font-display font-semibold text-sm sm:text-base">{message}</span>
      <span className="hidden sm:inline text-neutral-400 font-normal text-sm sm:text-base ml-1">
        →
      </span>
    </a>
  );
}
