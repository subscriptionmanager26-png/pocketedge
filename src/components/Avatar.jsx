const PALETTE = [
  'bg-[#fff0e8] text-[#c2410c]',
  'bg-[#eef4ff] text-[#1d4ed8]',
  'bg-[#f3eefc] text-[#6d28d9]',
  'bg-[#ecfdf3] text-[#15803d]',
  'bg-[#fef3c7] text-[#b45309]',
];

/** Substack feed avatars are 36px. */
export default function Avatar({ person, size = 'md', onClick, className = '' }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs', // 32px — comments / chrome
    md: 'h-9 w-9 text-sm', // 36px — feed posts
    lg: 'h-11 w-11 text-base', // 44px — profile chrome
    xl: 'h-16 w-16 text-xl md:h-[72px] md:w-[72px] md:text-2xl', // profile hero
  };
  const idx = (person?.name?.charCodeAt(0) ?? 0) % PALETTE.length;
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${sizes[size]} ${PALETTE[idx]} ${onClick ? 'cursor-pointer transition hover:opacity-90' : ''} ${className}`}
      aria-label={person?.name}
    >
      {person?.avatar ?? person?.name?.[0] ?? '?'}
    </Tag>
  );
}
