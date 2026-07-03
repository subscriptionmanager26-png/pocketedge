const PALETTE = [
  'from-emerald-500/30 to-emerald-700/40',
  'from-sky-500/30 to-sky-700/40',
  'from-violet-500/30 to-violet-700/40',
  'from-amber-500/30 to-amber-700/40',
  'from-rose-500/30 to-rose-700/40',
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
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-1 ring-white/10 ${sizes[size]} ${PALETTE[idx]} ${onClick ? 'cursor-pointer transition hover:ring-white/30' : ''} ${className}`}
      aria-label={person?.name}
    >
      {person?.avatar ?? person?.name?.[0] ?? '?'}
    </Tag>
  );
}
