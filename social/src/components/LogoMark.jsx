const LOGO_HEIGHTS = {
  sm: 'h-7 w-7',
  md: 'h-11 w-auto',
  lg: 'h-12 w-auto',
};

const WORD_SIZES = {
  sm: 'text-[15px]',
  md: 'text-xl',
  lg: 'text-2xl',
};

/** PocketEdge logo — `sm` (28px) in app shell; `md` on marketing headers (matches main site). */
export default function LogoMark({
  size = 'sm',
  showWordmark = false,
  className = '',
}) {
  const heightClass = LOGO_HEIGHTS[size] ?? LOGO_HEIGHTS.sm;
  const wordClass = WORD_SIZES[size] ?? WORD_SIZES.sm;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/logo.png"
        alt=""
        aria-hidden
        width={size === 'sm' ? 28 : undefined}
        height={size === 'sm' ? 28 : undefined}
        className={`shrink-0 object-contain ${heightClass}`}
      />
      {showWordmark && (
        <span className={`${wordClass} font-display font-semibold tracking-tight text-pe-text`}>
          PocketEdge
        </span>
      )}
    </div>
  );
}
