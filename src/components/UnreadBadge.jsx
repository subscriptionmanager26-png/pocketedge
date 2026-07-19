/** Top-right badge for unread counts on engagement icons (comments, etc.). */
export default function UnreadBadge({ count }) {
  if (!count || count <= 0) return null;

  const label = count > 9 ? '9+' : String(count);

  return (
    <span
      className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pe-accent px-1 text-[9px] font-bold leading-none text-white ring-2 ring-pe-canvas"
      aria-label={`${count} unread`}
    >
      {label}
    </span>
  );
}
