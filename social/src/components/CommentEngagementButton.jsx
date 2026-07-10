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
        <MessageCircle className="h-4 w-4" />
        <UnreadBadge count={unreadCount} />
      </span>
      {!hasUnread ? formatCount(count) : null}
    </>
  );

  const baseClass = `inline-flex items-center gap-1.5 text-sm transition ${className}`;

  if (as === 'span') {
    return <span className={baseClass}>{inner}</span>;
  }

  return (
    <button type="button" onClick={onClick} className={`${baseClass} hover:text-pe-text`}>
      {inner}
    </button>
  );
}
