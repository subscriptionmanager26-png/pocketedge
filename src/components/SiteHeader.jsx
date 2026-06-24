import React from 'react';
import LogoMark from './LogoMark';
import { HEADER_BELOW_BANNER, edgeX } from '../designTokens';

/**
 * Edge-to-edge site header — logo always pinned left with edgeX padding.
 * Pass nav/actions as children; they align right (same pattern as landing).
 * Use embedded when rendered inside StickyTopChrome (app shell).
 */
export default function SiteHeader({
  onLogoClick,
  logoHref,
  children,
  className = '',
  sticky = true,
  embedded = false,
}) {
  const logo = <LogoMark />;

  const positionClass = embedded
    ? 'relative z-auto'
    : sticky
      ? `sticky ${HEADER_BELOW_BANNER} z-50`
      : '';

  return (
    <header
      className={`${positionClass} inset-x-0 w-full bg-pe-canvas border-b border-neutral-200/60 ${className}`}
    >
      <div className={`flex items-center justify-between gap-4 h-16 sm:h-[4.5rem] ${edgeX}`}>
        {logoHref ? (
          <a href={logoHref} className="shrink-0">
            {logo}
          </a>
        ) : (
          <button type="button" onClick={onLogoClick} className="shrink-0">
            {logo}
          </button>
        )}

        {children ? (
          <div className="flex items-center justify-end gap-4 sm:gap-6 lg:gap-8 min-w-0 shrink">
            {children}
          </div>
        ) : (
          <span className="w-0 shrink" aria-hidden />
        )}
      </div>
    </header>
  );
}
