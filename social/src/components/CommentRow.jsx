import Avatar from './Avatar';
import TickerText from './TickerText';
import { getPerson, primaryHoldingsLabel } from '../data/mockData';
import { formatCount, formatPct, timeAgo } from '../lib/format';

export default function CommentRow({ comment }) {
  const person = getPerson(comment.authorId);
  const holdings = primaryHoldingsLabel(comment.authorId);

  return (
    <div className="flex gap-2.5 py-3">
      <Avatar person={person} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-pe-text">{person.name}</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              holdings === 'No position'
                ? 'bg-white/5 text-pe-text-muted'
                : 'bg-pe-positive/10 text-pe-positive'
            }`}
          >
            {holdings}
          </span>
          <span className="text-[11px] text-pe-text-muted">{timeAgo(comment.createdAt)}</span>
        </div>
        <div className="mt-0.5 flex gap-2 text-[11px] text-pe-text-muted">
          <span>XIRR {formatPct(person.xirr, { signed: false })}</span>
          <span>·</span>
          <span>{formatCount(person.followers)} followers</span>
        </div>
        <TickerText text={comment.body} authorId={comment.authorId} className="mt-1.5 text-sm" />
      </div>
    </div>
  );
}
