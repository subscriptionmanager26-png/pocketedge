import React from 'react';
import { Briefcase } from 'lucide-react';

export default function LogoMark({ size = 'md', showWordmark = true, className = '' }) {
  const iconBox =
    size === 'sm'
      ? 'w-8 h-8 rounded-lg'
      : size === 'lg'
        ? 'w-10 h-10 rounded-xl'
        : 'w-9 h-9 rounded-lg';
  const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
  const wordSize = size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-lg' : 'text-xl';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`${iconBox} bg-neutral-900 flex items-center justify-center shrink-0`}>
        <Briefcase className={`${iconSize} text-white`} />
      </div>
      {showWordmark && (
        <span className={`${wordSize} font-display font-semibold tracking-tight text-pe-text`}>
          PocketEdge
        </span>
      )}
    </div>
  );
}
