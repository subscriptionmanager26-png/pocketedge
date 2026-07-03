const PALETTE = [
  'from-emerald-500/40 to-emerald-800/50',
  'from-sky-500/40 to-sky-800/50',
  'from-violet-500/40 to-violet-800/50',
  'from-amber-500/40 to-amber-800/50',
  'from-rose-500/40 to-rose-800/50',
];

export default function Avatar({ person, size = 'md', onClick, className = '' }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  };
  const idx = (person?.name?.charCodeAt(0) ?? 0) % PALETTE.length;
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-1 ring-white/15 ${sizes[size]} ${PALETTE[idx]} ${onClick ? 'cursor-pointer transition hover:ring-white/35' : ''} ${className}`}
      aria-label={person?.name}
    >
      {person?.avatar ?? person?.name?.[0] ?? '?'}
    </Tag>
  );
}
