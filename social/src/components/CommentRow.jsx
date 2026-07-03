import Avatar from './Avatar';
import TickerText from './TickerText';
import { getPerson, primaryHoldingsLabel } from '../data/mockData';
import { formatCount, formatPct, timeAgo } from '../lib/format';

export default function CommentRow({ comment }) {
  const person = getPerson(comment.authorId);
  const holdings = primaryHoldingsLabel(comment.authorId);

  return (
    <div className="flex gap-2.5 border-b border-pe-border/70 py-3 last:border-b-0">
      <Avatar person={person} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-pe-text">{person.name}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              holdings === 'No position'
                ? 'bg-pe-elevated text-pe-text-secondary'
                : 'bg-pe-positive/12 text-pe-positive'
            }`}
          >
            {holdings}
          </span>
          <span className="text-xs text-pe-text-muted">{timeAgo(comment.createdAt)}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-pe-text-secondary">
          <span className="font-medium text-pe-positive">
            XIRR {formatPct(person.xirr, { signed: false })}
          </span>
          <span className="text-pe-text-muted">·</span>
          <span>{formatCount(person.followers)} followers</span>
        </div>
        <TickerText text={comment.body} authorId={comment.authorId} className="mt-1.5 text-sm leading-6" />
      </div>
    </div>
  );
}
