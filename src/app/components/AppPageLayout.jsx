import React from 'react';

/** App page shell — left-aligned by default; opt into center for Challenge */
export default function AppPageLayout({
  children,
  className = '',
  narrow = false,
  center = false,
}) {
  return (
    <div
      className={`w-full space-y-5 ${narrow ? 'max-w-2xl' : 'max-w-6xl'} ${
        center ? 'mx-auto' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
