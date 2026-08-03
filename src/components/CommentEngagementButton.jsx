import { MessageCircle } from 'lucide-react';
import { formatCount } from '../lib/format';
import UnreadBadge from './UnreadBadge';

/**
 * Comment control with total count and optional unread badge on the icon (top-right).
 * When unread > 0, only the badge is shown (not total count) to avoid visual clutter.
 */
export default function CommentEngagementButton({
  count = 0,
  unreadCount = 0,
  onClick,
  as = 'button',
  className = '',
}) {
  const hasUnread = unreadCount > 0;
  const inner = (
    <>
      <span className="relative inline-flex shrink-0">
        <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2} />
        <UnreadBadge count={unreadCount} />
      </span>
      {!hasUnread ? formatCount(count) : null}
    </>
  );

  const baseClass = `inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition hover:bg-black/[0.04] ${className}`;

  if (as === 'span') {
    return <span className={baseClass}>{inner}</span>;
  }

  return (
    <button type="button" onClick={onClick} className={baseClass}>
      {inner}
    </button>
  );
}
