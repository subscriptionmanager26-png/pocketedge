import Avatar from './Avatar';
import TickerText from './TickerText';
import { getPersonSync } from '../lib/socialIdentity';
import { timeAgo } from '../lib/format';

export default function CommentRow({ comment, onOpenProfile }) {
  const person = getPersonSync(comment.authorId);
  const openAuthor = () => onOpenProfile?.(comment.authorId);

  return (
    <div className="flex gap-2.5 border-b border-pe-border py-3 last:border-b-0">
      <Avatar person={person} size="sm" onClick={openAuthor} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            onClick={openAuthor}
            className="text-sm font-semibold text-pe-text hover:underline"
          >
            {person.name}
          </button>
          <span className="text-xs text-pe-text-muted">@{person.handle}</span>
          <span className="text-xs text-pe-text-muted">{timeAgo(comment.createdAt)}</span>
        </div>
        <TickerText
          text={comment.body}
          authorId={comment.authorId}
          className="mt-1.5 !font-sans !text-sm !leading-6"
        />
      </div>
    </div>
  );
}
