import React from 'react';

const logoHeights = {
  sm: 'h-9',
  md: 'h-11',
  lg: 'h-12',
};

const wordSizes = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
};

export default function LogoMark({ size = 'md', showWordmark = true, className = '' }) {
  const heightClass = logoHeights[size] || logoHeights.md;
  const wordClass = wordSizes[size] || wordSizes.md;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/logo.png"
        alt=""
        aria-hidden
        className={`pe-logo-img ${heightClass} w-auto object-contain shrink-0`}
      />
      {showWordmark && (
        <span
          className={`${wordClass} font-display font-semibold tracking-tight text-pe-text`}
        >
          PocketEdge
        </span>
      )}
    </div>
  );
}
