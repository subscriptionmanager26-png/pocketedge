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
