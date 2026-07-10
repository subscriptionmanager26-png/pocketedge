import Avatar from './Avatar';
import TickerText from './TickerText';
import { primaryHoldingsLabel } from '../data/mockData';
import { getPersonSync } from '../lib/socialIdentity';
import { formatCount, formatPct, timeAgo } from '../lib/format';

export default function CommentRow({ comment, onOpenProfile }) {
  const person = getPersonSync(comment.authorId);
  const holdings = primaryHoldingsLabel(comment.authorId);
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
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              holdings === 'No position'
                ? 'bg-pe-surface text-pe-text-secondary'
                : 'bg-pe-positive/10 text-pe-positive'
            }`}
          >
            {holdings}
          </span>
          <span className="text-xs text-pe-text-muted">{timeAgo(comment.createdAt)}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-pe-text-secondary">
          <span className="font-semibold text-pe-positive">
            XIRR {formatPct(person.xirr, { signed: false })}
          </span>
          <span>·</span>
          <span>{formatCount(person.followers)} followers</span>
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
