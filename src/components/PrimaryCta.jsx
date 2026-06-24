import React from 'react';
import { isRedesignThemeActive } from '../redesignFlags';

const SIZES = {
  sm: {
    redesign: 'px-4 py-2 text-xs',
    default: 'px-4 py-2 text-xs',
  },
  md: {
    redesign: 'px-6 py-2.5 text-sm',
    default: 'px-6 py-3 text-sm',
  },
  lg: {
    redesign: 'px-8 py-3.5 text-sm',
    default: 'px-8 py-3.5 text-base h-14',
  },
};

/** Primary CTA — white pill + glow in redesign; dark pill in default theme. */
export function primaryCtaClasses({ size = 'md', fullWidth = false, className = '' } = {}) {
  const redesign = isRedesignThemeActive();
  const sizeClass = SIZES[size]?.[redesign ? 'redesign' : 'default'] ?? SIZES.md.md;

  if (redesign) {
    return [
      'pe-redesign-cta inline-flex items-center justify-center gap-2 font-semibold transition-all',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30',
      'disabled:opacity-50 disabled:pointer-events-none disabled:grayscale',
      sizeClass,
      fullWidth ? 'w-full' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');
  }

  return [
    'pe-btn-primary inline-flex items-center justify-center gap-2 font-semibold transition-all rounded-full',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400/50',
    'disabled:opacity-50 disabled:pointer-events-none',
    sizeClass,
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

export default function PrimaryCta({
  children,
  size = 'md',
  fullWidth = false,
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={primaryCtaClasses({ size, fullWidth, className })}
      {...props}
    >
      {children}
    </button>
  );
}
