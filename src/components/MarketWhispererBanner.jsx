import React from 'react';
import { Trophy } from 'lucide-react';
import { CAMPAIGN_UI_ENABLED } from '../campaignFlags';
import { CHALLENGE_NAME, CHALLENGE_WINDOW, getChallengeBannerHref } from '../challengeMeta';
import { BANNER_HEIGHT_CLASS, edgeX } from '../designTokens';

export default function MarketWhispererBanner() {
  if (!CAMPAIGN_UI_ENABLED) return null;

  const href = getChallengeBannerHref();

  const inner = (
    <>
      <Trophy className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-amber-400" aria-hidden />
      <span className="font-display font-semibold text-sm sm:text-base text-pe-text">{CHALLENGE_NAME}</span>
      <span className="text-pe-text-muted hidden sm:inline" aria-hidden>
        ·
      </span>
      <span className="text-pe-text-muted sm:text-pe-text-muted text-sm sm:text-base">{CHALLENGE_WINDOW}</span>
      {href && (
        <span className="hidden sm:inline text-pe-text-muted font-normal text-sm sm:text-base ml-1">
          — Enter now →
        </span>
      )}
    </>
  );

  const className = `w-full shrink-0 ${BANNER_HEIGHT_CLASS} bg-neutral-900 text-pe-text border-b border-neutral-800 ${edgeX} flex items-center justify-center gap-2.5 sm:gap-3 text-center leading-snug`;

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
