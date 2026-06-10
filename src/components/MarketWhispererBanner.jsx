import React from 'react';
import { Trophy } from 'lucide-react';
import { CHALLENGE_NAME, CHALLENGE_WINDOW, getChallengeBannerHref } from '../challengeMeta';
import { BANNER_HEIGHT_CLASS, edgeX } from '../designTokens';

export default function MarketWhispererBanner() {
  const href = getChallengeBannerHref();

  const inner = (
    <>
      <Trophy className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-amber-400" aria-hidden />
      <span className="font-display font-semibold text-sm sm:text-base">{CHALLENGE_NAME}</span>
      <span className="text-neutral-400 hidden sm:inline" aria-hidden>
        ·
      </span>
      <span className="text-neutral-300 sm:text-neutral-400 text-sm sm:text-base">{CHALLENGE_WINDOW}</span>
      {href && (
        <span className="hidden sm:inline text-neutral-400 font-normal text-sm sm:text-base ml-1">
          — Enter now →
        </span>
      )}
    </>
  );

  const className = `w-full shrink-0 ${BANNER_HEIGHT_CLASS} bg-neutral-900 text-neutral-100 border-b border-neutral-800 ${edgeX} flex items-center justify-center gap-2.5 sm:gap-3 text-center leading-snug`;

  if (href) {
    return (
      <a href={href} className={`${className} hover:bg-neutral-800 transition-colors`}>
        {inner}
      </a>
    );
  }

  return (
    <div className={className} role="status">
      {inner}
    </div>
  );
}
