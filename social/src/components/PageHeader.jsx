import { Search } from 'lucide-react';

/**
 * Fixed-height primary header for the middle column.
 * Desktop: 72px — matches the feed "For You / Following" row.
 * Mobile: 56px — sits below the shell bar (top-14), unless desktopOnly.
 */
export default function PageHeader({
  children,
  footer,
  className = '',
  desktopOnly = false,
}) {
  return (
    <header
      className={`sticky z-30 bg-pe-canvas/95 backdrop-blur-md md:top-0 ${
        desktopOnly ? 'top-0 hidden md:block' : 'top-14 md:top-0'
      } ${className}`}
    >
      <div className="border-b border-pe-border">
        <div className="flex h-14 items-center px-4 md:h-[72px]">{children}</div>
      </div>
      {footer}
    </header>
  );
}

/** Secondary row inside PageHeader — same height as the primary band. */
export function PageHeaderRow({ children, className = '' }) {
  return (
    <div className={`border-b border-pe-border ${className}`}>
      <div className="flex h-14 items-center px-4 md:h-[72px]">{children}</div>
    </div>
  );
}

/** Shared search field used in page headers (Search, Markets). */
export function PageHeaderSearch({ value, onChange, placeholder, autoFocus = false }) {
  return (
    <div className="flex h-11 w-full min-w-0 items-center gap-2.5 rounded-lg bg-pe-surface px-3.5 focus-within:ring-2 focus-within:ring-pe-accent md:h-12">
      <Search className="h-4 w-4 shrink-0 text-pe-text-muted" />
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full min-w-0 bg-transparent text-base text-pe-text outline-none placeholder:text-pe-text-muted md:text-[15px]"
      />
    </div>
  );
}
