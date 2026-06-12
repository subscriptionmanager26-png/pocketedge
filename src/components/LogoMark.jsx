import React from 'react';

const heights = {
  sm: 'h-7',
  md: 'h-8',
  lg: 'h-9',
};

export default function LogoMark({ size = 'md', showWordmark = true, className = '' }) {
  const heightClass = heights[size] || heights.md;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src="/logo.png"
        alt="pocketedge"
        className={`${heightClass} w-auto object-contain shrink-0`}
      />
      {showWordmark && (
        <span className="text-lg sm:text-xl font-medium tracking-tight text-pe-text lowercase italic font-serif">
          pocketedge
        </span>
      )}
    </div>
  );
}
